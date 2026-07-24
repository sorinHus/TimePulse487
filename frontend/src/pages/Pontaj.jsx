import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getPontajSheet,
  getPersonalPontajSheet,
  savePontajSheet,
  regeneratePontajSheet,
  submitPontajSheet,
  reviewPontajSheet,
} from "../api/reports";
import { exportPontaj } from "../api/dashboard";
import { dateLocale } from "../i18n/config";
import { useAuth } from "../context/AuthContext";
import styles from "./Pontaj.module.css";

const EDITABLE_STATUSES = ["draft", "rejected"];
export const STATUS_BADGE = {
  draft: "badgeGray",
  generated: "badgeAmber",
  approved: "badgeGreen",
  rejected: "badgeRed",
};
export const LEAVE_CODES = ["CO", "CM", "FP", "IC", "CI", "AC", "NE"];
const CELL_HOUR_OPTIONS = [2, 4, 6, 8, 12];
const HOURS_PER_LEAVE_DAY = 8;

export function computeTotals(cells) {
  const totals = { workedHours: 0, leaveHours: 0, CO: 0, CM: 0, FP: 0, IC: 0, CI: 0, AC: 0, NE: 0 };
  for (const cell of cells) {
    if (cell.leave_code && LEAVE_CODES.includes(cell.leave_code)) {
      totals[cell.leave_code] += 1;
      totals.leaveHours += HOURS_PER_LEAVE_DAY;
    } else if (cell.hours != null) {
      totals.workedHours += cell.hours;
    }
  }
  totals.totalHours = totals.workedHours + totals.leaveHours;
  return totals;
}

export function computeMonthlyNorm(year, month, numDays, holidays) {
  let workDays = 0;
  for (let day = 1; day <= numDays; day++) {
    const dow = new Date(year, month - 1, day).getDay();
    if (dow === 0 || dow === 6) continue;
    if (holidays[day]) continue;
    workDays++;
  }
  return workDays * HOURS_PER_LEAVE_DAY;
}

