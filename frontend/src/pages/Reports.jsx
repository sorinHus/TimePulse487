import { useState, useEffect } from "react";
import { exportAttendanceExcel, exportLeavesPdf, exportPontaj } from "../api/dashboard";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import styles from "./Reports.module.css";

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Reports() {
  const { user } = useAuth();
  const [attendanceMonth, setAttendanceMonth] = useState(getCurrentMonth());
  const [leavesMonth, setLeavesMonth] = useState(getCurrentMonth());
  const [pontajMonth, setPontajMonth] = useState(getCurrentMonth());
  const [pontajType, setPontajType] = useState("department");
  const [pontajDept, setPontajDept] = useState("");
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
      setErrors(e => ({ ...e, attendance: "Export failed. Please try again." }));
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
      setErrors(e => ({ ...e, leaves: "Export failed. Please try again." }));
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
      setErrors(e => ({ ...e, pontaj: "Export failed. Please try again." }));
    } finally {
      setLoadingPontaj(false);
    }
  };

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Reports</h1>
          <p className={styles.subtitle}>Export attendance and leave data</p>
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
              <h3 className={styles.cardTitle}>Attendance Report</h3>
              <p className={styles.cardDesc}>
                Monthly attendance data including check-in/check-out times and total hours worked per employee.
              </p>
              <div className={styles.filterRow}>
                <label className={styles.filterLabel}>Month</label>
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
                {loadingAttendance ? "Exporting…" : "Export Excel"}
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
              <h3 className={styles.cardTitle}>Leave Requests Report</h3>
              <p className={styles.cardDesc}>
                Summary of all approved, rejected and pending leave requests for the selected year.
              </p>
              <div className={styles.filterRow}>
                <label className={styles.filterLabel}>Month</label>
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
                {loadingLeaves ? "Exporting…" : "Export PDF"}
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
              <h3 className={styles.cardTitle}>Monthly Attendance Sheet</h3>
              <p className={styles.cardDesc}>
                Nexoria Group attendance register — worked days and leave codes (CO, CM, FP etc.) per employee.
              </p>
              <div className={styles.filterRow}>
                <label className={styles.filterLabel}>Month</label>
                <input
                  type="month"
                  className={styles.monthInput}
                  value={pontajMonth}
                  onChange={e => setPontajMonth(e.target.value)}
                />
              </div>
              <div className={styles.filterRow}>
                <label className={styles.filterLabel}>Type</label>
                <select
                  className={styles.monthInput}
                  value={pontajType}
                  onChange={e => setPontajType(e.target.value)}
                >
                  <option value="department">By department</option>
                  <option value="individual">By employee</option>
                </select>
              </div>
              {pontajType === "department" && (
                <div className={styles.filterRow}>
                  <label className={styles.filterLabel}>Department</label>
                  <select
                    className={styles.monthInput}
                    value={pontajDept}
                    onChange={e => setPontajDept(e.target.value)}
                  >
                    <option value="">All departments</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {pontajType === "individual" && (
                <div className={styles.filterRow}>
                  <label className={styles.filterLabel}>Employee</label>
                  <select
                    className={styles.monthInput}
                    value={pontajUser}
                    onChange={e => setPontajUser(e.target.value)}
                  >
                    <option value="">Select employee…</option>
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
                {loadingPontaj ? "Generating…" : "Export Excel"}
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
          Reports are generated server-side and downloaded directly to your browser.
          Only administrators and managers can access this page.
        </p>
      </div>

    </div>
  );
}