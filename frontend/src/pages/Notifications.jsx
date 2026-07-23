import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getNotifications, markNotificationRead, markAllRead, deleteNotification } from "../api/attendance";
import styles from "./Notifications.module.css";

function timeAgo(dateStr, t) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("notifications.justNow");
  if (mins < 60) return t("notifications.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("notifications.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("notifications.daysAgo", { count: days });
}

const TYPE_ICONS = {
  overtime: (
    <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  leave: (
    <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
      <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 2v4M13 2v4M3 9h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  system: (
    <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 7v3M10 13h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

const TYPE_COLORS = {
  overtime: styles.typeOvertime,
  leave: styles.typeLeave,
  system: styles.typeSystem,
};

export default function Notifications() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetchNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleMarkRead = async (id) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, is_read: true } : n)
    );
  };

  const handleDelete = async (id) => {
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleItemClick = (n) => {
    if (!n.is_read) handleMarkRead(n.id);
    if (n.link) navigate(n.link);
  };

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.is_read;
    if (filter === "overtime") return n.type === "overtime";
    if (filter === "leave") return n.type === "leave";
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("notifications.title")}</h1>
          <p className={styles.subtitle}>
            {unreadCount > 0 ? t("notifications.unreadCount", { count: unreadCount }) : t("notifications.allCaughtUp")}
          </p>
        </div>
        {unreadCount > 0 && (
          <button className={styles.markAllBtn} onClick={handleMarkAllRead}>
            {t("notifications.markAllRead")}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        {["all", "unread", "overtime", "leave"].map((f) => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ""}`}
            onClick={() => setFilter(f)}
          >
            {t(`notifications.filters.${f}`)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className={styles.list}>
        {loading ? (
          <div className={styles.empty}>{t("notifications.loading")}</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>{t("notifications.noNotifications")}</div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              className={`${styles.item} ${!n.is_read ? styles.unread : ""}`}
              onClick={() => handleItemClick(n)}
            >
              <div className={`${styles.typeIcon} ${TYPE_COLORS[n.type] || styles.typeSystem}`}>
                {TYPE_ICONS[n.type] || TYPE_ICONS.system}
              </div>
              <div className={styles.itemBody}>
                <div className={styles.itemTitle}>{n.title}</div>
                <div className={styles.itemMessage}>{n.message}</div>
                <div className={styles.itemMeta}>{timeAgo(n.created_at, t)}</div>
              </div>
              {!n.is_read && <div className={styles.unreadDot} />}
              <button
                className={styles.deleteBtn}
                onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                aria-label={t("notifications.deleteAria")}
              >
                <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                  <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}