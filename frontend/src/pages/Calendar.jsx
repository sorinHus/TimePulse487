import { useState, useEffect } from "react";
import { getTeamCalendar } from "../api/dashboard";
import styles from "./Calendar.module.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonthGrid(year, month) {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Monday-first: 0=Mon ... 6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);
  return cells;
}

function getMonthParam(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

const STATUS_COLOR = {
  present:  "#22c55e",
  leave:    "#f59e0b",
  absent:   "#ef4444",
  weekend:  "transparent",
  holiday:  "#8b5cf6",
};

export default function Calendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [calData, setCalData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null); // { day, entries }

  useEffect(() => {
    setLoading(true);
    getTeamCalendar(getMonthParam(year, month))
      .then((data) => setCalData(Array.isArray(data) ? data : data?.results || []))
      .catch(() => setCalData([]))
      .finally(() => setLoading(false));
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelected(null);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelected(null);
  };

  const cells = getMonthGrid(year, month);
  const todayDay = today.getFullYear() === year && today.getMonth() === month
    ? today.getDate() : null;

  // Build lookup: day -> entries[]
  const dayMap = {};
  calData.forEach((entry) => {
    const d = new Date(entry.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(entry);
    }
  });

  // Legend counts for this month
  const counts = { present: 0, leave: 0, absent: 0 };
  Object.values(dayMap).forEach((entries) => {
    entries.forEach((e) => {
      if (counts[e.status] !== undefined) counts[e.status]++;
    });
  });

  const handleDayClick = (day) => {
    if (!day) return;
    const entries = dayMap[day] || [];
    setSelected(selected?.day === day ? null : { day, entries });
  };

  const monthLabel = new Date(year, month).toLocaleDateString("en-GB", {
    month: "long", year: "numeric",
  });

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Team Calendar</h1>
          <p className={styles.subtitle}>Monthly attendance overview</p>
        </div>
        <div className={styles.legend}>
          {Object.entries({ present: "Present", leave: "On leave", absent: "Absent" }).map(([key, label]) => (
            <span key={key} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: STATUS_COLOR[key] }} />
              {label}
              <span className={styles.legendCount}>{counts[key]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Month nav */}
      <div className={styles.monthNav}>
        <button className={styles.navBtn} onClick={prevMonth}>‹</button>
        <span className={styles.monthLabel}>{monthLabel}</span>
        <button className={styles.navBtn} onClick={nextMonth}>›</button>
      </div>

      {/* Calendar grid */}
      <div className={styles.calendarWrap}>
        {/* Day headers */}
        <div className={styles.dayHeaders}>
          {DAYS.map((d) => (
            <div key={d} className={`${styles.dayHeader} ${d === "Sat" || d === "Sun" ? styles.weekend : ""}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        {loading ? (
          <div className={styles.loadingMsg}>Loading…</div>
        ) : (
          <div className={styles.grid}>
            {cells.map((day, i) => {
              const entries = day ? (dayMap[day] || []) : [];
              const isToday = day === todayDay;
              const isWeekend = day ? ((i % 7) >= 5) : false;
              const isEmpty = !day;
              const isSelected = selected?.day === day;

              // Aggregate status dots (unique statuses)
              const statuses = [...new Set(entries.map((e) => e.status))];

              return (
                <div
                  key={i}
                  className={`
                    ${styles.cell}
                    ${isEmpty ? styles.cellEmpty : ""}
                    ${isToday ? styles.cellToday : ""}
                    ${isWeekend && !isEmpty ? styles.cellWeekend : ""}
                    ${isSelected ? styles.cellSelected : ""}
                    ${!isEmpty && entries.length > 0 ? styles.cellHasData : ""}
                  `}
                  onClick={() => handleDayClick(day)}
                >
                  {day && (
                    <>
                      <span className={styles.cellDay}>{day}</span>
                      {entries.length > 0 && (
                        <div className={styles.cellDots}>
                          {statuses.slice(0, 3).map((s, j) => (
                            <span
                              key={j}
                              className={styles.dot}
                              style={{ background: STATUS_COLOR[s] || "#475569" }}
                            />
                          ))}
                          {entries.length > 3 && (
                            <span className={styles.dotMore}>+{entries.length - 3}</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Day detail panel */}
      {selected && (
        <div className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <h2 className={styles.detailTitle}>
              {new Date(year, month, selected.day).toLocaleDateString("en-GB", {
                weekday: "long", day: "numeric", month: "long",
              })}
            </h2>
            <button className={styles.detailClose} onClick={() => setSelected(null)}>✕</button>
          </div>
          {selected.entries.length > 0 ? (
            <div className={styles.detailList}>
              {selected.entries.map((entry, i) => (
                <div key={i} className={styles.detailRow}>
                  <div className={styles.detailAvatar}>
                    {(entry.full_name || entry.username || "?")[0].toUpperCase()}
                  </div>
                  <div className={styles.detailInfo}>
                    <span className={styles.detailName}>{entry.full_name || entry.username}</span>
                    {entry.check_in && (
                      <span className={styles.detailMeta}>
                        {new Date(entry.check_in).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        {entry.check_out && ` → ${new Date(entry.check_out).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
                      </span>
                    )}
                  </div>
                  <span
                    className={styles.detailStatus}
                    style={{ background: `${STATUS_COLOR[entry.status]}22`, color: STATUS_COLOR[entry.status] }}
                  >
                    {entry.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.detailEmpty}>No data for this day.</p>
          )}
        </div>
      )}
    </div>
  );
}