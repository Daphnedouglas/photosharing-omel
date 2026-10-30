import { Link } from "react-router-dom";
import "../../styles/onboarding.css";

export const meta = {
  group: "Onboarding",
  title: "Onboarding 2 · Share the moment",
  path: "/onboarding/share",
  href: "/onboarding/share",
  flow: "Onboarding 2 → Onboarding 3",
  file: "frontend/src/pages/onboarding/ShareMomentPage.jsx",
  api: null,
  shell: false,
  design: "design/onboarding-2.png",
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

function Spark({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5 13.6 10.4 21.5 12 13.6 13.6 12 21.5 10.4 13.6 2.5 12 10.4 10.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function ShareMomentPage() {
  return (
    <div className="moment">
      <header className="moment__nav">
        <Link to="/onboarding/clowder" className="brand">
          omel <span className="brand__dot" />
        </Link>
        <div className="account">
          <Link to="/login" className="account__login">
            Log in
          </Link>
          <Link to="/signup" className="pill pill--dark">
            Get started
          </Link>
        </div>
      </header>

      <main className="moment__stage">
        <section className="moment__stack">
          <img
            src="/onboarding/stack.png"
            alt="A photo shared by Mimi. An orange cat in a silk scarf, captioned Sunday brunch, darling. Le Marais, Paris. Six whispers, 18 likes."
          />
        </section>

        <section className="moment__copy">
          <Spark className="moment__spark" />
          <p className="step">
            <span aria-hidden="true">✦</span> STEP 02 · INTIMATE MOMENTS
          </p>
          <h1>
            Share the <em>moment.</em>
          </h1>
          <p className="lede">
            Upload in seconds and tag it so your friends can find it later.
            Curate quiet circles, shared albums, and spontaneous afternoon
            whispers.
          </p>
          <div className="feature">
            <span className="feature__icon" aria-hidden="true">
              ✦
            </span>
            <p>
              <strong>Instant Auto-Tagging</strong>
              <span>Smart feline recognition & circle indexing</span>
            </p>
          </div>
          <div className="pager" aria-label="Step 2 of 3">
            <span className="pager__dot" />
            <span className="pager__bar" />
            <span className="pager__dot" />
            <span>02 OF 03</span>
          </div>
          <div className="moment__actions">
            <Link to="/onboarding/clowder" className="pill pill--ghost">
              Back
            </Link>
            <Link to="/onboarding/next" className="pill pill--dark pill--wide">
              Continue <Arrow />
            </Link>
          </div>
        </section>
      </main>

      <footer className="moment__foot">
        <span className="moment__edition">— OMEL SALON EDITORIAL EDITION</span>
        <nav className="moment__links" aria-label="Legal">
          <span>Privacy</span>
          <span>Terms of salon</span>
          <span>© 2025</span>
        </nav>
      </footer>
    </div>
  );
}
