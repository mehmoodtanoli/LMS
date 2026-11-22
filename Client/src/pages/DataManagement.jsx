import { useCallback, useEffect, useState } from "react";
import { Archive, Database, Download, RefreshCw } from "lucide-react";
import { exportsApi } from "../api/resources";
import { apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Empty, ErrorMessage, Loading, Status } from "../components/Common";
import "./DataManagement.css";

const slug = (value) =>
  String(value || "laboratory")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "laboratory";

const today = () => new Date().toISOString().slice(0, 10).replaceAll("-", "");

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// With responseType "blob", error bodies arrive as a Blob, so decode them.
async function exportErrorMessage(error) {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      return parsed.message || "Export failed.";
    } catch {
      return "Export failed.";
    }
  }
  return apiError(error);
}

export default function DataManagement() {
  const { user } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [selected, setSelected] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    try {
      const response = await exportsApi.history({ page, limit: 10 });
      setHistory(response.data.items);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    exportsApi
      .datasets()
      .then((response) => {
        const list = response.data.datasets;
        setDatasets(list);
        if (list.length > 0) setSelected(list[0].key);
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
    loadHistory(1);
  }, [loadHistory]);

  const current = datasets.find((dataset) => dataset.key === selected);

  const validate = () => {
    if (from && to && from > to) {
      setError("The From date must not be after the To date.");
      return false;
    }
    return true;
  };

  const run = async (kind) => {
    setError("");
    setSuccess("");
    if (!validate()) return;

    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;

    setBusy(kind);
    try {
      if (kind === "csv") {
        const blob = await exportsApi.downloadDataset(selected, params);
        saveBlob(blob, `${slug(user?.laboratory?.name)}-${selected}-${today()}.csv`);
        setSuccess(`${current?.label || "Dataset"} exported as CSV.`);
      } else {
        const blob = await exportsApi.downloadComplete(params);
        saveBlob(blob, `${slug(user?.laboratory?.name)}-complete-export-${today()}.zip`);
        setSuccess("Complete export downloaded as ZIP.");
      }
    } catch (err) {
      setError(await exportErrorMessage(err));
    } finally {
      setBusy("");
      loadHistory(1);
    }
  };

  if (loading) return <Loading text="Loading data management…" />;

  return (
    <div className="settings-page">
      <header className="page-header-simple">
        <div>
          <h1 className="page-title">Data Management</h1>
          <p className="page-subtitle">
            Download copies of your laboratory records. Dates are in Pakistan time.
          </p>
        </div>
        <Database size={28} color="#1d4ed8" aria-hidden="true" />
      </header>

      <ErrorMessage error={error} />
      {success && <div className="alert success">{success}</div>}

      <section className="settings-card">
        <div className="settings-section-heading">
          <Download size={18} />
          <div>
            <h2>Export Data</h2>
            <p>Choose one dataset for a CSV file, or download everything as a ZIP of CSV files.</p>
          </div>
        </div>

        <div className="export-filter-grid">
          <label className="form-group-clean">
            <span>Dataset</span>
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              {datasets.map((dataset) => (
                <option key={dataset.key} value={dataset.key}>
                  {dataset.label}
                </option>
              ))}
            </select>
            {current && <p className="export-hint">{current.description}</p>}
          </label>
          <label className="form-group-clean">
            <span>From</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="form-group-clean">
            <span>To</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>

        <div className="export-actions">
          <button
            type="button"
            className="btn-primary-action"
            disabled={Boolean(busy) || !selected}
            onClick={() => run("csv")}
          >
            <Download size={16} />
            {busy === "csv" ? "Preparing…" : "Download CSV"}
          </button>
          <button
            type="button"
            className="btn-primary-action"
            disabled={Boolean(busy)}
            onClick={() => run("zip")}
          >
            <Archive size={16} />
            {busy === "zip" ? "Preparing…" : "Download Complete Export (ZIP)"}
          </button>
        </div>
        <p className="export-hint">
          The date range applies to dated records. Laboratory profile, test catalogue and test
          parameters are always exported in full.
        </p>
      </section>

      <section className="export-history">
        <div className="export-history-header">
          <h2>Export History</h2>
          <button
            type="button"
            className="btn-cancel"
            disabled={historyLoading}
            onClick={() => loadHistory(pagination.page)}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {history.length === 0 ? (
          <Empty>No exports yet.</Empty>
        ) : (
          <div className="table-card">
            <table className="clean-table compact">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Dataset</th>
                  <th>Format</th>
                  <th>Rows</th>
                  <th>Range</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} title={item.error || undefined}>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                    <td>{item.actor?.email || "—"}</td>
                    <td>{item.dataset === "ALL" ? "Complete export" : item.dataset || "—"}</td>
                    <td>{item.format ? item.format.toUpperCase() : "—"}</td>
                    <td>{item.rowCount ?? "—"}</td>
                    <td>{item.from || item.to ? `${item.from || "…"} to ${item.to || "…"}` : "All"}</td>
                    <td>
                      <Status value={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="export-pager">
            <button
              type="button"
              className="btn-cancel"
              disabled={historyLoading || pagination.page <= 1}
              onClick={() => loadHistory(pagination.page - 1)}
            >
              Previous
            </button>
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              className="btn-cancel"
              disabled={historyLoading || pagination.page >= pagination.totalPages}
              onClick={() => loadHistory(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}