export default function Pontaj() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const departmentId = searchParams.get("department_id");
  const isSelf = searchParams.get("self") === "1";
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  const [meta, setMeta] = useState(null);
  const [rows, setRows] = useState([]);
  const [dirtyIds, setDirtyIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingCell, setEditingCell] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, note: "" });
  const [actionBusy, setActionBusy] = useState(false);
  const [savingBusy, setSavingBusy] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const dayAbbrevs = t("pontaj.days", { returnObjects: true });

  const applyServerSheet = (data) => {
    const { rows: newRows, ...m } = data;
    setMeta(m);
    setRows(newRows);
    setDirtyIds(new Set());
  };

  const fetchSheet = useCallback(async () => {
    if ((!isSelf && !departmentId) || !year || !month) return;
    setError("");
    try {
      const data = isSelf
        ? await getPersonalPontajSheet(year, month)
        : await getPontajSheet(departmentId, year, month);
      applyServerSheet(data);
    } catch (e) {
      setError(e?.response?.data?.detail || t("pontaj.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [isSelf, departmentId, year, month, t]);

  useEffect(() => {
    setLoading(true);
    fetchSheet();
  }, [fetchSheet]);

  useEffect(() => {
    const handler = (e) => {
      if (dirtyIds.size > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyIds]);

  if ((!isSelf && !departmentId) || !year || !month) {
    return <div className={styles.page}><p className={styles.error}>{t("pontaj.noDepartment")}</p></div>;
  }

  const isEditable = meta && EDITABLE_STATUSES.includes(meta.status);
  const isManagerOfDept = user?.effective_role === "manager" && String(user.department) === String(meta?.department);
  const isAdmin = user?.effective_role === "admin";
  const isReviewer = user?.effective_role === "admin" || user?.effective_role === "director";
  const canEditCells = isEditable && (isSelf || isAdmin || isManagerOfDept);
  const canReview = !isSelf && isReviewer && meta?.status === "generated";

  const monthTitle = new Date(year, month - 1, 1).toLocaleDateString(
    dateLocale(i18n.language), { month: "long", year: "numeric" }
  );

  const monthlyNorm = meta ? computeMonthlyNorm(year, month, meta.num_days, meta.holidays) : 0;

  const confirmDiscard = () =>
    dirtyIds.size === 0 || window.confirm(t("pontaj.discardConfirm"));

  const changeMonth = (newYear, newMonth) => {
    if (!confirmDiscard()) return;
    setSearchParams(isSelf
      ? { self: "1", year: String(newYear), month: String(newMonth) }
      : { department_id: departmentId, year: String(newYear), month: String(newMonth) });
  };

  const handlePrevMonth = () => {
    changeMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
  };

  const handleNextMonth = () => {
    changeMonth(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
  };

  const handleMonthInput = (e) => {
    const [y, m] = e.target.value.split("-").map(Number);
    if (y && m) changeMonth(y, m);
  };

  const handleBack = () => {
    if (confirmDiscard()) navigate("/reports");
  };

  const handleCellClick = (cell) => {
    if (!canEditCells) return;
    const current = cell.leave_code || (CELL_HOUR_OPTIONS.includes(cell.hours) ? String(cell.hours) : "");
    setEditingCell({ entryId: cell.entry_id, value: current });
  };

  const handleCellSelect = (entryId, value) => {
    setEditingCell(null);
    const patch = value === "" ? { hours: null, leave_code: "" }
      : LEAVE_CODES.includes(value) ? { hours: null, leave_code: value }
      : { hours: Number(value), leave_code: "" };
    setRows((prev) => prev.map((row) => ({
      ...row,
      cells: row.cells.map((c) => c.entry_id === entryId
        ? { ...c, ...patch, is_edited: true, leave_from_request: false }
        : c),
    })));
    setDirtyIds((prev) => new Set(prev).add(entryId));
  };

  const handleFillRow = (userId, value) => {
    if (!value) return;
    const touched = [];
    setRows((prev) => prev.map((row) => {
      if (row.user_id !== userId) return row;
      return {
        ...row,
        cells: row.cells.map((c) => {
          const isWeekend = [0, 6].includes(new Date(year, month - 1, c.day).getDay());
          const isHoliday = Boolean(meta.holidays[c.day]);
          if (isWeekend || isHoliday || c.leave_code) return c;
          touched.push(c.entry_id);
          return value === "8"
            ? { ...c, hours: 8, leave_code: "", is_edited: true, leave_from_request: false }
            : { ...c, hours: null, leave_code: value, is_edited: true, leave_from_request: false };
        }),
      };
    }));
    setDirtyIds((prev) => {
      const next = new Set(prev);
      touched.forEach((id) => next.add(id));
      return next;
    });
  };

  const collectDirtyEntries = () => {
    const entries = [];
    for (const row of rows) {
      for (const cell of row.cells) {
        if (dirtyIds.has(cell.entry_id)) {
          entries.push({ id: cell.entry_id, hours: cell.hours, leave_code: cell.leave_code });
        }
      }
    }
    return entries;
  };

  const handleSave = async () => {
    if (dirtyIds.size === 0) return;
    setSavingBusy(true);
    setError("");
    try {
      const data = await savePontajSheet(meta.id, collectDirtyEntries());
      applyServerSheet(data);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      setError(e?.response?.data?.detail || t("pontaj.saveFailed"));
    } finally {
      setSavingBusy(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenBusy(true);
    setError("");
    try {
      const { entries } = await regeneratePontajSheet(meta.id);
      const changed = entries.filter((e) => !dirtyIds.has(e.id));
      if (changed.length === 0) return;
      const byId = new Map(changed.map((e) => [e.id, e]));
      setRows((prev) => prev.map((row) => ({
        ...row,
        cells: row.cells.map((c) => byId.has(c.entry_id)
          ? { ...c, hours: byId.get(c.entry_id).hours, leave_code: byId.get(c.entry_id).leave_code, leave_from_request: byId.get(c.entry_id).leave_from_request }
          : c),
      })));
      setDirtyIds((prev) => {
        const next = new Set(prev);
        changed.forEach((e) => next.add(e.id));
        return next;
      });
    } catch (e) {
      setError(e?.response?.data?.detail || t("pontaj.saveFailed"));
    } finally {
      setRegenBusy(false);
    }
  };

  const handleSubmit = async () => {
    setActionBusy(true);
    setError("");
    try {
      const data = await submitPontajSheet(meta.id, collectDirtyEntries());
      applyServerSheet(data);
    } catch (e) {
      setError(e?.response?.data?.detail || t("pontaj.saveFailed"));
    } finally {
      setActionBusy(false);
    }
  };

  const handleExportExcel = async () => {
    setExportBusy(true);
    try {
      const blob = isSelf
        ? await exportPontaj(year, month, null, user.id)
        : await exportPontaj(year, month, departmentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pontaj_${year}-${String(month).padStart(2, "0")}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError(t("pontaj.saveFailed"));
    } finally {
      setExportBusy(false);
    }
  };

  const handleApprove = async () => {
    setActionBusy(true);
    try {
      const data = await reviewPontajSheet(meta.id, "approve");
      applyServerSheet(data);
    } catch (e) {
      setError(e?.response?.data?.detail || t("pontaj.saveFailed"));
    } finally {
      setActionBusy(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal.note.trim()) return;
    setActionBusy(true);
    try {
      const data = await reviewPontajSheet(meta.id, "reject", rejectModal.note.trim());
      applyServerSheet(data);
      setRejectModal({ open: false, note: "" });
    } catch (e) {
      setError(e?.response?.data?.detail || t("pontaj.saveFailed"));
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <button className={styles.btnBack} onClick={handleBack}>← {t("pontaj.backToReports")}</button>
          <div className={styles.monthNav}>
            <button className={styles.btnMonthNav} onClick={handlePrevMonth} aria-label={t("pontaj.prevMonth")} title={t("pontaj.prevMonth")}>‹</button>
            <h1 className={styles.title}>{isSelf ? t("pontaj.myPontaj") : (meta?.department_name || "")} — {monthTitle}</h1>
            <button className={styles.btnMonthNav} onClick={handleNextMonth} aria-label={t("pontaj.nextMonth")} title={t("pontaj.nextMonth")}>›</button>
            <input
              type="month"
              className={styles.monthInput}
              value={`${year}-${String(month).padStart(2, "0")}`}
              onChange={handleMonthInput}
              aria-label={t("pontaj.jumpToMonth")}
            />
          </div>
          {meta && (
            <div className={styles.subtitleRow}>
              <span className={`${styles.badge} ${styles[STATUS_BADGE[meta.status]]}`}>
                {t(`pontaj.status${meta.status.charAt(0).toUpperCase()}${meta.status.slice(1)}`)}
              </span>
              {meta.generated_by_name && (
                <span className={styles.auditLine}>{t("pontaj.generatedBy", { name: meta.generated_by_name })}</span>
              )}
              {meta.reviewed_by_name && (
                <span className={styles.auditLine}>{t("pontaj.reviewedBy", { name: meta.reviewed_by_name })}</span>
              )}
              {dirtyIds.size > 0 && (
                <span className={styles.unsavedBadge}>{t("pontaj.unsavedChanges", { count: dirtyIds.size })}</span>
              )}
              {savedFlash && <span className={styles.savedBadge}>{t("pontaj.saved")}</span>}
            </div>
          )}
          {meta?.status === "rejected" && meta.rejection_note && (
            <p className={styles.rejectionNote}>{t("pontaj.rejectionNote", { note: meta.rejection_note })}</p>
          )}
        </div>
        <div className={styles.actions}>
          {canEditCells && (
            <button className={styles.btnCancel} onClick={handleRegenerate} disabled={regenBusy}>
              {t("pontaj.regenerate")}
            </button>
          )}
          {canEditCells && (
            <button className={styles.btnGenerate} onClick={handleSave} disabled={savingBusy || dirtyIds.size === 0}>
              {t("pontaj.save")}
            </button>
          )}
          {canEditCells && (
            <button className={styles.btnApprove} onClick={handleSubmit} disabled={actionBusy}>
              {isSelf ? t("pontaj.approve") : meta.status === "rejected" ? t("pontaj.resubmit") : t("pontaj.submit")}
            </button>
          )}
          <button className={styles.btnCancel} onClick={handleExportExcel} disabled={exportBusy}>
            {t("pontaj.exportExcel")}
          </button>
          {canReview && (
            <>
              <button className={styles.btnApprove} onClick={handleApprove} disabled={actionBusy}>{t("pontaj.approve")}</button>
              <button className={styles.btnReject} onClick={() => setRejectModal({ open: true, note: "" })} disabled={actionBusy}>{t("pontaj.reject")}</button>
            </>
          )}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.muted}>{t("common.loading")}</p>
      ) : meta && (
        <div className={styles.gridWrap}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th className={styles.stickyCol}>{t("pontaj.employee")}</th>
                <th>{t("pontaj.position")}</th>
                <th>{t("pontaj.employeeNumber")}</th>
                {canEditCells && <th>{t("pontaj.fillRow")}</th>}
                {Array.from({ length: meta.num_days }, (_, i) => i + 1).map((day) => {
                  const isWeekend = [0, 6].includes(new Date(year, month - 1, day).getDay());
                  const holidayName = meta.holidays[day];
                  return (
                    <th
                      key={day}
                      className={isWeekend ? styles.weekendCol : holidayName ? styles.holidayCol : ""}
                      title={holidayName || undefined}
                    >
                      <div className={styles.dayHeader}>
                        <span>{day}</span>
                        <span className={styles.dayDow}>
                          {dayAbbrevs[new Date(year, month - 1, day).getDay()]}
                        </span>
                      </div>
                    </th>
                  );
                })}
                <th className={styles.totalsCol}>{t("pontaj.norm")}</th>
                <th className={styles.totalsCol}>{t("pontaj.totalHours")}</th>
                {LEAVE_CODES.map((code) => (
                  <th key={code} className={styles.totalsCol}>{code}</th>
                ))}
                <th className={styles.totalsCol}>{t("pontaj.unworkedDays")}</th>
                <th className={styles.totalsCol}>{t("pontaj.verification")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const totals = computeTotals(row.cells);
                const diff = Math.round((totals.totalHours - monthlyNorm) * 10) / 10;
                return (
                  <tr key={row.user_id}>
                    <td className={styles.stickyCol}>{row.full_name}</td>
                    <td className={styles.muted}>{row.position || "—"}</td>
                    <td className={styles.muted}>{row.employee_number || "—"}</td>
                    {canEditCells && (
                      <td className={styles.fillCol}>
                        <select
                          className={styles.fillSelect}
                          value=""
                          onChange={(e) => {
                            const v = e.target.value;
                            e.target.value = "";
                            handleFillRow(row.user_id, v);
                          }}
                        >
                          <option value="">{t("pontaj.fillRowPlaceholder")}</option>
                          <option value="8">8</option>
                          {LEAVE_CODES.map((code) => (
                            <option key={code} value={code}>{code}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    {row.cells.map((cell) => {
                      const isWeekend = [0, 6].includes(new Date(year, month - 1, cell.day).getDay());
                      const holidayName = meta.holidays[cell.day];
                      const isEditing = editingCell?.entryId === cell.entry_id;
                      const display = cell.leave_code || (cell.hours ?? "");
                      const title = holidayName || (cell.leave_from_request ? t("pontaj.fromRequestTitle") : undefined);
                      return (
                        <td
                          key={cell.day}
                          className={`${isWeekend ? styles.weekendCol : holidayName ? styles.holidayCol : ""} ${canEditCells && !isWeekend ? styles.editableCell : ""} ${cell.is_edited ? styles.editedCell : ""} ${cell.leave_from_request ? styles.requestLeaveCell : ""}`}
                          onClick={() => !isWeekend && handleCellClick(cell)}
                          title={title}
                        >
                          {isEditing ? (
                            <select
                              autoFocus
                              className={styles.cellSelect}
                              defaultValue={editingCell.value}
                              onChange={(e) => handleCellSelect(cell.entry_id, e.target.value)}
                              onBlur={() => setEditingCell(null)}
                            >
                              <option value="">-</option>
                              {CELL_HOUR_OPTIONS.map((h) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                              {LEAVE_CODES.map((code) => (
                                <option key={code} value={code}>{code}</option>
                              ))}
                            </select>
                          ) : (
                            display || (isWeekend ? "" : "-")
                          )}
                        </td>
                      );
                    })}
                    <td className={styles.totalsCol}>{monthlyNorm}</td>
                    <td className={`${styles.totalsCol} ${totals.totalHours > 0 ? styles.totalsFilled : ""}`}>
                      {totals.totalHours > 0 ? Math.round(totals.totalHours * 10) / 10 : 0}
                    </td>
                    {LEAVE_CODES.map((code) => (
                      <td key={code} className={`${styles.totalsCol} ${totals[code] > 0 ? styles.totalsFilled : ""}`}>
                        {totals[code]}
                      </td>
                    ))}
                    <td className={`${styles.totalsCol} ${totals.leaveHours > 0 ? styles.totalsFilled : ""}`}>
                      {totals.leaveHours}
                    </td>
                    <td className={`${styles.totalsCol} ${diff === 0 ? styles.verifyMatch : styles.verifyMismatch}`}>
                      {diff === 0 ? t("pontaj.verificationOk") : diff > 0 ? `+${diff}` : diff}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {meta && (
        <div className={styles.legend}>
          <div className={styles.legendGroup}>
            <span className={styles.legendGroupTitle}>{t("pontaj.legendMarkersTitle")}</span>
            <span className={styles.legendItem}><span className={`${styles.legendSwatch} ${styles.swatchHoliday}`} />{t("pontaj.legendHoliday")}</span>
            <span className={styles.legendItem}><span className={`${styles.legendSwatch} ${styles.swatchRequest}`} />{t("pontaj.legendFromRequest")}</span>
            <span className={styles.legendItem}><span className={`${styles.legendSwatch} ${styles.swatchManual}`} />{t("pontaj.legendManual")}</span>
          </div>
          <div className={styles.legendDivider} />
          <div className={styles.legendGroup}>
            <span className={styles.legendGroupTitle}>{t("pontaj.legendCodesTitle")}</span>
            {LEAVE_CODES.map((code) => (
              <span key={code} className={styles.legendItem}>
                <strong>{code}</strong> — {t(`pontaj.legendCode${code}`)}
              </span>
            ))}
          </div>
        </div>
      )}

      {rejectModal.open && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>{t("pontaj.rejectModalTitle")}</h3>
            <textarea
              className={styles.textarea}
              rows={4}
              placeholder={t("pontaj.rejectPlaceholder")}
              value={rejectModal.note}
              onChange={(e) => setRejectModal((m) => ({ ...m, note: e.target.value }))}
              autoFocus
            />
            {!rejectModal.note.trim() && <p className={styles.formError}>{t("pontaj.reasonRequired")}</p>}
            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={() => setRejectModal({ open: false, note: "" })}>
                {t("common.cancel")}
              </button>
              <button className={styles.btnReject} onClick={handleRejectConfirm} disabled={!rejectModal.note.trim() || actionBusy}>
                {t("pontaj.confirmReject")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
