import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { adminUsersApi, laboratoriesApi } from "../api/resources";
import { apiError } from "../api/client";
import { Empty, ErrorMessage, Loading, date } from "../components/Common";
import { useAuth } from "../auth/AuthContext";
import {
  Users as UsersIcon,
  Plus,
  Search,
  ArrowLeft,
  Save,
  Building2,
  ChevronDown,
  Edit,
  Shield,
  KeyRound,
} from "lucide-react";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminUsersApi
      .list({ page: 1, limit: 100 })
      .then((r) => setUsers(r.data.users || []))
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggle = async (user) => {
    try {
      await adminUsersApi.setStatus(user.id, !user.isActive);
      load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="users-page">
      <header className="page-header-simple">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">
            Manage system administrators, pathologists, and laboratory staff accounts ({filtered.length} total)
          </p>
        </div>

        <Link className="btn-primary-action" to="/admin/users/new">
          <Plus size={16} />
          <span>New User</span>
        </Link>
      </header>

      <ErrorMessage error={error} />

      <div className="orders-toolbar" style={{ marginBottom: "20px" }}>
        <div className="search-box" style={{ maxWidth: "460px" }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search users by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Loading text="Loading users…" />
      ) : filtered.length ? (
        <div className="table-card">
          <table className="clean-table">
            <thead>
              <tr>
                <th>Email / User</th>
                <th>Role</th>
                <th>Assigned Laboratory</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const initials = u.email.slice(0, 2).toUpperCase();
                return (
                  <tr key={u.id}>
                    <td className="cell-patient">
                      <div className="patient-avatar-box">
                        <span className="patient-avatar-circle">{initials}</span>
                        <div className="patient-info">
                          <Link to={`/admin/users/${u.id}`} className="patient-name">
                            {u.email}
                          </Link>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="test-tag">{u.role}</span>
                    </td>

                    <td className="cell-param-name">
                      {u.laboratory?.name || "Global Administrator"}
                    </td>

                    <td className="cell-status">
                      <span
                        className={`status-pill ${
                          u.isActive
                            ? "status-badge-finalized"
                            : "status-badge-cancelled"
                        }`}
                      >
                        {u.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "10px", alignItems: "center" }}>
                        <Link to={`/admin/users/${u.id}/edit`} className="action-text-btn">
                          Edit
                        </Link>
                        <button
                          type="button"
                          className={u.isActive ? "action-text-btn-danger" : "action-text-btn"}
                          onClick={() => toggle(u)}
                        >
                          {u.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No matching users found.</Empty>
      )}
    </div>
  );
}

const blank = { email: "", password: "", role: "LAB_ADMIN", laboratoryId: "" };

