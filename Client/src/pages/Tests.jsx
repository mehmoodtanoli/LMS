import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { testsApi, laboratoriesApi } from "../api/resources";
import { apiError } from "../api/client";
import {
  Empty,
  ErrorMessage,
  Loading,
  date,
} from "../components/Common";
import {
  TestTube2,
  Plus,
  Search,
  ArrowLeft,
  Save,
  Trash2,
  Edit,
  Globe,
  Building2,
  FileText,
  ListOrdered,
  DollarSign,
} from "lucide-react";

const blankParameter = {
  name: "",
  unit: "",
  referenceRange: "",
};

const blankTest = {
  code: "",
  name: "",
  description: "",
  price: "",
  laboratoryId: "",
  parameters: [],
};

export default function Tests() {
  const [tests, setTests] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    testsApi
      .list({ page: 1, limit: 100 })
      .then((r) => setTests(r.data.tests || []))
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = tests.filter((test) => {
    const query = search.toLowerCase();
    return (
      test.code.toLowerCase().includes(query) ||
      test.name.toLowerCase().includes(query) ||
      (test.description || "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="tests-page">
      <header className="page-header-simple">
        <div>
          <h1 className="page-title">Tests Catalog</h1>
          <p className="page-subtitle">
            Manage standardized laboratory investigation templates, pricing, and parameter ranges ({filtered.length} total)
          </p>
        </div>

        <Link className="btn-primary-action" to="/admin/tests/new">
          <Plus size={16} />
          <span>New Test</span>
        </Link>
      </header>

      <ErrorMessage error={error} />

      {/* Search Toolbar */}
      <div className="orders-toolbar" style={{ marginBottom: "20px" }}>
        <div className="search-box" style={{ maxWidth: "460px" }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search test definitions by code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Loading text="Loading test catalog…" />
      ) : filtered.length ? (
        <div className="table-card">
          <table className="clean-table">
            <thead>
              <tr>
                <th style={{ width: "120px" }}>Code</th>
                <th>Investigation Name</th>
                <th>Price (Fee)</th>
                <th>Scope</th>
                <th>Parameters</th>
                <th>Created</th>
                <th style={{ textAlign: "right", width: "130px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((test) => {
                const isGlobal = !test.laboratoryId;
                const paramCount = test.parameters?.length ?? 0;
                const priceNum = Number(test.price || 0);

                return (
                  <tr key={test.id}>
                    {/* Code */}
                    <td className="cell-order-num">
                      <span className="test-tag">{test.code}</span>
                    </td>

                    {/* Name */}
                    <td className="cell-patient">
                      <div className="patient-avatar-box">
                        <div className="lab-avatar-icon">
                          <TestTube2 size={16} />
                        </div>
                        <div className="patient-info">
                          <Link
                            to={`/admin/tests/${test.id}`}
                            className="patient-name"
                          >
                            {test.name}
                          </Link>
                          {test.description && (
                            <span className="patient-cnic">
                              {test.description.length > 55
                                ? test.description.slice(0, 52) + "…"
                                : test.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Price (Fixes A1) */}
                    <td className="cell-amount">
                      <span className="amount-val" style={{ fontWeight: 600 }}>
                        Rs {priceNum.toLocaleString()}
                      </span>
                    </td>

                    {/* Scope */}
                    <td className="cell-status">
                      <span
                        className={`status-pill ${
                          isGlobal
                            ? "status-badge-inprogress"
                            : "status-badge-pending"
                        }`}
                      >
                        {isGlobal ? "Global" : "Laboratory"}
                      </span>
                    </td>

                    {/* Parameters */}
                    <td className="cell-param-name">
                      {paramCount} parameter{paramCount === 1 ? "" : "s"}
                    </td>

                    {/* Created */}
                    <td className="cell-created">{date(test.createdAt)}</td>

                    {/* Actions */}
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "10px" }}>
                        <Link
                          to={`/admin/tests/${test.id}`}
                          className="action-text-btn"
                        >
                          View
                        </Link>
                        <Link
                          to={`/admin/tests/${test.id}/edit`}
                          className="action-text-btn"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No matching tests found in catalog.</Empty>
      )}
    </div>
  );
}

export function TestForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(blankTest);
  const [laboratories, setLaboratories] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(Boolean(id));

  useEffect(() => {
    laboratoriesApi
      .list({ page: 1, limit: 100 })
      .then((r) => setLaboratories(r.data.laboratories || []))
      .catch(() => {});

    if (!id) return;

    testsApi
      .get(id)
      .then((r) => {
        const test = r.data.test;
        setForm({
          code: test.code || "",
          name: test.name || "",
          description: test.description || "",
          price: test.price !== undefined && test.price !== null ? String(test.price) : "",
          laboratoryId: test.laboratoryId || "",
          parameters: (test.parameters || []).map((parameter) => ({
            name: parameter.name || "",
            unit: parameter.unit || "",
            referenceRange: parameter.referenceRange || "",
          })),
        });
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setBusy(false));
  }, [id]);

  const updateParameter = (index, field, value) => {
    setForm((current) => ({
      ...current,
      parameters: current.parameters.map((parameter, parameterIndex) =>
        parameterIndex === index
          ? {
              ...parameter,
              [field]: value,
            }
          : parameter
      ),
    }));
  };

  const addParameter = () => {
    setForm((current) => ({
      ...current,
      parameters: [...current.parameters, { ...blankParameter }],
    }));
  };

  const removeParameter = (index) => {
    setForm((current) => ({
      ...current,
      parameters: current.parameters.filter(
        (_, parameterIndex) => parameterIndex !== index
      ),
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);

    const parameters = form.parameters.map((parameter, index) => ({
      name: parameter.name.trim(),
      unit: parameter.unit.trim(),
      referenceRange: parameter.referenceRange.trim(),
      order: index + 1,
    }));

    const data = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      price: form.price !== "" ? Number(form.price) : 0,
      ...(form.description.trim()
        ? { description: form.description.trim() }
        : {}),
      ...(form.laboratoryId.trim()
        ? { laboratoryId: form.laboratoryId.trim() }
        : {}),
      ...(parameters.length ? { parameters } : {}),
    };

    try {
      const response = id
        ? await testsApi.update(id, data)
        : await testsApi.create(data);

      navigate(`/admin/tests/${response.data.test.id}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (busy && id) return <Loading text="Loading test template details…" />;

  return (
    <div className="test-form-page">
      <div className="form-page-top">
        <Link to="/admin/tests" className="back-nav-link">
          <ArrowLeft size={16} />
          <span>Back to Tests Catalog</span>
        </Link>
      </div>

      <header className="page-header-simple">
        <div>
          <h1 className="page-title">{id ? "Edit Test Definition" : "New Test Definition"}</h1>
          <p className="page-subtitle">
            Configure investigation codes, clinical parameters, fees, and normal reference ranges
          </p>
        </div>
      </header>

      <ErrorMessage error={error} />

      <div className="patient-form-card" style={{ maxWidth: "840px" }}>
        <form onSubmit={submit} className="patient-styled-form">
          {/* Row 1: Code & Name */}
          <div className="form-row-2col">
            <div className="form-group-clean">
              <label>
                Test Code <span className="required-star">*</span>
              </label>
              <input
                required
                placeholder="e.g. CBC"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <span className="field-hint">Unique laboratory abbreviation</span>
            </div>

            <div className="form-group-clean">
              <label>
                Test / Investigation Name <span className="required-star">*</span>
              </label>
              <input
                required
                placeholder="e.g. Complete Blood Count"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          </div>

          {/* Row 2: Price & Scope */}
          <div className="form-row-2col">
            <div className="form-group-clean">
              <label>
                Standard Price / Fee (Rs) <span className="required-star">*</span>
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 800"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              <span className="field-hint">Standard investigation billable rate in PKR</span>
            </div>

            <div className="form-group-clean">
              <label>Scope / Assigned Laboratory</label>
              <div className="select-wrapper">
                <select
                  value={form.laboratoryId}
                  onChange={(e) =>
                    setForm({ ...form, laboratoryId: e.target.value })
                  }
                >
                  <option value="">Global Template (Accessible to all laboratories)</option>
                  {laboratories.map((lab) => (
                    <option key={lab.id} value={lab.id}>
                      {lab.name}
                    </option>
                  ))}
                </select>
              </div>
              <span className="field-hint">
                Global templates can be ordered across any laboratory branch
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="form-group-clean">
            <label>Description / Clinical Notes</label>
            <input
              placeholder="e.g. Quantitative evaluation of blood cellular components"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Parameters Builder */}
          <div className="test-parameters-builder" style={{ marginTop: "12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                  Test Parameters ({form.parameters.length})
                </h3>
                <p className="field-hint" style={{ margin: "2px 0 0" }}>
                  Parameters define the individual numerical or textual fields evaluated in result entry
                </p>
              </div>

              <button
                type="button"
                className="btn-cancel"
                onClick={addParameter}
                style={{ height: "34px" }}
              >
                <Plus size={15} />
                <span>Add Parameter</span>
              </button>
            </div>

            {form.parameters.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {form.parameters.map((parameter, index) => (
                  <div
                    key={index}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "14px 16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "10px",
                      }}
                    >
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569" }}>
                        Parameter #{index + 1}
                      </span>
                      <button
                        type="button"
                        className="action-text-btn-danger"
                        onClick={() => removeParameter(index)}
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.4fr 1fr 1.6fr",
                        gap: "12px",
                      }}
                    >
                      <div className="form-group-clean">
                        <label style={{ fontSize: "0.8rem" }}>
                          Parameter Name <span className="required-star">*</span>
                        </label>
                        <input
                          required
                          placeholder="e.g. Hemoglobin"
                          value={parameter.name}
                          onChange={(e) =>
                            updateParameter(index, "name", e.target.value)
                          }
                          style={{ height: "36px", fontSize: "0.86rem" }}
                        />
                      </div>

                      <div className="form-group-clean">
                        <label style={{ fontSize: "0.8rem" }}>Unit</label>
                        <input
                          placeholder="e.g. g/dL"
                          value={parameter.unit}
                          onChange={(e) =>
                            updateParameter(index, "unit", e.target.value)
                          }
                          style={{ height: "36px", fontSize: "0.86rem" }}
                        />
                      </div>

                      <div className="form-group-clean">
                        <label style={{ fontSize: "0.8rem" }}>Normal Reference Range</label>
                        <input
                          placeholder="e.g. 13.5 - 17.5"
                          value={parameter.referenceRange}
                          onChange={(e) =>
                            updateParameter(index, "referenceRange", e.target.value)
                          }
                          style={{ height: "36px", fontSize: "0.86rem" }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  background: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  borderRadius: "8px",
                  color: "#64748b",
                  fontSize: "0.86rem",
                }}
              >
                No parameters added yet. Click &ldquo;Add Parameter&rdquo; to configure test fields, or leave empty for qualitative summary investigations.
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="form-actions-clean" style={{ marginTop: "24px" }}>
            <button
              type="button"
              className="btn-cancel"
              onClick={() => navigate("/admin/tests")}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-action"
              disabled={busy}
            >
              <Save size={16} />
              <span>{busy ? "Saving…" : id ? "Update Test" : "Save Test Definition"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TestDetail() {
  const { id } = useParams();
  const [test, setTest] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    testsApi
      .get(id)
      .then((r) => setTest(r.data.test))
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading text="Loading test definition details…" />;
  if (error) return <ErrorMessage error={error} />;
  if (!test) return <Empty>Test definition record not found.</Empty>;

  const isGlobal = !test.laboratoryId;
  const parameters = test.parameters || [];
  const priceNum = Number(test.price || 0);

  return (
    <div className="test-detail-page">
      <div className="form-page-top">
        <Link to="/admin/tests" className="back-nav-link">
          <ArrowLeft size={16} />
          <span>Back to Tests Catalog</span>
        </Link>
      </div>

      <header className="page-header-simple">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div className="lab-avatar-icon-lg">
            <TestTube2 size={24} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1 className="page-title">{test.name}</h1>
              <span className="test-tag">{test.code}</span>
            </div>
            <p className="page-subtitle">
              Standard Fee:{" "}
              <strong style={{ color: "#0c3c6d", fontSize: "1rem" }}>
                Rs {priceNum.toLocaleString()}
              </strong>
              {" · "}Scope:{" "}
              <span
                className={`status-pill ${
                  isGlobal
                    ? "status-badge-inprogress"
                    : "status-badge-pending"
                }`}
                style={{ marginLeft: "4px" }}
              >
                {isGlobal ? "Global Template" : "Laboratory Specific"}
              </span>
            </p>
          </div>
        </div>

        <Link className="btn-primary-action" to={`/admin/tests/${test.id}/edit`}>
          <Edit size={16} />
          <span>Edit Test</span>
        </Link>
      </header>

      {/* Description Panel if any */}
      {test.description && (
        <div
          className="dashboard-panel"
          style={{ marginBottom: "20px", padding: "16px 20px" }}
        >
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Clinical Description
          </span>
          <p style={{ margin: "4px 0 0", color: "#334155", fontSize: "0.9rem" }}>
            {test.description}
          </p>
        </div>
      )}

      {/* Parameters Table */}
      <div className="dashboard-panel">
        <div className="panel-top-bar">
          <div>
            <h2 className="panel-heading">Clinical Parameters & Reference Ranges</h2>
            <p className="page-subtitle" style={{ fontSize: "0.8rem", marginTop: "2px" }}>
              {parameters.length} parameter{parameters.length === 1 ? "" : "s"} defined for this test
            </p>
          </div>
        </div>

        {parameters.length ? (
          <table className="clean-table">
            <thead>
              <tr>
                <th style={{ width: "80px" }}>Order</th>
                <th>Parameter Name</th>
                <th>Unit</th>
                <th>Normal Reference Range</th>
              </tr>
            </thead>
            <tbody>
              {parameters.map((p) => (
                <tr key={p.id}>
                  <td className="cell-num">#{p.order}</td>
                  <td className="cell-param-name">{p.name}</td>
                  <td className="cell-unit">{p.unit || "—"}</td>
                  <td className="cell-range">{p.referenceRange || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-subtext">No sub-parameters defined for this test.</div>
        )}
      </div>
    </div>
  );
}
