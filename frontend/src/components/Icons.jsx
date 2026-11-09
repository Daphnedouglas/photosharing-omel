export function Icon({ name }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
      {marks[name]}
    </svg>
  );
}

const marks = {
  heart: (
    <path
      d="M12 19.2s-6.4-3.9-8.4-7.4C1.8 8.6 3 5.6 6 5c1.7-.4 3.2.4 4 1.8.8-1.4 2.3-2.2 4-1.8 3 .6 4.2 3.6 2.4 6.8-2 3.5-8.4 7.4-8.4 7.4Z"
      fill="currentColor"
    />
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" />
    </>
  ),
  arrowLeft: (
    <path d="M19 12H6M10 7l-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  ),
  arrowRight: (
    <path d="M5 12h13M14 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  ),
  bow: (
    <>
      <path d="M12 12c-1.6-4.2-6.6-4.4-8-.4 1.4 3.2 4.6 3.2 8 .4Z" fill="currentColor" />
      <path d="M12 12c1.6-4.2 6.6-4.4 8-.4-1.4 3.2-4.6 3.2-8 .4Z" fill="currentColor" />
      <path d="M12 12c-.6 2.4-.8 4.6-2.4 7.2M12 12c.6 2.4.8 4.6 2.4 7.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  shades: (
    <>
      <rect x="2.2" y="8" width="8" height="6.2" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13.8" y="8" width="8" height="6.2" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.2 11h3.6M4 9.2 6.2 6.8M20 9.2 17.8 6.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  spark: (
    <path d="M12 2.4 13.7 10.3 21.6 12 13.7 13.7 12 21.6 10.3 13.7 2.4 12 10.3 10.3Z" fill="currentColor" />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  friends: (
    <>
      <circle cx="9" cy="9" r="2.2" fill="currentColor" />
      <circle cx="16" cy="10" r="1.8" fill="currentColor" />
      <path d="M4.8 18.2c.4-2.6 2.2-4 4.2-4s3.8 1.4 4.2 4M14 14.4c1.3-.3 2.6.2 3.2 1.3.6 1.2.6 2.5.4 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  folder: (
    <path d="M3.5 8.2c0-.8.7-1.5 1.5-1.5h4l1.6 1.6H19c.8 0 1.5.7 1.5 1.5v7.2c0 .8-.7 1.5-1.5 1.5H5c-.8 0-1.5-.7-1.5-1.5V8.2Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  ),
  lock: (
    <>
      <rect x="6" y="10.5" width="12" height="8.5" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.5 10.5V8.2a3.5 3.5 0 0 1 7 0v2.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  strip: (
    <>
      <rect x="7" y="3.5" width="10" height="4.2" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="7" y="9.9" width="10" height="4.2" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="7" y="16.3" width="10" height="4.2" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
};
