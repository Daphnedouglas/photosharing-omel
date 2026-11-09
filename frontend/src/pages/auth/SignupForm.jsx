import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { register } from "../../api/users";
import { authConfig } from "./config";
import { ArrowIcon, CheckIcon, EyeIcon } from "./icons";

function passwordMeter(value) {
  const ready = value.length >= 8 && /\d/.test(value);
  if (!value) return { width: "0%", label: "" };
  if (ready) return { width: "58%", label: "Medium" };
  return { width: "24%", label: "" };
}

function looksLikeEmail(value) {
  return /.+@.+\..+/.test(value.trim());
}

const copy = authConfig.signup;

export default function SignupForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromLogin = location.state || {};
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(() => String(fromLogin.presetEmail || ""));
  const [emailTouched, setEmailTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [loginNotice] = useState(() => String(fromLogin.notice || ""));
  const meter = passwordMeter(password);
  const emailValid = looksLikeEmail(email);
  const passwordReady = password.length >= 8 && /\d/.test(password);
  const confirmReady = confirm.length > 0 && confirm === password;
  const emailError = formError === copy.errors.email || (emailTouched && email.length > 0 && !emailValid);
  const confirmError = formError === copy.errors.confirm || (confirm.length > 0 && confirm !== password);

  async function onSubmit(event) {
    event.preventDefault();
    if (!looksLikeEmail(email.trim())) {
      setFormError(copy.errors.email);
      return;
    }
    if (!(password.length >= 8 && /\d/.test(password))) {
      setFormError(copy.errors.password);
      return;
    }
    if (password !== confirm) {
      setFormError(copy.errors.confirm);
      return;
    }
    if (!agreed) {
      setFormError(copy.errors.terms);
      return;
    }
    setFormError("");
    setPending(true);
    try {
      await register({
        fullName: name.trim(),
        displayName: name.trim(),
        username: username.trim().replace(/^@/, ""),
        email: email.trim(),
        password,
      });
      navigate("/home");
    } catch (error) {
      setFormError(error?.message || "Could not create your account.");
      setPending(false);
    }
  }

  return (
    <form className="auth__fields auth__fields--signup" onSubmit={onSubmit} noValidate>
      <p className="museum-label">{copy.eyebrow}</p>
      <h1>{copy.heading}</h1>
      <p className="auth__sub">{copy.sub}</p>
      {loginNotice ? (
        <p className="auth__alert" role="status">
          <strong>{loginNotice}</strong>
        </p>
      ) : null}

      <div className="auth__pair">
        <div>
          <label htmlFor="signup-name">{copy.name}</label>
          <div className={`auth__field${name.trim() ? " is-ok" : ""}`}>
            <input
              id="signup-name"
              name="name"
              autoComplete="name"
              placeholder={copy.namePlaceholder}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            {name.trim() ? <CheckIcon /> : null}
          </div>
        </div>
        <div>
          <label htmlFor="signup-username">{copy.username}</label>
          <div className={`auth__field${username.trim() ? " is-ok" : ""}`}>
            <input
              id="signup-username"
              name="username"
              autoComplete="username"
              placeholder={copy.usernamePlaceholder}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
            {username.trim() ? <CheckIcon /> : null}
          </div>
        </div>
      </div>

      <label htmlFor="signup-email">{copy.email}</label>
      <div className={`auth__field${emailError ? " is-error" : ""}${emailValid ? " is-ok" : ""}`}>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={copy.emailPlaceholder}
          value={email}
          aria-invalid={emailError}
          onBlur={() => setEmailTouched(true)}
          onChange={(event) => {
            setEmail(event.target.value);
            setFormError("");
          }}
          required
        />
        {emailValid ? <CheckIcon /> : null}
      </div>

      <label htmlFor="signup-password">{copy.password}</label>
      <div className={`auth__field${formError === copy.errors.password ? " is-error" : ""}${passwordReady ? " is-ok" : ""}`}>
        <input
          id="signup-password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder={copy.passwordPlaceholder}
          value={password}
          aria-invalid={formError === copy.errors.password}
          onChange={(event) => {
            setPassword(event.target.value);
            setFormError("");
          }}
          required
        />
        {passwordReady ? <CheckIcon /> : null}
        <button
          className="auth__eye"
          type="button"
          aria-label={showPassword ? "Hide password" : "Show password"}
          onClick={() => setShowPassword((value) => !value)}
        >
          <EyeIcon />
        </button>
      </div>
      <div className={`auth__strength${password ? " is-live" : ""}`}>
        <span className="auth__strength-bar">
          <i className={passwordReady ? "is-ready" : ""} style={{ width: meter.width }} />
        </span>
        <span>{copy.rule}</span>
        <span>{meter.label}</span>
      </div>

      <label htmlFor="signup-confirm">{copy.confirm}</label>
      <div className={`auth__field${confirmError ? " is-error" : ""}${confirmReady ? " is-ok" : ""}`}>
        <input
          id="signup-confirm"
          name="confirm"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder={copy.confirmPlaceholder}
          value={confirm}
          aria-invalid={confirmError}
          onChange={(event) => {
            setConfirm(event.target.value);
            setFormError("");
          }}
          required
        />
        {confirmReady ? <CheckIcon /> : null}
      </div>

      {formError ? (
        <p className="auth__alert" role="alert">
          <strong>{formError}</strong>
        </p>
      ) : null}

      <div className="auth__row">
        <label className={`auth__check${formError === copy.errors.terms ? " is-error" : ""}`}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => {
              setAgreed(event.target.checked);
              setFormError("");
            }}
          />
          {copy.terms}
        </label>
      </div>

      <button className="auth__submit" type="submit" disabled={pending}>
        {pending ? copy.pending : copy.submit}
        {pending ? null : <ArrowIcon />}
      </button>
      <p className="auth__switch">
        {copy.switchLead} <Link to={copy.switchTo}>{copy.switchLink}</Link>
      </p>
    </form>
  );
}
