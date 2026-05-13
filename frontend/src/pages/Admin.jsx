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
  const [activeTab, setActiveTab] = useState("users");
  const [seniorityRules, setSeniorityRules] = useState([]);
  const [seniorityForm, setSeniorityForm] = useState({ min_years: "", extra_days: "" });
  const [seniorityError, setSeniorityError] = useState("");
  const [applyMsg, setApplyMsg] = useState("");
  const [bulkMsg, setBulkMsg] = useState("");
  const [bulkLoading, setBulkLoading] = useState("");
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null });

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

  const fetchSeniorityRules = async () => {
    try {
      const res = await api.get("/leaves/seniority-rules/");
      setSeniorityRules(Array.isArray(res.data) ? res.data : []);
    } catch { setSeniorityRules([]); }
  };

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
    fetchSeniorityRules();
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

  const handleSeniorityAdd = async () => {
    setSeniorityError("");
    if (!seniorityForm.min_years || !seniorityForm.extra_days) {
      setSeniorityError("Both fields are required.");
      return;
    }
    try {
      await api.post("/leaves/seniority-rules/", {
        min_years: parseInt(seniorityForm.min_years),
        extra_days: parseInt(seniorityForm.extra_days),
      });
      setSeniorityForm({ min_years: "", extra_days: "" });
      await fetchSeniorityRules();
    } catch (e) {
      setSeniorityError(e?.response?.data?.min_years?.[0] || e?.response?.data?.detail || "Error adding rule.");
    }
  };

  const handleSeniorityDelete = async (id) => {
    try {
      await api.delete(`/leaves/seniority-rules/${id}/`);
      await fetchSeniorityRules();
    } catch { /* silent */ }
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.delete(`/users/${deleteModal.user.id}/`);
      setDeleteModal({ open: false, user: null });
      await fetchUsers();
    } catch (e) {
      alert(e?.response?.data?.detail || "Delete failed.");
    }
  };

  const handleBulkClockIn = async () => {
    setBulkMsg("");
    setBulkLoading("in");
    try {
      const res = await api.post("/attendance/admin/bulk-clock-in/");
      setBulkMsg({ type: "success", text: `${res.data.detail} ${res.data.users?.length ? `(${res.data.users.join(", ")})` : ""}` });
    } catch (e) {
      setBulkMsg({ type: "error", text: e?.response?.data?.detail || "Error." });
    } finally {
      setBulkLoading("");
    }
  };

  const handleBulkClockOut = async () => {
    setBulkMsg("");
    setBulkLoading("out");
    try {
      const res = await api.post("/attendance/admin/bulk-clock-out/");
      setBulkMsg({ type: "success", text: res.data.detail });
    } catch (e) {
      setBulkMsg({ type: "error", text: e?.response?.data?.detail || "Error." });
    } finally {
      setBulkLoading("");
    }
  };

  const handleApplySeniority = async () => {
    setApplyMsg("");
    try {
      const res = await api.post("/leaves/seniority-rules/apply/");
      setApplyMsg(res.data?.detail || "Applied.");
      setTimeout(() => setApplyMsg(""), 4000);
    } catch (e) {
      setApplyMsg(e?.response?.data?.detail || "Error applying rules.");
    }
  };

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Administration</h1>
          <p className={styles.subtitle}>{users.length} accounts total</p>
        </div>
        {activeTab === "users" && (
          <button
            className={styles.btnNew}
            onClick={() => { setShowForm((v) => !v); setFormError(""); }}
          >
            {showForm ? "✕ Cancel" : "+ New user"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "users" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("users")}
        >
          Users
        </button>
        <button
          className={`${styles.tab} ${activeTab === "seniority" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("seniority")}
        >
          Seniority Rules
        </button>
        <button
          className={`${styles.tab} ${activeTab === "attendance" ? styles.tabActive : ""}`}
          onClick={() => { setActiveTab("attendance"); setBulkMsg(""); }}
        >
          Attendance Tools
        </button>
      </div>

      {/* ── Users Tab ── */}
      {activeTab === "users" && (
        <>
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
                    <button
                      className={styles.btnDelete}
                      onClick={() => setDeleteModal({ open: true, user: u })}
                      title="Delete user"
                    >
                      ✕
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
        </>
      )}

      {/* ── Attendance Tools Tab ── */}
      {activeTab === "attendance" && (
        <div className={styles.attendanceTools}>
          <div className={styles.seniorityInfo}>
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <circle cx="8" cy="8" r="7" stroke="#60a5fa" strokeWidth="1.4"/>
              <path d="M8 7v4M8 5.5v.5" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Bulk attendance actions for today. Clock-in skips users on approved leave or who already have a session. Clock-out closes all open sessions across all days.
          </div>

          <div className={styles.bulkActions}>
            <div className={styles.bulkCard}>
              <div className={styles.bulkCardTitle}>Bulk Clock-In</div>
              <p className={styles.bulkCardDesc}>
                Opens a session for all active users present today (no approved leave, no existing session).
              </p>
              <button
                className={styles.btnBulkIn}
                onClick={handleBulkClockIn}
                disabled={bulkLoading === "in"}
              >
                {bulkLoading === "in" ? <span className={styles.spinner} /> : null}
                Clock In All Present
              </button>
            </div>

            <div className={styles.bulkCard}>
              <div className={styles.bulkCardTitle}>Bulk Clock-Out</div>
              <p className={styles.bulkCardDesc}>
                Closes all currently open sessions and calculates work hours.
              </p>
              <button
                className={styles.btnBulkOut}
                onClick={handleBulkClockOut}
                disabled={bulkLoading === "out"}
              >
                {bulkLoading === "out" ? <span className={styles.spinner} /> : null}
                Clock Out All Open
              </button>
            </div>
          </div>

          {bulkMsg && (
            <div className={bulkMsg.type === "error" ? styles.formError : styles.successBanner}>
              {bulkMsg.text}
            </div>
          )}
        </div>
      )}

      {/* ── Seniority Rules Tab ── */}
      {activeTab === "seniority" && (
        <div className={styles.senioritySection}>

          <div className={styles.seniorityInfo}>
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <circle cx="8" cy="8" r="7" stroke="#60a5fa" strokeWidth="1.4"/>
              <path d="M8 7v4M8 5.5v.5" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Extra annual leave days based on seniority (years since hire date). Default values follow Romanian Labor Code.
            After modifying rules, click <strong>Apply to all balances</strong> to recalculate.
          </div>

          <div className={styles.seniorityTable}>
            <div className={`${styles.seniorityRow} ${styles.seniorityHead}`}>
              <span>Min. years</span>
              <span>Extra days</span>
              <span></span>
            </div>
            {seniorityRules.length > 0 ? seniorityRules.map((rule) => (
              <div key={rule.id} className={styles.seniorityRow}>
                <span className={styles.seniorityVal}>{rule.min_years}+ years</span>
                <span className={styles.seniorityExtra}>+{rule.extra_days} day{rule.extra_days !== 1 ? "s" : ""}</span>
                <span>
                  <button
                    className={styles.btnDelete}
                    onClick={() => handleSeniorityDelete(rule.id)}
                    title="Delete rule"
                  >
                    ✕
                  </button>
                </span>
              </div>
            )) : (
              <div className={styles.empty}>No seniority rules configured.</div>
            )}
          </div>

          <div className={styles.seniorityAddForm}>
            <div className={styles.seniorityAddRow}>
              <div className={styles.field}>
                <label className={styles.label}>Min. years *</label>
                <input
                  type="number"
                  min="1"
                  className={styles.input}
                  placeholder="e.g. 5"
                  value={seniorityForm.min_years}
                  onChange={e => setSeniorityForm(f => ({ ...f, min_years: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Extra days *</label>
                <input
                  type="number"
                  min="1"
                  className={styles.input}
                  placeholder="e.g. 1"
                  value={seniorityForm.extra_days}
                  onChange={e => setSeniorityForm(f => ({ ...f, extra_days: e.target.value }))}
                />
              </div>
              <button className={styles.btnSubmit} onClick={handleSeniorityAdd} style={{ alignSelf: "flex-end" }}>
                Add rule
              </button>
            </div>
            {seniorityError && <div className={styles.formError}>{seniorityError}</div>}
          </div>

          <div className={styles.seniorityApply}>
            <button className={styles.btnApply} onClick={handleApplySeniority}>
              Apply to all balances
            </button>
            {applyMsg && <span className={styles.applyMsg}>{applyMsg}</span>}
          </div>

        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal.open && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>Delete user</h3>
            <p className={styles.modalBody}>
              Are you sure you want to permanently delete{" "}
              <strong>{deleteModal.user?.full_name || deleteModal.user?.username}</strong>?
              This action cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.btnCancel}
                onClick={() => setDeleteModal({ open: false, user: null })}
              >
                Cancel
              </button>
              <button className={styles.btnDeleteConfirm} onClick={handleDeleteConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}