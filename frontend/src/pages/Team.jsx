import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import { registerSickLeave, getTeamSchedule, reviewSchedule } from "../api/leaves";
import { useAuth } from "../context/AuthContext";
import { translateLeaveType } from "../i18n/config";
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

const EMPTY_SICK = {
  start_date: "",
  end_date: "",
  medical_document: "",
  overlap_action: "return",
};

export default function Team() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.effective_role === "admin";
  const isManager = user?.effective_role === "manager";
  const canRegisterSick = isAdmin || isManager;

  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [view, setView] = useState("grid");

  const MONTHS = t("common.monthsShort", { returnObjects: true });
  const PLAN_YEAR = new Date().getFullYear();

  // Modal plan
  const [planModal, setPlanModal] = useState(null); // { member, schedule }
  const [planLoading, setPlanLoading] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  async function openPlanModal(member) {
    setPlanModal({ member, schedule: null });
    setRejectNote("");
    setShowRejectForm(false);
    try {
      const s = await getTeamSchedule(PLAN_YEAR, member.id);
      setPlanModal({ member, schedule: s });
    } catch {
      setPlanModal({ member, schedule: null });
    }
  }

  async function handlePlanReview(action) {
    if (!planModal?.schedule?.id) return;
    if (action === "reject" && !rejectNote.trim()) return;
    setPlanLoading(true);
    try {
      const s = await reviewSchedule(planModal.schedule.id, action, rejectNote.trim());
      setPlanModal((m) => ({ ...m, schedule: s }));
      setShowRejectForm(false);
    } catch (e) {
      alert(e?.response?.data?.detail || t("team.reviewActionFailed"));
    } finally {
      setPlanLoading(false);
    }
  }

  // Modal sick leave
  const [sickModal, setSickModal] = useState(null); // { member } sau null
  const [sickForm, setSickForm] = useState(EMPTY_SICK);
  const [sickLoading, setSickLoading] = useState(false);
  const [sickError, setSickError] = useState("");
  const [sickSuccess, setSickSuccess] = useState(null); // răspuns de la API

  useEffect(() => {
    if (isAdmin) {
      api.get("/users/")
        .then((res) => setMembers(Array.isArray(res.data) ? res.data : res.data?.results || []))
        .catch(() => setMembers([]));
    } else {
      api.get("/dashboard/manager/")
        .then((res) => {
          const team = (res.data?.team_status || []).map(m => ({
            ...m,
            id: m.user_id,
            username: m.full_name?.toLowerCase().replace(' ', '.') || '',
            is_active: true,
            role: 'employee',
          }));
          setMembers(team);
        })
        .catch(() => setMembers([]));
    }
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

  // ── Modal handlers ───────────────────────────────────────────────────────
  function openSickModal(member) {
    setSickModal({ member });
    setSickForm(EMPTY_SICK);
    setSickError("");
    setSickSuccess(null);
  }

  function closeSickModal() {
    setSickModal(null);
    setSickSuccess(null);
    setSickError("");
  }

  async function handleSickSubmit() {
    if (!sickForm.start_date || !sickForm.end_date) {
      setSickError(t("team.sick.startEndRequired"));
      return;
    }
    if (sickForm.start_date > sickForm.end_date) {
      setSickError(t("team.sick.endAfterStart"));
      return;
    }
    setSickLoading(true);
    setSickError("");
    try {
      const payload = {
        user_id: sickModal.member.id,
        start_date: sickForm.start_date,
        end_date: sickForm.end_date,
        medical_document: sickForm.medical_document || "",
        overlap_action: sickForm.overlap_action,
      };
      const result = await registerSickLeave(payload);
      setSickSuccess(result);
    } catch (err) {
      const msg = err?.response?.data?.detail || JSON.stringify(err?.response?.data) || t("team.sick.genericError");
      setSickError(msg);
    } finally {
      setSickLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("team.title")}</h1>
          <p className={styles.subtitle}>
            {t("team.activeMembers", { count: activeCount })}
            {departments.length > 0 && t("team.departmentsCount", { count: departments.length })}
          </p>
        </div>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${view === "grid" ? styles.viewBtnActive : ""}`}
            onClick={() => setView("grid")}
            title={t("team.gridView")}
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
            title={t("team.listView")}
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
            placeholder={t("team.searchPlaceholder")}
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
            <option value="">{t("team.allDepartments")}</option>
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
            <option value="">{t("team.allRoles")}</option>
            <option value="admin">{t("common.roles.admin")}</option>
            <option value="manager">{t("common.roles.manager")}</option>
            <option value="employee">{t("common.roles.employee")}</option>
          </select>
        )}
      </div>

      {/* Results count */}
      {(search || filterDept || filterRole) && (
        <p className={styles.resultCount}>
          {t("team.resultsCount", { count: filtered.length })}
          <button className={styles.clearBtn} onClick={() => { setSearch(""); setFilterDept(""); setFilterRole(""); }}>
            {t("team.clearFilters")}
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
                      {t(`common.roles.${m.role}`)}
                    </span>
                  )}
                  {m.department_name && (
                    <span className={styles.deptPill}>{m.department_name}</span>
                  )}
                </div>
                {m.email && <div className={styles.cardEmail}>{m.email}</div>}
                <div className={styles.cardBtns}>
                  {m.id && (
                    <button className={styles.planBtn} onClick={() => openPlanModal(m)}>
                      {t("team.viewPlan")}
                    </button>
                  )}
                  {canRegisterSick && m.id && (
                    <button className={styles.sickBtn} onClick={() => openSickModal(m)}>
                      {t("team.sickLeave")}
                    </button>
                  )}
                </div>
              </div>
            );
          }) : (
            <div className={styles.empty}>{t("team.noMembers")}</div>
          )}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className={styles.table}>
          <div className={`${styles.tableRow} ${styles.tableHead}`}>
            <span>{t("team.table.member")}</span>
            <span>{t("team.table.role")}</span>
            <span>{t("team.table.department")}</span>
            <span>{t("team.table.position")}</span>
            <span>{t("team.table.email")}</span>
            <span>{t("team.table.status")}</span>
            {canRegisterSick && <span></span>}
          </div>
          {filtered.length > 0 ? filtered.map((m, i) => {
            const roleStyle = ROLE_COLORS[m.role] || ROLE_COLORS.employee;
            return (
              <div key={i} className={`${styles.tableRow} ${canRegisterSick ? styles.tableRowWithAction : ""}`}>
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
                    {m.role ? t(`common.roles.${m.role}`) : "--"}
                  </span>
                </span>
                <span className={styles.muted}>{m.department_name || "—"}</span>
                <span className={styles.muted}>{m.position || "—"}</span>
                <span className={styles.muted}>{m.email || "—"}</span>
                <span>
                  <span className={`${styles.statusBadge} ${m.is_active === false ? styles.statusInactive : styles.statusActive}`}>
                    {m.is_active === false ? t("common.status.inactive") : t("common.status.active")}
                  </span>
                </span>
                <span className={styles.listActions}>
                  {m.id && (
                    <button className={styles.planBtnSmall} onClick={() => openPlanModal(m)}>
                      {t("team.planShort")}
                    </button>
                  )}
                  {canRegisterSick && m.id && (
                    <button className={styles.sickBtnSmall} onClick={() => openSickModal(m)}>
                      {t("team.sickLeave")}
                    </button>
                  )}
                </span>
              </div>
            );
          }) : (
            <div className={styles.empty}>{t("team.noMembers")}</div>
          )}
        </div>
      )}

      {/* ── Modal Annual Plan ───────────────────────────────────────────── */}
      {planModal && (
        <div className={styles.modalOverlay} onClick={() => setPlanModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>{t("team.plan.title", { year: PLAN_YEAR })}</h2>
                <p className={styles.modalSub}>{planModal.member.full_name || planModal.member.username}</p>
              </div>
              <button className={styles.modalClose} onClick={() => setPlanModal(null)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              {!planModal.schedule ? (
                <p className={styles.planEmptyMsg}>{t("team.plan.loading")}</p>
              ) : !planModal.schedule.id ? (
                <p className={styles.planEmptyMsg}>{t("team.plan.noPlan", { year: PLAN_YEAR })}</p>
              ) : (
                <>
                  {/* Status */}
                  <div className={styles.planStatusRow}>
                    <span className={`${styles.planStatusBadge} ${
                      planModal.schedule.status === "approved"  ? styles.planBadgeGreen :
                      planModal.schedule.status === "submitted" ? styles.planBadgeAmber :
                      planModal.schedule.status === "rejected"  ? styles.planBadgeRed :
                      styles.planBadgeGray
                    }`}>
                      {t(`common.status.${planModal.schedule.status}`)}
                    </span>
                    <span className={styles.planDaysInfo}>
                      {t("team.plan.plannedOfMax", { planned: Number(planModal.schedule.total_planned_days), max: planModal.schedule.annual_leave_days })}
                    </span>
                  </div>

                  {/* Carryover */}
                  {Number(planModal.schedule.carryover_days) > 0 && (
                    <div className={styles.planCarryover}>
                      {t("team.plan.carryover", {
                        dayCount: `${planModal.schedule.carryover_days} ${planModal.schedule.carryover_days === 1 ? t("common.day") : t("common.days")}`,
                        year: PLAN_YEAR - 1,
                      })}
                      {planModal.schedule.carryover_expires_at && t("team.plan.carryoverExpires", { date: planModal.schedule.carryover_expires_at })}
                    </div>
                  )}

                  {/* Month grid read-only */}
                  <div className={styles.planMonthGrid}>
                    {MONTHS.map((m, i) => {
                      const val = Number(planModal.schedule.monthly_plan?.[String(i+1)] ?? 0);
                      return (
                        <div key={i} className={styles.planMonthItem}>
                          <span className={styles.planMonthName}>{m}</span>
                          <span className={`${styles.planMonthDays} ${val > 0 ? styles.planMonthDaysFilled : ""}`}>{val}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Review note */}
                  {planModal.schedule.review_note && (
                    <p className={styles.planReviewNote}>
                      {t("team.plan.note", { note: planModal.schedule.review_note })}
                    </p>
                  )}

                  {/* Approve / Reject buttons (only for submitted) */}
                  {planModal.schedule.status === "submitted" && (
                    <div className={styles.planReviewActions}>
                      {!showRejectForm ? (
                        <>
                          <button
                            className={styles.planApproveBtn}
                            onClick={() => handlePlanReview("approve")}
                            disabled={planLoading}
                          >
                            {planLoading ? "…" : t("team.plan.approve")}
                          </button>
                          <button
                            className={styles.planRejectBtn}
                            onClick={() => setShowRejectForm(true)}
                          >
                            {t("team.plan.reject")}
                          </button>
                        </>
                      ) : (
                        <div className={styles.rejectForm}>
                          <textarea
                            className={styles.formInput}
                            rows={3}
                            placeholder={t("team.plan.rejectPlaceholder")}
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            autoFocus
                          />
                          <div className={styles.rejectFormBtns}>
                            <button className={styles.cancelBtn} onClick={() => setShowRejectForm(false)}>{t("common.cancel")}</button>
                            <button
                              className={styles.planRejectBtn}
                              onClick={() => handlePlanReview("reject")}
                              disabled={!rejectNote.trim() || planLoading}
                            >
                              {planLoading ? "…" : t("team.plan.confirmReject")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Sick Leave ────────────────────────────────────────────── */}
      {sickModal && (
        <div className={styles.modalOverlay} onClick={closeSickModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

            {/* Header modal */}
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>{t("team.sick.title")}</h2>
                <p className={styles.modalSub}>
                  {sickModal.member.full_name || sickModal.member.username}
                </p>
              </div>
              <button className={styles.modalClose} onClick={closeSickModal}>✕</button>
            </div>

            {!sickSuccess ? (
              <>
                {/* Formular */}
                <div className={styles.modalBody}>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>{t("team.sick.startDate")}</label>
                      <input
                        type="date"
                        className={styles.formInput}
                        value={sickForm.start_date}
                        onChange={(e) => setSickForm(f => ({ ...f, start_date: e.target.value }))}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>{t("team.sick.endDate")}</label>
                      <input
                        type="date"
                        className={styles.formInput}
                        value={sickForm.end_date}
                        onChange={(e) => setSickForm(f => ({ ...f, end_date: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>{t("team.sick.medicalDocument")} <span className={styles.optional}>{t("team.sick.optional")}</span></label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder={t("team.sick.medicalDocPlaceholder")}
                      value={sickForm.medical_document}
                      onChange={(e) => setSickForm(f => ({ ...f, medical_document: e.target.value }))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>{t("team.sick.overlapLabel")}</label>
                    <div className={styles.overlapOptions}>
                      <label className={`${styles.overlapOption} ${sickForm.overlap_action === 'return' ? styles.overlapOptionActive : ''}`}>
                        <input
                          type="radio"
                          name="overlap_action"
                          value="return"
                          checked={sickForm.overlap_action === 'return'}
                          onChange={() => setSickForm(f => ({ ...f, overlap_action: 'return' }))}
                        />
                        <div>
                          <span className={styles.overlapTitle}>{t("team.sick.returnTitle")}</span>
                          <span className={styles.overlapDesc}>{t("team.sick.returnDesc")}</span>
                        </div>
                      </label>
                      <label className={`${styles.overlapOption} ${sickForm.overlap_action === 'extend' ? styles.overlapOptionActive : ''}`}>
                        <input
                          type="radio"
                          name="overlap_action"
                          value="extend"
                          checked={sickForm.overlap_action === 'extend'}
                          onChange={() => setSickForm(f => ({ ...f, overlap_action: 'extend' }))}
                        />
                        <div>
                          <span className={styles.overlapTitle}>{t("team.sick.extendTitle")}</span>
                          <span className={styles.overlapDesc}>{t("team.sick.extendDesc")}</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className={styles.autoApproveNote}>
                    <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                      <circle cx="8" cy="8" r="7" stroke="var(--status-green)" strokeWidth="1.4"/>
                      <path d="M5 8l2 2 4-4" stroke="var(--status-green)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {t("team.sick.autoApproveNote")}
                  </div>

                  {sickError && <div className={styles.errorMsg}>{sickError}</div>}
                </div>

                <div className={styles.modalFooter}>
                  <button className={styles.cancelBtn} onClick={closeSickModal} disabled={sickLoading}>
                    {t("common.cancel")}
                  </button>
                  <button className={styles.submitBtn} onClick={handleSickSubmit} disabled={sickLoading}>
                    {sickLoading ? t("team.sick.registering") : t("team.sick.register")}
                  </button>
                </div>
              </>
            ) : (
              /* Success state */
              <div className={styles.modalBody}>
                <div className={styles.successBlock}>
                  <div className={styles.successIcon}>
                    <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
                      <circle cx="12" cy="12" r="11" stroke="var(--status-green)" strokeWidth="1.5"/>
                      <path d="M7 12l3.5 3.5L17 8.5" stroke="var(--status-green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p className={styles.successTitle}>{t("team.sick.registeredTitle")}</p>
                  <p className={styles.successDays}>
                    {sickSuccess.sick_leave?.total_days} {sickSuccess.sick_leave?.total_days === 1 ? t("common.workingDay") : t("common.workingDays")}
                    {" "}· {sickSuccess.sick_leave?.start_date} → {sickSuccess.sick_leave?.end_date}
                  </p>
                  {sickSuccess.overlaps_resolved?.length > 0 && (
                    <div className={styles.overlapSummary}>
                      <p className={styles.overlapSummaryTitle}>{t("team.sick.overlapsResolved", { count: sickSuccess.overlaps_resolved.length })}</p>
                      {sickSuccess.overlaps_resolved.map((o, i) => (
                        <div key={i} className={styles.overlapItem}>
                          <span className={styles.overlapItemType}>{translateLeaveType(t, o.leave_type)}</span>
                          <span className={styles.overlapItemDetail}>
                            {o.action === 'return'
                              ? t("team.sick.daysReturned", { count: o.days_returned, period: o.original_period })
                              : t("team.sick.extendedTo", { date: o.new_end_date, count: o.days_shifted })
                            }
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className={styles.modalFooter}>
                  <button className={styles.submitBtn} onClick={closeSickModal}>{t("team.sick.done")}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}