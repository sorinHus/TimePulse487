import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPontajSheet, patchPontajEntry, generatePontajSheet, reviewPontajSheet, fillPontajRow } from "../api/reports";
import { dateLocale } from "../i18n/config";
import { useAuth } from "../context/AuthContext";
import styles from "./Pontaj.module.css";

const EDITABLE_STATUSES = ["draft", "rejected"];
const STATUS_BADGE = {
  draft: "badgeGray",
  generated: "badgeAmber",
  approved: "badgeGreen",
  rejected: "badgeRed",
};
const LEAVE_CODES = ["CO", "CM", "FP", "IC", "CI", "AC", "NE"];
const CELL_HOUR_OPTIONS = [2, 4, 6, 8, 12];
const HOURS_PER_LEAVE_DAY = 8;

function computeTotals(cells) {
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

function computeMonthlyNorm(year, month, numDays, holidays) {
  let workDays = 0;
  for (let day = 1; day <= numDays; day++) {
    const dow = new Date(year, month - 1, day).getDay();
    if (dow === 0 || dow === 6) continue;
    if (holidays.includes(day)) continue;
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
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingCell, setEditingCell] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, note: "" });
  const [actionBusy, setActionBusy] = useState(false);

  const fetchSheet = useCallback(async () => {
    if (!departmentId || !year || !month) return;
    setError("");
    try {
      const data = await getPontajSheet(departmentId, year, month);
      setSheet(data);
    } catch (e) {
      setError(e?.response?.data?.detail || t("pontaj.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [departmentId, year, month, t]);

  useEffect(() => {
    setLoading(true);
    fetchSheet();
  }, [fetchSheet]);

  if (!departmentId || !year || !month) {
    return <div className={styles.page}><p className={styles.error}>{t("pontaj.noDepartment")}</p></div>;
  }

  const isEditable = sheet && EDITABLE_STATUSES.includes(sheet.status);
  const isManagerOfDept = user?.effective_role === "manager" && String(user.department) === String(sheet?.department);
  const isAdmin = user?.effective_role === "admin";
  const isReviewer = user?.effective_role === "admin" || user?.effective_role === "director";
  const canEditCells = isEditable && (isAdmin || isManagerOfDept);
  const canGenerate = isEditable && (isAdmin || isManagerOfDept);
  const canReview = isReviewer && sheet?.status === "generated";

  const monthTitle = new Date(year, month - 1, 1).toLocaleDateString(
    dateLocale(i18n.language), { month: "long", year: "numeric" }
  );

  const monthlyNorm = sheet ? computeMonthlyNorm(year, month, sheet.num_days, sheet.holidays) : 0;

  const changeMonth = (newYear, newMonth) => {
    setSearchParams({ department_id: departmentId, year: String(newYear), month: String(newMonth) });
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

  const handleCellClick = (cell) => {
    if (!canEditCells) return;
    const current = cell.leave_code || (CELL_HOUR_OPTIONS.includes(cell.hours) ? String(cell.hours) : "");
    setEditingCell({ entryId: cell.entry_id, value: current });
  };

  const saveCellValue = async (entryId, value) => {
    setEditingCell(null);
    const payload = value === "" ? { leave_code: "" }
      : LEAVE_CODES.includes(value) ? { leave_code: value }
      : { hours: Number(value) };
    try {
      await patchPontajEntry(entryId, payload);
      await fetchSheet();
    } catch (e) {
      setError(e?.response?.data?.detail || t("pontaj.saveFailed"));
    }
  };

  const handleFillRow = async (userId, value) => {
    if (!value) return;
    try {
      const data = await fillPontajRow(sheet.id, userId, value);
      setSheet(data);
    } catch (e) {
      setError(e?.response?.data?.detail || t("pontaj.saveFailed"));
    }
  };

  const handleGenerate = async () => {
    setActionBusy(true);
    try {
      const data = await generatePontajSheet(sheet.id);
      setSheet(data);
    } catch (e) {
      setError(e?.response?.data?.detail || t("pontaj.saveFailed"));
    } finally {
      setActionBusy(false);
    }
  };

  const handleApprove = async () => {
    setActionBusy(true);
    try {
      const data = await reviewPontajSheet(sheet.id, "approve");
      setSheet(data);
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
      const data = await reviewPontajSheet(sheet.id, "reject", rejectModal.note.trim());
      setSheet(data);
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
          <button className={styles.btnBack} onClick={() => navigate("/reports")}>← {t("pontaj.backToReports")}</button>
          <div className={styles.monthNav}>
            <button className={styles.btnMonthNav} onClick={handlePrevMonth} aria-label={t("pontaj.prevMonth")} title={t("pontaj.prevMonth")}>‹</button>
            <h1 className={styles.title}>{sheet?.department_name || ""} — {monthTitle}</h1>
            <button className={styles.btnMonthNav} onClick={handleNextMonth} aria-label={t("pontaj.nextMonth")} title={t("pontaj.nextMonth")}>›</button>
            <input
              type="month"
              className={styles.monthInput}
              value={`${year}-${String(month).padStart(2, "0")}`}
              onChange={handleMonthInput}
              aria-label={t("pontaj.jumpToMonth")}
            />
          </div>
          {sheet && (
            <div className={styles.subtitleRow}>
              <span className={`${styles.badge} ${styles[STATUS_BADGE[sheet.status]]}`}>
                {t(`pontaj.status${sheet.status.charAt(0).toUpperCase()}${sheet.status.slice(1)}`)}
              </span>
              {sheet.generated_by_name && (
                <span className={styles.auditLine}>{t("pontaj.generatedBy", { name: sheet.generated_by_name })}</span>
              )}
              {sheet.reviewed_by_name && (
                <span className={styles.auditLine}>{t("pontaj.reviewedBy", { name: sheet.reviewed_by_name })}</span>
              )}
            </div>
          )}
          {sheet?.status === "rejected" && sheet.rejection_note && (
            <p className={styles.rejectionNote}>{t("pontaj.rejectionNote", { note: sheet.rejection_note })}</p>
          )}
        </div>
        <div className={styles.actions}>
          {canGenerate && (
            <button className={styles.btnGenerate} onClick={handleGenerate} disabled={actionBusy}>
              {sheet.status === "rejected" ? t("pontaj.resubmit") : t("pontaj.generate")}
            </button>
          )}
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
      ) : sheet && (
        <div className={styles.gridWrap}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th className={styles.stickyCol}>{t("pontaj.employee")}</th>
                {canEditCells && <th>{t("pontaj.fillRow")}</th>}
                {Array.from({ length: sheet.num_days }, (_, i) => i + 1).map((day) => {
                  const isWeekend = [0, 6].includes(new Date(year, month - 1, day).getDay());
                  const isHoliday = sheet.holidays.includes(day);
                  return (
                    <th
                      key={day}
                      className={isWeekend ? styles.weekendCol : isHoliday ? styles.holidayCol : ""}
                      title={isHoliday ? t("pontaj.legalHoliday") : undefined}
                    >
                      {day}
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
              {sheet.rows.map((row) => {
                const totals = computeTotals(row.cells);
                const diff = Math.round((totals.totalHours - monthlyNorm) * 10) / 10;
                return (
                  <tr key={row.user_id}>
                    <td className={styles.stickyCol}>{row.full_name}</td>
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
                      const isHoliday = sheet.holidays.includes(cell.day);
                      const isEditing = editingCell?.entryId === cell.entry_id;
                      const display = cell.leave_code || (cell.hours ?? "");
                      return (
                        <td
                          key={cell.day}
                          className={`${isWeekend ? styles.weekendCol : isHoliday ? styles.holidayCol : ""} ${canEditCells && !isWeekend ? styles.editableCell : ""} ${cell.is_edited ? styles.editedCell : ""} ${cell.leave_from_request ? styles.requestLeaveCell : ""}`}
                          onClick={() => !isWeekend && handleCellClick(cell)}
                          title={cell.leave_from_request ? t("pontaj.fromRequestTitle") : undefined}
                        >
                          {isEditing ? (
                            <select
                              autoFocus
                              className={styles.cellSelect}
                              defaultValue={editingCell.value}
                              onChange={(e) => saveCellValue(cell.entry_id, e.target.value)}
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
                      {diff > 0 ? `+${diff}` : diff}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sheet && (
        <div className={styles.legend}>
          <span className={styles.legendItem}><span className={`${styles.legendSwatch} ${styles.swatchHoliday}`} />{t("pontaj.legendHoliday")}</span>
          <span className={styles.legendItem}><span className={`${styles.legendSwatch} ${styles.swatchRequest}`} />{t("pontaj.legendFromRequest")}</span>
          <span className={styles.legendItem}><span className={`${styles.legendSwatch} ${styles.swatchManual}`} />{t("pontaj.legendManual")}</span>
          {LEAVE_CODES.map((code) => (
            <span key={code} className={styles.legendItem}>
              <strong>{code}</strong> — {t(`pontaj.legendCode${code}`)}
            </span>
          ))}
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
