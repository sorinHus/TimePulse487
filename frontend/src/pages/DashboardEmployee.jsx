import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { checkIn, checkOut, getTodayAttendance } from "../api/attendance";
import { getEmployeeDashboard } from "../api/dashboard";
import styles from "./DashboardEmployee.module.css";

function formatTime(isoString) {
  if (!isoString) return "--:--";
  return new Date(isoString).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHours(decimal) {
  if (!decimal && decimal !== 0) return "--";
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
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

  const [today, setToday] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      const [todayData, dashData] = await Promise.all([
        getTodayAttendance(),
        getEmployeeDashboard(),
      ]);
      setToday(todayData);
      setDashboard(dashData);
    } catch {
      // silently fail — show empty state
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCheckIn = async () => {
    setError("");
    setLoadingAction(true);
    try {
      await checkIn();
      await fetchData();
    } catch (e) {
      setError(e?.response?.data?.detail || "Check-in failed.");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCheckOut = async () => {
    setError("");
    setLoadingAction(true);
    try {
      await checkOut();
      await fetchData();
    } catch (e) {
      setError(e?.response?.data?.detail || "Check-out failed.");
    } finally {
      setLoadingAction(false);
    }
  };

  const isCheckedIn = today?.check_in && !today?.check_out;
  const isCheckedOut = today?.check_in && today?.check_out;

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
          <h1 className={styles.pageTitle}>
            {greeting()}, {firstName}.
          </h1>
          <p className={styles.pageSubtitle}>
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Check-in card */}
      <div className={`${styles.checkinCard} ${isCheckedIn ? styles.checkinActive : ""} ${isCheckedOut ? styles.checkinDone : ""}`}>
        <div className={styles.checkinLeft}>
          <div className={styles.checkinStatus}>
            <span className={`${styles.pulse} ${isCheckedIn ? styles.pulseActive : ""}`} />
            <span className={styles.checkinStatusText}>
              {isCheckedOut
                ? "Shift complete"
                : isCheckedIn
                ? "Currently working"
                : "Not checked in"}
            </span>
          </div>
          <div className={styles.checkinTimes}>
            <div className={styles.timeBlock}>
              <span className={styles.timeLabel}>In</span>
              <span className={styles.timeValue}>{formatTime(today?.check_in)}</span>
            </div>
            <div className={styles.timeDivider} />
            <div className={styles.timeBlock}>
              <span className={styles.timeLabel}>Out</span>
              <span className={styles.timeValue}>{formatTime(today?.check_out)}</span>
            </div>
            {isCheckedOut && (
              <>
                <div className={styles.timeDivider} />
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>Total</span>
                  <span className={styles.timeValue}>{formatHours(today?.hours_worked)}</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className={styles.checkinRight}>
          {error && <p className={styles.checkinError}>{error}</p>}
          {!isCheckedIn && !isCheckedOut && (
            <button
              className={styles.btnCheckIn}
              onClick={handleCheckIn}
              disabled={loadingAction}
            >
              {loadingAction ? <span className={styles.spinner} /> : null}
              Check In
            </button>
          )}
          {isCheckedIn && (
            <button
              className={styles.btnCheckOut}
              onClick={handleCheckOut}
              disabled={loadingAction}
            >
              {loadingAction ? <span className={styles.spinner} /> : null}
              Check Out
            </button>
          )}
          {isCheckedOut && (
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
            <span>Check in</span>
            <span>Check out</span>
            <span>Hours</span>
            <span>Status</span>
          </div>
          {dashboard?.recent_attendance?.length > 0 ? (
            dashboard.recent_attendance.map((row, i) => (
              <div key={i} className={styles.tableRow}>
                <span>
                  {new Date(row.date).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
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
