import { useState, useEffect } from "react";
import {
  getLeaveTypes,
  getLeaveBalance,
  getLeaveRequests,
  createLeaveRequest,
  cancelLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
} from "../api/leaves";
import { useAuth } from "../context/AuthContext";
import styles from "./Leaves.module.css";

function daysBetween(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end) - new Date(start);
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

function StatusBadge({ status }) {
  const map = {
    pending:  styles.badgeAmber,
    approved: styles.badgeGreen,
    rejected: styles.badgeRed,
    cancelled: styles.badgeGray,
  };
  return (
    <span className={`${styles.badge} ${map[status] || styles.badgeGray}`}>
      {status}
    </span>
  );
}

export default function Leaves() {
  const { user } = useAuth();
  const isManager = user?.role === "manager" || user?.role === "admin";

  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [form, setForm] = useState({
    leave_type: "",
    start_date: "",
    end_date: "",
    reason: "",
  });

  const fetchAll = async () => {
    try {
      const [types, bal, reqs] = await Promise.all([
        getLeaveTypes(),
        getLeaveBalance(),
        getLeaveRequests(),
      ]);
      console.log('TYPES:', types);
      setLeaveTypes(Array.isArray(types) ? types : types?.results || []);
      setBalances(Array.isArray(bal) ? bal : bal?.results || []);
      setRequests(Array.isArray(reqs) ? reqs : reqs?.results || []);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.leave_type || !form.start_date || !form.end_date) {
      setFormError("Please fill in all required fields.");
      return;
    }
    if (new Date(form.end_date) < new Date(form.start_date)) {
      setFormError("End date cannot be before start date.");
      return;
    }
    setSubmitting(true);
    try {
      await createLeaveRequest(form);
      setSuccessMsg("Leave request submitted successfully.");
      setShowForm(false);
      setForm({ leave_type: "", start_date: "", end_date: "", reason: "" });
      await fetchAll();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (e) {
      setFormError(
        e?.response?.data?.detail ||
        Object.values(e?.response?.data || {}).flat().join(" ") ||
        "Submission failed."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    try {
      await cancelLeaveRequest(id);
      await fetchAll();
    } catch {
      // silent
    }
  };

  const handleApprove = async (id) => {
    try {
      await approveLeaveRequest(id);
      await fetchAll();
    } catch {
      // silent
    }
  };

  const handleReject = async (id) => {
    try {
      await rejectLeaveRequest(id);
      await fetchAll();
    } catch {
      // silent
    }
  };

  const selectedType = leaveTypes.find((t) => String(t.id) === String(form.leave_type));
  const days = daysBetween(form.start_date, form.end_date);

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Leave Requests</h1>
          <p className={styles.subtitle}>Manage your time off</p>
        </div>
        <button className={styles.btnNew} onClick={() => { setShowForm((v) => !v); setFormError(""); }}>
          {showForm ? "✕ Cancel" : "+ New request"}
        </button>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className={styles.successBanner}>{successMsg}</div>
      )}

      {/* Balance cards */}
      {balances.length > 0 && (
        <div className={styles.balanceGrid}>
          {balances.map((bal, i) => {
            const type = leaveTypes.find((t) => t.id === bal.leave_type || t.id === bal.leave_type_id);
            const color = type?.color || "#2563eb";
            const used = (type?.max_days || bal.total_days || 0) - (bal.remaining_days ?? bal.balance ?? 0);
            const total = type?.max_days || bal.total_days || 1;
            const remaining = bal.remaining_days ?? bal.balance ?? 0;
            const pct = Math.min(100, Math.round((used / total) * 100));
            return (
              <div key={i} className={styles.balanceCard}>
                <div className={styles.balanceTop}>
                  <span className={styles.balanceName}>{type?.name || bal.leave_type_name || "Leave"}</span>
                  <span className={styles.balanceDays}>{remaining} <small>days left</small></span>
                </div>
                <div className={styles.balanceBarBg}>
                  <div
                    className={styles.balanceBarFill}
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
                <div className={styles.balanceMeta}>
                  <span>{used} used</span>
                  <span>{total} total</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New request form */}
      {showForm && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>New leave request</h2>
          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <div className={styles.formRow}>
              <div className={styles.field}>
                <label className={styles.label}>Leave type *</label>
                <select
                  className={styles.select}
                  value={form.leave_type}
                  onChange={(e) => setForm((f) => ({ ...f, leave_type: e.target.value }))}
                  required
                >
                  <option value="">Select type…</option>
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.field}>
                <label className={styles.label}>Start date *</label>
                <input
                  type="date"
                  className={styles.input}
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>End date *</label>
                <input
                  type="date"
                  className={styles.input}
                  value={form.end_date}
                  min={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  required
                />
              </div>
            </div>

            {form.start_date && form.end_date && (
              <div className={styles.daysPill}>
                {days} day{days !== 1 ? "s" : ""}
                {selectedType && ` · ${selectedType.name}`}
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>Reason <span className={styles.optional}>(optional)</span></label>
              <textarea
                className={styles.textarea}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Briefly describe the reason for your absence…"
                rows={3}
              />
            </div>

            {formError && <div className={styles.formError}>{formError}</div>}

            <div className={styles.formActions}>
              <button type="submit" className={styles.btnSubmit} disabled={submitting}>
                {submitting ? <span className={styles.spinner} /> : null}
                Submit request
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requests list */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {isManager ? "All requests" : "My requests"}
        </h2>
        <div className={styles.table}>
          <div className={`${styles.tableRow} ${styles.tableHead}`}>
            {isManager && <span>Employee</span>}
            <span>Type</span>
            <span>From</span>
            <span>To</span>
            <span>Days</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {requests.length > 0 ? (
            requests.map((req, i) => (
              <div
                key={i}
                className={`${styles.tableRow} ${isManager ? styles.rowManager : ""}`}
              >
                {isManager && (
                  <span className={styles.empName}>{req.employee_name || req.employee}</span>
                )}
                <span>
                  <span className={styles.typeChip}>{req.leave_type_name || req.leave_type}</span>
                </span>
                <span className={styles.muted}>{req.start_date}</span>
                <span className={styles.muted}>{req.end_date}</span>
                <span>{req.days_requested ?? "--"}</span>
                <span><StatusBadge status={req.status} /></span>
                <span className={styles.actions}>
                  {req.status === "pending" && !isManager && (
                    <button
                      className={styles.btnCancel}
                      onClick={() => handleCancel(req.id)}
                      title="Cancel"
                    >
                      Cancel
                    </button>
                  )}
                  {req.status === "pending" && isManager && (
                    <>
                      <button className={styles.btnApprove} onClick={() => handleApprove(req.id)} title="Approve">✓</button>
                      <button className={styles.btnReject} onClick={() => handleReject(req.id)} title="Reject">✕</button>
                    </>
                  )}
                </span>
              </div>
            ))
          ) : (
            <div className={styles.empty}>No leave requests found.</div>
          )}
        </div>
      </div>
    </div>
  );
}