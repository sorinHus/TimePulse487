import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPontajSheet, patchPontajEntry, generatePontajSheet, reviewPontajSheet } from "../api/reports";
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

function computeTotals(cells) {
  const totals = { hours: 0, CO: 0, CM: 0, FP: 0, IC: 0, CI: 0, AC: 0, NE: 0 };
  for (const cell of cells) {
    if (cell.leave_code && LEAVE_CODES.includes(cell.leave_code)) {
      totals[cell.leave_code] += 1;
    } else if (cell.hours != null) {
      totals.hours += cell.hours;
    }
  }
  return totals;
}

export default function Pontaj() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  const handleCellClick = (cell) => {
    if (!canEditCells) return;
    setEditingCell({ entryId: cell.entry_id, value: cell.leave_code || (cell.hours ?? "") });
  };

  const saveEditingCell = async () => {
    if (!editingCell) return;
    const raw = String(editingCell.value).trim();
    setEditingCell(null);
    if (raw === "") return;
    const numeric = Number(raw.replace(",", "."));
    const payload = !Number.isNaN(numeric) ? { hours: numeric } : { leave_code: raw.toUpperCase() };
    try {
      await patchPontajEntry(editingCell.entryId, payload);
      await fetchSheet();
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
          <h1 className={styles.title}>{sheet?.department_name || ""} — {monthTitle}</h1>
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
                <th className={styles.totalsCol}>{t("pontaj.totalHours")}</th>
                {LEAVE_CODES.map((code) => (
                  <th key={code} className={styles.totalsCol}>{code}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row) => {
                const totals = computeTotals(row.cells);
                return (
                  <tr key={row.user_id}>
                    <td className={styles.stickyCol}>{row.full_name}</td>
                    {row.cells.map((cell) => {
                      const isWeekend = [0, 6].includes(new Date(year, month - 1, cell.day).getDay());
                      const isHoliday = sheet.holidays.includes(cell.day);
                      const isEditing = editingCell?.entryId === cell.entry_id;
                      const display = cell.leave_code || (cell.hours ?? "");
                      return (
                        <td
                          key={cell.day}
                          className={`${isWeekend ? styles.weekendCol : isHoliday ? styles.holidayCol : ""} ${canEditCells && !isWeekend ? styles.editableCell : ""} ${cell.is_edited ? styles.editedCell : ""}`}
                          onClick={() => !isWeekend && handleCellClick(cell)}
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              className={styles.cellInput}
                              value={editingCell.value}
                              onChange={(e) => setEditingCell((c) => ({ ...c, value: e.target.value }))}
                              onBlur={saveEditingCell}
                              onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                            />
                          ) : (
                            display || (isWeekend ? "" : "-")
                          )}
                        </td>
                      );
                    })}
                    <td className={`${styles.totalsCol} ${totals.hours > 0 ? styles.totalsFilled : ""}`}>
                      {totals.hours > 0 ? Math.round(totals.hours * 10) / 10 : 0}
                    </td>
                    {LEAVE_CODES.map((code) => (
                      <td key={code} className={`${styles.totalsCol} ${totals[code] > 0 ? styles.totalsFilled : ""}`}>
                        {totals[code]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
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