export function UserForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [form, setForm] = useState(blank);
  const [laboratories, setLaboratories] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(Boolean(id));

  useEffect(() => {
    laboratoriesApi
      .list({ page: 1, limit: 100 })
      .then((r) => setLaboratories(r.data.laboratories || []));
  }, []);

  useEffect(() => {
    if (id) {
      adminUsersApi
        .get(id)
        .then((r) =>
          setForm({
            ...blank,
            email: r.data.user.email,
            role: r.data.user.role,
            laboratoryId: r.data.user.laboratoryId || "",
          })
        )
        .catch((e) => setError(apiError(e)))
        .finally(() => setBusy(false));
    }
  }, [id]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);

    const data = {
      email: form.email.trim(),
    };

    // Only send role and laboratoryId when creating or when actor is SUPERADMIN (Fixes A8)
    if (!id || authUser?.role === "SUPERADMIN") {
      data.role = form.role;
      if (form.role === "LAB_ADMIN" || form.role === "LAB_TECH") {
        data.laboratoryId = form.laboratoryId || undefined;
      }
    }

    if (!id || form.password) data.password = form.password;

    try {
      const response = id
        ? await adminUsersApi.update(id, data)
        : await adminUsersApi.create(data);
      navigate(`/admin/users/${response.data.user.id}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (busy && id) return <Loading text="Loading user details…" />;

  return (
    <div className="patient-form-page">
      <div className="form-page-top">
        <Link to="/admin/users" className="back-nav-link">
          <ArrowLeft size={16} />
          <span>Back to Users</span>
        </Link>
      </div>

      <header className="page-header-simple">
        <div>
          <h1 className="page-title">{id ? "Edit User" : "New User Registration"}</h1>
          <p className="page-subtitle">
            Configure authentication credentials, role assignments, and laboratory affiliations
          </p>
        </div>
      </header>

      <ErrorMessage error={error} />

      <div className="patient-form-card" style={{ maxWidth: "680px" }}>
        <form onSubmit={submit} className="patient-styled-form">
          <div className="form-group-clean">
            <label>
              Email Address <span className="required-star">*</span>
            </label>
            <input
              required
              type="email"
              placeholder="e.g. user@xpertlab.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="form-group-clean">
            <label>
              {id ? "New Password (leave empty to keep current)" : "Password"}{" "}
              {!id && <span className="required-star">*</span>}
            </label>
            <input
              required={!id}
              type="password"
              minLength={6}
              placeholder="Minimum 6 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <div className="form-row-2col">
            <div className="form-group-clean">
              <label>
                System Role <span className="required-star">*</span>
              </label>
              <div className="select-wrapper">
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="LAB_ADMIN">Lab Administrator</option>
                  <option value="LAB_TECH">Lab Technician</option>
                  <option value="SUPERADMIN">Super Administrator</option>
                </select>
                <ChevronDown size={16} className="select-arrow" />
              </div>
            </div>

            {form.role === "LAB_ADMIN" && (
              <div className="form-group-clean">
                <label>
                  Assigned Laboratory <span className="required-star">*</span>
                </label>
                <div className="select-wrapper">
                  <select
                    required
                    value={form.laboratoryId}
                    onChange={(e) =>
                      setForm({ ...form, laboratoryId: e.target.value })
                    }
                  >
                    <option value="">Select a laboratory...</option>
                    {laboratories.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="select-arrow" />
                </div>
              </div>
            )}
          </div>

          <div className="form-actions-clean">
            <Link to="/admin/users" className="btn-cancel">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn-primary-action"
              disabled={busy}
            >
              <Save size={16} />
              <span>{busy ? "Saving…" : id ? "Update User" : "Create User"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function UserDetail() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    adminUsersApi
      .get(id)
      .then((r) => setUser(r.data.user))
      .catch((e) => setError(apiError(e)));
  };

  useEffect(load, [id]);

  const toggle = async () => {
    try {
      await adminUsersApi.setStatus(id, !user.isActive);
      load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  if (error) return <ErrorMessage error={error} />;
  if (!user) return <Loading text="Loading user profile…" />;

  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <div className="user-detail-page">
      <div className="form-page-top">
        <Link to="/admin/users" className="back-nav-link">
          <ArrowLeft size={16} />
          <span>Back to Users</span>
        </Link>
      </div>

      <header className="page-header-simple">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span className="patient-avatar-circle-lg">{initials}</span>
          <div>
            <h1 className="page-title">{user.email}</h1>
            <p className="page-subtitle">
              Role: <strong>{user.role}</strong> · Status:{" "}
              <span
                className={`status-pill ${
                  user.isActive
                    ? "status-badge-finalized"
                    : "status-badge-cancelled"
                }`}
                style={{ marginLeft: "4px" }}
              >
                {user.isActive ? "ACTIVE" : "INACTIVE"}
              </span>
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Link className="btn-cancel" to="edit">
            <Edit size={15} />
            <span>Edit</span>
          </Link>
          <button
            type="button"
            className={user.isActive ? "btn-cancel" : "btn-primary-action"}
            onClick={toggle}
          >
            {user.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
      </header>

      <div className="patient-info-summary-grid">
        <div className="summary-card-clean">
          <Building2 size={18} className="summary-card-icon" />
          <div>
            <span className="summary-card-lbl">Laboratory Affiliation</span>
            <span className="summary-card-val">
              {user.laboratory?.name || "Global Super Administrator"}
            </span>
          </div>
        </div>

        <div className="summary-card-clean">
          <Shield size={18} className="summary-card-icon" />
          <div>
            <span className="summary-card-lbl">Access Level</span>
            <span className="summary-card-val">{user.role}</span>
          </div>
        </div>

        <div className="summary-card-clean">
          <KeyRound size={18} className="summary-card-icon" />
          <div>
            <span className="summary-card-lbl">Account Created</span>
            <span className="summary-card-val">{date(user.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
