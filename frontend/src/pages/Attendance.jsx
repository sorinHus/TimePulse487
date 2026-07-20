import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { clockIn, clockOut, getTodaySessions, getSessionHistory, requestOvertime } from "../api/attendance";
import styles from "./Attendance.module.css";


const NIGHT_START = 22;
const NIGHT_END = 6;

function isNightHour(hour) {
  return hour >= NIGHT_START || hour < NIGHT_END;
}

function formatTime(isoString, locale) {
  if (!isoString) return "--:--";
  const d = new Date(isoString);
  if (isNaN(d)) return "--:--";
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function formatHours(decimal) {
  if (decimal === null || decimal === undefined || decimal === "") return "--";
  const num = parseFloat(decimal);
  if (isNaN(num)) return "--";
  const h = Math.floor(num);
  const m = Math.round((num - h) * 60);
  return `${h}h ${m}m`;
}

function getMonthLabel(locale, offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function getMonthParam(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Attendance() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ro" ? "ro-RO" : "en-GB";
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

  useEffect(() => {
    getTodaySessions()
      .then((data) => setTodaySummary(data))
      .catch(() => setTodaySummary(null));
  }, []);

  useEffect(() => {
    Promise.resolve()
      .then(() => {
        setLoadingHistory(true);
        return getSessionHistory(getMonthParam(monthOffset));
      })
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [monthOffset]);

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
      const confirmed = window.confirm(t("attendance.nightConfirm"));
      if (!confirmed) return;
    }
    setLoadingAction(true);
    try {
      await clockIn();
      await fetchToday();
      await fetchHistory(monthOffset);
    } catch (e) {
      setError(e?.response?.data?.detail || t("attendance.clockInFailed"));
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
      setError(e?.response?.data?.detail || t("attendance.clockOutFailed"));
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRequestOvertime = async (date) => {
    try {
      await requestOvertime(date);
      await fetchHistory(monthOffset);
    } catch (e) {
      alert(e?.response?.data?.detail || t("attendance.overtimeRequestFailed"));
    }
  };

  const toggleExpand = (date) => {
    setExpandedDates((prev) => ({ ...prev, [date]: !prev[date] }));
  };

  const hasOpenSession = todaySummary?.has_open_session;
  const isDayComplete = todaySummary?.status === "complete";
  const openSession = todaySummary?.sessions?.find((s) => s.status === "open");
  const onLeave = todaySummary?.on_leave ?? null;

  // Sumarul lunii din history
  const totalDays = history.length;
  const totalHours = history.reduce((sum, d) => sum + parseFloat(d.total_hours || 0), 0);
  const completeDays = history.filter((d) => d.status === "complete").length;
  const incompleteDays = history.filter((d) => d.status === "in_progress" || d.status === "incomplete").length;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("attendance.title")}</h1>
          <p className={styles.subtitle}>{t("attendance.subtitle")}</p>
        </div>
      </div>

      {/* Warning noapte */}
      {nightWarning && (
        <div className={styles.nightWarning}>
          {t("attendance.nightWarning")}
        </div>
      )}

      {/* Leave banner */}
      {onLeave && (
        <div className={styles.leaveBanner}>
          {t("attendance.onLeaveBanner", { type: onLeave.leave_type, start: onLeave.start_date, end: onLeave.end_date })}
        </div>
      )}

      {/* Today card */}
      <div className={`${styles.todayCard} ${hasOpenSession ? styles.cardActive : ""} ${isDayComplete ? styles.cardDone : ""}`}>
        <div className={styles.todayLeft}>
          <div className={styles.todayStatus}>
            <span className={`${styles.pulse} ${hasOpenSession ? styles.pulseOn : ""}`} />
            <span className={styles.todayStatusText}>
              {isDayComplete ? t("attendance.shiftComplete") : hasOpenSession ? t("attendance.currentlyWorking") : t("attendance.notClockedIn")}
            </span>
          </div>
          <div className={styles.todayDate}>
            {new Date().toLocaleDateString(locale, {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </div>
          <div className={styles.timeRow}>
            {openSession ? (
              <>
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>{t("attendance.clockIn")}</span>
                  <span className={styles.timeValue}>{formatTime(openSession.clock_in, locale)}</span>
                </div>
                <div className={styles.timeSep} />
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>{t("attendance.clockOut")}</span>
                  <span className={styles.timeValue}>--:--</span>
                </div>
              </>
            ) : todaySummary?.sessions?.length > 0 ? (
              <>
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>{t("attendance.firstClockIn")}</span>
                  <span className={styles.timeValue}>
                    {formatTime(todaySummary.sessions[0]?.clock_in, locale)}
                  </span>
                </div>
                <div className={styles.timeSep} />
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>{t("attendance.lastClockOut")}</span>
                  <span className={styles.timeValue}>
                    {formatTime([...todaySummary.sessions].reverse().find(s => s.clock_out)?.clock_out, locale)}
                  </span>
                </div>
                <div className={styles.timeSep} />
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>{t("attendance.totalToday")}</span>
                  <span className={styles.timeValue}>{formatHours(todaySummary.total_hours)}</span>
                </div>
                <div className={styles.timeSep} />
                <div className={styles.timeBlock}>
                  <span className={styles.timeLabel}>{t("attendance.sessions")}</span>
                  <span className={styles.timeValue}>{todaySummary.sessions.length}</span>
                </div>
                {parseFloat(todaySummary.overtime_hours) > 0 && (
                  <>
                    <div className={styles.timeSep} />
                    <div className={styles.timeBlock}>
                      <span className={styles.timeLabel}>{t("attendance.overtime")}</span>
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
                      <span className={styles.timeLabel}>{t("attendance.remaining")}</span>
                      <span className={styles.timeValue}>{formatHours(todaySummary.remaining_hours)}</span>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className={styles.timeBlock}>
                <span className={styles.timeLabel}>{t("attendance.clockIn")}</span>
                <span className={styles.timeValue}>--:--</span>
              </div>
            )}
          </div>
        </div>
        <div className={styles.todayRight}>
          {error && <p className={styles.errorMsg}>{error}</p>}
          {!hasOpenSession && (
            <button className={styles.btnIn} onClick={handleClockIn} disabled={loadingAction || !!onLeave}>
              {loadingAction && <span className={styles.spinner} />}
              {t("attendance.btnClockIn")}
            </button>
          )}
          {hasOpenSession && (
            <button className={styles.btnOut} onClick={handleClockOut} disabled={loadingAction || !!onLeave}>
              {loadingAction && <span className={styles.spinner} />}
              {t("attendance.btnClockOut")}
            </button>
          )}
          {isDayComplete && !hasOpenSession && (
            <span className={styles.doneTag}>{t("attendance.doneForToday")}</span>
          )}
        </div>
      </div>

      {/* Month summary */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>{t("attendance.summary.daysWorked")}</span>
          <span className={styles.summaryValue}>{totalDays}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>{t("attendance.summary.totalHours")}</span>
          <span className={styles.summaryValue}>{formatHours(totalHours)}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>{t("attendance.summary.completeShifts")}</span>
          <span className={styles.summaryValue}>{completeDays}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>{t("attendance.summary.incomplete")}</span>
          <span className={styles.summaryValue}>{incompleteDays}</span>
        </div>
      </div>

      {/* History */}
      <div className={styles.historySection}>
        <div className={styles.historyHeader}>
          <h2 className={styles.sectionTitle}>{t("attendance.monthlyHistory")}</h2>
          <div className={styles.monthNav}>
            <button className={styles.monthBtn} onClick={() => setMonthOffset((o) => o - 1)}>‹</button>
            <span className={styles.monthLabel}>{getMonthLabel(locale, monthOffset)}</span>
            <button
              className={styles.monthBtn}
              onClick={() => setMonthOffset((o) => Math.min(o + 1, 0))}
              disabled={monthOffset === 0}
            >›</button>
          </div>
        </div>

        <div className={styles.table}>
          <div className={`${styles.tableRow} ${styles.tableHead}`}>
            <span>{t("attendance.table.date")}</span>
            <span>{t("attendance.table.day")}</span>
            <span>{t("attendance.table.totalHours")}</span>
            <span>{t("attendance.table.sessions")}</span>
            <span>{t("attendance.table.remainingOvertime")}</span>
            <span>{t("attendance.table.status")}</span>
          </div>

          {loadingHistory ? (
            <div className={styles.empty}>{t("common.loading")}</div>
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
                      {date.toLocaleDateString(locale, { day: "numeric", month: "short" })}
                      {isToday && <span className={styles.todayPill}>{t("attendance.today")}</span>}
                    </span>
                    <span className={styles.muted}>
                      {date.toLocaleDateString(locale, { weekday: "short" })}
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
                              {t("attendance.request")}
                            </button>
                          )}
                          {row.overtime_request && (
                            <span className={`${styles.otStatus} ${
                              row.overtime_request.status === 'approved' ? styles.otApproved :
                              row.overtime_request.status === 'partially_approved' ? styles.otPartial :
                              row.overtime_request.status === 'rejected' ? styles.otRejected :
                              styles.otPending
                            }`}>
                              {row.overtime_request.status === 'approved' ? `✓ ${t("common.status.approved")}` :
                               row.overtime_request.status === 'partially_approved' ? `✓ ${row.overtime_request.approved_hours}h` :
                               row.overtime_request.status === 'rejected' ? `✗ ${t("common.status.rejected")}` :
                               `⏳ ${t("common.status.pending")}`}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className={styles.remainingText}>{formatHours(row.remaining_hours)}</span>
                      )}
                    </span>
                    <span>
                      <span className={`${styles.badge} ${
                        row.status === "complete"   ? styles.badgeGreen :
                        row.status === "in_progress" ? styles.badgeAmber :
                        row.status === "incomplete" ? styles.badgeRed :
                        styles.badgeGray
                      }`}>
                        {t(`common.status.${row.status === "complete" || row.status === "in_progress" || row.status === "incomplete" ? row.status : "absent"}`)}
                      </span>
                    </span>
                  </div>

                  {/* Sesiuni expandate */}
                  {expanded && row.sessions?.map((s, j) => (
                    <div key={j} className={styles.sessionRow}>
                      <span className={styles.sessionIndex}>#{j + 1}</span>
                      <span />
                      <span>
                        {formatTime(s.clock_in, locale)} → {s.clock_out ? formatTime(s.clock_out, locale) : t("attendance.open")}
                      </span>
                      <span>{formatHours(s.work_hours)}</span>
                      <span>
                        {parseFloat(s.night_hours) > 0 && (
                          <span className={styles.nightBadge}>🌙 {formatHours(s.night_hours)}</span>
                        )}
                      </span>
                      <span>
                        <span className={`${styles.badge} ${s.status === "complete" ? styles.badgeGreen : styles.badgeAmber}`}>
                          {s.status === "complete" ? t("common.status.complete") : t("common.status.open")}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              );
            })
          ) : (
            <div className={styles.empty}>{t("attendance.noRecords")}</div>
          )}
        </div>
      </div>
    </div>
  );
}