import { useState, useEffect } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import styles from "./Team.module.css";

function getInitials(u) {
  if (u.first_name && u.last_name)
    return `${u.first_name[0]}${u.last_name[0]}`.toUpperCase();
  return (u.username || "?").slice(0, 2).toUpperCase();
}

const ROLE_COLORS = {
  admin:    { bg: "rgba(139,92,246,0.15)",  color: "#c4b5fd" },
  manager:  { bg: "rgba(14,165,233,0.12)",  color: "#38bdf8" },
  employee: { bg: "rgba(100,116,139,0.1)",  color: "#94a3b8" },
};

export default function Team() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [view, setView] = useState("grid"); // grid | list

  useEffect(() => {
    const endpoint = isAdmin ? "/users/" : "/attendance/team/";
    api.get(endpoint)
      .then((res) => setMembers(Array.isArray(res.data) ? res.data : res.data?.results || []))
      .catch(() => setMembers([]));

    api.get("/departments/")
      .then((res) => setDepartments(Array.isArray(res.data) ? res.data : res.data?.results || []))
      .catch(() => setDepartments([]));
  }, [isAdmin]);

  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      m.username?.toLowerCase().includes(q) ||
      m.first_name?.toLowerCase().includes(q) ||
      m.last_name?.toLowerCase().includes(q) ||
      m.full_name?.toLowerCase().includes(q) ||
      m.position?.toLowerCase().includes(q);
    const matchDept = !filterDept || String(m.department) === filterDept || m.department_name === filterDept;
    const matchRole = !filterRole || m.role === filterRole;
    return matchSearch && matchDept && matchRole;
  });

  const activeCount = members.filter((m) => m.is_active !== false).length;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Team</h1>
          <p className={styles.subtitle}>
            {activeCount} active member{activeCount !== 1 ? "s" : ""}
            {departments.length > 0 && ` · ${departments.length} departments`}
          </p>
        </div>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${view === "grid" ? styles.viewBtnActive : ""}`}
            onClick={() => setView("grid")}
            title="Grid view"
          >
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" />
              <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.5" />
              <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.5" />
              <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.5" />
            </svg>
          </button>
          <button
            className={`${styles.viewBtn} ${view === "list" ? styles.viewBtnActive : ""}`}
            onClick={() => setView("list")}
            title="List view"
          >
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <path d="M1 4h14M1 8h14M1 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchWrap}>
          <svg viewBox="0 0 16 16" fill="none" width="13" height="13" className={styles.searchIcon}>
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            className={styles.searchInput}
            placeholder="Search by name or position…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {departments.length > 0 && (
          <select
            className={styles.filterSelect}
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        )}
        {isAdmin && (
          <select
            className={styles.filterSelect}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="employee">Employee</option>
          </select>
        )}
      </div>

      {/* Results count */}
      {(search || filterDept || filterRole) && (
        <p className={styles.resultCount}>
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          <button className={styles.clearBtn} onClick={() => { setSearch(""); setFilterDept(""); setFilterRole(""); }}>
            Clear filters
          </button>
        </p>
      )}

      {/* Grid view */}
      {view === "grid" && (
        <div className={styles.grid}>
          {filtered.length > 0 ? filtered.map((m, i) => {
            const roleStyle = ROLE_COLORS[m.role] || ROLE_COLORS.employee;
            return (
              <div key={i} className={`${styles.card} ${m.is_active === false ? styles.cardInactive : ""}`}>
                <div className={styles.cardAvatar} style={{ background: roleStyle.bg, color: roleStyle.color }}>
                  {getInitials(m)}
                </div>
                <div className={styles.cardName}>{m.full_name || `${m.first_name || ""} ${m.last_name || ""}`.trim() || m.username}</div>
                {m.position && <div className={styles.cardPosition}>{m.position}</div>}
                <div className={styles.cardMeta}>
                  {m.role && (
                    <span className={styles.rolePill} style={{ background: roleStyle.bg, color: roleStyle.color }}>
                      {m.role}
                    </span>
                  )}
                  {m.department_name && (
                    <span className={styles.deptPill}>{m.department_name}</span>
                  )}
                </div>
                {m.email && <div className={styles.cardEmail}>{m.email}</div>}
              </div>
            );
          }) : (
            <div className={styles.empty}>No team members found.</div>
          )}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className={styles.table}>
          <div className={`${styles.tableRow} ${styles.tableHead}`}>
            <span>Member</span>
            <span>Role</span>
            <span>Department</span>
            <span>Position</span>
            <span>Email</span>
            <span>Status</span>
          </div>
          {filtered.length > 0 ? filtered.map((m, i) => {
            const roleStyle = ROLE_COLORS[m.role] || ROLE_COLORS.employee;
            return (
              <div key={i} className={styles.tableRow}>
                <span className={styles.memberCell}>
                  <span className={styles.listAvatar} style={{ background: roleStyle.bg, color: roleStyle.color }}>
                    {getInitials(m)}
                  </span>
                  <span className={styles.memberInfo}>
                    <span className={styles.memberName}>{m.full_name || m.username}</span>
                    <span className={styles.memberUser}>@{m.username}</span>
                  </span>
                </span>
                <span>
                  <span className={styles.rolePill} style={{ background: roleStyle.bg, color: roleStyle.color }}>
                    {m.role || "--"}
                  </span>
                </span>
                <span className={styles.muted}>{m.department_name || "—"}</span>
                <span className={styles.muted}>{m.position || "—"}</span>
                <span className={styles.muted}>{m.email || "—"}</span>
                <span>
                  <span className={`${styles.statusBadge} ${m.is_active === false ? styles.statusInactive : styles.statusActive}`}>
                    {m.is_active === false ? "Inactive" : "Active"}
                  </span>
                </span>
              </div>
            );
          }) : (
            <div className={styles.empty}>No team members found.</div>
          )}
        </div>
      )}
    </div>
  );
}