import styles from "./SortableHeader.module.css";

export default function SortableHeader({ label, sortKey, activeKey, dir, onSort, className }) {
  const active = sortKey === activeKey;

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSort(sortKey);
    }
  };

  return (
    <span
      className={`${styles.sortable} ${className || ""}`}
      onClick={() => onSort(sortKey)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      {label}
      <span className={`${styles.sortArrow} ${active ? styles.sortArrowActive : ""}`}>
        {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
      </span>
    </span>
  );
}
