import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getManagerDashboard } from "../api/dashboard";
import styles from "./DashboardManager.module.css";

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

function StatusDot({ status }) {
  const map = {
    present: styles.dotGreen,
    absent: styles.dotRed,
    leave: styles.dotAmber,
    late: styles.dotOrange,
  };
  return <span className={`${styles.dot} ${map[status] || styles.dotGray}`} />;
}

function StatCard({ label, value, sub, accent, delay }) {
  return (
    <div
      className={`${styles.statCard} ${accent ? styles[accent] : ""}`}
      style={{ animationDelay: delay }}
    >
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value ?? "--"}</span>
      {sub && <span className={styles.statSub}>{sub}</span>}
    </div>
  );
}

export default function DashboardManager() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("attendance");

  useEffect(() => {
    getManagerDashboard()
      .then(setData)
      .catch(() => {});
  }, []);

  const firstName = user?.first_name || user?.username || "there";

  const pendingLeaves = data?.pending_leave_requests || [];
  const teamAttendance = data?.team_attendance || [];
  const teamMembers = data?.team_members || [];

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Team Overview</h1>
          <p className={styles.subtitle}>
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {" · "}
            <span className={styles.managerName}>{firstName}</span>
          </p>
        </div>
        <div className={styles.headerBadge}>
          <span className={styles.teamCount}>
            {data?.team_size ?? "--"}
          </span>
          <span className={styles.teamLabel}>team members</span>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <StatCard
          label="Present today"
          value={data?.present_today}
          sub={`of ${data?.team_size ?? "--"} members`}
          accent="accentGreen"
          delay="0ms"
        />
        <StatCard
          label="On leave"
          value={data?.on_leave_today}
          sub="approved absences"
          accent="accentAmber"
          delay="50ms"
        />
        <StatCard
          label="Pending approvals"
          value={pendingLeaves.length}
          sub="leave requests"
          accent={pendingLeaves.length > 0 ? "accentRed" : ""}
          delay="100ms"
        />
        <StatCard
          label="Avg hours / month"
          value={formatHours(data?.avg_hours_this_month)}
          sub="team average"
          delay="150ms"
        />
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "attendance" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("attendance")}
        >
          Today's attendance
          {data?.present_today != null && (
            <span className={styles.tabBadge}>{data.present_today}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === "leaves" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("leaves")}
        >
          Pending leaves
          {pendingLeaves.length > 0 && (
            <span className={`${styles.tabBadge} ${styles.tabBadgeRed}`}>
              {pendingLeaves.length}
            </span>
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === "team" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("team")}
        >
          Team members
        </button>
      </div>

      {/* Tab content */}
      <div className={styles.panel}>

        {/* Attendance tab */}
        {activeTab === "attendance" && (
          <div className={styles.table}>
            <div className={`${styles.tableRow} ${styles.tableHead}`}>
              <span>Employee</span>
              <span>Status</span>
              <span>Check in</span>
              <span>Check out</span>
              <span>Hours</span>
            </div>
            {teamAttendance.length > 0 ? (
              teamAttendance.map((row, i) => (
                <div key={i} className={styles.tableRow}>
                  <span className={styles.employeeName}>
                    {row.full_name || row.username}
                  </span>
                  <span className={styles.statusCell}>
                    <StatusDot status={row.status} />
                    <span className={styles.statusText}>{row.status}</span>
                  </span>
                  <span>{formatTime(row.check_in)}</span>
                  <span>{formatTime(row.check_out)}</span>
                  <span>{formatHours(row.hours_worked)}</span>
                </div>
              ))
            ) : (
              <div className={styles.empty}>No attendance data for today.</div>
            )}
          </div>
        )}

        {/* Leaves tab */}
        {activeTab === "leaves" && (
          <div className={styles.table}>
            <div className={`${styles.tableRow} ${styles.tableHead}`}>
              <span>Employee</span>
              <span>Type</span>
              <span>From</span>
              <span>To</span>
              <span>Days</span>
              <span>Actions</span>
            </div>
            {pendingLeaves.length > 0 ? (
              pendingLeaves.map((req, i) => (
                <div key={i} className={styles.tableRow}>
                  <span className={styles.employeeName}>
                    {req.employee_name || req.employee}
                  </span>
                  <span>
                    <span className={styles.leaveType}>{req.leave_type_name || req.leave_type}</span>
                  </span>
                  <span>{req.start_date}</span>
                  <span>{req.end_date}</span>
                  <span>{req.days_requested ?? "--"}</span>
                  <span className={styles.actions}>
                    <a
                      href={`/leaves/${req.id}/approve`}
                      className={styles.btnApprove}
                      onClick={(e) => {
                        e.preventDefault();
                        // approve action — wired in Leaves page
                      }}
                    >
                      ✓
                    </a>
                    <a
                      href={`/leaves/${req.id}/reject`}
                      className={styles.btnReject}
                      onClick={(e) => {
                        e.preventDefault();
                      }}
                    >
                      ✕
                    </a>
                  </span>
                </div>
              ))
            ) : (
              <div className={styles.empty}>No pending leave requests.</div>
            )}
          </div>
        )}

        {/* Team tab */}
        {activeTab === "team" && (
          <div className={styles.teamGrid}>
            {teamMembers.length > 0 ? (
              teamMembers.map((member, i) => {
                const initials = member.first_name && member.last_name
                  ? `${member.first_name[0]}${member.last_name[0]}`.toUpperCase()
                  : member.username?.slice(0, 2).toUpperCase() || "??";
                return (
                  <div key={i} className={styles.memberCard}>
                    <div className={styles.memberAvatar}>{initials}</div>
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>
                        {member.full_name || member.username}
                      </span>
                      <span className={styles.memberPosition}>
                        {member.position || member.role}
                      </span>
                    </div>
                    <span className={`${styles.memberStatus} ${member.is_active ? styles.memberActive : styles.memberInactive}`}>
                      {member.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className={styles.empty}>No team members found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
