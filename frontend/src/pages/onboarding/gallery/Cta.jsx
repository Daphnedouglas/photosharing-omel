import { Link } from "react-router-dom";
import { gallery } from "./config";

export default function Cta() {
  return (
    <Link className="gallery__cta" to="/signup">
      {gallery.copy.cta}
    </Link>
  );
}
