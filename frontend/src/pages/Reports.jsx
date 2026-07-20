import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { exportAttendanceExcel, exportLeavesPdf, exportPontaj } from "../api/dashboard";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import styles from "./Reports.module.css";

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Reports() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isManager = user?.effective_role === "manager";

  const [attendanceMonth, setAttendanceMonth] = useState(getCurrentMonth());
  const [leavesMonth, setLeavesMonth] = useState(getCurrentMonth());
  const [pontajMonth, setPontajMonth] = useState(getCurrentMonth());
  const [pontajType, setPontajType] = useState("department");
  const [pontajDept, setPontajDept] = useState(() =>
    user?.effective_role === "manager" ? String(user.department_id) : ""
  );
  const [pontajUser, setPontajUser] = useState("");
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [loadingPontaj, setLoadingPontaj] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.get("/departments/")
      .then(r => setDepartments(Array.isArray(r.data) ? r.data : r.data?.results || []))
      .catch(() => {});
    api.get("/users/")
      .then(r => setUsers(Array.isArray(r.data) ? r.data : r.data?.results || []))
      .catch(() => {});
  }, []);

  // Daca e manager, forteaza intotdeauna department_id-ul sau
  useEffect(() => {
    if (isManager && user?.department_id) {
      setPontajDept(String(user.department_id));
    }
  }, [isManager, user?.department_id]);

  const handleExportAttendance = async () => {
    setErrors({});
    setLoadingAttendance(true);
    try {
      const [year, month] = attendanceMonth.split("-");
      const blob = await exportAttendanceExcel(year, month);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_${attendanceMonth}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setErrors(e => ({ ...e, attendance: t("reports.exportFailed") }));
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleExportLeaves = async () => {
    setErrors({});
    setLoadingLeaves(true);
    try {
      const [year] = leavesMonth.split("-");
      const blob = await exportLeavesPdf(year);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leaves_${leavesMonth}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setErrors(e => ({ ...e, leaves: t("reports.exportFailed") }));
    } finally {
      setLoadingLeaves(false);
    }
  };

  const handleExportPontaj = async () => {
    setErrors({});
    setLoadingPontaj(true);
    try {
      const [year, month] = pontajMonth.split("-");
      const blob = await exportPontaj(
        year, month,
        pontajType === "department" ? pontajDept || null : null,
        pontajType === "individual" ? pontajUser || null : null,
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_sheet_${pontajMonth}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setErrors(e => ({ ...e, pontaj: t("reports.exportFailed") }));
    } finally {
      setLoadingPontaj(false);
    }
  };

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("reports.title")}</h1>
          <p className={styles.subtitle}>{t("reports.subtitle")}</p>
        </div>
      </div>

      {/* Report cards */}
      <div className={styles.cardsGrid}>

        {/* Attendance Excel */}
        <div className={styles.reportCardWrap}>
          <div className={styles.reportCard}>
            <div className={styles.cardIcon} style={{ background: "#22c55e18", color: "#22c55e" }}>
              <svg viewBox="0 0 24 24" fill="none" width="24" height="24">
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>{t("reports.attendance.title")}</h3>
              <p className={styles.cardDesc}>
                {t("reports.attendance.desc")}
              </p>
              <div className={styles.filterRow}>
                <label className={styles.filterLabel}>{t("reports.month")}</label>
                <input
                  type="month"
                  className={styles.monthInput}
                  value={attendanceMonth}
                  onChange={e => setAttendanceMonth(e.target.value)}
                />
              </div>
              {errors.attendance && <p className={styles.errorMsg}>{errors.attendance}</p>}
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.formatBadge} style={{ background: "#22c55e18", color: "#22c55e" }}>.xlsx</span>
              <button
                className={styles.exportBtn}
                style={{ background: "#22c55e18", color: "#22c55e", borderColor: "#22c55e33" }}
                onClick={handleExportAttendance}
                disabled={loadingAttendance}
              >
                {loadingAttendance ? <span className={styles.spinner} /> : (
                  <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                    <path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {loadingAttendance ? t("reports.exporting") : t("reports.exportExcel")}
              </button>
            </div>
          </div>
        </div>

        {/* Leaves PDF */}
        <div className={styles.reportCardWrap}>
          <div className={styles.reportCard}>
            <div className={styles.cardIcon} style={{ background: "#ef444418", color: "#ef4444" }}>
              <svg viewBox="0 0 24 24" fill="none" width="24" height="24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>{t("reports.leaves.title")}</h3>
              <p className={styles.cardDesc}>
                {t("reports.leaves.desc")}
              </p>
              <div className={styles.filterRow}>
                <label className={styles.filterLabel}>{t("reports.month")}</label>
                <input
                  type="month"
                  className={styles.monthInput}
                  value={leavesMonth}
                  onChange={e => setLeavesMonth(e.target.value)}
                />
              </div>
              {errors.leaves && <p className={styles.errorMsg}>{errors.leaves}</p>}
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.formatBadge} style={{ background: "#ef444418", color: "#ef4444" }}>.pdf</span>
              <button
                className={styles.exportBtn}
                style={{ background: "#ef444418", color: "#ef4444", borderColor: "#ef444433" }}
                onClick={handleExportLeaves}
                disabled={loadingLeaves}
              >
                {loadingLeaves ? <span className={styles.spinner} /> : (
                  <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                    <path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {loadingLeaves ? t("reports.exporting") : t("reports.exportPdf")}
              </button>
            </div>
          </div>
        </div>

        {/* Monthly Attendance Sheet */}
        <div className={styles.reportCardWrap}>
          <div className={styles.reportCard}>
            <div className={styles.cardIcon} style={{ background: "#3b82f618", color: "#3b82f6" }}>
              <svg viewBox="0 0 24 24" fill="none" width="24" height="24">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 9h18M9 3v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>{t("reports.pontaj.title")}</h3>
              <p className={styles.cardDesc}>
                {t("reports.pontaj.desc")}
              </p>
              <div className={styles.filterRow}>
                <label className={styles.filterLabel}>{t("reports.month")}</label>
                <input
                  type="month"
                  className={styles.monthInput}
                  value={pontajMonth}
                  onChange={e => setPontajMonth(e.target.value)}
                />
              </div>
              <div className={styles.filterRow}>
                <label className={styles.filterLabel}>{t("reports.type")}</label>
                <select
                  className={styles.monthInput}
                  value={pontajType}
                  onChange={e => setPontajType(e.target.value)}
                >
                  <option value="department">{t("reports.pontaj.byDepartment")}</option>
                  <option value="individual">{t("reports.pontaj.byEmployee")}</option>
                </select>
              </div>

              {/* Selectorul de departament: vizibil doar pentru admin */}
              {pontajType === "department" && !isManager && (
                <div className={styles.filterRow}>
                  <label className={styles.filterLabel}>{t("reports.department")}</label>
                  <select
                    className={styles.monthInput}
                    value={pontajDept}
                    onChange={e => setPontajDept(e.target.value)}
                  >
                    <option value="">{t("reports.allDepartments")}</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Daca e manager si type=department, arata departamentul sau (read-only) */}
              {pontajType === "department" && isManager && (
                <div className={styles.filterRow}>
                  <label className={styles.filterLabel}>{t("reports.department")}</label>
                  <input
                    className={styles.monthInput}
                    value={departments.find(d => String(d.id) === String(user.department_id))?.name || t("reports.pontaj.yourDepartment")}
                    readOnly
                    style={{ opacity: 0.7, cursor: "not-allowed" }}
                  />
                </div>
              )}

              {pontajType === "individual" && (
                <div className={styles.filterRow}>
                  <label className={styles.filterLabel}>{t("reports.employee")}</label>
                  <select
                    className={styles.monthInput}
                    value={pontajUser}
                    onChange={e => setPontajUser(e.target.value)}
                  >
                    <option value="">{t("reports.pontaj.selectEmployee")}</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} — {u.department_name || u.username}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {errors.pontaj && <p className={styles.errorMsg}>{errors.pontaj}</p>}
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.formatBadge} style={{ background: "#3b82f618", color: "#3b82f6" }}>.xlsx</span>
              <button
                className={styles.exportBtn}
                style={{ background: "#3b82f618", color: "#3b82f6", borderColor: "#3b82f633" }}
                onClick={handleExportPontaj}
                disabled={loadingPontaj}
              >
                {loadingPontaj ? <span className={styles.spinner} /> : (
                  <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                    <path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {loadingPontaj ? t("reports.pontaj.generating") : t("reports.exportExcel")}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Info box */}
      <div className={styles.infoBox}>
        <svg viewBox="0 0 20 20" fill="none" width="16" height="16" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="10" cy="10" r="8" stroke="#475569" strokeWidth="1.5" />
          <path d="M10 9v5M10 7v.5" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className={styles.infoText}>
          {t("reports.infoText")}
        </p>
      </div>

    </div>
  );
}