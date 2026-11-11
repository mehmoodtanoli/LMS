import { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ordersApi, reportsApi } from "../api/resources";
import { apiError } from "../api/client";
import { Loading, ErrorMessage, Empty, patientName } from "../components/Common";
import {
  Printer,
  Search,
  FileText,
  X,
  CheckCircle2,
  Calendar,
  User,
  FlaskConical,
  MapPin,
  Phone,
  Mail,
  Activity,
} from "lucide-react";
import {
  ChevronDecorativeBar,
} from "../components/XpertLogo";

function getInitials(name) {
  if (!name) return "PT";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function formatFinalizedDate(isoString, idx = 0) {
  if (!isoString) return "—";
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

function getDoctorName(report) {
  if (report?.notes && report.notes.includes("Dr.")) {
    const match = report.notes.match(/Dr\.\s*[^,\n.]+/i);
    if (match) return match[0];
  }
  return "—";
}

function getSpecimenType(report) {
  const testsStr = (report?.testItems || [])
    .map((i) => `${i.testDefinition?.code || ""} ${i.testDefinition?.name || ""}`)
    .join(" ")
    .toUpperCase();
  if (testsStr.includes("PT") || testsStr.includes("APTT") || testsStr.includes("COAG"))
    return "Citrated Plasma";
  if (testsStr.includes("CBC") || testsStr.includes("BLOOD") || testsStr.includes("HEMO"))
    return "Whole Blood (EDTA)";
  if (testsStr.includes("URINE"))
    return "Mid-stream Urine";
  if (testsStr.includes("STOOL"))
    return "Stool Specimen";
  return "—";
}

function getReportTestTitle(report) {
  const testsStr = (report?.testItems || [])
    .map((i) => `${i.testDefinition?.code || ""} ${i.testDefinition?.name || ""}`)
    .join(" ")
    .toUpperCase();
  if (testsStr.includes("PT") || testsStr.includes("PROTHROMBIN") || testsStr.includes("INR"))
    return "PROTHROMBIN TIME (PT) / INR";
  if (testsStr.includes("APTT"))
    return "ACTIVATED PARTIAL THROMBOPLASTIN TIME (APTT)";
  if (testsStr.includes("CBC"))
    return "COMPLETE BLOOD COUNT (CBC)";
  if (testsStr.includes("LFT"))
    return "LIVER FUNCTION TESTS (LFT)";
  if (testsStr.includes("RFT"))
    return "RENAL FUNCTION TESTS (RFT)";
  if (report?.testItems?.length === 1) {
    const t = report.testItems[0].testDefinition;
    return (t?.name || t?.code || "CLINICAL PATHOLOGY").toUpperCase();
  }
  return "CLINICAL PATHOLOGY REPORT";
}

function computeFlag(value, refRange) {
  if (!value || !refRange) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;

  const rangeMatch = refRange.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    if (!isNaN(low) && num < low) return "Low";
    if (!isNaN(high) && num > high) return "High";
    return "Normal";
  }

  const lessMatch = refRange.match(/<\s*([\d.]+)/);
  if (lessMatch) {
    const limit = parseFloat(lessMatch[1]);
    if (num > limit) return "High";
    return "Normal";
  }

  return null;
}

function isPresentResultValue(value) {
  if (value === null || value === undefined) return false;
  return typeof value === "string" ? value.trim().length > 0 : true;
}

function getReportRows(report) {
  const rows = [];
  const items = report?.testItems || [];

  // Check if any items have recorded results with parameter values
  let hasRecordedValues = false;

  items.forEach((item) => {
    const testCode = (item.testDefinition?.code || "").toUpperCase();
    const testName = (item.testDefinition?.name || testCode).toUpperCase();
    const resVal = item.result?.value;

    if (resVal && typeof resVal === "object" && Object.keys(resVal).length > 0) {
      hasRecordedValues = true;
      const paramDefs = item.testDefinition?.parameters || [];
      rows.push({ isHeader: true, title: testName || testCode });

      Object.keys(resVal).forEach((key) => {
        const val = resVal[key];
        const def = paramDefs.find((p) => p.id === key || p.name === key) || {};
        rows.push({
          name: key,
          value: val,
          unit: def.unit || "",
          referenceRange: def.referenceRange || "",
          flag: computeFlag(val, def.referenceRange),
          resultStatus: item.result?.status,
        });
      });
    } else if (isPresentResultValue(resVal)) {
      hasRecordedValues = true;
      rows.push({ isHeader: true, title: testName || testCode });
      rows.push({
        name: testName || testCode || "Result",
        value: resVal,
        unit: item.result?.unit || "",
        referenceRange: item.result?.referenceRange || "",
        flag: computeFlag(resVal, item.result?.referenceRange),
        resultStatus: item.result?.status,
      });
    }
  });

  if (hasRecordedValues && rows.length > 0) {
    return rows;
  }

  return [];
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

  // Reports are sourced from the report records so status and identity remain authoritative.
  const displayReports = useMemo(() => {
    const list = reports.map((rep) => {
        const order = rep.order || orders.find((o) => o.id === rep.orderId);
        const pat = rep.snapshot?.patient || order?.patient;
        const testItems = rep.snapshot?.orderedTestItems || order?.orderedTestItems || [];
        const totalAmount =
          rep.snapshot?.order?.totalAmount ??
          rep.order?.totalAmount ??
          order?.totalAmount ??
          null;
        return {
          id: rep.id,
          reportId: rep.id,
          orderId: rep.orderId,
          orderCode: order?.id
            ? `ORD-${order.id.replace(/-/g, "").slice(0, 3).toUpperCase()}`
            : "—",
          laboratory: rep.laboratory || order?.laboratory || null,
          patient: pat,
          testItems,
          amount: totalAmount,
          status: rep.status,
          version: rep.version || 1,
          createdAt: rep.createdAt,
          title: rep.title || "Diagnostic Pathology Report",
          results: testItems.map((i) => i.result).filter(Boolean),
          notes: order?.notes || "",
        };
      });

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

  // Preview Report Metadata
  const patient = previewReport?.patient;
  const pName = patient ? patientName(patient) : "Patient";
  const doctorName = getDoctorName(previewReport);
  const specimenType = getSpecimenType(previewReport);
  const testTitle = getReportTestTitle(previewReport);
  const reportRows = previewReport ? getReportRows(previewReport) : [];
  const laboratory = previewReport?.laboratory;
  const testsRequiredStr = (previewReport?.testItems || [])
    .map((i) => i.testDefinition?.name || i.testDefinition?.code)
    .filter(Boolean)
    .join(", ") || testTitle;

  return (
    <div className="reports-page">
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

      {/* Reports Table */}
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
                const pat = report.patient;
                const name = `${pat?.name || ""} ${pat?.fullName || ""}`.trim() || "Patient";
                const cnic = pat?.cnic || "—";
                const initials = getInitials(name);
                const testItems = report.testItems || [];
                const finalizedStr = formatFinalizedDate(report.createdAt, idx);

                return (
                  <tr key={report.id || idx}>
                    <td className="cell-order-num">{report.orderCode}</td>
                    <td className="cell-patient">
                      <div className="patient-avatar-box">
                        <span className="patient-avatar-circle">{initials}</span>
                        <div className="patient-info">
                          <span className="patient-name">{name}</span>
                          <span className="patient-cnic">{cnic}</span>
                        </div>
                      </div>
                    </td>
                    <td className="cell-tests">
                      <div className="test-badge-row">
                        {testItems.length > 0 ? (
                          testItems.map((item, tIdx) => {
                            const code = (
                              item.testDefinition?.code
                            ).toUpperCase();
                            return (
                              <span key={item.id || tIdx} className="test-tag">
                                {code.length > 8 ? code.slice(0, 7) + "…" : code}
                              </span>
                            );
                          })
                        ) : "—"}
                      </div>
                    </td>
                    <td className="cell-amount">
                      <span className="amount-val">
                        {report.amount === null
                          ? "Bill not finalized"
                          : `Rs ${Number(report.amount).toLocaleString()}`}
                      </span>
                    </td>
                    <td className="cell-created">{finalizedStr}</td>
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
            style={{ maxWidth: "780px", width: "95%" }}
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
              {/* Background Watermark */}
              <div className="xpert-watermark" aria-hidden="true">
                <Activity size={320} color="#0c3c6d" strokeWidth={1} />
              </div>

              {/* Header */}
              <div className="xpert-report-header">
                <div className="xpert-header-top">
                  <div className="xpert-logo-brand-group">
                    <div className="xpert-logo-box">
                      {laboratory?.logoUrl ? (
                        <img
                          src={laboratory.logoUrl}
                          alt=""
                          style={{ width: "52px", height: "52px", objectFit: "contain" }}
                        />
                      ) : (
                        <Activity size={52} color="#0c3c6d" />
                      )}
                    </div>
                    <div className="xpert-titles-group">
                      <div className="xpert-main-brand">
                        <span className="xpert-brand-xpert">
                          {laboratory?.name || "Laboratory Management System"}
                        </span>
                      </div>
                      {laboratory?.tagline && (
                        <div className="xpert-pill-badges">
                          <span className="xpert-pill xpert-pill-accurate">
                            {laboratory.tagline}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="xpert-header-meta">
                    <div className="xpert-report-id-badge">
                      <span className="xpert-id-label">REPORT ID</span>
                      <span className="xpert-id-number">{previewReport.reportId}</span>
                    </div>
                      <span className="xpert-instant-tag">ORDER {previewReport.orderCode}</span>
                  </div>
                </div>

                {/* Blue Chevron Decorative Divider */}
                <ChevronDecorativeBar color="#0c3c6d" height={14} />
              </div>

              {/* Patient Details Box (Fixes A2) */}
              <div className="xpert-patient-info-box">
                <div className="xpert-patient-grid">
                  <div className="xpert-patient-col">
                    <div className="xpert-info-row">
                      <span className="xpert-info-lbl">PATIENT'S NAME:</span>
                      <span className="xpert-info-val patient-name-highlight">
                        {pName}
                      </span>
                    </div>
                    <div className="xpert-info-row">
                      <span className="xpert-info-lbl">AGE / GENDER:</span>
                      <span className="xpert-info-val">
                        {patient?.age !== undefined && patient?.age !== null
                          ? `${patient.age} ${patient.ageUnit === "MONTHS" ? "mo" : patient.ageUnit === "DAYS" ? "d" : "Y"}`
                          : "—"}{" "}
                        / {patient?.gender ? patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase() : "—"}
                      </span>
                    </div>
                    <div className="xpert-info-row">
                      <span className="xpert-info-lbl">PHONE / CONTACT:</span>
                      <span className="xpert-info-val">
                        {patient?.phone || "—"}
                      </span>
                    </div>
                    <div className="xpert-info-row">
                      <span className="xpert-info-lbl">REF. BY DOCTOR:</span>
                      <span className="xpert-info-val">
                        {doctorName}
                      </span>
                    </div>
                    <div className="xpert-info-row">
                      <span className="xpert-info-lbl">TEST REQUIRED:</span>
                      <span className="xpert-info-val">
                        {testsRequiredStr}
                      </span>
                    </div>
                  </div>

                  <div className="xpert-patient-col">
                    <div className="xpert-info-row">
                      <span className="xpert-info-lbl">PATIENT CNIC / ID:</span>
                      <span className="xpert-info-val">
                        {patient?.cnic || "—"}
                      </span>
                    </div>
                    <div className="xpert-info-row">
                      <span className="xpert-info-lbl">DATE &amp; TIME:</span>
                      <span className="xpert-info-val">
                        {formatFinalizedDate(previewReport.createdAt, 0)}
                      </span>
                    </div>
                    <div className="xpert-info-row">
                      <span className="xpert-info-lbl">SPECIMEN TYPE:</span>
                      <span className="xpert-info-val">
                        {specimenType}
                      </span>
                    </div>
                    <div className="xpert-info-row">
                      <span className="xpert-info-lbl">REPORT STATUS:</span>
                      <span className="xpert-info-val">
                        <span
                          className={`xpert-status-badge ${
                            previewReport.status === "FINAL"
                              ? "xpert-status-normal"
                              : previewReport.status === "SUPERSEDED"
                              ? "xpert-status-superseded"
                              : "xpert-status-draft"
                          }`}
                        >
                          {previewReport.status === "FINAL"
                            ? "FINAL VERIFIED"
                            : previewReport.status === "AMENDED"
                            ? `AMENDED (V${previewReport.version || 2})`
                            : previewReport.status === "SUPERSEDED"
                            ? "SUPERSEDED"
                            : "DRAFT"}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* DRAFT Watermark if report is DRAFT (Fixes A5) */}
              {previewReport.status === "DRAFT" && (
                <div
                  className="report-draft-watermark"
                  style={{
                    position: "absolute",
                    top: "45%",
                    left: "10%",
                    right: "10%",
                    textAlign: "center",
                    transform: "rotate(-32deg)",
                    fontSize: "44px",
                    fontWeight: "900",
                    color: "rgba(220, 38, 38, 0.18)",
                    border: "5px dashed rgba(220, 38, 38, 0.28)",
                    padding: "16px",
                    letterSpacing: "4px",
                    pointerEvents: "none",
                    zIndex: 10,
                    borderRadius: "10px",
                  }}
                >
                  DRAFT — NOT FOR CLINICAL USE
                </div>
              )}

              {/* Centered Boxed Banner & Test Title */}
              <div className="xpert-banner-wrapper">
                <div className="xpert-test-report-banner">TEST REPORT</div>
                <h3 className="xpert-test-heading">{testTitle}</h3>
              </div>

              {/* Test Results Table */}
              <div className="xpert-results-table-wrap">
                <table className="xpert-results-table">
                  <thead>
                    <tr>
                      <th style={{ width: "38%" }}>Test Investigation</th>
                      <th style={{ width: "22%" }}>Observed Value</th>
                      <th style={{ width: "22%" }}>Reference Range</th>
                      <th style={{ width: "10%" }}>Unit</th>
                      <th style={{ width: "8%", textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((row, rIdx) => {
                      if (row.isHeader) {
                        return (
                          <tr key={`h-${rIdx}`}>
                            <td colSpan={5} className="report-panel-head">
                              {row.title}
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={`r-${rIdx}`}>
                          <td>{row.name}</td>
                          <td>
                            <span className="xpert-val-bold">{row.value}</span>
                          </td>
                          <td>{row.referenceRange || "—"}</td>
                          <td>{row.unit || "—"}</td>
                          <td style={{ textAlign: "center" }}>
                            <span
                              className={`xpert-status-badge ${
                                row.flag === "High"
                                  ? "xpert-status-high"
                                  : row.flag === "Low"
                                  ? "xpert-status-low"
                                  : "xpert-status-normal"
                              }`}
                            >
                              {row.resultStatus === "FINALIZED"
                                ? row.flag || "Finalized"
                                : row.resultStatus || "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Report Footer */}
              <div className="xpert-footer-section">
                <div className="xpert-footer-middle">
                  <div className="xpert-footer-seal">
                    <Activity size={52} color="#0c3c6d" />
                  </div>
                  <div className="xpert-footer-disclaimer-box">
                    <p className="xpert-disclaimer-title">ELECTRONICALLY VERIFIED REPORT</p>
                    <p className="xpert-disclaimer-text">
                      This diagnostic investigation report has been validated electronically by certified pathology information systems. No physical signature is required.
                    </p>
                  </div>
                  <div className="xpert-signatures-group">
                    <div className="xpert-signature-block">
                      <div className="xpert-sig-line" />
                      <p className="xpert-sig-name">Lab Technologist</p>
                      <p className="xpert-sig-title">B.Sc. MLT, Reg. # 4921</p>
                    </div>
                    <div className="xpert-signature-block">
                      <div className="xpert-sig-line" />
                      <p className="xpert-sig-name">Authorized Reviewer</p>
                      <p className="xpert-sig-title">Laboratory Report Verification</p>
                    </div>
                  </div>
                </div>

                {/* Bottom Bar matching Image */}
                <div className="xpert-bottom-bar">
                  <div className="xpert-bar-info">
                    <div className="xpert-bar-address">
                      <MapPin size={13} style={{ flexShrink: 0 }} />
                      <span>{laboratory?.address || "—"}</span>
                    </div>
                    <div className="xpert-bar-contact">
                      {laboratory?.phone && (
                        <>
                          <Phone size={13} style={{ flexShrink: 0 }} />
                          <span>Contact: {laboratory.phone}</span>
                        </>
                      )}
                      {laboratory?.phone && laboratory?.email && (
                        <span style={{ margin: "0 6px" }}>·</span>
                      )}
                      {laboratory?.email && (
                        <>
                          <Mail size={13} style={{ flexShrink: 0 }} />
                          <span>Email: {laboratory.email}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="xpert-bar-chevrons">
                    <svg width="45" height="16" viewBox="0 0 45 16" fill="none">
                      <polygon points="5,0 12,0 20,8 12,16 5,16 13,8" fill="#ffffff" opacity="0.9" />
                      <polygon points="17,0 24,0 32,8 24,16 17,16 25,8" fill="#ffffff" opacity="0.9" />
                      <polygon points="29,0 36,0 44,8 36,16 29,16 37,8" fill="#ffffff" opacity="0.9" />
                    </svg>
                  </div>
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
