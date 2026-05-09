import { useState, useEffect } from "react";
import { checkIn, checkOut, getTodayAttendance, getAttendanceHistory } from "../api/attendance";
import styles from "./Attendance.module.css";

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

function getMonthLabel(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function getMonthParam(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Attendance() {
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [loadingAction, setLoadingAction] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");

  const fetchToday = async () => {
    try {
      const data = await getTodayAttendance();
      setToday(data);
    } catch {
      setToday(null);
    }
  };

  const fetchHistory = async (offset) => {
    setLoadingHistory(true);
    try {
      const month = getMonthParam(offset);
      const data = await getAttendanceHistory(month);
      setHistory(Array.isArray(data) ? data : data?.results || []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchToday();
  }, []);

  useEffect(() => {
    fetchHistory(monthOffset);
  }, [monthOffset]);

  const handleCheckIn = async () => {
    setError("");
    setLoadingAction(true);
    try {
      await checkIn();
      await fetchToday();
      await fetchHistory(monthOffset);
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
      await fetchToday();
      await fetchHistory(monthOffset);
    } catch (e) {
      setError(e?.response?.data?.detail || "Check-out failed.");
    } finally {
      setLoadingAction(false);
    }
  };

  const isCheckedIn = today?.check_in && !today?.check_out;
  const isCheckedOut = today?.check_in && today?.check_out;

  // Summary stats from history
  const totalDays = history.filter((r) => r.check_in).length;
  const totalHours = history.reduce((sum, r) => sum + (r.hours_worked || 0), 0);
  const completeDays = history.filter((r) => r.check_in && r.check_out).length;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Attendance</h1>
          <p className={styles.subtitle}>Track your daily working hours</p>
        </div>
      </div>

      {/* Today card */}
      <div className={`${styles.todayCard} ${isCheckedIn ? styles.cardActive : ""} ${isCheckedOut ? styles.cardDone : ""}`}>
        <div className={styles.todayLeft}>
          <div className={styles.todayStatus}>
            <span className={`${styles.pulse} ${isCheckedIn ? styles.pulseOn : ""}`} />
            <span className={styles.todayStatusText}>
              {isCheckedOut ? "Shift complete" : isCheckedIn ? "Currently working" : "Not checked in"}
            </span>
          </div>
          <div className={styles.todayDate}>
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </div>
          <div className={styles.timeRow}>
            <div className={styles.timeBlock}>
              <span className={styles.timeLabel}>Check in</span>
              <span className={styles.timeValue}>{formatTime(today?.check_in)}</span>
            </div>
            <div className={styles.timeSep} />
            <div className={styles.timeBlock}>
              <span className={styles.timeLabel}>Check out</span>
              <span className={styles.timeValue}>{formatTime(today?.check_out)}</span>
            </div>
            {isCheckedOut && (
              <>
                <div className={styles.timeSep} />
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>Duration</span>
                  <span className={styles.timeValue}>{formatHours(today?.hours_worked)}</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className={styles.todayRight}>
          {error && <p className={styles.errorMsg}>{error}</p>}
          {!isCheckedIn && !isCheckedOut && (
            <button className={styles.btnIn} onClick={handleCheckIn} disabled={loadingAction}>
              {loadingAction && <span className={styles.spinner} />}
              Check In
            </button>
          )}
          {isCheckedIn && (
            <button className={styles.btnOut} onClick={handleCheckOut} disabled={loadingAction}>
              {loadingAction && <span className={styles.spinner} />}
              Check Out
            </button>
          )}
          {isCheckedOut && (
            <span className={styles.doneTag}>✓ Done for today</span>
          )}
        </div>
      </div>

      {/* Month summary */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Days worked</span>
          <span className={styles.summaryValue}>{totalDays}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total hours</span>
          <span className={styles.summaryValue}>{formatHours(totalHours)}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Complete shifts</span>
          <span className={styles.summaryValue}>{completeDays}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Incomplete</span>
          <span className={styles.summaryValue}>{totalDays - completeDays}</span>
        </div>
      </div>

      {/* History */}
      <div className={styles.historySection}>
        <div className={styles.historyHeader}>
          <h2 className={styles.sectionTitle}>Monthly history</h2>
          <div className={styles.monthNav}>
            <button
              className={styles.monthBtn}
              onClick={() => setMonthOffset((o) => o - 1)}
            >
              ‹
            </button>
            <span className={styles.monthLabel}>{getMonthLabel(monthOffset)}</span>
            <button
              className={styles.monthBtn}
              onClick={() => setMonthOffset((o) => Math.min(o + 1, 0))}
              disabled={monthOffset === 0}
            >
              ›
            </button>
          </div>
        </div>

        <div className={styles.table}>
          <div className={`${styles.tableRow} ${styles.tableHead}`}>
            <span>Date</span>
            <span>Day</span>
            <span>Check in</span>
            <span>Check out</span>
            <span>Hours</span>
            <span>Status</span>
          </div>
          {loadingHistory ? (
            <div className={styles.empty}>Loading…</div>
          ) : history.length > 0 ? (
            history.map((row, i) => {
              const date = new Date(row.date);
              const isToday = row.date === new Date().toISOString().slice(0, 10);
              return (
                <div key={i} className={`${styles.tableRow} ${isToday ? styles.rowToday : ""}`}>
                  <span className={styles.dateCell}>
                    {date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    {isToday && <span className={styles.todayPill}>today</span>}
                  </span>
                  <span className={styles.muted}>
                    {date.toLocaleDateString("en-GB", { weekday: "short" })}
                  </span>
                  <span>{formatTime(row.check_in)}</span>
                  <span>{formatTime(row.check_out)}</span>
                  <span>{formatHours(row.hours_worked)}</span>
                  <span>
                    <span className={`${styles.badge} ${
                      row.check_in && row.check_out ? styles.badgeGreen :
                      row.check_in ? styles.badgeAmber : styles.badgeGray
                    }`}>
                      {row.check_in && row.check_out ? "Complete" :
                       row.check_in ? "In progress" : "Absent"}
                    </span>
                  </span>
                </div>
              );
            })
          ) : (
            <div className={styles.empty}>No records for this month.</div>
          )}
        </div>
      </div>
    </div>
  );
}