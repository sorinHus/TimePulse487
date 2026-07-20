import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const map = {
    pending:  styles.badgeAmber,
    approved: styles.badgeGreen,
    rejected: styles.badgeRed,
    cancelled: styles.badgeGray,
  };
  return (
    <span className={`${styles.badge} ${map[status] || styles.badgeGray}`}>
      {t(`common.status.${status}`)}
    </span>
  );
}

export default function Leaves() {
  const { t } = useTranslation();
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
  const MONTHS = t("common.monthsShort", { returnObjects: true });
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
      setFormError(t("leaves.fillRequiredFields"));
      return;
    }
    if (!form.leave_type || !form.start_date || !form.end_date || !form.substitute) {
      setFormError(t("leaves.fillRequiredFields"));
      return;
    }
    setSubmitting(true);
    try {
      await createLeaveRequest(form);
      setSuccessMsg(t("leaves.submittedSuccess"));
      setShowForm(false);
      setForm({ leave_type: "", start_date: "", end_date: "", reason: "" });
      await fetchAll();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (e) {
      setFormError(
        e?.response?.data?.detail ||
        Object.values(e?.response?.data || {}).flat().join(" ") ||
        t("leaves.submissionFailed")
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
      setPlanError(e?.response?.data?.detail || t("leaves.saveFailed"));
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
      setPlanError(e?.response?.data?.detail || t("leaves.submitFailed"));
    }
  };

  const selectedType = leaveTypes.find((lt) => String(lt.id) === String(form.leave_type));
  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("leaves.title")}</h1>
          <p className={styles.subtitle}>{t("leaves.subtitle")}</p>
        </div>
        <button className={styles.btnNew} onClick={() => { setShowForm((v) => !v); setFormError(""); }}>
          {showForm ? t("leaves.cancelNew") : t("leaves.newRequest")}
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
            const type = leaveTypes.find((lt) => lt.id === bal.leave_type || lt.id === bal.leave_type_id);
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
                  <span className={styles.chipExpired}>{t("leaves.expiredChip", { count: expired })}</span>
                );
              } else if (remaining > 0 && daysUntilExpiry <= 60 && daysUntilExpiry > 0) {
                expiryChip = (
                  <span className={styles.chipWarning}>{t("leaves.expiresIn", { days: daysUntilExpiry })}</span>
                );
              }
            }

            return (
              <div key={i} className={styles.balanceCard}>
                <div className={styles.balanceTop}>
                  <span className={styles.balanceName}>{type?.name || bal.leave_type_name || t("leaves.leaveFallback")}</span>
                  <span className={styles.balanceDays}>{remaining} <small>{t("leaves.daysLeft")}</small></span>
                </div>
                <div className={styles.balanceBarBg}>
                  <div
                    className={styles.balanceBarFill}
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
                <div className={styles.balanceMeta}>
                  <span>{used} {t("leaves.used")}{expired > 0 ? ` · ${expired} ${t("leaves.expired")}` : ""}</span>
                  <span>{total} {t("leaves.total")}</span>
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
            <span className={styles.planTitle}>{t("leaves.annualPlan", { year: PLAN_YEAR })}</span>
            {schedule?.status && (
              <span className={`${styles.planBadge} ${
                schedule.status === "approved"  ? styles.planBadgeGreen :
                schedule.status === "submitted" ? styles.planBadgeAmber :
                schedule.status === "rejected"  ? styles.planBadgeRed :
                styles.planBadgeGray
              }`}>
                {t(`common.status.${schedule.status}`)}
              </span>
            )}
          </div>
          <div className={styles.planActions}>
            {(!schedule?.status || schedule.status === "draft" || schedule.status === "rejected") && !planEdit && (
              <button className={styles.planBtnEdit} onClick={() => setPlanEdit(true)}>
                {schedule?.id ? t("leaves.editPlan") : t("leaves.createPlan")}
              </button>
            )}
            {planEdit && (
              <>
                <button className={styles.planBtnCancel} onClick={() => { setPlanEdit(false); setPlanError(""); }}>{t("common.cancel")}</button>
                <button className={styles.planBtnSave} onClick={handlePlanSave} disabled={planSaving}>
                  {planSaving ? t("common.saving") : t("common.save")}
                </button>
              </>
            )}
            {!planEdit && schedule?.id && schedule.status === "draft" && (
              <button className={styles.planBtnSubmit} onClick={handlePlanSubmit}>{t("leaves.submitForApproval")}</button>
            )}
            {!planEdit && schedule?.id && schedule.status === "rejected" && (
              <button className={styles.planBtnSubmit} onClick={handlePlanSubmit}>{t("leaves.resubmit")}</button>
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
            {t("leaves.carryover", {
              dayCount: `${schedule.carryover_days} ${schedule.carryover_days === 1 ? t("common.day") : t("common.days")}`,
              year: PLAN_YEAR - 1,
            })}
            {schedule.carryover_expires_at && t("leaves.carryoverExpires", { date: schedule.carryover_expires_at })}
          </div>
        )}

        {/* Rejected note */}
        {schedule?.status === "rejected" && schedule.review_note && (
          <div className={styles.planRejectedNote}>
            {t("leaves.rejectedBy", { name: schedule.reviewed_by_name, note: schedule.review_note })}
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
            {t("leaves.plannedOfMax", { planned: planEdit ? planTotal : Number(schedule?.total_planned_days ?? 0), max: planMax })}
          </span>
        </div>

        {planError && <div className={styles.formError}>{planError}</div>}
      </div>

      {/* New request form */}
      {showForm && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>{t("leaves.newRequestTitle")}</h2>
          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <div className={styles.formRow}>
              <div className={styles.field}>
                <label className={styles.label}>{t("leaves.leaveType")}</label>
                <select
                  className={styles.select}
                  value={form.leave_type}
                  onChange={(e) => setForm((f) => ({ ...f, leave_type: e.target.value }))}
                  required
                >
                  <option value="">{t("leaves.selectType")}</option>
                  {leaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>{lt.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t("leaves.substitute")}</label>
                <select
                  className={styles.select}
                  value={form.substitute}
                  onChange={(e) => setForm((f) => ({ ...f, substitute: e.target.value }))}
                  required
                >
                  <option value="">{t("leaves.selectSubstitute")}</option>
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
                <label className={styles.label}>{t("leaves.startDate")}</label>
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
                <label className={styles.label}>{t("leaves.endDate")}</label>
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
                  ? `${workingDays} ${workingDays === 1 ? t("common.workingDay") : t("common.workingDays")}`
                  : t("leaves.calculating")}
                {selectedType && ` · ${selectedType.name}`}
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>{t("leaves.reason")} <span className={styles.optional}>{t("leaves.optional")}</span></label>
              <textarea
                className={styles.textarea}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder={t("leaves.reasonPlaceholder")}
                rows={3}
              />
            </div>

            {formError && <div className={styles.formError}>{formError}</div>}

            <div className={styles.formActions}>
              <button type="submit" className={styles.btnSubmit} disabled={submitting}>
                {submitting ? <span className={styles.spinner} /> : null}
                {t("leaves.submitRequest")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requests list */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {isManager ? t("leaves.allRequests") : t("leaves.myRequests")}
        </h2>
        <div className={styles.table}>
          <div className={`${styles.tableRow} ${styles.tableHead} ${isManager ? styles.rowManager : ""}`}>
            {isManager && <span>{t("leaves.table.employee")}</span>}
            <span>{t("leaves.table.type")}</span>
            <span>{t("leaves.table.from")}</span>
            <span>{t("leaves.table.to")}</span>
            <span>{t("leaves.table.days")}</span>
            <span>{t("leaves.table.substitute")}</span>
            <span>{t("leaves.table.status")}</span>
            <span>{t("leaves.table.actions")}</span>
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
                      title={t("leaves.cancelAction")}
                    >
                      {t("leaves.cancelAction")}
                    </button>
                  )}
                  {req.status === "pending" && isManager && req.user !== user?.id && (
                    <>
                      <button className={styles.btnApprove} onClick={() => handleApprove(req.id)} title={t("leaves.approve")}>✓</button>
                      <button className={styles.btnReject} onClick={() => handleReject(req.id)} title={t("leaves.reject")}>✕</button>
                    </>
                  )}
                </span>
              </div>
            ))
          ) : (
            <div className={styles.empty}>{t("leaves.noRequests")}</div>
          )}
        </div>
      </div>
    {/* Reject modal */}
      {rejectModal.open && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>{t("leaves.rejectModalTitle")}</h3>
            <p className={styles.modalSubtitle}>{t("leaves.rejectModalSubtitle")}</p>
            <textarea
              className={styles.textarea}
              rows={4}
              placeholder={t("leaves.rejectPlaceholder")}
              value={rejectModal.note}
              onChange={(e) => setRejectModal((m) => ({ ...m, note: e.target.value }))}
              autoFocus
            />
            {!rejectModal.note.trim() && (
              <p className={styles.formError}>{t("leaves.reasonRequired")}</p>
            )}
            <div className={styles.modalActions}>
              <button
                className={styles.btnCancel}
                onClick={() => setRejectModal({ open: false, id: null, note: "" })}
              >
                {t("common.cancel")}
              </button>
              <button
                className={styles.btnReject}
                onClick={handleRejectConfirm}
                disabled={!rejectModal.note.trim()}
              >
                {t("leaves.confirmReject")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}