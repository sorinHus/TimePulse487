import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { clockIn, clockOut, getTodaySessions } from "../api/attendance";
import { getEmployeeDashboard } from "../api/dashboard";
import styles from "./DashboardEmployee.module.css";

function formatTime(isoString) {
  if (!isoString) return "--:--";
  const d = new Date(isoString);
  if (isNaN(d)) return "--:--";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
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
      setError(e?.response?.data?.detail || "Clock-in failed.");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleClockOut = async () => {
    setError("");
    setLoadingAction(true);
    try {
      await clockOut();
      await fetchData();
    } catch (e) {
      setError(e?.response?.data?.detail || "Clock-out failed.");
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
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const firstName = user?.first_name || user?.username || "there";

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{greeting()}, {firstName}.</h1>
          <p className={styles.pageSubtitle}>
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Leave banner */}
      {onLeave && (
        <div className={styles.leaveBanner}>
          You are on <strong>{onLeave.leave_type}</strong> from{" "}
          <strong>{onLeave.start_date}</strong> to{" "}
          <strong>{onLeave.end_date}</strong>. Clock-in is disabled during approved leave.
        </div>
      )}

      {/* Clock-in card */}
      <div className={`${styles.checkinCard} ${hasOpenSession ? styles.checkinActive : ""} ${isDayComplete ? styles.checkinDone : ""}`}>
        <div className={styles.checkinLeft}>
          <div className={styles.checkinStatus}>
            <span className={`${styles.pulse} ${hasOpenSession ? styles.pulseActive : ""}`} />
            <span className={styles.checkinStatusText}>
              {isDayComplete ? "Shift complete" : hasOpenSession ? "Currently working" : "Not clocked in"}
            </span>
          </div>
          <div className={styles.checkinTimes}>
            {openSession ? (
              <>
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>In</span>
                  <span className={styles.timeValue}>{formatTime(openSession.clock_in)}</span>
                </div>
                <div className={styles.timeDivider} />
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>Out</span>
                  <span className={styles.timeValue}>--:--</span>
                </div>
              </>
            ) : todaySummary?.sessions?.length > 0 ? (
              <>
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>Total</span>
                  <span className={styles.timeValue}>{formatHours(todaySummary.total_hours)}</span>
                </div>
                <div className={styles.timeDivider} />
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>Sessions</span>
                  <span className={styles.timeValue}>{todaySummary.sessions.length}</span>
                </div>
              </>
            ) : (
              <>
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>In</span>
                  <span className={styles.timeValue}>--:--</span>
                </div>
                <div className={styles.timeDivider} />
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>Out</span>
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
              Clock In
            </button>
          )}
          {hasOpenSession && (
            <button className={styles.btnCheckOut} onClick={handleClockOut} disabled={loadingAction}>
              {loadingAction ? <span className={styles.spinner} /> : null}
              Clock Out
            </button>
          )}
          {isDayComplete && !hasOpenSession && (
            <span className={styles.doneTag}>✓ Done for today</span>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className={styles.statsGrid}>
        <StatCard
          label="Hours this month"
          value={formatHours(dashboard?.hours_this_month)}
          accent="accentBlue"
        />
        <StatCard
          label="Annual leave left"
          value={dashboard?.leave_balance?.annual ?? "--"}
          sublabel="days remaining"
          accent="accentGreen"
        />
        <StatCard
          label="Sick leave left"
          value={dashboard?.leave_balance?.sick ?? "--"}
          sublabel="days remaining"
          accent="accentAmber"
        />
        <StatCard
          label="Pending requests"
          value={dashboard?.pending_leave_requests ?? "--"}
          sublabel="awaiting approval"
        />
      </div>

      {/* Recent attendance */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent attendance</h2>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Date</span>
            <span>Clock in</span>
            <span>Clock out</span>
            <span>Hours</span>
            <span>Status</span>
          </div>
          {dashboard?.recent_attendance?.length > 0 ? (
            dashboard.recent_attendance.map((row, i) => (
              <div key={i} className={styles.tableRow}>
                <span>
                  {new Date(row.date + "T00:00:00").toLocaleDateString("en-GB", {
                    weekday: "short", day: "numeric", month: "short",
                  })}
                </span>
                <span>{formatTime(row.check_in)}</span>
                <span>{formatTime(row.check_out)}</span>
                <span>{formatHours(row.hours_worked)}</span>
                <span>
                  <span className={`${styles.badge} ${row.check_out ? styles.badgeGreen : styles.badgeAmber}`}>
                    {row.check_out ? "Complete" : "Incomplete"}
                  </span>
                </span>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>No attendance records yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}