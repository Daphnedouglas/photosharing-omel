import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import PhotoStrip from "./PhotoStrip";
import PrintCamera from "./PrintCamera";
import FinishedStripView from "./FinishedStripView";
import {
  PRINT,
  prefersReducedMotion,
  printAnimEnabled,
  printDebug,
  printDebugEnabled,
} from "./printConfig";
import {
  buildPrintKeyframes,
  developDelayMs,
  printStepCount,
  printTotalMs,
} from "./printKeyframes";

const DESIGN_W = 600;
const DEFAULT_SCALE = 0.32;

export default function PrintStage({
  strip,
  savePromise = null,
  onComplete,
  onSaved,
  onFailed,
  onRetry,
  onCreateAnother,
  onDownload,
  viewHref,
  showFinaleActions = false,
}) {
  const uid = useId().replace(/:/g, "");
  const boxRef = useRef(null);
  const stripRef = useRef(null);
  const stageRef = useRef(null);
  const saveRef = useRef({ done: false, ok: false, error: null, result: null });
  const animDoneRef = useRef(false);
  const finishedRef = useRef(false);
  const completedRef = useRef(false);

  const [runId, setRunId] = useState(0);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [animDone, setAnimDone] = useState(false);
  const [saveDone, setSaveDone] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [savedStrip, setSavedStrip] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Printing your strip…");
  const [light, setLight] = useState("idle");
  const [phase, setPhase] = useState("printing");
  const [forceStatic, setForceStatic] = useState(false);
  const [metrics, setMetrics] = useState({ sw: 0, sh: 0, bh: 0, designH: 0, strips: 0 });

  const debug = printDebugEnabled();
  const reduced = prefersReducedMotion() || !printAnimEnabled() || forceStatic;
  const steps = printStepCount(strip);
  const totalMs = printTotalMs(steps);
  const animId = `${uid}-${runId}`;
  const keyframes = buildPrintKeyframes(animId, steps);
  const finalStrip = savedStrip || strip;

  useLayoutEffect(() => {
    if (phase === "done" || phase === "error") return undefined;
    const stage = stageRef.current;
    const stripNode = stripRef.current;
    if (!stage) return undefined;

    function measure() {
      const design = stripNode?.querySelector(".print-stage__design");
      const designH = design?.offsetHeight || 0;
      const cameraH = stage.querySelector(".print-stage__camera")?.getBoundingClientRect().height || 0;
      const availH = Math.max(0, stage.clientHeight - cameraH - 24);
      const availW = Math.max(0, stage.clientWidth - 16);
      let next = DEFAULT_SCALE;
      if (designH > 0 && availH > 0) {
        const byH = availH / designH;
        const byW = availW > 0 ? availW / DESIGN_W : DEFAULT_SCALE;
        const computed = Math.min(byH, byW, 1);
        if (Number.isFinite(computed) && computed > 0) next = computed;
      }
      setScale(next);
      setMetrics({
        sw: stripNode?.offsetWidth || 0,
        sh: stripNode?.offsetHeight || 0,
        bh: boxRef.current?.offsetHeight || 0,
        designH,
        strips: document.querySelectorAll("[data-photo-strip]").length,
      });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    if (stripNode) observer.observe(stripNode);
    return () => observer.disconnect();
  }, [runId, strip?.layout, strip?.color, strip?.photos?.length, forceStatic, phase]);

  useEffect(() => {
    saveRef.current = { done: false, ok: false, error: null, result: null };
    setSaveDone(false);
    setSaveOk(false);
    setSavedStrip(null);
    setError("");
    finishedRef.current = false;
    completedRef.current = false;

    if (savePromise) {
      savePromise.then(
        (result) => {
          saveRef.current = { done: true, ok: true, error: null, result };
          setSavedStrip(result);
          setSaveDone(true);
          setSaveOk(true);
          onSaved?.(result);
        },
        (err) => {
          saveRef.current = { done: true, ok: false, error: err, result: null };
          setSaveDone(true);
          setSaveOk(false);
        },
      );
    } else {
      saveRef.current = { done: true, ok: true, error: null, result: strip };
      setSavedStrip(strip);
      setSaveDone(true);
      setSaveOk(true);
    }
  }, [runId, savePromise, strip]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    animDoneRef.current = false;
    setAnimDone(false);
    setStatus("Printing your strip…");
    setLight("idle");
    setError("");

    if (reduced) {
      setPhase(forceStatic ? "static" : "reduced");
      const timer = window.setTimeout(() => markAnimDone(), forceStatic ? 0 : PRINT.reducedFadeMs);
      return () => window.clearTimeout(timer);
    }

    setPhase("printing");

    const guard = window.setTimeout(() => {
      const sh = stripRef.current?.offsetHeight || 0;
      const bh = boxRef.current?.offsetHeight || 0;
      if (sh < 1 || bh < 1) {
        // eslint-disable-next-line no-console
        console.error("[print] Strip or box height is 0 — showing static strip.", { sh, bh });
        setForceStatic(true);
        markAnimDone();
      }
    }, 120);

    const fallback = window.setTimeout(() => markAnimDone(), totalMs + 800);

    return () => {
      window.clearTimeout(guard);
      window.clearTimeout(fallback);
    };
  }, [runId, reduced, forceStatic, totalMs]); // eslint-disable-line react-hooks/exhaustive-deps

  function markAnimDone() {
    if (animDoneRef.current) return;
    animDoneRef.current = true;
    setAnimDone(true);
  }

  function onStripAnimationEnd(event) {
    if (event.target !== stripRef.current) return;
    if (!String(event.animationName || "").includes(`print-slide-${animId}`)) return;
    markAnimDone();
  }

  useEffect(() => {
    if (finishedRef.current) return undefined;
    if (!animDone) return undefined;

    if (!saveDone) {
      setPhase("waiting");
      setStatus("Finishing…");
      setLight("wait");
      const timeout = window.setTimeout(() => {
        if (finishedRef.current) return;
        saveRef.current = {
          done: true,
          ok: false,
          error: new Error("We couldn't create your strip. Please try again."),
          result: null,
        };
        setSaveDone(true);
        setSaveOk(false);
      }, PRINT.timeoutMs);
      return () => window.clearTimeout(timeout);
    }

    if (!saveOk) {
      finishedRef.current = true;
      setPhase("error");
      setError(saveRef.current.error?.message || "We couldn't create your strip. Please try again.");
      setStatus("");
      setLight("idle");
      onFailed?.(saveRef.current.error);
      return undefined;
    }

    const waitMin = reduced ? Math.max(0, PRINT.minMs - PRINT.reducedFadeMs) : 0;
    const timer = window.setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const result = saveRef.current.result || strip;
      setPhase("done");
      setStatus("Your strip is ready.");
      setLight("ready");
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.(result);
      }
    }, waitMin);
    return () => window.clearTimeout(timer);
  }, [animDone, saveDone, saveOk, reduced, strip, onComplete, onFailed]);

  function skip() {
    setForceStatic(true);
    markAnimDone();
    if (!saveRef.current.done && !savePromise) {
      saveRef.current = { done: true, ok: true, error: null, result: strip };
      setSaveDone(true);
      setSaveOk(true);
    }
  }

  function replayNow() {
    setForceStatic(false);
    setRunId((value) => value + 1);
  }

  // Animation finished successfully → unmount print chrome entirely.
  // Parent create flow switches to success; replay/dev keep a finished view here.
  if (phase === "done" && saveOk) {
    if (!showFinaleActions) return null;
    return (
      <FinishedStripView
        strip={finalStrip}
        viewHref={viewHref}
        onDownload={onDownload}
        onCreateAnother={onCreateAnother}
        onReplay={replayNow}
      />
    );
  }

  const slideName = `print-slide-${animId}`;
  const flashName = `print-flash-${animId}`;
  const shakeName = `print-shake-${animId}`;
  const animating = phase === "printing" && !reduced;
  const retracting = phase === "error";

  printDebug("run", { steps, totalMs, scale, animId, reduced, forceStatic, phase });

  return (
    <div className={["print-stage", phase === "error" ? "is-error" : "", debug ? "is-debug" : ""].join(" ")}>
      <style>{keyframes.css}</style>

      <div className="print-stage__panel">
        <div ref={stageRef} className="print-stage__scene">
          <div
            className="print-stage__camera"
            style={{
              animation: animating ? `${shakeName} ${totalMs}ms linear forwards` : undefined,
            }}
          >
            <PrintCamera light={light} />
            {animating ? (
              <span
                className="print-stage__flash-layer"
                style={{ animation: `${flashName} ${totalMs}ms linear forwards` }}
                aria-hidden="true"
              />
            ) : null}
          </div>

          <div
            ref={boxRef}
            className={["print-stage__box", debug ? "is-debug" : ""].filter(Boolean).join(" ")}
            style={{ "--s": String(scale || DEFAULT_SCALE) }}
          >
            <div
              key={animId}
              ref={stripRef}
              className={[
                "print-stage__strip-slide",
                debug ? "is-debug" : "",
                phase === "reduced" ? "is-reduced" : "",
                forceStatic || phase === "static" || phase === "waiting" ? "is-shown" : "",
                retracting ? "is-retract" : "",
              ].filter(Boolean).join(" ")}
              style={{
                "--total": `${totalMs}ms`,
                "--dev-header": `${developDelayMs(1, steps)}ms`,
                "--dev-footer": `${developDelayMs(steps, steps)}ms`,
                animation: animating
                  ? `${slideName} ${totalMs}ms linear forwards`
                  : retracting
                    ? `print-retract 600ms ease-in forwards`
                    : undefined,
                ...Object.fromEntries(
                  Array.from({ length: 6 }, (_, index) => [
                    `--dev-${index + 1}`,
                    `${developDelayMs(Math.min(index + 1, steps), steps)}ms`,
                  ]),
                ),
              }}
              onAnimationEnd={onStripAnimationEnd}
            >
              <div className="print-stage__zoom" style={{ zoom: scale }}>
                <div className="print-stage__design" style={{ width: DESIGN_W }}>
                  <PhotoStrip strip={strip} preview printMarks />
                </div>
              </div>
            </div>
          </div>

          {debug ? (
            <pre className="print-stage__debug">
              {`state ${phase}\n`}
              {`S ${steps}  total ${totalMs}ms\n`}
              {`--s ${scale.toFixed(3)}\n`}
              {`strip ${metrics.sw}×${metrics.sh}\n`}
              {`designH ${metrics.designH}  box h ${metrics.bh}\n`}
              {`strips in DOM: ${metrics.strips}\n`}
              {`animDone ${animDone} save ${saveDone}/${saveOk}`}
            </pre>
          ) : null}

          {phase === "error" ? (
            <div className="print-stage__error" role="alert">
              <p>{error || "We couldn't create your strip. Please try again."}</p>
              <button type="button" className="print-stage__primary" onClick={onRetry}>Try again</button>
            </div>
          ) : null}
        </div>

        <p className="print-stage__status" role="status" aria-live="polite">{status}</p>
        <div className="print-stage__toolbar">
          {phase !== "error" ? (
            <button type="button" className="print-stage__skip" onClick={skip}>Skip</button>
          ) : null}
          {debug && import.meta.env.DEV ? (
            <button
              type="button"
              className="print-stage__skip"
              onClick={() => { setForceStatic(true); markAnimDone(); }}
            >
              Show static strip
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
