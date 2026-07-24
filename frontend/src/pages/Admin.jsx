import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  position: "", employee_number: "",
};

const EMPTY_EDIT_FORM = {
  username: "", email: "", first_name: "", last_name: "", phone: "",
  role: "employee", department: "", position: "", employee_number: "", hire_date: "",
};

export default function Admin() {
  const { t } = useTranslation();
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
  const [deactivateModal, setDeactivateModal] = useState({ open: false, user: null, reason: "" });
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFormError, setEditFormError] = useState("");
  const [scheduleTypes, setScheduleTypes] = useState([]);
  const [scheduleForm, setScheduleForm] = useState({ name: "", start_time: "", end_time: "", break_minutes: "60", pontaj_hours: "8" });
  const [scheduleError, setScheduleError] = useState("");
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [editScheduleForm, setEditScheduleForm] = useState({ name: "", start_time: "", end_time: "", break_minutes: "", pontaj_hours: "" });
  const [editScheduleError, setEditScheduleError] = useState("");
  const [deptForm, setDeptForm] = useState({ name: "", description: "" });
  const [deptError, setDeptError] = useState("");
  const [editingDeptId, setEditingDeptId] = useState(null);
  const [editDeptForm, setEditDeptForm] = useState({ name: "", description: "" });
  const [editDeptError, setEditDeptError] = useState("");

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

  const fetchScheduleTypes = async () => {
    try {
      const res = await api.get("/attendance/schedule-types/");
      setScheduleTypes(Array.isArray(res.data) ? res.data : []);
    } catch { setScheduleTypes([]); }
  };

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
    fetchSeniorityRules();
    fetchScheduleTypes();
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
      setFormError(t("admin.errors.passwordMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.department) delete payload.department;
      if (!payload.employee_number) delete payload.employee_number;
      delete payload.password2;
      await api.post("/auth/register/", payload);
      setSuccessMsg(t("admin.userCreatedSuccess", { username: form.username }));
      setShowForm(false);
      setForm(EMPTY_FORM);
      await fetchUsers();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (e) {
      const data = e?.response?.data;
      setFormError(
        data?.detail ||
        Object.entries(data || {}).map(([k, v]) => `${k}: ${[v].flat().join(", ")}`).join(" · ") ||
        t("admin.errors.creationFailed")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditStart = (u) => {
    setShowForm(false);
    setEditingUser(u);
    setEditFormError("");
    setEditForm({
      username: u.username || "",
      email: u.email || "",
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      phone: u.phone || "",
      role: u.role || "employee",
      department: u.department || "",
      position: u.position || "",
      employee_number: u.employee_number || "",
      hire_date: u.hire_date || "",
    });
  };

  const handleEditCancel = () => {
    setEditingUser(null);
    setEditFormError("");
  };

  const ef = (key) => (e) => setEditForm((v) => ({ ...v, [key]: e.target.value }));

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditFormError("");
    setEditSubmitting(true);
    try {
      const payload = { ...editForm };
      if (!payload.department) payload.department = null;
      if (!payload.employee_number) payload.employee_number = null;
      if (!payload.hire_date) payload.hire_date = null;
      await api.patch(`/users/${editingUser.id}/`, payload);
      setEditingUser(null);
      await fetchUsers();
    } catch (e) {
      const data = e?.response?.data;
      setEditFormError(
        data?.detail ||
        Object.entries(data || {}).map(([k, v]) => `${k}: ${[v].flat().join(", ")}`).join(" · ") ||
        t("admin.errors.updateUserFailed")
      );
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleActivate = async (user) => {
    try {
      await api.post(`/users/${user.id}/activate/`);
      await fetchUsers();
    } catch { /* silent */ }
  };

  const handleUserScheduleChange = async (user, scheduleTypeId) => {
    try {
      await api.patch(`/users/${user.id}/`, { schedule_type: scheduleTypeId });
      await fetchUsers();
    } catch (e) {
      alert(e?.response?.data?.detail || t("admin.departments.errors.updateFailed"));
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivateModal.reason.trim()) return;
    try {
      await api.post(`/users/${deactivateModal.user.id}/deactivate/`, { reason: deactivateModal.reason.trim() });
      setDeactivateModal({ open: false, user: null, reason: "" });
      await fetchUsers();
    } catch (e) {
      alert(e?.response?.data?.detail || t("admin.errors.deactivationFailed"));
    }
  };

  const f = (key) => (e) => setForm((v) => ({ ...v, [key]: e.target.value }));

  const handleSeniorityAdd = async () => {
    setSeniorityError("");
    if (!seniorityForm.min_years || !seniorityForm.extra_days) {
      setSeniorityError(t("admin.errors.bothFieldsRequired"));
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
      setSeniorityError(e?.response?.data?.min_years?.[0] || e?.response?.data?.detail || t("admin.errors.addRuleError"));
    }
  };

  const handleSeniorityDelete = async (id) => {
    try {
      await api.delete(`/leaves/seniority-rules/${id}/`);
      await fetchSeniorityRules();
    } catch { /* silent */ }
  };

  const handleScheduleAdd = async () => {
    setScheduleError("");
    if (!scheduleForm.name.trim() || !scheduleForm.start_time || !scheduleForm.end_time) {
      setScheduleError(t("admin.departments.errors.scheduleFieldsRequired"));
      return;
    }
    try {
      await api.post("/attendance/schedule-types/", {
        name: scheduleForm.name.trim(),
        start_time: scheduleForm.start_time,
        end_time: scheduleForm.end_time,
        break_minutes: parseInt(scheduleForm.break_minutes) || 0,
        pontaj_hours: scheduleForm.pontaj_hours || "8",
      });
      setScheduleForm({ name: "", start_time: "", end_time: "", break_minutes: "60", pontaj_hours: "8" });
      await fetchScheduleTypes();
    } catch (e) {
      const data = e?.response?.data;
      setScheduleError(
        data?.detail ||
        Object.entries(data || {}).map(([k, v]) => `${k}: ${[v].flat().join(", ")}`).join(" · ") ||
        t("admin.departments.errors.addScheduleFailed")
      );
    }
  };

  const handleScheduleDelete = async (id) => {
    try {
      await api.delete(`/attendance/schedule-types/${id}/`);
      await fetchScheduleTypes();
    } catch (e) {
      alert(e?.response?.data?.detail || t("admin.departments.errors.deleteFailed"));
    }
  };

  const handleScheduleEditStart = (s) => {
    setEditingScheduleId(s.id);
    setEditScheduleForm({
      name: s.name,
      start_time: s.start_time,
      end_time: s.end_time,
      break_minutes: String(s.break_minutes),
      pontaj_hours: String(s.pontaj_hours),
    });
    setEditScheduleError("");
  };

  const handleScheduleEditCancel = () => {
    setEditingScheduleId(null);
    setEditScheduleError("");
  };

  const handleScheduleEditSave = async (id) => {
    setEditScheduleError("");
    if (!editScheduleForm.name.trim() || !editScheduleForm.start_time || !editScheduleForm.end_time) {
      setEditScheduleError(t("admin.departments.errors.scheduleFieldsRequired"));
      return;
    }
    try {
      await api.patch(`/attendance/schedule-types/${id}/`, {
        name: editScheduleForm.name.trim(),
        start_time: editScheduleForm.start_time,
        end_time: editScheduleForm.end_time,
        break_minutes: parseInt(editScheduleForm.break_minutes) || 0,
        pontaj_hours: editScheduleForm.pontaj_hours || "8",
      });
      setEditingScheduleId(null);
      await fetchScheduleTypes();
    } catch (e) {
      const data = e?.response?.data;
      setEditScheduleError(
        data?.detail ||
        Object.entries(data || {}).map(([k, v]) => `${k}: ${[v].flat().join(", ")}`).join(" · ") ||
        t("admin.departments.errors.updateFailed")
      );
    }
  };

  const handleDeptAdd = async () => {
    setDeptError("");
    if (!deptForm.name.trim()) {
      setDeptError(t("admin.departments.errors.deptNameRequired"));
      return;
    }
    try {
      await api.post("/departments/", deptForm);
      setDeptForm({ name: "", description: "" });
      await fetchDepartments();
    } catch (e) {
      const data = e?.response?.data;
      setDeptError(
        data?.detail ||
        Object.entries(data || {}).map(([k, v]) => `${k}: ${[v].flat().join(", ")}`).join(" · ") ||
        t("admin.departments.errors.addDeptFailed")
      );
    }
  };

  const handleDeptDelete = async (id) => {
    try {
      await api.delete(`/departments/${id}/`);
      await fetchDepartments();
    } catch (e) {
      alert(e?.response?.data?.detail || t("admin.departments.errors.deleteFailed"));
    }
  };

  const handleDeptScheduleChange = async (dept, scheduleTypeId) => {
    try {
      await api.patch(`/departments/${dept.id}/`, { schedule_type: scheduleTypeId });
      await fetchDepartments();
    } catch (e) {
      alert(e?.response?.data?.detail || t("admin.departments.errors.updateFailed"));
    }
  };

  const handleDeptEditStart = (dept) => {
    setEditingDeptId(dept.id);
    setEditDeptForm({ name: dept.name, description: dept.description || "" });
    setEditDeptError("");
  };

  const handleDeptEditCancel = () => {
    setEditingDeptId(null);
    setEditDeptError("");
  };

  const handleDeptEditSave = async (id) => {
    setEditDeptError("");
    if (!editDeptForm.name.trim()) {
      setEditDeptError(t("admin.departments.errors.deptNameRequired"));
      return;
    }
    try {
      await api.patch(`/departments/${id}/`, editDeptForm);
      setEditingDeptId(null);
      await fetchDepartments();
    } catch (e) {
      const data = e?.response?.data;
      setEditDeptError(
        data?.detail ||
        Object.entries(data || {}).map(([k, v]) => `${k}: ${[v].flat().join(", ")}`).join(" · ") ||
        t("admin.departments.errors.updateFailed")
      );
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.delete(`/users/${deleteModal.user.id}/`);
      setDeleteModal({ open: false, user: null });
      await fetchUsers();
    } catch (e) {
      alert(e?.response?.data?.detail || t("admin.errors.deleteFailed"));
    }
  };

  const handleBulkClockIn = async () => {
    setBulkMsg("");
    setBulkLoading("in");
    try {
      const res = await api.post("/attendance/admin/bulk-clock-in/");
      setBulkMsg({ type: "success", text: `${res.data.detail} ${res.data.users?.length ? `(${res.data.users.join(", ")})` : ""}` });
    } catch (e) {
      setBulkMsg({ type: "error", text: e?.response?.data?.detail || t("admin.errors.genericError") });
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
      setBulkMsg({ type: "error", text: e?.response?.data?.detail || t("admin.errors.genericError") });
    } finally {
      setBulkLoading("");
    }
  };

  const handleApplySeniority = async () => {
    setApplyMsg("");
    try {
      const res = await api.post("/leaves/seniority-rules/apply/");
      setApplyMsg(res.data?.detail || t("admin.applied"));
      setTimeout(() => setApplyMsg(""), 4000);
    } catch (e) {
      setApplyMsg(e?.response?.data?.detail || t("admin.errors.applyRulesError"));
    }
  };

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("admin.title")}</h1>
          <p className={styles.subtitle}>{t("admin.accountsTotal", { count: users.length })}</p>
        </div>
        {activeTab === "users" && (
          <button
            className={styles.btnNew}
            onClick={() => { setShowForm((v) => !v); setFormError(""); setEditingUser(null); }}
          >
            {showForm ? t("admin.cancelNew") : t("admin.newUser")}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "users" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("users")}
        >
          {t("admin.tabs.users")}
        </button>
        <button
          className={`${styles.tab} ${activeTab === "seniority" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("seniority")}
        >
          {t("admin.tabs.seniority")}
        </button>
        <button
          className={`${styles.tab} ${activeTab === "attendance" ? styles.tabActive : ""}`}
          onClick={() => { setActiveTab("attendance"); setBulkMsg(""); }}
        >
          {t("admin.tabs.attendance")}
        </button>
        <button
          className={`${styles.tab} ${activeTab === "departments" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("departments")}
        >
          {t("admin.tabs.departments")}
        </button>
      </div>

      {/* ── Users Tab ── */}
      {activeTab === "users" && (
        <>
          {successMsg && <div className={styles.successBanner}>{successMsg}</div>}

          {/* New user form */}
          {showForm && (
            <div className={styles.formCard}>
              <h2 className={styles.formTitle}>{t("admin.createUserTitle")}</h2>
              <form onSubmit={handleSubmit} className={styles.form} noValidate>
                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.firstName")}</label>
                    <input className={styles.input} value={form.first_name} onChange={f("first_name")} placeholder="Ion" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.lastName")}</label>
                    <input className={styles.input} value={form.last_name} onChange={f("last_name")} placeholder="Popescu" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.username")}</label>
                    <input className={styles.input} value={form.username} onChange={f("username")} placeholder="ion.popescu" required />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.email")}</label>
                    <input className={styles.input} type="email" value={form.email} onChange={f("email")} placeholder="ion@example.com" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.password")}</label>
                    <input className={styles.input} type="password" value={form.password} onChange={f("password")} placeholder={t("admin.form.passwordHint")} required />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.confirmPassword")}</label>
                    <input className={styles.input} type="password" value={form.password2} onChange={f("password2")} placeholder={t("admin.form.confirmPasswordHint")} required />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.role")}</label>
                    <select className={styles.select} value={form.role} onChange={f("role")}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{t(`common.roles.${r}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.department")}</label>
                    <select className={styles.select} value={form.department} onChange={f("department")}>
                      <option value="">{t("admin.form.noneDept")}</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.position")}</label>
                    <input className={styles.input} value={form.position} onChange={f("position")} placeholder={t("admin.form.positionHint")} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.employeeNumber")}</label>
                    <input className={styles.input} value={form.employee_number} onChange={f("employee_number")} placeholder={t("admin.form.employeeNumberHint")} />
                  </div>
                </div>
                {formError && <div className={styles.formError}>{formError}</div>}
                <div className={styles.formActions}>
                  <button type="submit" className={styles.btnSubmit} disabled={submitting}>
                    {submitting && <span className={styles.spinner} />}
                    {t("admin.createUser")}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Edit user form */}
          {editingUser && (
            <div className={styles.formCard}>
              <h2 className={styles.formTitle}>{t("admin.editUserTitle", { name: editingUser.full_name || editingUser.username })}</h2>
              <form onSubmit={handleEditSubmit} className={styles.form} noValidate>
                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.firstName")}</label>
                    <input className={styles.input} value={editForm.first_name} onChange={ef("first_name")} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.lastName")}</label>
                    <input className={styles.input} value={editForm.last_name} onChange={ef("last_name")} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.username")}</label>
                    <input className={styles.input} value={editForm.username} onChange={ef("username")} required />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.email")}</label>
                    <input className={styles.input} type="email" value={editForm.email} onChange={ef("email")} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.phone")}</label>
                    <input className={styles.input} value={editForm.phone} onChange={ef("phone")} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.role")}</label>
                    <select className={styles.select} value={editForm.role} onChange={ef("role")}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{t(`common.roles.${r}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.department")}</label>
                    <select className={styles.select} value={editForm.department} onChange={ef("department")}>
                      <option value="">{t("admin.form.noneDept")}</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.position")}</label>
                    <input className={styles.input} value={editForm.position} onChange={ef("position")} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.employeeNumber")}</label>
                    <input className={styles.input} value={editForm.employee_number} onChange={ef("employee_number")} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>{t("admin.form.hireDate")}</label>
                    <input className={styles.input} type="date" value={editForm.hire_date || ""} onChange={ef("hire_date")} />
                  </div>
                </div>
                {editFormError && <div className={styles.formError}>{editFormError}</div>}
                <div className={styles.formActions}>
                  <button type="button" className={styles.btnCancel} onClick={handleEditCancel}>
                    {t("common.cancel")}
                  </button>
                  <button type="submit" className={styles.btnSubmit} disabled={editSubmitting}>
                    {editSubmitting && <span className={styles.spinner} />}
                    {t("common.save")}
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
              placeholder={t("admin.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Users table */}
          <div className={styles.table}>
            <div className={`${styles.tableRow} ${styles.tableHead}`}>
              <span>{t("admin.table.user")}</span>
              <span>{t("admin.table.role")}</span>
              <span>{t("admin.table.department")}</span>
              <span>{t("admin.table.schedule")}</span>
              <span>{t("admin.table.position")}</span>
              <span>{t("admin.table.employeeNumber")}</span>
              <span>{t("admin.table.email")}</span>
              <span>{t("admin.table.status")}</span>
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
                      {t(`common.roles.${u.role}`)}
                    </span>
                  </span>
                  <span className={styles.muted}>{u.department_name || "—"}</span>
                  <span className={styles.scheduleCell}>
                    <select
                      className={styles.select}
                      value={u.schedule_type || ""}
                      onChange={(e) => handleUserScheduleChange(u, e.target.value ? parseInt(e.target.value) : null)}
                    >
                      <option value="">{t("admin.userSchedule.departmentDefault")}</option>
                      {scheduleTypes.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {!u.schedule_type && u.effective_schedule_type_name && (
                      <span className={styles.scheduleHint}>{u.effective_schedule_type_name}</span>
                    )}
                  </span>
                  <span className={styles.muted}>{u.position || "—"}</span>
                  <span className={styles.muted}>{u.employee_number || "—"}</span>
                  <span className={styles.muted}>{u.email || "—"}</span>
                  <span className={styles.statusCell}>
                    <button
                      className={styles.btnEdit}
                      onClick={() => handleEditStart(u)}
                      title={t("common.edit")}
                    >
                      ✎
                    </button>
                    {u.is_active ? (
                      <button
                        className={styles.btnDeactivate}
                        onClick={() => setDeactivateModal({ open: true, user: u, reason: "" })}
                        title={t("admin.deactivateTitle")}
                      >
                        {t("admin.deactivate")}
                      </button>
                    ) : (
                      <button
                        className={styles.btnActivate}
                        onClick={() => handleActivate(u)}
                        title={u.deactivation_reason ? t("admin.reasonTooltip", { reason: u.deactivation_reason }) : t("admin.activateTitle")}
                      >
                        {t("admin.activate")}
                      </button>
                    )}
                    <button
                      className={styles.btnDelete}
                      onClick={() => setDeleteModal({ open: true, user: u })}
                      title={t("admin.deleteTitle")}
                    >
                      ✕
                    </button>
                  </span>
                </div>
              ))
            ) : (
              <div className={styles.empty}>
                {search ? t("admin.noUsersMatching", { search }) : t("admin.noUsers")}
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
            {t("admin.bulkInfo")}
          </div>

          <div className={styles.bulkActions}>
            <div className={styles.bulkCard}>
              <div className={styles.bulkCardTitle}>{t("admin.bulkIn.title")}</div>
              <p className={styles.bulkCardDesc}>
                {t("admin.bulkIn.desc")}
              </p>
              <button
                className={styles.btnBulkIn}
                onClick={handleBulkClockIn}
                disabled={bulkLoading === "in"}
              >
                {bulkLoading === "in" ? <span className={styles.spinner} /> : null}
                {t("admin.bulkIn.button")}
              </button>
            </div>

            <div className={styles.bulkCard}>
              <div className={styles.bulkCardTitle}>{t("admin.bulkOut.title")}</div>
              <p className={styles.bulkCardDesc}>
                {t("admin.bulkOut.desc")}
              </p>
              <button
                className={styles.btnBulkOut}
                onClick={handleBulkClockOut}
                disabled={bulkLoading === "out"}
              >
                {bulkLoading === "out" ? <span className={styles.spinner} /> : null}
                {t("admin.bulkOut.button")}
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
            {t("admin.seniorityInfo", { applyLabel: t("admin.applyToAll") })}
          </div>

          <div className={styles.seniorityTable}>
            <div className={`${styles.seniorityRow} ${styles.seniorityHead}`}>
              <span>{t("admin.seniorityTable.minYears")}</span>
              <span>{t("admin.seniorityTable.extraDays")}</span>
              <span></span>
            </div>
            {seniorityRules.length > 0 ? seniorityRules.map((rule) => (
              <div key={rule.id} className={styles.seniorityRow}>
                <span className={styles.seniorityVal}>{t("admin.seniorityTable.years", { count: rule.min_years })}</span>
                <span className={styles.seniorityExtra}>{t("admin.seniorityTable.extraDaysValue", { count: rule.extra_days })}</span>
                <span>
                  <button
                    className={styles.btnDelete}
                    onClick={() => handleSeniorityDelete(rule.id)}
                    title={t("common.delete")}
                  >
                    ✕
                  </button>
                </span>
              </div>
            )) : (
              <div className={styles.empty}>{t("admin.noSeniorityRules")}</div>
            )}
          </div>

          <div className={styles.seniorityAddForm}>
            <div className={styles.seniorityAddRow}>
              <div className={styles.field}>
                <label className={styles.label}>{t("admin.seniorityForm.minYears")}</label>
                <input
                  type="number"
                  min="1"
                  className={styles.input}
                  placeholder={t("admin.seniorityForm.minYearsPlaceholder")}
                  value={seniorityForm.min_years}
                  onChange={e => setSeniorityForm(f => ({ ...f, min_years: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t("admin.seniorityForm.extraDays")}</label>
                <input
                  type="number"
                  min="1"
                  className={styles.input}
                  placeholder={t("admin.seniorityForm.extraDaysPlaceholder")}
                  value={seniorityForm.extra_days}
                  onChange={e => setSeniorityForm(f => ({ ...f, extra_days: e.target.value }))}
                />
              </div>
              <button className={styles.btnSubmit} onClick={handleSeniorityAdd} style={{ alignSelf: "flex-end" }}>
                {t("admin.seniorityForm.addRule")}
              </button>
            </div>
            {seniorityError && <div className={styles.formError}>{seniorityError}</div>}
          </div>

          <div className={styles.seniorityApply}>
            <button className={styles.btnApply} onClick={handleApplySeniority}>
              {t("admin.applyToAll")}
            </button>
            {applyMsg && <span className={styles.applyMsg}>{applyMsg}</span>}
          </div>

        </div>
      )}

      {/* ── Departments & Schedules Tab ── */}
      {activeTab === "departments" && (
        <div className={styles.senioritySection}>

          <div className={styles.seniorityInfo}>
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <circle cx="8" cy="8" r="7" stroke="#60a5fa" strokeWidth="1.4"/>
              <path d="M8 7v4M8 5.5v.5" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            {t("admin.departments.scheduleInfo")}
          </div>

          <div className={styles.seniorityTable}>
            <div className={`${styles.scheduleRow} ${styles.seniorityHead}`}>
              <span>{t("admin.departments.table.name")}</span>
              <span>{t("admin.departments.table.start")}</span>
              <span>{t("admin.departments.table.end")}</span>
              <span>{t("admin.departments.table.breakMinutes")}</span>
              <span>{t("admin.departments.table.pontajHours")}</span>
              <span></span>
            </div>
            {scheduleTypes.length > 0 ? scheduleTypes.map((s) => (
              editingScheduleId === s.id ? (
                <div key={s.id} className={styles.scheduleRow}>
                  <input
                    className={styles.input}
                    value={editScheduleForm.name}
                    onChange={(e) => setEditScheduleForm((f) => ({ ...f, name: e.target.value }))}
                    autoFocus
                  />
                  <input
                    type="time"
                    className={styles.input}
                    value={editScheduleForm.start_time}
                    onChange={(e) => setEditScheduleForm((f) => ({ ...f, start_time: e.target.value }))}
                  />
                  <input
                    type="time"
                    className={styles.input}
                    value={editScheduleForm.end_time}
                    onChange={(e) => setEditScheduleForm((f) => ({ ...f, end_time: e.target.value }))}
                  />
                  <input
                    type="number"
                    min="0"
                    className={styles.input}
                    value={editScheduleForm.break_minutes}
                    onChange={(e) => setEditScheduleForm((f) => ({ ...f, break_minutes: e.target.value }))}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className={styles.input}
                    value={editScheduleForm.pontaj_hours}
                    onChange={(e) => setEditScheduleForm((f) => ({ ...f, pontaj_hours: e.target.value }))}
                  />
                  <span className={styles.rowActions}>
                    <button
                      className={styles.btnSave}
                      onClick={() => handleScheduleEditSave(s.id)}
                      title={t("common.save")}
                    >
                      ✓
                    </button>
                    <button
                      className={styles.btnDelete}
                      onClick={handleScheduleEditCancel}
                      title={t("common.cancel")}
                    >
                      ✕
                    </button>
                  </span>
                </div>
              ) : (
                <div key={s.id} className={styles.scheduleRow}>
                  <span className={styles.seniorityVal}>{s.name}</span>
                  <span className={styles.muted}>{s.start_time}</span>
                  <span className={styles.muted}>{s.end_time}</span>
                  <span className={styles.muted}>{s.break_minutes}</span>
                  <span className={styles.muted}>{s.pontaj_hours}</span>
                  <span className={styles.rowActions}>
                    <button
                      className={styles.btnEdit}
                      onClick={() => handleScheduleEditStart(s)}
                      title={t("common.edit")}
                    >
                      ✎
                    </button>
                    <button
                      className={styles.btnDelete}
                      onClick={() => handleScheduleDelete(s.id)}
                      title={t("common.delete")}
                    >
                      ✕
                    </button>
                  </span>
                </div>
              )
            )) : (
              <div className={styles.empty}>{t("admin.departments.noScheduleTypes")}</div>
            )}
          </div>
          {editScheduleError && <div className={styles.formError}>{editScheduleError}</div>}

          <div className={styles.seniorityAddForm}>
            <div className={styles.scheduleAddRow}>
              <div className={styles.field}>
                <label className={styles.label}>{t("admin.departments.scheduleForm.name")}</label>
                <input
                  className={styles.input}
                  value={scheduleForm.name}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t("admin.departments.scheduleForm.namePlaceholder")}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t("admin.departments.scheduleForm.start")}</label>
                <input
                  type="time"
                  className={styles.input}
                  value={scheduleForm.start_time}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, start_time: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t("admin.departments.scheduleForm.end")}</label>
                <input
                  type="time"
                  className={styles.input}
                  value={scheduleForm.end_time}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, end_time: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t("admin.departments.scheduleForm.breakMinutes")}</label>
                <input
                  type="number"
                  min="0"
                  className={styles.input}
                  value={scheduleForm.break_minutes}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, break_minutes: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t("admin.departments.scheduleForm.pontajHours")}</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className={styles.input}
                  value={scheduleForm.pontaj_hours}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, pontaj_hours: e.target.value }))}
                />
              </div>
              <button className={styles.btnSubmit} onClick={handleScheduleAdd} style={{ alignSelf: "flex-end" }}>
                {t("admin.departments.scheduleForm.add")}
              </button>
            </div>
            {scheduleError && <div className={styles.formError}>{scheduleError}</div>}
          </div>

          <div className={styles.seniorityTable}>
            <div className={`${styles.deptRow} ${styles.seniorityHead}`}>
              <span>{t("admin.departments.table.deptName")}</span>
              <span>{t("admin.departments.table.description")}</span>
              <span>{t("admin.departments.table.schedule")}</span>
              <span></span>
            </div>
            {departments.length > 0 ? departments.map((d) => (
              editingDeptId === d.id ? (
                <div key={d.id} className={styles.deptRow}>
                  <input
                    className={styles.input}
                    value={editDeptForm.name}
                    onChange={(e) => setEditDeptForm((f) => ({ ...f, name: e.target.value }))}
                    autoFocus
                  />
                  <input
                    className={styles.input}
                    value={editDeptForm.description}
                    onChange={(e) => setEditDeptForm((f) => ({ ...f, description: e.target.value }))}
                  />
                  <span className={styles.muted}>{d.schedule_type_name || "—"}</span>
                  <span className={styles.rowActions}>
                    <button
                      className={styles.btnSave}
                      onClick={() => handleDeptEditSave(d.id)}
                      title={t("common.save")}
                    >
                      ✓
                    </button>
                    <button
                      className={styles.btnDelete}
                      onClick={handleDeptEditCancel}
                      title={t("common.cancel")}
                    >
                      ✕
                    </button>
                  </span>
                </div>
              ) : (
                <div key={d.id} className={styles.deptRow}>
                  <span className={styles.seniorityVal}>{d.name}</span>
                  <span className={styles.muted}>{d.description || "—"}</span>
                  <span>
                    <select
                      className={styles.select}
                      value={d.schedule_type || ""}
                      onChange={(e) => handleDeptScheduleChange(d, e.target.value ? parseInt(e.target.value) : null)}
                    >
                      <option value="">{t("admin.departments.deptForm.noSchedule")}</option>
                      {scheduleTypes.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </span>
                  <span className={styles.rowActions}>
                    <button
                      className={styles.btnEdit}
                      onClick={() => handleDeptEditStart(d)}
                      title={t("common.edit")}
                    >
                      ✎
                    </button>
                    <button
                      className={styles.btnDelete}
                      onClick={() => handleDeptDelete(d.id)}
                      title={t("common.delete")}
                    >
                      ✕
                    </button>
                  </span>
                </div>
              )
            )) : (
              <div className={styles.empty}>{t("admin.departments.noDepartments")}</div>
            )}
          </div>
          {editDeptError && <div className={styles.formError}>{editDeptError}</div>}

          <div className={styles.seniorityAddForm}>
            <div className={styles.deptAddRow}>
              <div className={styles.field}>
                <label className={styles.label}>{t("admin.departments.deptForm.name")}</label>
                <input
                  className={styles.input}
                  value={deptForm.name}
                  onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t("admin.departments.deptForm.namePlaceholder")}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t("admin.departments.deptForm.description")}</label>
                <input
                  className={styles.input}
                  value={deptForm.description}
                  onChange={(e) => setDeptForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t("admin.departments.deptForm.descriptionPlaceholder")}
                />
              </div>
              <button className={styles.btnSubmit} onClick={handleDeptAdd} style={{ alignSelf: "flex-end" }}>
                {t("admin.departments.deptForm.add")}
              </button>
            </div>
            {deptError && <div className={styles.formError}>{deptError}</div>}
          </div>

        </div>
      )}

      {/* Deactivate modal */}
      {deactivateModal.open && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>{t("admin.deactivateTitle")}</h3>
            <p className={styles.modalBody}>
              {t("admin.deactivateModal.body", { name: deactivateModal.user?.full_name || deactivateModal.user?.username })}
            </p>
            <textarea
              className={styles.modalTextarea}
              rows={3}
              placeholder={t("admin.deactivateModal.placeholder")}
              value={deactivateModal.reason}
              onChange={(e) => setDeactivateModal((m) => ({ ...m, reason: e.target.value }))}
              autoFocus
            />
            {!deactivateModal.reason.trim() && (
              <p className={styles.formError}>{t("admin.deactivateModal.reasonRequired")}</p>
            )}
            <div className={styles.modalActions}>
              <button
                className={styles.btnCancel}
                onClick={() => setDeactivateModal({ open: false, user: null, reason: "" })}
              >
                {t("common.cancel")}
              </button>
              <button
                className={styles.btnDeleteConfirm}
                onClick={handleDeactivateConfirm}
                disabled={!deactivateModal.reason.trim()}
              >
                {t("admin.deactivate")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal.open && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>{t("admin.deleteTitle")}</h3>
            <p className={styles.modalBody}>
              {t("admin.deleteBody", { name: deleteModal.user?.full_name || deleteModal.user?.username })}
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.btnCancel}
                onClick={() => setDeleteModal({ open: false, user: null })}
              >
                {t("common.cancel")}
              </button>
              <button className={styles.btnDeleteConfirm} onClick={handleDeleteConfirm}>
                {t("admin.deleteConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}