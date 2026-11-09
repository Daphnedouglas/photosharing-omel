import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { passwordResetConfig } from "../../api/passwordResetConfig";
import { login } from "../../api/users";
import { authConfig } from "./config";
import { ArrowIcon, CheckIcon, EyeIcon } from "./icons";

const copy = authConfig.login;

export default function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [passwordWrong, setPasswordWrong] = useState(false);
  const [pending, setPending] = useState(false);
  const passwordReady = password.length > 0 && !passwordWrong;

  async function onSubmit(event) {
    event.preventDefault();
    setPending(true);
    setPasswordWrong(false);
    try {
      await login({ identifier: email, password });
      navigate("/home");
    } catch (error) {
      const status = error?.status || error?.statusCode;
      if (status === 404) {
        navigate("/signup", {
          replace: true,
          state: {
            presetEmail: email.trim(),
            notice: "No account found. Create one to join Omel.",
          },
        });
        return;
      }
      setPasswordWrong(true);
      setPending(false);
    }
  }

  return (
    <form className="auth__fields" onSubmit={onSubmit} noValidate>
      <p className="museum-label">{copy.eyebrow}</p>
      <h1>
        {copy.headingLead} <em>{copy.headingEm}</em>.
      </h1>
      <p className="auth__sub">{copy.sub}</p>

      <label htmlFor="login-email">{copy.email}</label>
      <div className="auth__field">
        <input
          id="login-email"
          name="email"
          type="text"
          autoComplete="username"
          placeholder={copy.emailPlaceholder}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setPasswordWrong(false);
          }}
          required
        />
      </div>

      <label htmlFor="login-password">{copy.password}</label>
      <div className={`auth__field${passwordWrong ? " is-error" : ""}${passwordReady ? " is-ok" : ""}`}>
        <input
          id="login-password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder={copy.passwordPlaceholder}
          value={password}
          aria-invalid={passwordWrong}
          onChange={(event) => {
            setPassword(event.target.value);
            setPasswordWrong(false);
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
      {passwordWrong ? (
        <p className="auth__alert" role="alert">
          <strong>{copy.passwordError}</strong>
        </p>
      ) : null}

      <div className="auth__row">
        <label className="auth__check">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          {copy.remember}
        </label>
        {passwordResetConfig.PASSWORD_RESET_ENABLED ? (
          <Link className="auth__forgot" to="/forgot-password">{copy.forgot}</Link>
        ) : null}
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
