/**
 * Step 3 turns automatic rotation on.
 * The viewer already calls restart() whenever the photo changes by hand.
 */
export const ROTATION_MS = 5000;

export function createRotation() {
  return {
    playing: false,
    start() {},
    stop() {},
    restart() {},
    toggle() {},
  };
}
