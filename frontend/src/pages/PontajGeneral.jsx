import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPontajOrgOverview } from "../api/reports";
import { dateLocale } from "../i18n/config";
import { LEAVE_CODES, STATUS_BADGE, computeTotals, computeMonthlyNorm } from "./Pontaj";
import styles from "./Pontaj.module.css";

function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function PontajGeneral() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { year: defaultYear, month: defaultMonth } = currentYearMonth();
  const year = Number(searchParams.get("year")) || defaultYear;
  const month = Number(searchParams.get("month")) || defaultMonth;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const dayAbbrevs = t("pontaj.days", { returnObjects: true });

  const fetchData = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await getPontajOrgOverview(year, month);
      setData(res);
    } catch (e) {
      setError(e?.response?.data?.detail || t("pontaj.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [year, month, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const monthTitle = new Date(year, month - 1, 1).toLocaleDateString(
    dateLocale(i18n.language), { month: "long", year: "numeric" }
  );

  const changeMonth = (newYear, newMonth) => {
    setSearchParams({ year: String(newYear), month: String(newMonth) });
  };
  const handlePrevMonth = () => changeMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
  const handleNextMonth = () => changeMonth(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
  const handleMonthInput = (e) => {
    const [y, m] = e.target.value.split("-").map(Number);
    if (y && m) changeMonth(y, m);
  };

  const monthlyNorm = data ? computeMonthlyNorm(year, month, data.num_days, data.holidays) : 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <button className={styles.btnBack} onClick={() => navigate("/reports")}>← {t("pontaj.backToReports")}</button>
          <div className={styles.monthNav}>
            <button className={styles.btnMonthNav} onClick={handlePrevMonth} aria-label={t("pontaj.prevMonth")} title={t("pontaj.prevMonth")}>‹</button>
            <h1 className={styles.title}>{t("pontaj.orgTitle")} — {monthTitle}</h1>
            <button className={styles.btnMonthNav} onClick={handleNextMonth} aria-label={t("pontaj.nextMonth")} title={t("pontaj.nextMonth")}>›</button>
            <input
              type="month"
              className={styles.monthInput}
              value={`${year}-${String(month).padStart(2, "0")}`}
              onChange={handleMonthInput}
              aria-label={t("pontaj.jumpToMonth")}
            />
          </div>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.muted}>{t("common.loading")}</p>
      ) : data && data.rows.length === 0 ? (
        <p className={styles.muted}>{t("pontaj.noRows")}</p>
      ) : data && (
        <div className={styles.gridWrap}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th className={styles.stickyCol}>{t("pontaj.department")}</th>
                <th>{t("pontaj.employee")}</th>
                <th>{t("pontaj.position")}</th>
                <th>{t("pontaj.employeeNumber")}</th>
                {Array.from({ length: data.num_days }, (_, i) => i + 1).map((day) => {
                  const isWeekend = [0, 6].includes(new Date(year, month - 1, day).getDay());
                  const holidayName = data.holidays[day];
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
                <th className={styles.totalsCol}>{t("pontaj.statusColumn")}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const totals = computeTotals(row.cells);
                return (
                  <tr key={`${row.sheet_id}-${row.user_id}`}>
                    <td className={styles.stickyCol}>
                      {row.department_id ? (
                        <button
                          type="button"
                          className={styles.linkCell}
                          onClick={() => navigate(`/pontaj?department_id=${row.department_id}&year=${year}&month=${month}`)}
                          title={t("pontaj.viewEdit")}
                        >
                          {row.department_name}
                        </button>
                      ) : (row.department_name || "—")}
                    </td>
                    <td className={styles.muted}>{row.full_name}</td>
                    <td className={styles.muted}>{row.position || "—"}</td>
                    <td className={styles.muted}>{row.employee_number || "—"}</td>
                    {row.cells.map((cell) => {
                      const isWeekend = [0, 6].includes(new Date(year, month - 1, cell.day).getDay());
                      const holidayName = data.holidays[cell.day];
                      const display = cell.leave_code || (cell.hours ?? "");
                      return (
                        <td
                          key={cell.day}
                          className={isWeekend ? styles.weekendCol : holidayName ? styles.holidayCol : ""}
                          title={holidayName || undefined}
                        >
                          {display || (isWeekend ? "" : "-")}
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
                    <td className={styles.totalsCol}>
                      <span className={`${styles.badge} ${styles[STATUS_BADGE[row.sheet_status]]}`}>
                        {t(`pontaj.status${row.sheet_status.charAt(0).toUpperCase()}${row.sheet_status.slice(1)}`)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
