import { useEffect, useState, Fragment } from "react";
import { Link, useParams } from "react-router-dom";
import { ordersApi, reportsApi } from "../api/resources";
import { apiError } from "../api/client";
import {
  Empty,
  ErrorMessage,
  Loading,
  Status,
  date,
  patientName,
} from "../components/Common";

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({
    orderId: "",
    title: "",
    status: "DRAFT",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);

    Promise.all([
      reportsApi.list({ page: 1, limit: 100 }),
      ordersApi.list({ page: 1, limit: 100 }),
    ])
      .then(([r, o]) => {
        setReports(r.data.reports);
        setOrders(o.data.orders);
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      await reportsApi.create({
        orderId: form.orderId,
        status: form.status,
        ...(form.title.trim() ? { title: form.title.trim() } : {}),
      });

      setForm({
        orderId: "",
        title: "",
        status: "DRAFT",
      });

      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Patient documents</p>
          <h1>Reports</h1>
          <p>Create a versioned report from an order’s current results.</p>
        </div>
      </header>

      <ErrorMessage error={error} />

      <form className="panel form-grid" onSubmit={create}>
        <div className="panel-heading full">
          <h2>Create report</h2>
          <span className="search-meta">
            A saved report preserves the current result snapshot.
          </span>
        </div>

        <label className="full">
          Order
          <select
            required
            value={form.orderId}
            onChange={(e) =>
              setForm({
                ...form,
                orderId: e.target.value,
              })
            }
          >
            <option value="">Choose order</option>

            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {patientName(order.patient)} —{" "}
                {order.orderedTestItems
                  .map((x) => x.testDefinition.name)
                  .join(", ")}
              </option>
            ))}
          </select>
        </label>

        <label>
          Report title
          <input
            value={form.title}
            onChange={(e) =>
              setForm({
                ...form,
                title: e.target.value,
              })
            }
          />
        </label>

        <label>
          Report status
          <select
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value,
              })
            }
          >
            <option>DRAFT</option>
            <option>FINAL</option>
            <option>AMENDED</option>
          </select>
        </label>

        <div className="full">
          <button disabled={saving}>
            {saving ? "Creating…" : "Create report"}
          </button>
        </div>
      </form>

      {loading ? (
        <Loading text="Loading reports…" />
      ) : reports.length ? (
        <section className="panel">
          <div className="panel-heading">
            <h2>Report register</h2>
            <span className="search-meta">
              {reports.length} report{reports.length === 1 ? "" : "s"}
            </span>
          </div>

          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Title</th>
                <th>Status</th>
                <th>Version</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{patientName(report.order.patient)}</td>

                  <td>
                    <Link to={`/reports/${report.id}`}>
                      {report.title || "Laboratory report"}
                    </Link>
                  </td>

                  <td>
                    <Status value={report.status} />
                  </td>

                  <td>v{report.version}</td>

                  <td>{date(report.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <Empty>No reports created yet.</Empty>
      )}
    </>
  );
}

export function ReportDetail() {
  const { id } = useParams();

  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    reportsApi
      .get(id)
      .then((r) => setReport(r.data.report))
      .catch((e) => setError(apiError(e)));
  }, [id]);

  if (error) {
    return <ErrorMessage error={error} />;
  }

  if (!report) {
    return <Loading text="Preparing report preview…" />;
  }

  const snapshot = report.snapshot || {};
  const patient = snapshot.patient || report.order.patient;
  const items =
    snapshot.orderedTestItems || report.order.orderedTestItems || [];

  return (
    <div className="report">
      <header className="page-header no-print">
        <div>
          <p className="eyebrow">Report preview</p>
          <h1>Report v{report.version}</h1>
          <p>{report.title || "Laboratory report"}</p>
        </div>

        <button onClick={() => window.print()}>Print / Save PDF</button>
      </header>

      <article className="print-sheet">
        <div className="report-head">
          <div>
            <h1>
              {snapshot.laboratory?.name ||
                report.laboratory?.name ||
                "Laboratory"}
            </h1>
            <p>Diagnostic laboratory report</p>
          </div>

          <div>
            <Status value={report.status} />

            <p>
              Version {report.version}
              <br />
              Generated {date(report.createdAt)}
            </p>
          </div>
        </div>

        <section className="report-patient">
          <div>
            <b>Patient</b>
            {patientName(patient)}
          </div>

          <div>
            <b>CNIC</b>
            {patient?.cnic || "—"}
          </div>

          <div>
            <b>Age / Gender</b>
            {patient?.age ?? "—"} / {patient?.gender || "—"}
          </div>
        </section>

        <h2>{report.title || "Test results"}</h2>

        <table>
          <thead>
            <tr>
              <th>Test</th>
              <th>Result</th>
              <th>Unit</th>
              <th>Reference range</th>
              <th>Interpretation</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => {
              const parameters = Array.isArray(item.testDefinition?.parameters)
                ? item.testDefinition.parameters
                : [];

              const hasParams = parameters.length > 0;

              if (hasParams) {
                return (
                  <Fragment key={item.id}>
                    <tr>
                      <td colSpan={4}>
                        <strong>
                          {item.testDefinition.code} —{" "}
                          {item.testDefinition.name}
                        </strong>
                      </td>

                      <td>{item.result?.interpretation || "—"}</td>
                    </tr>

                    {parameters.map((parameter) => {
                      const parameterValue =
                        item.result?.value?.[parameter.name];

                      return (
                        <tr key={parameter.id}>
                          <td>{parameter.name}</td>

                          <td>
                            {parameterValue == null
                              ? "—"
                              : String(parameterValue)}
                          </td>

                          <td>{parameter.unit || "—"}</td>

                          <td>{parameter.referenceRange || "—"}</td>

                          <td />
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              }

              const resultValue = item.result?.value;

              return (
                <tr key={item.id}>
                  <td>
                    {item.testDefinition.code} — {item.testDefinition.name}
                  </td>

                  <td>
                    {resultValue == null
                      ? "—"
                      : typeof resultValue === "object"
                        ? JSON.stringify(resultValue)
                        : String(resultValue)}
                  </td>

                  <td>{item.result?.unit || "—"}</td>

                  <td>{item.result?.referenceRange || "—"}</td>

                  <td>{item.result?.interpretation || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <footer className="report-footer">
          <span>
            This report is generated by the laboratory information system.
          </span>
          <span>End of report</span>
        </footer>
      </article>
    </div>
  );
}
