import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  patientsApi,
  ordersApi,
  paymentsApi,
  reportsApi,
  resultsApi,
  testsApi,
  laboratoriesApi,
} from "../api/resources";
import { apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  Empty,
  ErrorMessage,
  Loading,
  Status,
  date,
  patientName,
  formatAge,
} from "../components/Common";
import {
  ArrowLeft,
  UserPlus,
  Save,
  User,
  Phone,
  CreditCard,
  MapPin,
  Calendar,
  Building2,
  ChevronDown,
  Edit,
  ClipboardList,
} from "lucide-react";

const blank = {
  name: "",
  fullName: "",
  age: "",
  ageUnit: "YEARS",
  gender: "MALE",
  cnic: "",
  phone: "",
  address: "",
  laboratoryId: "",
};

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    patientsApi
      .list({ page: 1, limit: 100 })
      .then((r) => setPatients(r.data.patients || []))
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const remove = async (id) => {
    if (
      !window.confirm(
        "Delete this patient? Related records may prevent deletion."
      )
    )
      return;

    try {
      await patientsApi.remove(id);
      load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const filtered = patients.filter((p) =>
    `${p.name} ${p.fullName || ""} ${p.cnic || ""} ${p.phone || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="patients-page">
      <header className="page-header-simple">
        <div>
          <h1 className="page-title">Patients</h1>
          <p className="page-subtitle">
            Register and manage diagnostic laboratory patients ({filtered.length} total)
          </p>
        </div>

        <Link className="btn-primary-action" to="/patients/new">
          <UserPlus size={16} />
          <span>New Patient</span>
        </Link>
      </header>

      <ErrorMessage error={error} />

      <div className="orders-toolbar" style={{ marginBottom: "20px" }}>
        <div className="search-box" style={{ maxWidth: "480px" }}>
          <input
            type="text"
            placeholder="Search patients by name, CNIC, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : filtered.length ? (
        <div className="table-card">
          <table className="clean-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>CNIC</th>
                <th>Phone</th>
                <th>Age / Gender</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((p) => {
                const name = patientName(p);
                const initials =
                  name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "PT";
                return (
                  <tr key={p.id}>
                    <td className="cell-patient">
                      <div className="patient-avatar-box">
                        <span className="patient-avatar-circle">{initials}</span>
                        <div className="patient-info">
                          <Link to={`/patients/${p.id}`} className="patient-name">
                            {name}
                          </Link>
                        </div>
                      </div>
                    </td>

                    <td className="cell-cnic">{p.cnic || "—"}</td>

                    <td className="cell-phone">{p.phone || "—"}</td>

                    <td className="cell-demographics">
                      {formatAge(p)} / {p.gender}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "10px" }}>
                        <Link to={`/patients/${p.id}/edit`} className="action-text-btn">
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="action-text-btn-danger"
                          onClick={() => remove(p.id)}
                        >
                          Delete
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
        <Empty>No matching patients found.</Empty>
      )}
    </div>
  );
}

export function PatientForm() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(blank);
  const [laboratories, setLaboratories] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(Boolean(id));

  useEffect(() => {
    if (user?.role === "SUPERADMIN") {
      laboratoriesApi
        .list({ page: 1, limit: 100 })
        .then((r) => {
          const labs = r.data.laboratories || [];
          setLaboratories(labs);
          if (labs.length > 0 && !id && !form.laboratoryId) {
            setForm((prev) => ({ ...prev, laboratoryId: labs[0].id }));
          }
        })
        .catch(() => {});
    }

    if (id) {
      patientsApi
        .get(id)
        .then((r) =>
          setForm({
            ...blank,
            ...r.data.patient,
            age: String(r.data.patient.age),
            ageUnit: r.data.patient.ageUnit || "YEARS",
          })
        )
        .catch((e) => setError(apiError(e)))
        .finally(() => setBusy(false));
    }
  }, [id, user]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const name = form.name.trim();
    const fullName = form.fullName.trim();
    const cnic = form.cnic ? form.cnic.replace(/\D/g, "") : "";
    const phone = form.phone ? form.phone.trim() : "";
    const age = Number(form.age);
    const ageUnit = form.ageUnit || "YEARS";

    if (!name) {
      setError("First name is required.");
      return;
    }

    if (!fullName) {
      setError("Last name is required.");
      return;
    }

    if (cnic && !/^\d{13}$/.test(cnic)) {
      setError("CNIC must contain exactly 13 digits (e.g. 3520112345671).");
      return;
    }

    if (phone && !/^03\d{9}$/.test(phone)) {
      setError(
        "Phone number must be a valid Pakistani mobile number, e.g. 03001234567."
      );
      return;
    }

    if (!Number.isInteger(age) || age < 1) {
      setError("Age must be a valid positive whole number.");
      return;
    }

    if (!["MALE", "FEMALE", "OTHER"].includes(form.gender)) {
      setError("Please select a valid gender.");
      return;
    }

    const data = {
      ...form,
      name,
      fullName,
      cnic: cnic || null,
      phone: phone || null,
      age,
      ageUnit,
    };

    if (!data.address?.trim()) data.address = null;
    else data.address = data.address.trim();

    if (!data.laboratoryId) delete data.laboratoryId;

    setBusy(true);

    try {
      const response = id
        ? await patientsApi.update(id, data)
        : await patientsApi.create(data);

      navigate(`/patients/${response.data.patient.id}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (busy && id) return <Loading text="Loading patient details…" />;

  return (
    <div className="patient-form-page">
      {/* Header with Back Link */}
      <div className="form-page-top">
        <Link to="/patients" className="back-nav-link">
          <ArrowLeft size={16} />
          <span>Back to Patients</span>
        </Link>
      </div>

      <header className="page-header-simple">
        <div>
          <h1 className="page-title">{id ? "Edit Patient" : "New Patient Registration"}</h1>
          <p className="page-subtitle">
            Enter patient demographics, CNIC, and contact details for diagnostic records
          </p>
        </div>
      </header>

      <ErrorMessage error={error} />

      {/* Styled Card Container */}
      <div className="patient-form-card">
        <form onSubmit={submit} className="patient-styled-form">
          {/* Row 1: First Name & Last Name */}
          <div className="form-row-2col">
            <div className="form-group-clean">
              <label>
                First Name <span className="required-star">*</span>
              </label>
              <input
                required
                placeholder="e.g. Muhammad"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="form-group-clean">
              <label>
                Last Name <span className="required-star">*</span>
              </label>
              <input
                required
                placeholder="e.g. Ali Khan"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
          </div>

          {/* Row 2: Age & Gender */}
          <div className="form-row-2col">
            <div className="form-group-clean">
              <label>
                Age <span className="required-star">*</span>
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 32"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  style={{ flex: 1 }}
                />
                <select
                  value={form.ageUnit || "YEARS"}
                  onChange={(e) => setForm({ ...form, ageUnit: e.target.value })}
                  style={{ width: "110px", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color, #d1d5db)" }}
                >
                  <option value="YEARS">Years</option>
                  <option value="MONTHS">Months</option>
                  <option value="DAYS">Days</option>
                </select>
              </div>
            </div>

            <div className="form-group-clean">
              <label>
                Gender <span className="required-star">*</span>
              </label>
              <div className="select-wrapper">
                <select
                  required
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
                <ChevronDown size={16} className="select-arrow" />
              </div>
            </div>
          </div>

          {/* Row 3: CNIC & Phone */}
          <div className="form-row-2col">
            <div className="form-group-clean">
              <label>
                CNIC Number (13 digits)
              </label>
              <input
                inputMode="numeric"
                maxLength="13"
                placeholder="e.g. 3520112345671 (Optional)"
                value={form.cnic || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    cnic: e.target.value.replace(/\D/g, "").slice(0, 13),
                  })
                }
              />
              <span className="field-hint">Optional for children/dependents</span>
            </div>

            <div className="form-group-clean">
              <label>
                Mobile Phone
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength="11"
                placeholder="03001234567 (Optional)"
                value={form.phone || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phone: e.target.value.replace(/\D/g, "").slice(0, 11),
                  })
                }
              />
              <span className="field-hint">Pakistani format: 03001234567</span>
            </div>
          </div>

          {/* Superadmin Laboratory Select */}
          {user?.role === "SUPERADMIN" && !id && (
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
                  <option value="">Select laboratory...</option>
                  {laboratories.map((lab) => (
                    <option key={lab.id} value={lab.id}>
                      {lab.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="select-arrow" />
              </div>
            </div>
          )}

          {/* Address */}
          <div className="form-group-clean">
            <label>Residential Address</label>
            <textarea
              rows={3}
              placeholder="e.g. Al Haider Plaza, Mansehra Road, Abbottabad"
              value={form.address || ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          {/* Form Actions */}
          <div className="form-actions-clean">
            <Link to="/patients" className="btn-cancel">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn-primary-action"
              disabled={busy}
            >
              <Save size={16} />
              <span>{busy ? "Saving…" : id ? "Update Patient" : "Save Patient"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PatientDetail() {
  const { id } = useParams();

  const [patient, setPatient] = useState(null);
  const [related, setRelated] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      patientsApi.get(id),
      ordersApi.list({ page: 1, limit: 100 }),
      resultsApi.list({ page: 1, limit: 100 }),
      reportsApi.list({ page: 1, limit: 100 }),
      paymentsApi.list({ page: 1, limit: 100 }),
      testsApi.list({ page: 1, limit: 1 }),
    ])
      .then(([p, o, r, rep, pay]) => {
        const orders = (o.data.orders || []).filter((x) => x.patientId === id);
        const orderIds = new Set(orders.map((x) => x.id));

        setPatient(p.data.patient);

        setRelated({
          orders,
          results: (r.data.results || []).filter((x) =>
            orderIds.has(x.orderedTestItem?.order?.id)
          ),
          reports: (rep.data.reports || []).filter((x) => orderIds.has(x.orderId)),
          payments: (pay.data.payments || []).filter((x) => orderIds.has(x.orderId)),
        });
      })
      .catch((e) => setError(apiError(e)));
  }, [id]);

  if (error) return <ErrorMessage error={error} />;
  if (!patient || !related) return <Loading text="Loading patient record…" />;

  const pName = patientName(patient);
  const initials =
    pName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "PT";

  return (
    <div className="patient-detail-page">
      <div className="form-page-top">
        <Link to="/patients" className="back-nav-link">
          <ArrowLeft size={16} />
          <span>Back to Patients</span>
        </Link>
      </div>

      <header className="page-header-simple">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span className="patient-avatar-circle-lg">{initials}</span>
          <div>
            <h1 className="page-title">{pName}</h1>
            <p className="page-subtitle">
              CNIC: {patient.cnic || "None"} · {formatAge(patient)} · {patient.gender}
            </p>
          </div>
        </div>

        <Link className="btn-primary-action" to="edit">
          <Edit size={16} />
          <span>Edit Patient</span>
        </Link>
      </header>

      {/* Info Cards Grid */}
      <div className="patient-info-summary-grid">
        <div className="summary-card-clean">
          <Phone size={18} className="summary-card-icon" />
          <div>
            <span className="summary-card-lbl">Phone Number</span>
            <span className="summary-card-val">{patient.phone || "—"}</span>
          </div>
        </div>

        <div className="summary-card-clean">
          <MapPin size={18} className="summary-card-icon" />
          <div>
            <span className="summary-card-lbl">Address</span>
            <span className="summary-card-val">{patient.address || "—"}</span>
          </div>
        </div>

        <div className="summary-card-clean">
          <Calendar size={18} className="summary-card-icon" />
          <div>
            <span className="summary-card-lbl">Registered On</span>
            <span className="summary-card-val">{date(patient.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Related Workflow Section */}
      <div className="dashboard-panel" style={{ marginTop: "24px" }}>
        <div className="panel-top-bar">
          <div>
            <h2 className="panel-heading">Patient Orders & Work History</h2>
            <p className="page-subtitle" style={{ fontSize: "0.8rem", marginTop: "2px" }}>
              {related.orders.length} order{related.orders.length === 1 ? "" : "s"} ·{" "}
              {related.results.length} result{related.results.length === 1 ? "" : "s"} ·{" "}
              {related.reports.length} report{related.reports.length === 1 ? "" : "s"}
            </p>
          </div>
          <Link to="/orders" className="panel-action-link">
            <span>+ Create Order</span>
          </Link>
        </div>

        {related.orders.length ? (
          <table className="clean-table">
            <thead>
              <tr>
                <th>Test Ordered</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {related.orders.map((o) => (
                <tr key={o.id}>
                  <td className="cell-param-name">
                    {(o.orderedTestItems || [])
                      .map((item) => item.testDefinition?.name || item.testDefinition?.code)
                      .join(", ") || "Diagnostic Panel"}
                  </td>
                  <td>
                    <span
                      className={`status-pill ${
                        o.status === "COMPLETED"
                          ? "status-badge-finalized"
                          : o.status === "IN_PROGRESS"
                          ? "status-badge-inprogress"
                          : "status-badge-pending"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="cell-created">{date(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-subtext">No orders recorded for this patient yet.</div>
        )}
      </div>
    </div>
  );
}
