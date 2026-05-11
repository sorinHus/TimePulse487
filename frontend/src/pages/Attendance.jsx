import { useState, useEffect } from "react";
import { clockIn, clockOut, getTodaySessions, getSessionHistory, requestOvertime } from "../api/attendance";
import styles from "./Attendance.module.css";


const WORKDAY_HOURS = 8.5;
const NIGHT_START = 22;
const NIGHT_END = 6;

function isNightHour(hour) {
  return hour >= NIGHT_START || hour < NIGHT_END;
}

function formatTime(isoString) {
  if (!isoString) return "--:--";
  const d = new Date(isoString);
  if (isNaN(d)) return "--:--";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatHours(decimal) {
  if (decimal === null || decimal === undefined || decimal === "") return "--";
  const num = parseFloat(decimal);
  if (isNaN(num)) return "--";
  const h = Math.floor(num);
  const m = Math.round((num - h) * 60);
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
  const [todaySummary, setTodaySummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [expandedDates, setExpandedDates] = useState({});
  const [monthOffset, setMonthOffset] = useState(0);
  const [loadingAction, setLoadingAction] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");
  const [nightWarning, setNightWarning] = useState(false);

  const fetchToday = async () => {
    try {
      const data = await getTodaySessions();
      setTodaySummary(data);
    } catch {
      setTodaySummary(null);
    }
  };

  const fetchHistory = async (offset) => {
    setLoadingHistory(true);
    try {
      const month = getMonthParam(offset);
      const data = await getSessionHistory(month);
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => { fetchToday(); }, []);
  useEffect(() => { fetchHistory(monthOffset); }, [monthOffset]);

  // Warning noapte la 21:45
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      if (h === 21 && m >= 45) setNightWarning(true);
      else setNightWarning(false);
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleClockIn = async () => {
    setError("");
    const hour = new Date().getHours();
    if (isNightHour(hour)) {
      const confirmed = window.confirm(
        "Atenție: urmează să contorizați ore de noapte (22:00–06:00). Continuați?"
      );
      if (!confirmed) return;
    }
    setLoadingAction(true);
    try {
      await clockIn();
      await fetchToday();
      await fetchHistory(monthOffset);
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
      await fetchToday();
      await fetchHistory(monthOffset);
    } catch (e) {
      setError(e?.response?.data?.detail || "Clock-out failed.");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRequestOvertime = async (date) => {
    try {
      await requestOvertime(date);
      await fetchHistory(monthOffset);
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to request overtime.");
    }
  };

  const toggleExpand = (date) => {
    setExpandedDates((prev) => ({ ...prev, [date]: !prev[date] }));
  };

  const hasOpenSession = todaySummary?.has_open_session;
  const isDayComplete = todaySummary?.status === "complete";
  const openSession = todaySummary?.sessions?.find((s) => s.status === "open");

  // Sumarul lunii din history
  const totalDays = history.length;
  const totalHours = history.reduce((sum, d) => sum + parseFloat(d.total_hours || 0), 0);
  const completeDays = history.filter((d) => d.status === "complete").length;
  const incompleteDays = history.filter((d) => d.status === "in_progress" || (d.status !== "complete" && d.total_hours > 0)).length;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Attendance</h1>
          <p className={styles.subtitle}>Track your daily working hours</p>
        </div>
      </div>

      {/* Warning noapte */}
      {nightWarning && (
        <div className={styles.nightWarning}>
          ⚠ Se apropie intervalul de noapte (22:00–06:00)
        </div>
      )}

      {/* Today card */}
      <div className={`${styles.todayCard} ${hasOpenSession ? styles.cardActive : ""} ${isDayComplete ? styles.cardDone : ""}`}>
        <div className={styles.todayLeft}>
          <div className={styles.todayStatus}>
            <span className={`${styles.pulse} ${hasOpenSession ? styles.pulseOn : ""}`} />
            <span className={styles.todayStatusText}>
              {isDayComplete ? "Shift complete" : hasOpenSession ? "Currently working" : "Not clocked in"}
            </span>
          </div>
          <div className={styles.todayDate}>
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </div>
          <div className={styles.timeRow}>
            {openSession ? (
              <>
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>Clock in</span>
                  <span className={styles.timeValue}>{formatTime(openSession.clock_in)}</span>
                </div>
                <div className={styles.timeSep} />
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>Clock out</span>
                  <span className={styles.timeValue}>--:--</span>
                </div>
              </>
            ) : todaySummary?.sessions?.length > 0 ? (
              <>
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>First clock-in</span>
                  <span className={styles.timeValue}>
                    {formatTime(todaySummary.sessions[0]?.clock_in)}
                  </span>
                </div>
                <div className={styles.timeSep} />
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>Last clock-out</span>
                  <span className={styles.timeValue}>
                    {formatTime([...todaySummary.sessions].reverse().find(s => s.clock_out)?.clock_out)}
                  </span>
                </div>
                <div className={styles.timeSep} />
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>Total azi</span>
                  <span className={styles.timeValue}>{formatHours(todaySummary.total_hours)}</span>
                </div>
                <div className={styles.timeSep} />
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>Sesiuni</span>
                  <span className={styles.timeValue}>{todaySummary.sessions.length}</span>
                </div>
                {parseFloat(todaySummary.overtime_hours) > 0 && (
                  <>
                    <div className={styles.timeSep} />
                    <div className={styles.timeBlock}>
                      <span className={styles.timeLabel}>Overtime</span>
                      <span className={`${styles.timeValue} ${styles.overtime}`}>
                        +{formatHours(todaySummary.overtime_hours)}
                      </span>
                    </div>
                  </>
                )}
                {parseFloat(todaySummary.remaining_hours) > 0 && (
                  <>
                    <div className={styles.timeSep} />
                    <div className={styles.timeBlock}>
                      <span className={styles.timeLabel}>Rămase</span>
                      <span className={styles.timeValue}>{formatHours(todaySummary.remaining_hours)}</span>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className={styles.timeBlock}>
                <span className={styles.timeLabel}>Clock in</span>
                <span className={styles.timeValue}>--:--</span>
              </div>
            )}
          </div>
        </div>
        <div className={styles.todayRight}>
          {error && <p className={styles.errorMsg}>{error}</p>}
          {!hasOpenSession && (
            <button className={styles.btnIn} onClick={handleClockIn} disabled={loadingAction}>
              {loadingAction && <span className={styles.spinner} />}
              Clock In
            </button>
          )}
          {hasOpenSession && (
            <button className={styles.btnOut} onClick={handleClockOut} disabled={loadingAction}>
              {loadingAction && <span className={styles.spinner} />}
              Clock Out
            </button>
          )}
          {isDayComplete && !hasOpenSession && (
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
          <span className={styles.summaryValue}>{incompleteDays}</span>
        </div>
      </div>

      {/* History */}
      <div className={styles.historySection}>
        <div className={styles.historyHeader}>
          <h2 className={styles.sectionTitle}>Monthly history</h2>
          <div className={styles.monthNav}>
            <button className={styles.monthBtn} onClick={() => setMonthOffset((o) => o - 1)}>‹</button>
            <span className={styles.monthLabel}>{getMonthLabel(monthOffset)}</span>
            <button
              className={styles.monthBtn}
              onClick={() => setMonthOffset((o) => Math.min(o + 1, 0))}
              disabled={monthOffset === 0}
            >›</button>
          </div>
        </div>

        <div className={styles.table}>
          <div className={`${styles.tableRow} ${styles.tableHead}`}>
            <span>Date</span>
            <span>Day</span>
            <span>Total hours</span>
            <span>Sesiuni</span>
            <span>Remaining / Overtime</span>
            <span>Status</span>
          </div>

          {loadingHistory ? (
            <div className={styles.empty}>Loading…</div>
          ) : history.length > 0 ? (
            history.map((row, i) => {
              const date = new Date(row.date + "T00:00:00");
              const isToday = row.date === new Date().toISOString().slice(0, 10);
              const expanded = expandedDates[row.date];
              const hasNight = parseFloat(row.total_night_hours) > 0;
              const isOvertime = parseFloat(row.overtime_hours) > 0;

              return (
                <div key={i}>
                  <div
                    className={`${styles.tableRow} ${isToday ? styles.rowToday : ""} ${styles.rowClickable}`}
                    onClick={() => toggleExpand(row.date)}
                  >
                    <span className={styles.dateCell}>
                      {date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {isToday && <span className={styles.todayPill}>today</span>}
                    </span>
                    <span className={styles.muted}>
                      {date.toLocaleDateString("en-GB", { weekday: "short" })}
                    </span>
                    <span>
                      {formatHours(row.total_hours)}
                      {hasNight && <span className={styles.nightBadge}>🌙</span>}
                    </span>
                    <span>{row.sessions?.length || 0}</span>
                    <span>
                      {isOvertime ? (
                        <span className={styles.overtimeCell}>
                          <span className={styles.overtimeText}>+{formatHours(row.overtime_hours)}</span>
                          {!row.overtime_request && (
                            <button
                              className={styles.otBtn}
                              onClick={(e) => { e.stopPropagation(); handleRequestOvertime(row.date); }}
                            >
                              Request
                            </button>
                          )}
                          {row.overtime_request && (
                            <span className={`${styles.otStatus} ${
                              row.overtime_request.status === 'approved' ? styles.otApproved :
                              row.overtime_request.status === 'partially_approved' ? styles.otPartial :
                              row.overtime_request.status === 'rejected' ? styles.otRejected :
                              styles.otPending
                            }`}>
                              {row.overtime_request.status === 'approved' ? '✓ Approved' :
                               row.overtime_request.status === 'partially_approved' ? `✓ ${row.overtime_request.approved_hours}h` :
                               row.overtime_request.status === 'rejected' ? '✗ Rejected' :
                               '⏳ Pending'}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className={styles.remainingText}>{formatHours(row.remaining_hours)}</span>
                      )}
                    </span>
                    <span>
                      <span className={`${styles.badge} ${
                        row.status === "complete" ? styles.badgeGreen :
                        row.status === "in_progress" ? styles.badgeAmber :
                        styles.badgeGray
                      }`}>
                        {row.status === "complete" ? "Complete" :
                         row.status === "in_progress" ? "In progress" : "Absent"}
                      </span>
                    </span>
                  </div>

                  {/* Sesiuni expandate */}
                  {expanded && row.sessions?.map((s, j) => (
                    <div key={j} className={styles.sessionRow}>
                      <span className={styles.sessionIndex}>#{j + 1}</span>
                      <span />
                      <span>
                        {formatTime(s.clock_in)} → {s.clock_out ? formatTime(s.clock_out) : "open"}
                      </span>
                      <span>{formatHours(s.work_hours)}</span>
                      <span>
                        {parseFloat(s.night_hours) > 0 && (
                          <span className={styles.nightBadge}>🌙 {formatHours(s.night_hours)}</span>
                        )}
                      </span>
                      <span>
                        <span className={`${styles.badge} ${s.status === "complete" ? styles.badgeGreen : styles.badgeAmber}`}>
                          {s.status === "complete" ? "Complete" : "Open"}
                        </span>
                      </span>
                    </div>
                  ))}
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