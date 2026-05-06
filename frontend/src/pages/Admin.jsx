import { useState, useEffect } from "react";
import api from "../api/axios";
import styles from "./Admin.module.css";

const ROLES = ["employee", "manager", "admin"];

function getInitials(u) {
  if (u.first_name && u.last_name)
    return `${u.first_name[0]}${u.last_name[0]}`.toUpperCase();
  return (u.username || "?").slice(0, 2).toUpperCase();
}

const EMPTY_FORM = {
  username: "", email: "", first_name: "", last_name: "",
  password: "", password2: "", role: "employee", department: "",
};

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [search, setSearch] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await api.get("/users/");
      setUsers(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch { setUsers([]); }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get("/departments/");
      setDepartments(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch { setDepartments([]); }
  };

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.username?.toLowerCase().includes(q) ||
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (form.password !== form.password2) {
      setFormError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.department) delete payload.department;
      delete payload.password2;
      await api.post("/auth/register/", payload);
      setSuccessMsg(`User "${form.username}" created successfully.`);
      setShowForm(false);
      setForm(EMPTY_FORM);
      await fetchUsers();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (e) {
      const data = e?.response?.data;
      setFormError(
        data?.detail ||
        Object.entries(data || {}).map(([k, v]) => `${k}: ${[v].flat().join(", ")}`).join(" · ") ||
        "Creation failed."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (user) => {
    try {
      await api.patch(`/users/${user.id}/`, { is_active: !user.is_active });
      await fetchUsers();
    } catch { /* silent */ }
  };

  const f = (key) => (e) => setForm((v) => ({ ...v, [key]: e.target.value }));

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>User Management</h1>
          <p className={styles.subtitle}>{users.length} accounts total</p>
        </div>
        <button
          className={styles.btnNew}
          onClick={() => { setShowForm((v) => !v); setFormError(""); }}
        >
          {showForm ? "✕ Cancel" : "+ New user"}
        </button>
      </div>

      {successMsg && <div className={styles.successBanner}>{successMsg}</div>}

      {/* New user form */}
      {showForm && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Create new user</h2>
          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label}>First name</label>
                <input className={styles.input} value={form.first_name} onChange={f("first_name")} placeholder="Ion" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Last name</label>
                <input className={styles.input} value={form.last_name} onChange={f("last_name")} placeholder="Popescu" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Username *</label>
                <input className={styles.input} value={form.username} onChange={f("username")} placeholder="ion.popescu" required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input className={styles.input} type="email" value={form.email} onChange={f("email")} placeholder="ion@example.com" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Password *</label>
                <input className={styles.input} type="password" value={form.password} onChange={f("password")} placeholder="min. 8 characters" required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Confirm password *</label>
                <input className={styles.input} type="password" value={form.password2} onChange={f("password2")} placeholder="repeat password" required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Role *</label>
                <select className={styles.select} value={form.role} onChange={f("role")}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Department</label>
                <select className={styles.select} value={form.department} onChange={f("department")}>
                  <option value="">— None —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {formError && <div className={styles.formError}>{formError}</div>}
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnSubmit} disabled={submitting}>
                {submitting && <span className={styles.spinner} />}
                Create user
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className={styles.searchWrap}>
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14" className={styles.searchIcon}>
          <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          className={styles.searchInput}
          placeholder="Search by name, username, role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Users table */}
      <div className={styles.table}>
        <div className={`${styles.tableRow} ${styles.tableHead}`}>
          <span>User</span>
          <span>Role</span>
          <span>Department</span>
          <span>Position</span>
          <span>Email</span>
          <span>Status</span>
        </div>
        {filtered.length > 0 ? (
          filtered.map((u, i) => (
            <div key={i} className={styles.tableRow}>
              <span className={styles.userCell}>
                <span className={`${styles.avatar} ${!u.is_active ? styles.avatarInactive : ""}`}>
                  {getInitials(u)}
                </span>
                <span className={styles.userInfo}>
                  <span className={styles.userName}>{u.full_name || u.username}</span>
                  <span className={styles.userUsername}>@{u.username}</span>
                </span>
              </span>
              <span>
                <span className={`${styles.roleBadge} ${styles[`role_${u.role}`]}`}>
                  {u.role}
                </span>
              </span>
              <span className={styles.muted}>{u.department_name || "—"}</span>
              <span className={styles.muted}>{u.position || "—"}</span>
              <span className={styles.muted}>{u.email || "—"}</span>
              <span className={styles.statusCell}>
                <button
                  className={`${styles.toggleBtn} ${u.is_active ? styles.toggleActive : styles.toggleInactive}`}
                  onClick={() => toggleActive(u)}
                  title={u.is_active ? "Deactivate user" : "Activate user"}
                >
                  {u.is_active ? "Active" : "Inactive"}
                </button>
              </span>
            </div>
          ))
        ) : (
          <div className={styles.empty}>
            {search ? `No users matching "${search}".` : "No users found."}
          </div>
        )}
      </div>
    </div>
  );
}