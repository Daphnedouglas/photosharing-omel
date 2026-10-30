import { Link } from "react-router-dom";
import "../../styles/onboarding.css";

export const meta = {
  group: "Onboarding",
  title: "Onboarding 3 · Spill the tea",
  path: "/onboarding/next",
  href: "/onboarding/next",
  flow: "Onboarding 3 → Login",
  file: "frontend/src/pages/onboarding/OnboardingThreePage.jsx",
  api: null,
  shell: false,
  design: "design/onboarding-3.png",
};

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M2.5 8h11M9 3.5 13.5 8 9 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function OnboardingThreePage() {
  return (
    <div className="tea">
      <header className="salon__bar">
        <div className="tea__brand">
          <Link to="/onboarding/clowder" className="brand">
            omel.
          </Link>
          <span className="tea__volume">PRIVATE CIRCLE · 03</span>
        </div>
        <div className="account">
          <Link to="/login" className="account__login">
            Log in
          </Link>
          <Link to="/signup" className="pill pill--dark">
            Get started
          </Link>
        </div>
      </header>

      <main className="tea__stage">
        <section>
          <p className="kicker">
            <span aria-hidden="true">●</span> ONBOARDING 03 / 03
          </p>
          <h1>Spill the tea.</h1>
          <p className="lede">
            Comment, react and search through every memory together. Unfiltered
            reflections for your most trusted inner sanctum.
          </p>
          <div className="tea__chips">
            <span>End-to-end safe</span>
            <span>Private reaction tags</span>
          </div>
          <div className="tea__row">
            <Link to="/login" className="pill pill--dark">
              Get started <Arrow />
            </Link>
            <div className="pager" aria-label="Step 3 of 3">
              <span className="pager__dot" />
              <span className="pager__dot" />
              <span className="pager__bar" />
            </div>
          </div>
        </section>

        <section className="tea__visual">
          <img
            src="/onboarding/tea.png"
            alt="A black cat in oval glasses, with notes from Coco, Barnaby, and Marmaduke."
          />
        </section>
      </main>

      <footer className="tea__foot">
        <span>© Omel Inc. Crafted for intimate circles.</span>
        <nav className="tea__legal" aria-label="Legal">
          <span>Privacy</span>
          <span>Terms</span>
        </nav>
        <span>● Editorial Companion No. 3</span>
      </footer>
    </div>
  );
}
