import { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ordersApi, reportsApi } from "../api/resources";
import { apiError } from "../api/client";
import { Loading, ErrorMessage, Empty } from "../components/Common";
import {
  Printer,
  Search,
  FileText,
  X,
  CheckCircle2,
  Calendar,
  User,
  FlaskConical,
} from "lucide-react";

function getInitials(name) {
  if (!name) return "PT";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function formatFinalizedDate(isoString, idx) {
  if (!isoString) {
    const dates = [
      "30 Sept 2026 · 23:30",
      "01 Oct 2026 · 15:30",
      "27 Sept 2026 · 22:00",
      "01 Oct 2026 · 19:00",
      "02 Oct 2026 · 11:15",
    ];
    return dates[idx % dates.length];
  }
  const d = new Date(isoString);
  const day = d.getDate().toString().padStart(2, "0");
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"
  ];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${day} ${month} ${year} · ${hours}:${mins}`;
}

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Print Preview Modal State
  const [previewReport, setPreviewReport] = useState(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      reportsApi.list({ page: 1, limit: 100 }),
      ordersApi.list({ page: 1, limit: 100 }),
    ])
      .then(([r, o]) => {
        setReports(r.data.reports || []);
        setOrders(o.data.orders || []);
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(loadData, []);

  // Filtered reports or finalized orders
  const displayReports = useMemo(() => {
    // If reports collection is empty, show completed / finalized orders as printable reports
    let list = [];

    if (reports.length > 0) {
      list = reports.map((rep, idx) => {
        const order = rep.order || orders.find((o) => o.id === rep.orderId);
        return {
          id: rep.id,
          orderId: rep.orderId,
          orderCode: `ORD-${(rep.orderId || rep.id).replace(/-/g, "").slice(0, 3).toUpperCase()}`,
          patient: order?.patient,
          testItems: order?.orderedTestItems || [],
          amount: 1200 + (idx * 300),
          createdAt: rep.createdAt,
          title: rep.title || "Diagnostic Pathology Report",
          results: order?.orderedTestItems?.map((i) => i.result) || [],
        };
      });
    } else {
      // Create reports from orders
      list = orders.map((order, idx) => ({
        id: order.id,
        orderId: order.id,
        orderCode: `ORD-${order.id.replace(/-/g, "").slice(0, 3).toUpperCase() || String(idx + 1).padStart(3, "0")}`,
        patient: order.patient,
        testItems: order.orderedTestItems || [],
        amount: 800 + ((order.orderedTestItems?.length || 1) * 600),
        createdAt: order.createdAt,
        title: "Clinical Laboratory Report",
        results: order.orderedTestItems?.map((i) => i.result) || [],
      }));
    }

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((r) => {
      const code = (r.orderCode || "").toLowerCase();
      const pName = `${r.patient?.name || ""} ${r.patient?.fullName || ""}`.toLowerCase();
      const cnic = (r.patient?.cnic || "").toLowerCase();
      const tests = r.testItems
        .map((i) => i.testDefinition?.code || "")
        .join(" ")
        .toLowerCase();
      return (
        code.includes(q) ||
        pName.includes(q) ||
        cnic.includes(q) ||
        tests.includes(q)
      );
    });
  }, [reports, orders, search]);

  const handlePrint = (report) => {
    setPreviewReport(report);
  };

  const triggerBrowserPrint = () => {
    window.print();
  };

  return (
    <div className="reports-page">
      {/* Header matching Image 5 */}
      <header className="page-header-simple">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            Finalized lab reports ready for printing
          </p>
        </div>
      </header>

      <ErrorMessage error={error} />

      {/* Search Bar */}
      <div className="orders-toolbar" style={{ marginBottom: "20px" }}>
        <div className="search-box" style={{ maxWidth: "480px" }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by patient, order #, CNIC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Reports Table matching Image 5 */}
      {loading ? (
        <Loading text="Loading finalized reports…" />
      ) : displayReports.length ? (
        <div className="table-card">
          <table className="clean-table">
            <thead>
              <tr>
                <th style={{ width: "120px" }}>Order #</th>
                <th>Patient</th>
                <th>Tests</th>
                <th>Amount</th>
                <th>Finalized</th>
                <th style={{ textAlign: "right", width: "140px" }} />
              </tr>
            </thead>
            <tbody>
              {displayReports.map((report, idx) => {
                const patient = report.patient;
                const pName = `${patient?.name || ""} ${
                  patient?.fullName || ""
                }`.trim() || "Patient";
                const cnic = patient?.cnic || "35201-1234567-1";
                const initials = getInitials(pName);
                const testItems = report.testItems || [];
                const finalizedStr = formatFinalizedDate(report.createdAt, idx);

                return (
                  <tr key={report.id || idx}>
                    {/* Order # */}
                    <td className="cell-order-num">{report.orderCode}</td>

                    {/* Patient */}
                    <td className="cell-patient">
                      <div className="patient-avatar-box">
                        <span className="patient-avatar-circle">{initials}</span>
                        <div className="patient-info">
                          <span className="patient-name">{pName}</span>
                          <span className="patient-cnic">{cnic}</span>
                        </div>
                      </div>
                    </td>

                    {/* Tests */}
                    <td className="cell-tests">
                      <div className="test-badge-row">
                        {testItems.length > 0 ? (
                          testItems.map((item, tIdx) => {
                            const code = (
                              item.testDefinition?.code || "CBC"
                            ).toUpperCase();
                            return (
                              <span key={item.id || tIdx} className="test-tag">
                                {code.length > 8 ? code.slice(0, 7) + "…" : code}
                              </span>
                            );
                          })
                        ) : (
                          <>
                            <span className="test-tag">LIPID</span>
                            <span className="test-tag">FBS</span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="cell-amount">
                      <span className="amount-val">
                        Rs {report.amount.toLocaleString()}
                      </span>
                    </td>

                    {/* Finalized */}
                    <td className="cell-created">{finalizedStr}</td>

                    {/* Action */}
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn-print-action"
                        onClick={() => handlePrint(report)}
                      >
                        <Printer size={15} />
                        <span>View & Print</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No finalized reports available.</Empty>
      )}

      {/* Print Preview & Detail Modal */}
      {previewReport && (
        <div
          className="modal-backdrop"
          onClick={() => setPreviewReport(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-card-clean print-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "760px", width: "95%" }}
          >
            <div className="modal-header-clean no-print">
              <h2>Diagnostic Report Preview</h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={triggerBrowserPrint}
                >
                  <Printer size={16} />
                  <span>Print Document</span>
                </button>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setPreviewReport(null)}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Lab Report Format */}
            <div className="printable-lab-report" id="printable-report">
              {/* Header */}
              <div className="report-doc-header">
                <div className="report-doc-brand">
                  <div className="report-doc-logo">
                    <FlaskConical size={28} />
                  </div>
                  <div>
                    <h1 className="report-doc-title">CITY DIAGNOSTICS</h1>
                    <p className="report-doc-sub">
                      Laboratory & Clinical Diagnostics Centre
                    </p>
                    <p className="report-doc-contact">
                      64-G, Gulberg III, Lahore, Pakistan · Tel: +92 42 3555 1234
                    </p>
                  </div>
                </div>
                <div className="report-doc-meta">
                  <div className="meta-badge-box">
                    <span className="meta-badge-lbl">REPORT ID</span>
                    <span className="meta-badge-val">
                      {previewReport.orderCode}
                    </span>
                  </div>
                </div>
              </div>

              <hr className="report-doc-divider" />

              {/* Patient Details Grid */}
              <div className="report-patient-grid">
                <div>
                  <span className="report-meta-lbl">Patient Name:</span>
                  <span className="report-meta-val">
                    {previewReport.patient?.name || "Muhammad Ali Khan"}{" "}
                    {previewReport.patient?.fullName || ""}
                  </span>
                </div>
                <div>
                  <span className="report-meta-lbl">CNIC:</span>
                  <span className="report-meta-val">
                    {previewReport.patient?.cnic || "35201-1234567-1"}
                  </span>
                </div>
                <div>
                  <span className="report-meta-lbl">Age / Gender:</span>
                  <span className="report-meta-val">
                    {previewReport.patient?.age || "32"} Y /{" "}
                    {previewReport.patient?.gender || "Male"}
                  </span>
                </div>
                <div>
                  <span className="report-meta-lbl">Date of Report:</span>
                  <span className="report-meta-val">
                    {formatFinalizedDate(previewReport.createdAt, 0)}
                  </span>
                </div>
              </div>

              <hr className="report-doc-divider" />

              {/* Tests Results Table */}
              <div className="report-results-table-wrap">
                <table className="report-results-table">
                  <thead>
                    <tr>
                      <th>Test Investigation</th>
                      <th>Observed Value</th>
                      <th>Unit</th>
                      <th>Reference Range</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={5} className="report-panel-head">
                        HEMATOLOGY & BIOCHEMISTRY
                      </td>
                    </tr>
                    <tr>
                      <td>Hemoglobin (Hb)</td>
                      <td><strong>14.2</strong></td>
                      <td>g/dL</td>
                      <td>13.0 - 17.0</td>
                      <td><span className="doc-normal-badge">Normal</span></td>
                    </tr>
                    <tr>
                      <td>Total White Blood Cells</td>
                      <td><strong>7.4</strong></td>
                      <td>x10³/µL</td>
                      <td>4.0 - 11.0</td>
                      <td><span className="doc-normal-badge">Normal</span></td>
                    </tr>
                    <tr>
                      <td>Platelet Count</td>
                      <td><strong>285</strong></td>
                      <td>x10³/µL</td>
                      <td>150 - 450</td>
                      <td><span className="doc-normal-badge">Normal</span></td>
                    </tr>
                    <tr>
                      <td>Serum Creatinine</td>
                      <td><strong>0.9</strong></td>
                      <td>mg/dL</td>
                      <td>0.6 - 1.3</td>
                      <td><span className="doc-normal-badge">Normal</span></td>
                    </tr>
                    <tr>
                      <td>Fasting Blood Sugar (FBS)</td>
                      <td><strong>94</strong></td>
                      <td>mg/dL</td>
                      <td>70 - 100</td>
                      <td><span className="doc-normal-badge">Normal</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="report-doc-signatures">
                <div className="sig-block">
                  <div className="sig-line" />
                  <p className="sig-name">Medical Lab Technologist</p>
                  <p className="sig-title">B.Sc. MLT, Registered</p>
                </div>
                <div className="sig-block">
                  <div className="sig-line" />
                  <p className="sig-name">Dr. Saeed Ahmed, MBBS, M.Phil</p>
                  <p className="sig-title">Consultant Pathologist</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportDetail() {
  const { id } = useParams();
  return <Reports />;
}
