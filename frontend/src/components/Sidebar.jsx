import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logout } from "../api/auth";
import { getLeaveRequests } from "../api/leaves";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" />
        <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
        <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
      </svg>
    ),
    roles: ["admin", "manager", "employee"],
  },
  {
    label: "Attendance",
    path: "/attendance",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    roles: ["admin", "manager", "employee"],
  },
  {
    label: "Leaves",
    path: "/leaves",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 2v4M13 2v4M3 9h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    roles: ["admin", "manager", "employee"],
  },
  {
    label: "Calendar",
    path: "/calendar",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="3" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 8h16" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="6.5" cy="12" r="1" fill="currentColor" />
        <circle cx="10" cy="12" r="1" fill="currentColor" />
        <circle cx="13.5" cy="12" r="1" fill="currentColor" />
      </svg>
    ),
    roles: ["admin", "manager", "employee"],
  },
  {
    label: "Reports",
    path: "/reports",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 14l4-4 3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    roles: ["admin", "manager"],
  },
  {
    label: "Team",
    path: "/team",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="7.5" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1 17c0-3.314 2.91-6 6.5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="14" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M17.5 17c0-2.761-1.567-5-4-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    roles: ["admin", "manager"],
  },
  {
    label: "Admin",
    path: "/admin",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    roles: ["admin"],
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "manager") {
      getLeaveRequests()
        .then((data) => {
          const pending = data.filter((r) => r.status === "pending").length;
          setPendingCount(pending);
        })
        .catch(() => {});
    }
  }, [user?.role]);
  
  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(user?.role)
  );

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = user?.first_name && user?.last_name
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : user?.username?.slice(0, 2).toUpperCase() || "??";

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>

      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoMark}>T</div>
        {!collapsed && <span className={styles.logoText}>TimePulse</span>}
        <button
          className={styles.toggleBtn}
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
            {collapsed ? (
              <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M13 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {!collapsed && (
          <span className={styles.navSection}>Menu</span>
        )}
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ""}`
            }
            title={collapsed ? item.label : undefined}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {!collapsed && (
              <span className={styles.navLabel}>{item.label}</span>
            )}
            {item.label === "Leaves" &&
              pendingCount > 0 &&
              (user?.role === "admin" || user?.role === "manager") && (
                <span className={styles.badge}>{pendingCount}</span>
              )}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className={styles.userArea}>
        <div className={styles.userCard}>
          <div className={styles.avatar}>{initials}</div>
          {!collapsed && (
            <div className={styles.userInfo}>
              <span className={styles.userName}>
                {user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.username}
              </span>
              <span className={styles.userRole}>{user?.role}</span>
            </div>
          )}
        </div>
        <button
          className={styles.logoutBtn}
          onClick={handleLogout}
          title="Sign out"
        >
          <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
            <path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3M13 14l3-4-3-4M16 10H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>

    </aside>
  );
}
