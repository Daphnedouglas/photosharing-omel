import { Link } from "react-router-dom";
import GalleryHero from "./gallery/GalleryHero";
import PhoneBubbles from "./PhoneBubbles";
import "../../styles/landing.css";

const steps = [
  {
    n: "1",
    title: "Gather your clowder",
    copy: "The photographs stay with the people who know them. One private room, not a public feed.",
  },
  {
    n: "2",
    title: "Share the moment",
    copy: "A picture leaves the camera and lands with your friends, including the ones who missed the room.",
  },
  {
    n: "3",
    title: "Spill the tea",
    copy: "A comment sits on the photo, so the story stays with the picture instead of drifting off.",
  },
];

export const meta = {
  group: "Onboarding",
  title: "Landing",
  path: "/",
  href: "/",
  flow: "Landing → Sign up or Log in. The feed lives at /home.",
  file: "frontend/src/pages/onboarding/LandingPage.jsx",
  api: null,
  shell: false,
  design: "design/onboarding-1.png",
};

export default function LandingPage() {
  return (
    <main className="landing">
      <GalleryHero>
        <nav className="landing__nav" aria-label="Landing">
          <Link to="/" className="landing__logo">
            <img className="landing__mark" src="/onboarding/caticon.png" alt="" width="42" height="42" />
            omel
          </Link>
          <div className="landing__links">
            <a href="#memories">Memories</a>
            <a href="#how">How it works</a>
          </div>
          <Link to="/login" className="landing__login">
            Log in
          </Link>
        </nav>
      </GalleryHero>

      <section id="memories" className="landing__share">
        <PhoneBubbles>
          <div className="phone" aria-hidden="true">
            <div className="phone__screen">
              <img src="/gallery/pin10.jpg" alt="" />
              <span className="phone__island" />
              <div className="phone__caption">
                <p>Getting my Vitamin D</p>
                <span>Mimi replied to the post : Cute!</span>
              </div>
            </div>
          </div>
        </PhoneBubbles>
        <div className="landing__share-copy">
          <h2>Share your memories with friends</h2>
          <p>Pass a photograph to the people who were there. They answer on the picture, not in a separate thread.</p>
          <Link className="landing__share-btn" to="/signup">
            Share a moment
          </Link>
          <a className="landing__more" href="#how">
            See how it works
          </a>
        </div>
      </section>

      <section id="how" className="landing__how">
        <h2>How it works</h2>
        <ol>
          {steps.map((step) => (
            <li key={step.n}>
              <span>{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
