import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getTeamCalendar } from "../api/dashboard";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { dateLocale, translateLeaveType } from "../i18n/config";
import styles from "./Calendar.module.css";

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
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

function getInitials(fullName) {
  if (!fullName) return "?";
  const parts = fullName.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

// Bar per angajat în celulă cu tooltip la hover
function EntryChip({ entry }) {
  const { t } = useTranslation();
  const color = entry.status === "leave"
    ? (entry.color || "#f59e0b")
    : "#ef4444";

  const tooltipText = entry.status === "leave"
    ? `${entry.full_name} · ${translateLeaveType(t, entry.leave_type) || t("leaves.leaveFallback")}`
    : `${entry.full_name} · ${t("common.status.absent")}`;

  return (
    <div
      className={styles.entryChip}
      style={{ background: `${color}22`, borderLeft: `3px solid ${color}` }}
      title={tooltipText}
    >
      <span className={styles.chipInitials} style={{ color }}>
        {getInitials(entry.full_name)}
      </span>
      <span className={styles.chipName}>{entry.full_name?.split(" ")[0] || entry.username}</span>
    </div>
  );
}

export default function Calendar() {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);
  const DAYS = [
    t("calendar.days.mon"), t("calendar.days.tue"), t("calendar.days.wed"),
    t("calendar.days.thu"), t("calendar.days.fri"), t("calendar.days.sat"), t("calendar.days.sun"),
  ];
  const { user } = useAuth();
  const today = new Date();
  const [year, setYear]     = useState(today.getFullYear());
  const [month, setMonth]   = useState(today.getMonth());
  const [calData, setCalData]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [selected, setSelected]     = useState(null);
  const [departments, setDepartments] = useState([]);
  const [filterDept, setFilterDept]   = useState("");

  const isAdmin    = user?.effective_role === "admin";
  const isDirector = user?.effective_role === "director";
  const canFilterDept = isAdmin || isDirector;

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

  // dayMap: day -> { leave: [], absent: [] }
  const dayMap = {};
  calData.forEach(entry => {
    if (entry.status !== "leave" && entry.status !== "absent") return;
    const d = new Date(entry.date);
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    const day = d.getDate();
    if (!dayMap[day]) dayMap[day] = { leave: [], absent: [] };
    if (entry.status === "leave") dayMap[day].leave.push(entry);
    else dayMap[day].absent.push(entry);
  });

  // Legend counts
  const counts = { present: 0, leave: 0, absent: 0 };
  calData.forEach(e => { if (counts[e.status] !== undefined) counts[e.status]++; });

  const handleDayClick = (day) => {
    if (!day) return;
    const entries = [...(dayMap[day]?.leave || []), ...(dayMap[day]?.absent || [])];
    if (!entries.length) return;
    setSelected(selected?.day === day ? null : { day, entries });
  };

  const monthLabel = new Date(year, month).toLocaleDateString(locale, {
    month: "long", year: "numeric",
  });

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
          <h1 className={styles.title}>{t("calendar.title")}</h1>
          <p className={styles.subtitle}>{t("calendar.subtitle")}</p>
        </div>
        <div className={styles.legend}>
          {Object.entries({ present: t("calendar.legend.present"), leave: t("calendar.legend.onLeave"), absent: t("calendar.legend.absent") }).map(([key, label]) => (
            <span key={key} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: STATUS_COLOR[key] }} />
              {label}
              <span className={styles.legendCount}>{counts[key]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Filtru departament */}
      {canFilterDept && departments.length > 0 && (
        <div className={styles.filterBar}>
          <select
            className={styles.filterSelect}
            value={filterDept}
            onChange={e => { setFilterDept(e.target.value); setSelected(null); }}
          >
            <option value="">{t("calendar.allDepartments")}</option>
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
          {DAYS.map((d, i) => (
            <div key={d} className={`${styles.dayHeader} ${i >= 5 ? styles.weekend : ""}`}>
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className={styles.loadingMsg}>{t("calendar.loading")}</div>
        ) : (
          <div className={styles.grid}>
            {cells.map((day, i) => {
              const dayEntries = day ? dayMap[day] : null;
              const leaveEntries  = dayEntries?.leave  || [];
              const absentEntries = dayEntries?.absent || [];
              const allEntries    = [...leaveEntries, ...absentEntries];
              const isToday    = day === todayDay;
              const isWeekend  = day ? ((i % 7) >= 5) : false;
              const isSelected = selected?.day === day;
              const hasData    = allEntries.length > 0;
              const MAX_VISIBLE = 3;

              return (
                <div
                  key={i}
                  className={`
                    ${styles.cell}
                    ${!day ? styles.cellEmpty : ""}
                    ${isToday ? styles.cellToday : ""}
                    ${isWeekend && day ? styles.cellWeekend : ""}
                    ${isSelected ? styles.cellSelected : ""}
                    ${hasData ? styles.cellHasData : ""}
                  `}
                  onClick={() => handleDayClick(day)}
                >
                  {day && (
                    <>
                      <span className={styles.cellDay}>{day}</span>
                      <div className={styles.chipList}>
                        {allEntries.slice(0, MAX_VISIBLE).map((entry, j) => (
                          <EntryChip key={j} entry={entry} />
                        ))}
                        {allEntries.length > MAX_VISIBLE && (
                          <div className={styles.chipMore}>
                            {t("calendar.moreCount", { count: allEntries.length - MAX_VISIBLE })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <h2 className={styles.detailTitle}>
              {new Date(year, month, selected.day).toLocaleDateString(locale, {
                weekday: "long", day: "numeric", month: "long",
              })}
            </h2>
            <span className={styles.detailCount}>
              {t("calendar.memberCount", { count: selected.entries.length })}
            </span>
            <button className={styles.detailClose} onClick={() => setSelected(null)}>✕</button>
          </div>

          {canFilterDept && !filterDept ? (
            Object.entries(groupByDept(selected.entries)).map(([dept, entries]) => (
              <div key={dept} className={styles.deptGroup}>
                <div className={styles.deptGroupTitle}>{dept}</div>
                <div className={styles.detailList}>
                  {entries.map((entry, i) => <DetailRow key={i} entry={entry} />)}
                </div>
              </div>
            ))
          ) : (
            <div className={styles.detailList}>
              {selected.entries.map((entry, i) => <DetailRow key={i} entry={entry} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ entry }) {
  const { t } = useTranslation();
  const color = entry.status === "leave"
    ? (entry.color || "#f59e0b")
    : "#ef4444";

  return (
    <div className={styles.detailRow}>
      <div className={styles.detailAvatar} style={{ background: `${color}22`, color }}>
        {getInitials(entry.full_name)}
      </div>
      <div className={styles.detailInfo}>
        <span className={styles.detailName}>{entry.full_name || entry.username}</span>
        {entry.leave_type && (
          <span className={styles.detailMeta}>{translateLeaveType(t, entry.leave_type)}</span>
        )}
      </div>
      <span
        className={styles.detailStatus}
        style={{ background: `${color}22`, color }}
      >
        {entry.status === "leave" ? (translateLeaveType(t, entry.leave_type) || t("leaves.leaveFallback")) : t("common.status.absent")}
      </span>
    </div>
  );
}
