import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { clockIn, getTodaySessions } from "../api/attendance";
import { getEmployeeDashboard } from "../api/dashboard";
import { dateLocale } from "../i18n/config";
import styles from "./DashboardEmployee.module.css";

function formatTime(isoString, locale) {
  if (!isoString) return "--:--";
  const d = new Date(isoString);
  if (isNaN(d)) return "--:--";
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function formatHours(decimal) {
  if (!decimal && decimal !== 0) return "--";
  const num = parseFloat(decimal);
  if (isNaN(num)) return "--";
  const h = Math.floor(num);
  const m = Math.round((num - h) * 60);
  return `${h}h ${m}m`;
}

function StatCard({ label, value, accent, sublabel }) {
  return (
    <div className={`${styles.statCard} ${accent ? styles[accent] : ""}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {sublabel && <span className={styles.statSub}>{sublabel}</span>}
    </div>
  );
}

export default function DashboardEmployee() {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);
  const { user } = useAuth();

  const [todaySummary, setTodaySummary] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      const [todayData, dashData] = await Promise.all([
        getTodaySessions(),
        getEmployeeDashboard(),
      ]);
      setTodaySummary(todayData);
      setDashboard(dashData);
    } catch {
      // silently fail
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleClockIn = async () => {
    setError("");
    setLoadingAction(true);
    try {
      await clockIn();
      await fetchData();
    } catch (e) {
      setError(e?.response?.data?.detail || t("dashboardEmployee.clockInFailed"));
    } finally {
      setLoadingAction(false);
    }
  };

  const hasOpenSession = todaySummary?.has_open_session;
  const isDayComplete = todaySummary?.status === "complete";
  const openSession = todaySummary?.sessions?.find((s) => s.status === "open");
  const onLeave = todaySummary?.on_leave ?? null;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t("dashboardEmployee.goodMorning");
    if (h < 18) return t("dashboardEmployee.goodAfternoon");
    return t("dashboardEmployee.goodEvening");
  };

  const firstName = user?.first_name || user?.username || t("dashboardEmployee.there");

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{greeting()}, {firstName}.</h1>
          <p className={styles.pageSubtitle}>
            {new Date().toLocaleDateString(locale, {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Leave banner */}
      {onLeave && (
        <div className={styles.leaveBanner}>
          {t("dashboardEmployee.onLeaveBanner", { type: onLeave.leave_type, start: onLeave.start_date, end: onLeave.end_date })}
        </div>
      )}

      {/* Clock-in card */}
      <div className={`${styles.checkinCard} ${hasOpenSession ? styles.checkinActive : ""} ${isDayComplete ? styles.checkinDone : ""}`}>
        <div className={styles.checkinLeft}>
          <div className={styles.checkinStatus}>
            <span className={`${styles.pulse} ${hasOpenSession ? styles.pulseActive : ""}`} />
            <span className={styles.checkinStatusText}>
              {isDayComplete ? t("dashboardEmployee.shiftComplete") : hasOpenSession ? t("dashboardEmployee.currentlyWorking") : t("dashboardEmployee.notClockedIn")}
            </span>
          </div>
          <div className={styles.checkinTimes}>
            {openSession ? (
              <>
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>{t("dashboardEmployee.in")}</span>
                  <span className={styles.timeValue}>{formatTime(openSession.clock_in, locale)}</span>
                </div>
                <div className={styles.timeDivider} />
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>{t("dashboardEmployee.out")}</span>
                  <span className={styles.timeValue}>--:--</span>
                </div>
              </>
            ) : todaySummary?.sessions?.length > 0 ? (
              <>
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>{t("dashboardEmployee.total")}</span>
                  <span className={styles.timeValue}>{formatHours(todaySummary.total_hours)}</span>
                </div>
                <div className={styles.timeDivider} />
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>{t("dashboardEmployee.sessions")}</span>
                  <span className={styles.timeValue}>{todaySummary.sessions.length}</span>
                </div>
              </>
            ) : (
              <>
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>{t("dashboardEmployee.in")}</span>
                  <span className={styles.timeValue}>--:--</span>
                </div>
                <div className={styles.timeDivider} />
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>{t("dashboardEmployee.out")}</span>
                  <span className={styles.timeValue}>--:--</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className={styles.checkinRight}>
          {error && <p className={styles.checkinError}>{error}</p>}
          {!hasOpenSession && (
            <button className={styles.btnCheckIn} onClick={handleClockIn} disabled={loadingAction || !!onLeave}>
              {loadingAction ? <span className={styles.spinner} /> : null}
              {t("dashboardEmployee.clockIn")}
            </button>
          )}
          {isDayComplete && !hasOpenSession && (
            <span className={styles.doneTag}>{t("dashboardEmployee.doneForToday")}</span>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className={styles.statsGrid}>
        <StatCard
          label={t("dashboardEmployee.stats.hoursThisMonth")}
          value={formatHours(dashboard?.hours_this_month)}
          accent="accentBlue"
        />
        <StatCard
          label={t("dashboardEmployee.stats.annualLeaveLeft")}
          value={dashboard?.leave_balance?.annual ?? "--"}
          sublabel={t("dashboardEmployee.stats.daysRemaining")}
          accent="accentGreen"
        />
        <StatCard
          label={t("dashboardEmployee.stats.sickLeaveLeft")}
          value={dashboard?.leave_balance?.sick ?? "--"}
          sublabel={t("dashboardEmployee.stats.daysRemaining")}
          accent="accentAmber"
        />
        <StatCard
          label={t("dashboardEmployee.stats.pendingRequests")}
          value={dashboard?.pending_leave_requests ?? "--"}
          sublabel={t("dashboardEmployee.stats.awaitingApproval")}
        />
      </div>

      {/* Recent attendance */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("dashboardEmployee.recentAttendance")}</h2>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>{t("dashboardEmployee.table.date")}</span>
            <span>{t("dashboardEmployee.table.clockIn")}</span>
            <span>{t("dashboardEmployee.table.clockOut")}</span>
            <span>{t("dashboardEmployee.table.hours")}</span>
            <span>{t("dashboardEmployee.table.status")}</span>
          </div>
          {dashboard?.recent_attendance?.length > 0 ? (
            dashboard.recent_attendance.map((row, i) => (
              <div key={i} className={styles.tableRow}>
                <span>
                  {new Date(row.date + "T00:00:00").toLocaleDateString(locale, {
                    weekday: "short", day: "numeric", month: "short",
                  })}
                </span>
                <span>{formatTime(row.check_in, locale)}</span>
                <span>{formatTime(row.check_out, locale)}</span>
                <span>{formatHours(row.hours_worked)}</span>
                <span>
                  <span className={`${styles.badge} ${row.check_out ? styles.badgeGreen : styles.badgeAmber}`}>
                    {row.check_out ? t("common.status.complete") : t("common.status.incomplete")}
                  </span>
                </span>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>{t("dashboardEmployee.noRecords")}</div>
          )}
        </div>
      </div>
    </div>
  );
}