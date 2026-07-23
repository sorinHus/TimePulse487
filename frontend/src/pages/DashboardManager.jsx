import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { getManagerDashboard } from "../api/dashboard";
import { dateLocale } from "../i18n/config";
import styles from "./DashboardManager.module.css";

function formatHours(decimal) {
  if (!decimal && decimal !== 0) return "--";
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${h}h ${m}m`;
}

function formatTime(isoString, locale) {
  if (!isoString) return "--:--";
  return new Date(isoString).toLocaleTimeString(locale, {
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
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("attendance");

  useEffect(() => {
    getManagerDashboard()
      .then(setData)
      .catch(() => {});
  }, []);

  const firstName = user?.first_name || user?.username || t("dashboardEmployee.there");

  const pendingLeaves = data?.recent_pending_leaves || [];
  const teamAttendance = data?.team_status || [];
  const teamMembers = data?.team_status || [];

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("dashboardManager.title")}</h1>
          <p className={styles.subtitle}>
            {new Date().toLocaleDateString(locale, {
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
            {data?.stats?.total_team ?? "--"}
          </span>
          <span className={styles.teamLabel}>{t("dashboardManager.teamMembers")}</span>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <StatCard
          label={t("dashboardManager.stats.presentToday")}
          value={data?.stats?.present_today}
          sub={t("dashboardManager.stats.ofMembers", { total: data?.stats?.total_team ?? "--" })}
          accent="accentGreen"
          delay="0ms"
        />
        <StatCard
          label={t("dashboardManager.stats.onLeave")}
          value={data?.stats?.on_leave_today}
          sub={t("dashboardManager.stats.approvedAbsences")}
          accent="accentAmber"
          delay="50ms"
        />
        <StatCard
          label={t("dashboardManager.stats.pendingApprovals")}
          value={pendingLeaves.length}
          sub={t("dashboardManager.stats.leaveRequests")}
          accent={pendingLeaves.length > 0 ? "accentRed" : ""}
          delay="100ms"
        />
        <StatCard
          label={t("dashboardManager.stats.avgHours")}
          value={formatHours(data?.avg_hours_this_month)}
          sub={t("dashboardManager.stats.teamAverage")}
          delay="150ms"
        />
    </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "attendance" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("attendance")}
        >
          {t("dashboardManager.tabs.attendance")}
          {data?.present_today != null && (
            <span className={styles.tabBadge}>{data.present_today}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === "leaves" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("leaves")}
        >
          {t("dashboardManager.tabs.leaves")}
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
          {t("dashboardManager.tabs.team")}
        </button>
      </div>

      {/* Tab content */}
      <div className={styles.panel}>

        {/* Attendance tab */}
        {activeTab === "attendance" && (
          <div className={styles.table}>
            <div className={`${styles.tableRow} ${styles.tableHead}`}>
              <span>{t("dashboardManager.table.employee")}</span>
              <span>{t("dashboardManager.table.status")}</span>
              <span>{t("dashboardManager.table.checkIn")}</span>
              <span>{t("dashboardManager.table.checkOut")}</span>
              <span>{t("dashboardManager.table.hours")}</span>
            </div>
            {teamAttendance.length > 0 ? (
              teamAttendance.map((row, i) => (
                <div key={i} className={styles.tableRow}>
                  <span className={styles.employeeName}>
                    {row.full_name || row.username}
                  </span>
                  <span className={styles.statusCell}>
                    <StatusDot status={row.status} />
                    <span className={styles.statusText}>{t(`common.status.${row.status}`)}</span>
                  </span>
                  <span>{formatTime(row.check_in, locale)}</span>
                  <span>{formatTime(row.check_out, locale)}</span>
                  <span>{formatHours(row.hours_worked)}</span>
                </div>
              ))
            ) : (
              <div className={styles.empty}>{t("dashboardManager.noAttendance")}</div>
            )}
          </div>
        )}

        {/* Leaves tab */}
        {activeTab === "leaves" && (
          <div className={styles.table}>
            <div className={`${styles.tableRow} ${styles.tableHead}`}>
              <span>{t("dashboardManager.table.employee")}</span>
              <span>{t("dashboardManager.table.type")}</span>
              <span>{t("dashboardManager.table.from")}</span>
              <span>{t("dashboardManager.table.to")}</span>
              <span>{t("dashboardManager.table.days")}</span>
              <span>{t("dashboardManager.table.actions")}</span>
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
              <div className={styles.empty}>{t("dashboardManager.noPendingLeaves")}</div>
            )}
          </div>
        )}

        {/* Team tab */}
          {activeTab === "team" && (
            <div className={styles.teamGrid}>
              {teamMembers.length > 0 ? (
                teamMembers.map((member, i) => {
                  const nameParts = (member.full_name || member.username || "").split(" ");
                  const initials = nameParts.length >= 2
                    ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
                    : (member.full_name || member.username || "??").slice(0, 2).toUpperCase();
                  return (
                    <div key={i} className={styles.memberCard}>
                      <div className={styles.memberAvatar}>{initials}</div>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>
                          {member.full_name || member.username}
                        </span>
                        <span className={styles.memberPosition}>
                          {member.detail || t(`common.status.${member.status}`)}
                        </span>
                      </div>
                      <span className={`${styles.memberStatus} ${
                        member.status === 'present' ? styles.memberActive : styles.memberInactive
                      }`}>
                        {t(`common.status.${member.status}`)}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className={styles.empty}>{t("dashboardManager.noTeamMembers")}</div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
