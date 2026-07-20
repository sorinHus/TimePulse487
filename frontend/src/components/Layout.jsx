import { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "./Sidebar";
import { getUnreadCount } from "../api/attendance";
import { setLanguage } from "../i18n/config";
import styles from "./Layout.module.css";

export default function Layout({ theme, onToggleTheme }) {
  const { t, i18n } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const currentLang = i18n.language === "en" ? "en" : "ro";

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
            <div className={styles.langGroup} role="group" aria-label="RO / EN">
              <button
                type="button"
                className={`${styles.langOption} ${currentLang === "ro" ? styles.langActive : ""}`}
                onClick={() => setLanguage("ro")}
                aria-pressed={currentLang === "ro"}
              >
                RO
              </button>
              <button
                type="button"
                className={`${styles.langOption} ${currentLang === "en" ? styles.langActive : ""}`}
                onClick={() => setLanguage("en")}
                aria-pressed={currentLang === "en"}
              >
                EN
              </button>
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
              {new Date().toLocaleDateString(currentLang === "ro" ? "ro-RO" : "en-GB", {
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