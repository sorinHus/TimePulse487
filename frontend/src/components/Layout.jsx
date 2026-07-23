import { useState, useEffect, useRef, useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "./Sidebar";
import { getUnreadCount } from "../api/attendance";
import { setLanguage, dateLocale } from "../i18n/config";
import styles from "./Layout.module.css";

const LANGUAGES = [
  { code: "ro", label: "RO" },
  { code: "en", label: "EN" },
  { code: "uk", label: "UA" },
];

// Emoji regional-indicator flags don't render as flags on Windows (no color
// flag glyphs in Segoe UI Emoji), so these are drawn as small SVGs instead.
function FlagIcon({ code }) {
  if (code === "ro") {
    return (
      <svg viewBox="0 0 3 2" width="16" height="12" preserveAspectRatio="none">
        <rect width="1" height="2" fill="#002B7F" />
        <rect x="1" width="1" height="2" fill="#FCD116" />
        <rect x="2" width="1" height="2" fill="#CE1126" />
      </svg>
    );
  }
  if (code === "uk") {
    return (
      <svg viewBox="0 0 3 2" width="16" height="12" preserveAspectRatio="none">
        <rect width="3" height="1" fill="#0057B7" />
        <rect y="1" width="3" height="1" fill="#FFD700" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 60 40" width="16" height="12" preserveAspectRatio="none">
      <rect width="60" height="40" fill="#012169" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#FFF" strokeWidth="8" />
      <path d="M0,0 L24,16 M60,0 L36,16 M0,40 L24,24 M60,40 L36,24" stroke="#C8102E" strokeWidth="5.5" />
      <path d="M30,0 V40 M0,20 H60" stroke="#FFF" strokeWidth="13" />
      <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="8" />
    </svg>
  );
}

export default function Layout({ theme, onToggleTheme }) {
  const { t, i18n } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef(null);
  const navigate = useNavigate();
  const currentLang = LANGUAGES.find((l) => l.code === i18n.language)?.code || "ro";
  const currentLangOption = LANGUAGES.find((l) => l.code === currentLang);

  useEffect(() => {
    if (!langMenuOpen) return;
    const handlePointerDown = (e) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) {
        setLangMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setLangMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [langMenuOpen]);

  const chooseLanguage = (code) => {
    setLanguage(code);
    setLangMenuOpen(false);
  };

  const fetchUnread = useCallback(async () => {
    try {
      const data = await getUnreadCount();
      setUnreadCount(data.count || 0);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  return (
    <div className={styles.shell}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft} />
          <div className={styles.topbarRight}>
            <div className={styles.langDropdown} ref={langMenuRef}>
              <button
                type="button"
                className={styles.langTrigger}
                onClick={() => setLangMenuOpen((open) => !open)}
                aria-haspopup="listbox"
                aria-expanded={langMenuOpen}
              >
                <span className={styles.langFlag}><FlagIcon code={currentLangOption?.code} /></span>
                <span>{currentLangOption?.label}</span>
                <svg
                  className={styles.langChevron}
                  viewBox="0 0 20 20"
                  fill="none"
                  width="12"
                  height="12"
                >
                  <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {langMenuOpen && (
                <ul className={styles.langMenu} role="listbox">
                  {LANGUAGES.map((lang) => (
                    <li key={lang.code} role="option" aria-selected={currentLang === lang.code}>
                      <button
                        type="button"
                        className={`${styles.langMenuItem} ${currentLang === lang.code ? styles.langMenuItemActive : ""}`}
                        onClick={() => chooseLanguage(lang.code)}
                      >
                        <span className={styles.langFlag}><FlagIcon code={lang.code} /></span>
                        <span>{lang.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              className={styles.themeBtn}
              onClick={onToggleTheme}
              title={theme === 'dark' ? t("layout.switchToLight") : t("layout.switchToDark")}
            >
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7zm0-5a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1zm0 17a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0v-1a1 1 0 0 1 1-1zm8.66-13.5a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.71-.71a1 1 0 0 1 1.41 0zM6.05 17.95a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.71-.71a1 1 0 0 1 1.41 0zM21 11h1a1 1 0 0 1 0 2h-1a1 1 0 0 1 0-2zM3 11h1a1 1 0 0 1 0 2H3a1 1 0 0 1 0-2zm15.66 5.66a1 1 0 0 1 1.41 0l.71.71a1 1 0 0 1-1.41 1.41l-.71-.71a1 1 0 0 1 0-1.41zM4.34 7.05a1 1 0 0 1 1.41 0l.71.71A1 1 0 0 1 5.05 9.17l-.71-.71a1 1 0 0 1 0-1.41z"/>
                </svg>
              )}
            </button>
            <span className={styles.dateBadge}>
              {new Date().toLocaleDateString(dateLocale(currentLang), {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <button
              className={styles.notifBtn}
              onClick={() => navigate("/notifications")}
              aria-label={t("layout.notifications")}
            >
              <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                <path d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 15.5a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {unreadCount > 0 && (
                <span className={styles.notifCount}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}