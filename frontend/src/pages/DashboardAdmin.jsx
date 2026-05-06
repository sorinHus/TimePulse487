import { useState, useEffect } from "react";
import { getAdminDashboard } from "../api/dashboard";
import styles from "./DashboardAdmin.module.css";

function formatHours(decimal) {
  if (!decimal && decimal !== 0) return "--";
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${h}h ${m}m`;
}

function formatTime(isoString) {
  if (!isoString) return "--:--";
  return new Date(isoString).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function KpiCard({ label, value, sub, color, delay }) {
  return (
    <div className={styles.kpiCard} style={{ animationDelay: delay }}>
      <div className={styles.kpiTop}>
        <span className={styles.kpiLabel}>{label}</span>
        <div className={styles.kpiBar} style={{ background: color }} />
      </div>
      <span className={styles.kpiValue}>{value ?? "--"}</span>
      {sub && <span className={styles.kpiSub}>{sub}</span>}
    </div>
  );
}

const TABS = ["Attendance", "Leave requests", "Employees"];

export default function DashboardAdmin() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("Attendance");

  useEffect(() => {
    getAdminDashboard()
      .then(setData)
      .catch(() => {});
  }, []);

  const attendance = data?.today_attendance || [];
  const leaveRequests = data?.recent_leave_requests || [];
  const employees = data?.employees || [];

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <p className={styles.headerEyebrow}>Admin Console</p>
          <h1 className={styles.title}>Organization Overview</h1>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.dateText}>
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* KPI row */}
      <div className={styles.kpiGrid}>
        <KpiCard
          label="Total employees"
          value={data?.total_employees}
          sub="active accounts"
          color="#2563eb"
          delay="0ms"
        />
        <KpiCard
          label="Present today"
          value={data?.present_today}
          sub={`of ${data?.total_employees ?? "--"}`}
          color="#22c55e"
          delay="40ms"
        />
        <KpiCard
          label="On leave"
          value={data?.on_leave_today}
          sub="approved"
          color="#f59e0b"
          delay="80ms"
        />
        <KpiCard
          label="Absent"
          value={data?.absent_today}
          sub="no check-in"
          color="#ef4444"
          delay="120ms"
        />
        <KpiCard
          label="Avg hours / month"
          value={formatHours(data?.avg_hours_this_month)}
          sub="org average"
          color="#8b5cf6"
          delay="160ms"
        />
        <KpiCard
          label="Pending leaves"
          value={data?.pending_leave_requests}
          sub="awaiting approval"
          color="#ec4899"
          delay="200ms"
        />
      </div>

      {/* Departments summary */}
      {data?.departments?.length > 0 && (
        <div className={styles.deptSection}>
          <h2 className={styles.sectionTitle}>Departments</h2>
          <div className={styles.deptGrid}>
            {data.departments.map((dept, i) => (
              <div key={i} className={styles.deptCard}>
                <div className={styles.deptTop}>
                  <span className={styles.deptName}>{dept.name}</span>
                  <span className={styles.deptCount}>{dept.employee_count} members</span>
                </div>
                <div className={styles.deptBar}>
                  <div
                    className={styles.deptBarFill}
                    style={{
                      width: `${data.total_employees
                        ? Math.round((dept.employee_count / data.total_employees) * 100)
                        : 0}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab === "Leave requests" && data?.pending_leave_requests > 0 && (
              <span className={styles.tabBadge}>{data.pending_leave_requests}</span>
            )}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className={styles.panel}>

        {/* Attendance tab */}
        {activeTab === "Attendance" && (
          <div className={styles.table}>
            <div className={`${styles.tableRow} ${styles.tableHead}`}>
              <span>Employee</span>
              <span>Department</span>
              <span>Check in</span>
              <span>Check out</span>
              <span>Hours</span>
              <span>Status</span>
            </div>
            {attendance.length > 0 ? (
              attendance.map((row, i) => (
                <div key={i} className={styles.tableRow}>
                  <span className={styles.empName}>{row.full_name || row.username}</span>
                  <span className={styles.muted}>{row.department_name || "--"}</span>
                  <span>{formatTime(row.check_in)}</span>
                  <span>{formatTime(row.check_out)}</span>
                  <span>{formatHours(row.hours_worked)}</span>
                  <span>
                    <span className={`${styles.badge} ${
                      row.status === "present" ? styles.badgeGreen :
                      row.status === "leave"   ? styles.badgeAmber :
                      row.status === "absent"  ? styles.badgeRed : styles.badgeGray
                    }`}>
                      {row.status || "--"}
                    </span>
                  </span>
                </div>
              ))
            ) : (
              <div className={styles.empty}>No attendance data for today.</div>
            )}
          </div>
        )}

        {/* Leave requests tab */}
        {activeTab === "Leave requests" && (
          <div className={styles.table}>
            <div className={`${styles.tableRow} ${styles.tableHeadLeave}`}>
              <span>Employee</span>
              <span>Type</span>
              <span>From</span>
              <span>To</span>
              <span>Days</span>
              <span>Status</span>
            </div>
            {leaveRequests.length > 0 ? (
              leaveRequests.map((req, i) => (
                <div key={i} className={`${styles.tableRow} ${styles.tableRowLeave}`}>
                  <span className={styles.empName}>{req.employee_name || req.employee}</span>
                  <span>
                    <span className={styles.leaveChip}>{req.leave_type_name || req.leave_type}</span>
                  </span>
                  <span className={styles.muted}>{req.start_date}</span>
                  <span className={styles.muted}>{req.end_date}</span>
                  <span>{req.days_requested ?? "--"}</span>
                  <span>
                    <span className={`${styles.badge} ${
                      req.status === "approved" ? styles.badgeGreen :
                      req.status === "rejected" ? styles.badgeRed :
                      styles.badgeAmber
                    }`}>
                      {req.status}
                    </span>
                  </span>
                </div>
              ))
            ) : (
              <div className={styles.empty}>No leave requests found.</div>
            )}
          </div>
        )}

        {/* Employees tab */}
        {activeTab === "Employees" && (
          <div className={styles.table}>
            <div className={`${styles.tableRow} ${styles.tableHeadEmp}`}>
              <span>Name</span>
              <span>Role</span>
              <span>Department</span>
              <span>Position</span>
              <span>Status</span>
            </div>
            {employees.length > 0 ? (
              employees.map((emp, i) => {
                const initials = emp.first_name && emp.last_name
                  ? `${emp.first_name[0]}${emp.last_name[0]}`.toUpperCase()
                  : emp.username?.slice(0, 2).toUpperCase() || "??";
                return (
                  <div key={i} className={`${styles.tableRow} ${styles.tableRowEmp}`}>
                    <span className={styles.empCell}>
                      <span className={styles.empAvatar}>{initials}</span>
                      <span className={styles.empName}>{emp.full_name || emp.username}</span>
                    </span>
                    <span>
                      <span className={`${styles.roleBadge} ${styles[`role_${emp.role}`]}`}>
                        {emp.role}
                      </span>
                    </span>
                    <span className={styles.muted}>{emp.department_name || "--"}</span>
                    <span className={styles.muted}>{emp.position || "--"}</span>
                    <span>
                      <span className={`${styles.badge} ${emp.is_active ? styles.badgeGreen : styles.badgeGray}`}>
                        {emp.is_active ? "Active" : "Inactive"}
                      </span>
                    </span>
                  </div>
                );
              })
            ) : (
              <div className={styles.empty}>No employees found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}