import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { login } from "../api/auth";
import styles from "./Login.module.css";

export default function Login() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login(username, password);
      setUser(data);
      navigate("/dashboard");
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          t("login.invalidCredentials")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.brand}>
        <div className={styles.logoMark}>
          <span className={styles.logoIcon}>T</span>
        </div>
        <h1 className={styles.brandName}>TimePulse</h1>
        <p className={styles.brandTagline}>{t("login.tagline")}</p>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>{t("login.title")}</h2>
          <p className={styles.cardSubtitle}>
            {t("login.subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="username" className={styles.label}>
              {t("login.username")}
            </label>
            <input
              id="username"
              type="text"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("login.usernamePlaceholder")}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              {t("login.password")}
            </label>
            <div className={styles.passwordWrapper}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className={styles.inputPassword}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
              >
                {showPassword ? (
                  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                    <path d="M3 10s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4" />
                    <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M3 3l14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                    <path d="M3 10s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4" />
                    <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.errorBanner} role="alert">
              <span className={styles.errorIcon}>!</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading || !username || !password}
          >
            {loading ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                {t("login.signingIn")}
              </>
            ) : (
              t("login.signIn")
            )}
          </button>
        </form>
      </div>

      <p className={styles.footer}>
        {t("login.footer", { year: new Date().getFullYear() })}
      </p>
    </div>
  );
}
