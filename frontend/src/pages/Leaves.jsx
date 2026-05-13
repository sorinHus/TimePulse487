import { useState, useEffect } from "react";
import {
  getLeaveTypes,
  getLeaveBalance,
  getLeaveRequests,
  createLeaveRequest,
  cancelLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  getWorkingDays,
  getSchedule,
  saveSchedule,
  submitSchedule,
} from "../api/leaves";
import { getColleagues } from "../api/auth";
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
  const isManager = user?.effective_role === "manager" || user?.role === "admin" || user?.role === "director";

  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [workingDays, setWorkingDays] = useState(null);
  const [colleagues, setColleagues] = useState([]);
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, note: "" });

  const PLAN_YEAR = new Date().getFullYear();
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [schedule, setSchedule] = useState(null);
  const [planEdit, setPlanEdit] = useState(false);
  const [monthlyInput, setMonthlyInput] = useState(Array(12).fill(0));
  const [planError, setPlanError] = useState("");
  const [planSaving, setPlanSaving] = useState(false);
  
  const [form, setForm] = useState({
    leave_type: "",
    start_date: "",
    end_date: "",
    reason: "",
    substitute: "",
  });

  const fetchSchedule = async () => {
    try {
      const s = await getSchedule(PLAN_YEAR);
      setSchedule(s);
      if (s?.monthly_plan) {
        setMonthlyInput(Array.from({length: 12}, (_, i) => Number(s.monthly_plan[String(i+1)] ?? 0)));
      }
    } catch { setSchedule(null); }
  };

  const fetchAll = async () => {
    try {
      const [types, bal, reqs, cols] = await Promise.all([
        getLeaveTypes(),
        getLeaveBalance(new Date().getFullYear()),
        getLeaveRequests(),
        getColleagues(),
      ]);
      setLeaveTypes(Array.isArray(types) ? types : types?.results || []);
      setBalances(Array.isArray(bal) ? bal : bal?.results || []);
      setRequests(Array.isArray(reqs) ? reqs : reqs?.results || []);
      setColleagues(Array.isArray(cols) ? cols : cols?.results || []);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchAll();
    fetchSchedule();
  }, []);

  useEffect(() => {
    if (form.start_date && form.end_date && form.end_date >= form.start_date) {
      getWorkingDays(form.start_date, form.end_date)
        .then(data => setWorkingDays(data.working_days))
        .catch(() => setWorkingDays(null));
    } else {
      setWorkingDays(null);
    }
  }, [form.start_date, form.end_date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.leave_type || !form.start_date || !form.end_date) {
      setFormError("Please fill in all required fields.");
      return;
    }
    if (!form.leave_type || !form.start_date || !form.end_date || !form.substitute) {
      setFormError("Please fill in all required fields.");
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

  const handleReject = (id) => {
    setRejectModal({ open: true, id, note: "" });
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal.note.trim()) return;
    try {
      await rejectLeaveRequest(rejectModal.id, rejectModal.note.trim());
      setRejectModal({ open: false, id: null, note: "" });
      await fetchAll();
    } catch {
      // silent
    }
  };

  const planTotal = monthlyInput.reduce((s, v) => s + Number(v || 0), 0);
  const planMax = schedule?.annual_leave_days ?? 21;

  const handlePlanSave = async () => {
    setPlanError("");
    setPlanSaving(true);
    try {
      const monthly_plan = {};
      monthlyInput.forEach((v, i) => { monthly_plan[String(i + 1)] = Number(v || 0); });
      const s = await saveSchedule(PLAN_YEAR, monthly_plan);
      setSchedule(s);
      setPlanEdit(false);
    } catch (e) {
      setPlanError(e?.response?.data?.detail || "Save failed.");
    } finally {
      setPlanSaving(false);
    }
  };

  const handlePlanSubmit = async () => {
    setPlanError("");
    try {
      const s = await submitSchedule(schedule.id);
      setSchedule(s);
    } catch (e) {
      setPlanError(e?.response?.data?.detail || "Submit failed.");
    }
  };

  const selectedType = leaveTypes.find((t) => String(t.id) === String(form.leave_type));
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
            const total = bal.total_days || 1;
            const remaining = Number(bal.remaining_days ?? 0);
            const expired = Number(bal.expired_days ?? 0);
            const used = total - remaining - expired;
            const pct = Math.min(100, Math.round(((used + expired) / total) * 100));

            let expiryChip = null;
            if (bal.expires_at) {
              const expiryDate = new Date(bal.expires_at);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const daysUntilExpiry = Math.round((expiryDate - today) / 86400000);
              if (expired > 0) {
                expiryChip = (
                  <span className={styles.chipExpired}>{expired} expired</span>
                );
              } else if (remaining > 0 && daysUntilExpiry <= 60 && daysUntilExpiry > 0) {
                expiryChip = (
                  <span className={styles.chipWarning}>Expires in {daysUntilExpiry}d</span>
                );
              }
            }

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
                  <span>{used} used{expired > 0 ? ` · ${expired} expired` : ""}</span>
                  <span>{total} total</span>
                </div>
                {expiryChip && <div>{expiryChip}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Annual Plan */}
      <div className={styles.planSection}>
        <div className={styles.planHeader}>
          <div>
            <span className={styles.planTitle}>Annual Leave Plan — {PLAN_YEAR}</span>
            {schedule?.status && (
              <span className={`${styles.planBadge} ${
                schedule.status === "approved"  ? styles.planBadgeGreen :
                schedule.status === "submitted" ? styles.planBadgeAmber :
                schedule.status === "rejected"  ? styles.planBadgeRed :
                styles.planBadgeGray
              }`}>
                {schedule.status === "approved"  ? "Approved" :
                 schedule.status === "submitted" ? "Awaiting approval" :
                 schedule.status === "rejected"  ? "Rejected" : "Draft"}
              </span>
            )}
          </div>
          <div className={styles.planActions}>
            {(!schedule?.status || schedule.status === "draft" || schedule.status === "rejected") && !planEdit && (
              <button className={styles.planBtnEdit} onClick={() => setPlanEdit(true)}>
                {schedule?.id ? "Edit plan" : "Create plan"}
              </button>
            )}
            {planEdit && (
              <>
                <button className={styles.planBtnCancel} onClick={() => { setPlanEdit(false); setPlanError(""); }}>Cancel</button>
                <button className={styles.planBtnSave} onClick={handlePlanSave} disabled={planSaving}>
                  {planSaving ? "Saving…" : "Save"}
                </button>
              </>
            )}
            {!planEdit && schedule?.id && schedule.status === "draft" && (
              <button className={styles.planBtnSubmit} onClick={handlePlanSubmit}>Submit for approval</button>
            )}
            {!planEdit && schedule?.id && schedule.status === "rejected" && (
              <button className={styles.planBtnSubmit} onClick={handlePlanSubmit}>Resubmit</button>
            )}
          </div>
        </div>

        {/* Carryover banner */}
        {Number(schedule?.carryover_days) > 0 && (
          <div className={styles.carryoverBanner}>
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <circle cx="8" cy="8" r="7" stroke="#fbbf24" strokeWidth="1.4"/>
              <path d="M8 5v3.5L10 10" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            You have <strong>{schedule.carryover_days} day{schedule.carryover_days !== 1 ? "s" : ""}</strong> remaining from {PLAN_YEAR - 1}
            {schedule.carryover_expires_at && (
              <> — expires <strong>{schedule.carryover_expires_at}</strong></>
            )}
          </div>
        )}

        {/* Rejected note */}
        {schedule?.status === "rejected" && schedule.review_note && (
          <div className={styles.planRejectedNote}>
            Rejected by {schedule.reviewed_by_name}: {schedule.review_note}
          </div>
        )}

        {/* Month grid */}
        <div className={styles.planGrid}>
          {MONTHS.map((m, i) => (
            <div key={i} className={styles.planMonthCell}>
              <span className={styles.planMonthLabel}>{m}</span>
              {planEdit ? (
                <input
                  type="number"
                  min="0"
                  max={planMax}
                  step="0.5"
                  className={styles.planMonthInput}
                  value={monthlyInput[i]}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value));
                    setMonthlyInput(prev => { const n = [...prev]; n[i] = v; return n; });
                  }}
                />
              ) : (
                <span className={`${styles.planMonthValue} ${Number(schedule?.monthly_plan?.[String(i+1)]) > 0 ? styles.planMonthFilled : ""}`}>
                  {Number(schedule?.monthly_plan?.[String(i+1)] ?? 0)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Progress */}
        <div className={styles.planProgress}>
          <div className={styles.planProgressBar}>
            <div
              className={`${styles.planProgressFill} ${planTotal > planMax ? styles.planProgressOver : ""}`}
              style={{ width: `${Math.min(100, Math.round((planTotal / planMax) * 100))}%` }}
            />
          </div>
          <span className={`${styles.planProgressLabel} ${planTotal > planMax ? styles.planProgressOver : ""}`}>
            {planEdit ? planTotal : Number(schedule?.total_planned_days ?? 0)} / {planMax} days planned
          </span>
        </div>

        {planError && <div className={styles.formError}>{planError}</div>}
      </div>

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
              <div className={styles.field}>
                <label className={styles.label}>Substitute *</label>
                <select
                  className={styles.select}
                  value={form.substitute}
                  onChange={(e) => setForm((f) => ({ ...f, substitute: e.target.value }))}
                  required
                >
                  <option value="">Select substitute…</option>
                  {colleagues.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} — {c.position || c.username}
                    </option>
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
                  min={new Date().toISOString().split("T")[0]}
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
                {workingDays !== null
                  ? `${workingDays} working day${workingDays !== 1 ? "s" : ""}`
                  : "Calculating…"}
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
          <div className={`${styles.tableRow} ${styles.tableHead} ${isManager ? styles.rowManager : ""}`}>
            {isManager && <span>Employee</span>}
            <span>Type</span>
            <span>From</span>
            <span>To</span>
            <span>Days</span>
            <span>Substitute</span>
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
                  <span className={styles.empName}>{req.full_name || req.username}</span>
                )}
                <span>
                  <span className={styles.typeChip}>{req.leave_type_name || req.leave_type}</span>
                </span>
                <span className={styles.muted}>{req.start_date}</span>
                <span className={styles.muted}>{req.end_date}</span>
                <span>{req.total_days ? Math.round(req.total_days) : "--"}</span>
                <span className={styles.muted}>{req.substitute_name || "—"}</span>
                <span>
                  <StatusBadge status={req.status} />
                  {req.status === "rejected" && req.review_note && (
                    <span className={styles.reviewNote} title={req.review_note}>
                      💬 {req.review_note}
                    </span>
                  )}
                </span>
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
                  {req.status === "pending" && isManager && req.user !== user?.id && (
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
    {/* Reject modal */}
      {rejectModal.open && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>Reject leave request</h3>
            <p className={styles.modalSubtitle}>Please provide a reason for rejection.</p>
            <textarea
              className={styles.textarea}
              rows={4}
              placeholder="Reason for rejection… *"
              value={rejectModal.note}
              onChange={(e) => setRejectModal((m) => ({ ...m, note: e.target.value }))}
              autoFocus
            />
            {!rejectModal.note.trim() && (
              <p className={styles.formError}>Reason is required.</p>
            )}
            <div className={styles.modalActions}>
              <button
                className={styles.btnCancel}
                onClick={() => setRejectModal({ open: false, id: null, note: "" })}
              >
                Cancel
              </button>
              <button
                className={styles.btnReject}
                onClick={handleRejectConfirm}
                disabled={!rejectModal.note.trim()}
              >
                Confirm reject
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}