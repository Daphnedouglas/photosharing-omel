import { forwardRef } from "react";

const Wall = forwardRef(function Wall(_, ref) {
  return (
    <div ref={ref} className="gallery__track gallery__wall" aria-hidden="true">
      <div className="gallery__damask" />
      <div className="gallery__floor" />
    </div>
  );
});

export default Wall;
