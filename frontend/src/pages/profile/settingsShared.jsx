export function Switch({ id, checked, onChange, labelledBy, describedBy }) {
  const on = Boolean(checked);
  return (
    <button
      id={id}
      type="button"
      className="settings__switch"
      role="switch"
      aria-checked={on ? "true" : "false"}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onChange(!on);
      }}
    >
      <span aria-hidden="true" />
    </button>
  );
}

export function SettingRow({ id, label, help, error, stack = false, children }) {
  const labelId = `${id}-label`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  return (
    <div className={stack ? "settings__row settings__row--stack" : "settings__row"}>
      <div className="settings__copy">
        <p className="settings__label" id={labelId}>{label}</p>
        {help ? <p className="settings__help" id={helpId}>{help}</p> : null}
        {error ? <p className="settings__error" id={errorId} role="alert">{error}</p> : null}
      </div>
      <div className="settings__control">
        {typeof children === "function"
          ? children({ labelId, helpId: help ? helpId : undefined, errorId: error ? errorId : undefined })
          : children}
      </div>
    </div>
  );
}

export function profileDraftFrom(user) {
  return {
    displayName: user.displayName || "",
    username: user.username || "",
    bio: user.bio || "",
    location: user.location || "",
  };
}

export function accountDraftFrom(user) {
  return {
    fullName: user.fullName || "",
    email: user.email || "",
  };
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("That photo couldn't be read."));
    reader.readAsDataURL(file);
  });
}
