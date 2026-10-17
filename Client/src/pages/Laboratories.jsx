import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { laboratoriesApi } from "../api/resources";
import { apiError } from "../api/client";
import { Empty, ErrorMessage, Loading, date } from "../components/Common";
import {
  Building2,
  Plus,
  Search,
  ArrowLeft,
  Save,
  Users,
  CheckCircle2,
  XCircle,
  Edit,
  ShieldCheck,
} from "lucide-react";

export default function Laboratories() {
  const [laboratories, setLaboratories] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    laboratoriesApi
      .list({ page: 1, limit: 100 })
      .then((r) => setLaboratories(r.data.laboratories || []))
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggle = async (lab) => {
    try {
      await laboratoriesApi.setStatus(lab.id, !lab.isActive);
      load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const filtered = laboratories.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="laboratories-page">
      <header className="page-header-simple">
        <div>
          <h1 className="page-title">Laboratories</h1>
          <p className="page-subtitle">
            Manage laboratory branches and clinical centers on the platform ({filtered.length} total)
          </p>
        </div>

        <Link className="btn-primary-action" to="/admin/laboratories/new">
          <Plus size={16} />
          <span>New Laboratory</span>
        </Link>
      </header>

      <ErrorMessage error={error} />

      {/* Search Toolbar */}
      <div className="orders-toolbar" style={{ marginBottom: "20px" }}>
        <div className="search-box" style={{ maxWidth: "460px" }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search laboratories by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Loading text="Loading laboratories…" />
      ) : filtered.length ? (
        <div className="table-card">
          <table className="clean-table">
            <thead>
              <tr>
                <th>Laboratory Name</th>
                <th>Status</th>
                <th>Users</th>
                <th>Patients</th>
                <th>Created</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  {/* Name with Icon */}
                  <td className="cell-patient">
                    <div className="patient-avatar-box">
                      <div className="lab-avatar-icon">
                        <Building2 size={16} />
                      </div>
                      <div className="patient-info">
                        <Link
                          to={`/admin/laboratories/${l.id}`}
                          className="patient-name"
                        >
                          {l.name}
                        </Link>
                        <span className="patient-cnic">ID: {l.id.slice(0, 8)}…</span>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="cell-status">
                    <span
                      className={`status-pill ${
                        l.isActive
                          ? "status-badge-finalized"
                          : "status-badge-cancelled"
                      }`}
                    >
                      {l.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>

                  {/* Users */}
                  <td className="cell-param-name">{l._count?.users ?? 0}</td>

                  {/* Patients */}
                  <td className="cell-param-name">{l._count?.patients ?? 0}</td>

                  {/* Created */}
                  <td className="cell-created">{date(l.createdAt)}</td>

                  {/* Actions */}
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "10px", alignItems: "center" }}>
                      <Link
                        to={`/admin/laboratories/${l.id}/edit`}
                        className="action-text-btn"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className={l.isActive ? "action-text-btn-danger" : "action-text-btn"}
                        onClick={() => toggle(l)}
                      >
                        {l.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No matching laboratories found.</Empty>
      )}
    </div>
  );
}

export function LaboratoryForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(Boolean(id));

  useEffect(() => {
    if (id) {
      laboratoriesApi
        .get(id)
        .then((r) => setForm({ name: r.data.laboratory.name }))
        .catch((e) => setError(apiError(e)))
        .finally(() => setBusy(false));
    }
  }, [id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Laboratory name is required.");
      return;
    }

    setError("");
    setBusy(true);

    try {
      const response = id
        ? await laboratoriesApi.update(id, form)
        : await laboratoriesApi.create(form);
      navigate(`/admin/laboratories/${response.data.laboratory.id}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (busy && id) return <Loading text="Loading laboratory details…" />;

  return (
    <div className="patient-form-page">
      <div className="form-page-top">
        <Link to="/admin/laboratories" className="back-nav-link">
          <ArrowLeft size={16} />
          <span>Back to Laboratories</span>
        </Link>
      </div>

      <header className="page-header-simple">
        <div>
          <h1 className="page-title">{id ? "Edit Laboratory" : "New Laboratory"}</h1>
          <p className="page-subtitle">
            Configure laboratory name, branch information, and diagnostic permissions
          </p>
        </div>
      </header>

      <ErrorMessage error={error} />

      <div className="patient-form-card" style={{ maxWidth: "600px" }}>
        <form onSubmit={submit} className="patient-styled-form">
          <div className="form-group-clean">
            <label>
              Laboratory Center Name <span className="required-star">*</span>
            </label>
            <input
              required
              placeholder="e.g. Xpert Clinical Laboratory - Abbottabad"
              value={form.name}
              onChange={(e) => setForm({ name: e.target.value })}
            />
            <span className="field-hint">
              Enter the full official name of this laboratory or diagnostic facility
            </span>
          </div>

          <div className="form-actions-clean">
            <Link to="/admin/laboratories" className="btn-cancel">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn-primary-action"
              disabled={busy}
            >
              <Save size={16} />
              <span>{busy ? "Saving…" : id ? "Update Laboratory" : "Create Laboratory"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LaboratoryDetail() {
  const { id } = useParams();
  const [laboratory, setLaboratory] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    laboratoriesApi
      .get(id)
      .then((r) => setLaboratory(r.data.laboratory))
      .catch((e) => setError(apiError(e)));
  };

  useEffect(load, [id]);

  const toggle = async () => {
    try {
      await laboratoriesApi.setStatus(id, !laboratory.isActive);
      load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  if (error) return <ErrorMessage error={error} />;
  if (!laboratory) return <Loading text="Loading laboratory…" />;

  const users = laboratory.users || [];

  return (
    <div className="laboratory-detail-page">
      <div className="form-page-top">
        <Link to="/admin/laboratories" className="back-nav-link">
          <ArrowLeft size={16} />
          <span>Back to Laboratories</span>
        </Link>
      </div>

      <header className="page-header-simple">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div className="lab-avatar-icon-lg">
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="page-title">{laboratory.name}</h1>
            <p className="page-subtitle">
              Status:{" "}
              <span
                className={`status-pill ${
                  laboratory.isActive
                    ? "status-badge-finalized"
                    : "status-badge-cancelled"
                }`}
                style={{ marginLeft: "6px" }}
              >
                {laboratory.isActive ? "ACTIVE" : "INACTIVE"}
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
            className={laboratory.isActive ? "btn-cancel" : "btn-primary-action"}
            onClick={toggle}
          >
            {laboratory.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
      </header>

      {/* Assigned Users Section */}
      <div className="dashboard-panel" style={{ marginTop: "24px" }}>
        <div className="panel-top-bar">
          <div>
            <h2 className="panel-heading">Assigned Staff & Operators</h2>
            <p className="page-subtitle" style={{ fontSize: "0.8rem", marginTop: "2px" }}>
              {users.length} user{users.length === 1 ? "" : "s"} attached to this laboratory
            </p>
          </div>
        </div>

        {users.length ? (
          <table className="clean-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="cell-patient-name">{u.email}</td>
                  <td>
                    <span className="test-tag">{u.role}</span>
                  </td>
                  <td>
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
                  <td className="cell-created">{date(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-subtext">No staff accounts assigned to this laboratory yet.</div>
        )}
      </div>
    </div>
  );
}
