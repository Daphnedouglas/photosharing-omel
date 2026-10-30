import { Link } from "react-router-dom";
import "../../styles/onboarding.css";

export const meta = {
  group: "Onboarding",
  title: "Onboarding 1 · Your clowder, in one place",
  path: "/onboarding/clowder",
  href: "/onboarding/clowder",
  flow: "Onboarding 1 → Onboarding 2",
  file: "frontend/src/pages/onboarding/ClowderPage.jsx",
  api: null,
  shell: false,
  design: "design/onboarding-1.png",
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

function Paw({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6.5" cy="8" r="2" fill="currentColor" />
      <circle cx="12" cy="5.5" r="2" fill="currentColor" />
      <circle cx="17.5" cy="8" r="2" fill="currentColor" />
      <path
        d="M8.2 13.2c.2-1.6 1.6-2.6 3.8-2.6s3.6 1 3.8 2.6c.2 2.4-1.5 5-3.8 5s-4-2.6-3.8-5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function ClowderPage() {
  return (
    <div className="salon">
      <header className="salon__bar">
        <Link to="/onboarding/clowder" className="brand">
          omel
          <Paw className="brand__mark" />
          <span className="brand__salon">SALON</span>
        </Link>
        <div className="account">
          <Link to="/login" className="account__login">
            Log in
          </Link>
          <Link to="/signup" className="pill pill--dark">
            Get started <Arrow />
          </Link>
        </div>
      </header>

      <main className="salon__stage">
        <section>
          <p className="kicker">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3.5" y="7" width="9" height="6.5" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            PRIVATE CIRCLE • VOLUME I
          </p>
          <h1>
            Your clowder,
            <br />
            <em>in one place.</em>
          </h1>
          <p className="lede">
            Share photos privately with the friends who matter. No strangers, no
            noise. Only your innermost inner circle.
            <Paw className="lede__paw" />
          </p>
          <div className="pager" aria-label="Step 1 of 3">
            <span className="pager__bar" />
            <span className="pager__dot" />
            <span className="pager__dot" />
            <span>01 / 03</span>
          </div>
          <div className="salon__cta">
            <Link to="/onboarding/share" className="pill pill--dark">
              Continue <Arrow />
            </Link>
            <Link to="/login" className="skip">
              Skip
            </Link>
          </div>
          <p className="curators">
            <span className="faces" aria-hidden="true">
              <span>M</span>
              <span>C</span>
              <span>V</span>
            </span>
            Curated with 1,400+ intimate feline salons
          </p>
        </section>

        <section className="salon__collage">
          <img
            src="/onboarding/collage.png"
            alt="Portraits from the salon: Duchess Cleo, a black cat in glasses, Giselle in pearls, Bartholomew in a silk scarf, and a grey cat."
          />
        </section>
      </main>

      <footer className="salon__foot">
        <span>© Omel Social Salon • By Invitation Only</span>
        <span>End-to-End Encrypted Feeds</span>
        <nav className="salon__links" aria-label="Salon">
          <span>Salon Etiquette</span>
          <span>Privacy charter</span>
          <span>Curators</span>
        </nav>
      </footer>
    </div>
  );
}
