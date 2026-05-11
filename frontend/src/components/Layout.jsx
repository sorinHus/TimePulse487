import { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { getUnreadCount } from "../api/attendance";
import styles from "./Layout.module.css";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

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
            <span className={styles.dateBadge}>
              {new Date().toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <button
              className={styles.notifBtn}
              onClick={() => navigate("/notifications")}
              aria-label="Notifications"
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