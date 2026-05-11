import { useState, useEffect } from "react";
import { getTeamCalendar } from "../api/dashboard";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import styles from "./Calendar.module.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);
  return cells;
}

const STATUS_COLOR = {
  present: "#22c55e",
  leave:   "#f59e0b",
  absent:  "#ef4444",
};

export default function Calendar() {
  const { user } = useAuth();
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [calData, setCalData]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState(null);
  const [departments, setDepartments] = useState([]);
  const [filterDept, setFilterDept]   = useState("");

  const isAdmin    = user?.effective_role === "admin";
  const isDirector = user?.effective_role === "director";
  const canFilterDept = isAdmin || isDirector;

  // Încarcă departamente pentru admin/director
  useEffect(() => {
    if (canFilterDept) {
      api.get("/departments/")
        .then(r => setDepartments(Array.isArray(r.data) ? r.data : r.data?.results || []))
        .catch(() => setDepartments([]));
    }
  }, [canFilterDept]);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    getTeamCalendar(year, month + 1, filterDept || null)
      .then(data => setCalData(Array.isArray(data) ? data : []))
      .catch(() => setCalData([]))
      .finally(() => setLoading(false));
  }, [year, month, filterDept]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const cells = getMonthGrid(year, month);
  const todayDay = today.getFullYear() === year && today.getMonth() === month
    ? today.getDate() : null;

  // Build lookup: day -> entries[]
  const dayMap = {};
  calData.forEach(entry => {
    const d = new Date(entry.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(entry);
    }
  });

  // Legend counts
  const counts = { present: 0, leave: 0, absent: 0 };
  Object.values(dayMap).forEach(entries =>
    entries.forEach(e => { if (counts[e.status] !== undefined) counts[e.status]++; })
  );

  const handleDayClick = (day) => {
    if (!day) return;
    const entries = dayMap[day] || [];
    setSelected(selected?.day === day ? null : { day, entries });
  };

  const monthLabel = new Date(year, month).toLocaleDateString("en-GB", {
    month: "long", year: "numeric",
  });

  // Grupează entries din ziua selectată per departament
  const groupByDept = (entries) => {
    const groups = {};
    entries.forEach(e => {
      const key = e.department_name || "—";
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return groups;
  };

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Team Calendar</h1>
          <p className={styles.subtitle}>Monthly attendance & leave overview</p>
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

      {/* Filtrare departament (admin/director) */}
      {canFilterDept && departments.length > 0 && (
        <div className={styles.filterBar}>
          <select
            className={styles.filterSelect}
            value={filterDept}
            onChange={e => { setFilterDept(e.target.value); setSelected(null); }}
          >
            <option value="">All departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Month nav */}
      <div className={styles.monthNav}>
        <button className={styles.navBtn} onClick={prevMonth}>‹</button>
        <span className={styles.monthLabel}>{monthLabel}</span>
        <button className={styles.navBtn} onClick={nextMonth}>›</button>
      </div>

      {/* Calendar grid */}
      <div className={styles.calendarWrap}>
        <div className={styles.dayHeaders}>
          {DAYS.map(d => (
            <div key={d} className={`${styles.dayHeader} ${d === "Sat" || d === "Sun" ? styles.weekend : ""}`}>
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className={styles.loadingMsg}>Loading…</div>
        ) : (
          <div className={styles.grid}>
            {cells.map((day, i) => {
              const entries  = day ? (dayMap[day] || []) : [];
              const isToday  = day === todayDay;
              const isWeekend = day ? ((i % 7) >= 5) : false;
              const isSelected = selected?.day === day;
              const statuses = [...new Set(entries.map(e => e.status))];

              // Culoare dominantă a zilei
              const dominantStatus = statuses.includes("leave") ? "leave"
                : statuses.includes("present") ? "present"
                : statuses.includes("absent") ? "absent" : null;

              return (
                <div
                  key={i}
                  className={`
                    ${styles.cell}
                    ${!day ? styles.cellEmpty : ""}
                    ${isToday ? styles.cellToday : ""}
                    ${isWeekend && day ? styles.cellWeekend : ""}
                    ${isSelected ? styles.cellSelected : ""}
                    ${day && entries.length > 0 ? styles.cellHasData : ""}
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
                      {dominantStatus && (
                        <div
                          className={styles.cellBar}
                          style={{ background: STATUS_COLOR[dominantStatus] }}
                        />
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
            <span className={styles.detailCount}>{selected.entries.length} member{selected.entries.length !== 1 ? "s" : ""}</span>
            <button className={styles.detailClose} onClick={() => setSelected(null)}>✕</button>
          </div>

          {selected.entries.length > 0 ? (
            canFilterDept && !filterDept ? (
              // Grupat per departament pentru admin/director fără filtru
              Object.entries(groupByDept(selected.entries)).map(([dept, entries]) => (
                <div key={dept} className={styles.deptGroup}>
                  <div className={styles.deptGroupTitle}>{dept}</div>
                  <div className={styles.detailList}>
                    {entries.map((entry, i) => (
                      <EntryRow key={i} entry={entry} />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.detailList}>
                {selected.entries.map((entry, i) => (
                  <EntryRow key={i} entry={entry} />
                ))}
              </div>
            )
          ) : (
            <p className={styles.detailEmpty}>No data for this day.</p>
          )}
        </div>
      )}
    </div>
  );
}

function EntryRow({ entry }) {
  const STATUS_COLOR = {
    present: "#22c55e",
    leave:   "#f59e0b",
    absent:  "#ef4444",
  };
  return (
    <div className={styles.detailRow}>
      <div className={styles.detailAvatar}>
        {(entry.full_name || entry.username || "?")[0].toUpperCase()}
      </div>
      <div className={styles.detailInfo}>
        <span className={styles.detailName}>{entry.full_name || entry.username}</span>
        {entry.leave_type && (
          <span className={styles.detailMeta}>{entry.leave_type}</span>
        )}
      </div>
      <span
        className={styles.detailStatus}
        style={{ background: `${STATUS_COLOR[entry.status]}22`, color: STATUS_COLOR[entry.status] }}
      >
        {entry.status}
      </span>
    </div>
  );
}