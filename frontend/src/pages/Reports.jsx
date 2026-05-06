import { useState } from "react";
import { exportAttendanceExcel, exportLeavesPdf } from "../api/dashboard";
import styles from "./Reports.module.css";

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ReportCard({ icon, title, description, format, color, onExport, loading }) {
  return (
    <div className={styles.reportCard}>
      <div className={styles.cardIcon} style={{ background: `${color}18`, color }}>
        {icon}
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.cardDesc}>{description}</p>
      </div>
      <div className={styles.cardFooter}>
        <span className={styles.formatBadge}>{format}</span>
        <button
          className={styles.exportBtn}
          style={{ background: `${color}18`, color, borderColor: `${color}33` }}
          onClick={onExport}
          disabled={loading}
        >
          {loading ? <span className={styles.spinner} /> : (
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {loading ? "Exporting…" : "Export"}
        </button>
      </div>
    </div>
  );
}

export default function Reports() {
  const [attendanceMonth, setAttendanceMonth] = useState(getCurrentMonth());
  const [leavesMonth, setLeavesMonth] = useState(getCurrentMonth());
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [errors, setErrors] = useState({});

  const handleExportAttendance = async () => {
    setErrors({});
    setLoadingAttendance(true);
    try {
      const blob = await exportAttendanceExcel(attendanceMonth);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_${attendanceMonth}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setErrors((e) => ({ ...e, attendance: "Export failed. Please try again." }));
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleExportLeaves = async () => {
    setErrors({});
    setLoadingLeaves(true);
    try {
      const blob = await exportLeavesPdf(leavesMonth);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leaves_${leavesMonth}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setErrors((e) => ({ ...e, leaves: "Export failed. Please try again." }));
    } finally {
      setLoadingLeaves(false);
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
                  onChange={(e) => setAttendanceMonth(e.target.value)}
                />
              </div>
              {errors.attendance && (
                <p className={styles.errorMsg}>{errors.attendance}</p>
              )}
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.formatBadge} style={{ background: "#22c55e18", color: "#22c55e" }}>
                .xlsx
              </span>
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
                Summary of all approved, rejected and pending leave requests for the selected month.
              </p>
              <div className={styles.filterRow}>
                <label className={styles.filterLabel}>Month</label>
                <input
                  type="month"
                  className={styles.monthInput}
                  value={leavesMonth}
                  onChange={(e) => setLeavesMonth(e.target.value)}
                />
              </div>
              {errors.leaves && (
                <p className={styles.errorMsg}>{errors.leaves}</p>
              )}
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.formatBadge} style={{ background: "#ef444418", color: "#ef4444" }}>
                .pdf
              </span>
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