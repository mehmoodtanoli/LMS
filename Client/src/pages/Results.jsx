import { useEffect, useState } from "react";
import { ordersApi, resultsApi } from "../api/resources";
import { apiError } from "../api/client";
import {
  Empty,
  ErrorMessage,
  Loading,
  Status,
  patientName,
} from "../components/Common";

const blank = {
  value: "",
  unit: "",
  referenceRange: "",
  interpretation: "",
  notes: "",
  status: "COMPLETED",
};

export default function Results() {
  const [orders, setOrders] = useState([]),
    [results, setResults] = useState([]),
    [editing, setEditing] = useState(null),
    [form, setForm] = useState(blank),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false);
  const load = () => {
    setLoading(true);
    Promise.all([
      ordersApi.list({ page: 1, limit: 100 }),
      resultsApi.list({ page: 1, limit: 100 }),
    ])
      .then(([o, r]) => {
        setOrders(o.data.orders);
        setResults(r.data.results);
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const open = (item, result) => {
    setError("");
    setEditing({ item, result });
    setForm(
      result
        ? {
            status: result.status,
            value: result.value == null ? "" : JSON.stringify(result.value),
            unit: result.unit || "",
            referenceRange: result.referenceRange || "",
            interpretation: result.interpretation || "",
            notes: result.notes || "",
          }
        : blank,
    );
  };
  const submit = async (event, status) => {
    event.preventDefault();
    setError("");
    let value;
    try {
      value = form.value.trim() ? JSON.parse(form.value) : undefined;
    } catch {
      setError(
        'Result value must be valid JSON (for example: 4.5 or {"value": 4.5}).',
      );
      return;
    }
    const data = {
      status,
      ...(value !== undefined ? { value } : {}),
      ...Object.fromEntries(
        ["unit", "referenceRange", "interpretation", "notes"]
          .filter((key) => form[key].trim())
          .map((key) => [key, form[key].trim()]),
      ),
    };
    setSaving(true);
    try {
      if (editing.result) await resultsApi.update(editing.result.id, data);
      else
        await resultsApi.create({
          orderedTestItemId: editing.item.id,
          ...data,
        });
      setEditing(null);
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };
  const items = orders.flatMap((order) =>
    order.orderedTestItems.map((item) => ({
      ...item,
      order,
      result:
        item.result ||
        results.find((result) => result.orderedTestItemId === item.id),
    })),
  );
  const isFinalized = editing?.result?.status === "FINALIZED";
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Laboratory bench</p>
          <h1>Results</h1>
          <p>Enter, review, and finalize ordered test results.</p>
        </div>
      </header>
      <ErrorMessage error={error} />
      {loading ? (
        <Loading text="Loading result work…" />
      ) : items.length ? (
        <section className="panel">
          <div className="panel-heading">
            <h2>Ordered tests</h2>
            <span className="search-meta">
              {items.length} test item{items.length === 1 ? "" : "s"}
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Test</th>
                <th>Result status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{patientName(item.order.patient)}</td>
                  <td>
                    {item.testDefinition.code} — {item.testDefinition.name}
                  </td>
                  <td>
                    <Status value={item.result?.status || "PENDING"} />
                  </td>
                  <td>
                    <button
                      className="secondary"
                      onClick={() => open(item, item.result)}
                    >
                      {item.result ? "Review result" : "Enter result"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <Empty>No ordered test items are available.</Empty>
      )}
      {editing && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label="Result entry"
        >
          <form
            className="panel modal-card form-grid"
            onSubmit={(event) => submit(event, form.status)}
          >
            <div className="panel-heading full">
              <h2>{editing.result ? "Review result" : "Enter result"}</h2>
              <button
                type="button"
                className="link"
                onClick={() => setEditing(null)}
              >
                Close
              </button>
            </div>
            <div className="result-context full">
              <strong>
                {editing.item.testDefinition.code} —{" "}
                {editing.item.testDefinition.name}
              </strong>
              <br />
              Patient: {patientName(editing.item.order.patient)} · Current
              status: <Status value={editing.result?.status || "PENDING"} />
              {isFinalized ? (
                <>
                  <br />
                  <em>This result is finalized and cannot be edited.</em>
                </>
              ) : null}
            </div>
            <label>
              Result value (JSON)
              <input
                disabled={isFinalized}
                placeholder={'e.g. 4.5 or {"value": 4.5}'}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </label>
            <label>
              Unit
              <input
                disabled={isFinalized}
                placeholder="e.g. mg/dL"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </label>
            <label>
              Reference range
              <input
                disabled={isFinalized}
                placeholder="e.g. 70–110"
                value={form.referenceRange}
                onChange={(e) =>
                  setForm({ ...form, referenceRange: e.target.value })
                }
              />
            </label>
            <label>
              Interpretation
              <input
                disabled={isFinalized}
                placeholder="Optional clinical interpretation"
                value={form.interpretation}
                onChange={(e) =>
                  setForm({ ...form, interpretation: e.target.value })
                }
              />
            </label>
            <label className="full">
              Technician notes
              <textarea
                disabled={isFinalized}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            <div className="full form-actions">
              <button
                type="button"
                className="secondary"
                disabled={saving || isFinalized}
                onClick={(event) => submit(event, "COMPLETED")}
              >
                {saving ? "Saving…" : "Save draft"}
              </button>
              <button
                type="button"
                disabled={saving || isFinalized}
                onClick={(event) => submit(event, "FINALIZED")}
              >
                {saving ? "Saving…" : "Finalize result"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
