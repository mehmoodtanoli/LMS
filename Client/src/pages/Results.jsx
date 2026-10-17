import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ordersApi, resultsApi } from "../api/resources";
import { apiError } from "../api/client";
import { Loading, ErrorMessage, Empty } from "../components/Common";
import { Save, AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";

// Standard laboratory panel default parameters if DB test parameters are empty
const DEFAULT_PARAMETERS = {
  CBC: [
    { name: "Hemoglobin (Hb)", unit: "g/dL", referenceRange: "13.0 - 17.0" },
    { name: "Red Blood Cell Count", unit: "x10⁶/µL", referenceRange: "4.5 - 5.5" },
    { name: "White Blood Cell Count", unit: "x10³/µL", referenceRange: "4.0 - 11.0" },
    { name: "Platelet Count", unit: "x10³/µL", referenceRange: "150 - 450" },
    { name: "Hematocrit (PCV)", unit: "%", referenceRange: "40 - 50" },
    { name: "MCV", unit: "fL", referenceRange: "80 - 100" },
    { name: "MCH", unit: "pg", referenceRange: "27 - 32" },
    { name: "MCHC", unit: "g/dL", referenceRange: "32 - 36" },
    { name: "Neutrophils", unit: "%", referenceRange: "40 - 75" },
    { name: "Lymphocytes", unit: "%", referenceRange: "20 - 45" },
    { name: "Monocytes", unit: "%", referenceRange: "2 - 10" },
    { name: "Eosinophils", unit: "%", referenceRange: "1 - 6" },
    { name: "Basophils", unit: "%", referenceRange: "0 - 1" },
    { name: "ESR (1st Hour)", unit: "mm/hr", referenceRange: "0 - 15" },
    { name: "RDW-CV", unit: "%", referenceRange: "11.5 - 14.5" },
  ],
  LFT: [
    { name: "Total Bilirubin", unit: "mg/dL", referenceRange: "0.2 - 1.2" },
    { name: "Direct Bilirubin", unit: "mg/dL", referenceRange: "0.0 - 0.3" },
    { name: "Indirect Bilirubin", unit: "mg/dL", referenceRange: "0.2 - 0.8" },
    { name: "SGPT / ALT", unit: "U/L", referenceRange: "10 - 40" },
    { name: "SGOT / AST", unit: "U/L", referenceRange: "10 - 35" },
    { name: "Alkaline Phosphatase (ALP)", unit: "U/L", referenceRange: "44 - 147" },
    { name: "Total Protein", unit: "g/dL", referenceRange: "6.0 - 8.3" },
    { name: "Serum Albumin", unit: "g/dL", referenceRange: "3.5 - 5.0" },
    { name: "Serum Globulin", unit: "g/dL", referenceRange: "2.3 - 3.4" },
  ],
  RFT: [
    { name: "Blood Urea", unit: "mg/dL", referenceRange: "15 - 45" },
    { name: "Serum Creatinine", unit: "mg/dL", referenceRange: "0.6 - 1.3" },
    { name: "Blood Urea Nitrogen (BUN)", unit: "mg/dL", referenceRange: "7 - 20" },
    { name: "Serum Uric Acid", unit: "mg/dL", referenceRange: "3.5 - 7.2" },
    { name: "Sodium (Na+)", unit: "mEq/L", referenceRange: "135 - 145" },
    { name: "Potassium (K+)", unit: "mEq/L", referenceRange: "3.5 - 5.1" },
    { name: "Chloride (Cl-)", unit: "mEq/L", referenceRange: "98 - 107" },
    { name: "Estimated GFR (eGFR)", unit: "mL/min/1.73m²", referenceRange: "> 90" },
  ],
  PT: [
    { name: "Patient Value", unit: "Seconds", referenceRange: "11.0 - 15.0" },
    { name: "Control Value", unit: "Seconds", referenceRange: "12.0 - 14.0" },
    { name: "I.N.R", unit: "Ratio", referenceRange: "0.8 - 1.2" },
    { name: "Prothrombin Activity / Index", unit: "%", referenceRange: "70 - 100" },
  ],
  APTT: [
    { name: "Patient Value", unit: "Seconds", referenceRange: "26.0 - 38.0" },
    { name: "Control Value", unit: "Seconds", referenceRange: "28.0 - 32.0" },
    { name: "Ratio", unit: "Ratio", referenceRange: "0.8 - 1.2" },
  ],
};

function getInitials(name) {
  if (!name) return "PT";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function computeFlag(value, refRange) {
  if (!value || !refRange) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;

  // Check if range is like "13.0 - 17.0" or "40 - 50"
  const rangeMatch = refRange.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    if (!isNaN(low) && num < low) return "Low";
    if (!isNaN(high) && num > high) return "High";
    return "Normal";
  }

  // Check if range is like "< 500" or "> 90"
  const lessMatch = refRange.match(/<\s*([\d.]+)/);
  if (lessMatch) {
    const limit = parseFloat(lessMatch[1]);
    if (num > limit) return "High";
    return "Normal";
  }

  return null;
}

export default function Results() {
  const [searchParams] = useSearchParams();
  const requestedOrderId = searchParams.get("orderId");

  const [orders, setOrders] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);

  const [paramValues, setParamValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const inputRefs = useRef([]);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      ordersApi.list({ page: 1, limit: 100 }),
      resultsApi.list({ page: 1, limit: 100 }),
    ])
      .then(([o, r]) => {
        const orderList = o.data.orders || [];
        setOrders(orderList);
        setResults(r.data.results || []);

        if (orderList.length > 0) {
          if (requestedOrderId && orderList.some((x) => x.id === requestedOrderId)) {
            setSelectedOrderId(requestedOrderId);
          } else if (!selectedOrderId) {
            setSelectedOrderId(orderList[0].id);
          }
        }
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(loadData, [requestedOrderId]);

  // Selected Order Object
  const selectedOrder = useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId) || orders[0] || null;
  }, [orders, selectedOrderId]);

  // Order items for selected order
  const orderItems = useMemo(() => {
    return selectedOrder?.orderedTestItems || [];
  }, [selectedOrder]);

  // Selected Item
  const activeItem = useMemo(() => {
    return orderItems[selectedItemIndex] || orderItems[0] || null;
  }, [orderItems, selectedItemIndex]);

  // Parameters for the active item
  const parameters = useMemo(() => {
    if (!activeItem) return [];
    const dbParams = activeItem.testDefinition?.parameters;
    if (Array.isArray(dbParams) && dbParams.length > 0) {
      return dbParams.map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit || "",
        referenceRange: p.referenceRange || "",
      }));
    }

    // Fallback to default realistic clinical templates based on test code
    const code = (activeItem.testDefinition?.code || "").toUpperCase();
    const name = (activeItem.testDefinition?.name || "").toUpperCase();
    if (code.includes("PT") || code.includes("INR") || name.includes("PROTHROMBIN")) return DEFAULT_PARAMETERS.PT;
    if (code.includes("APTT") || name.includes("THROMBOPLASTIN")) return DEFAULT_PARAMETERS.APTT;
    if (code.includes("CBC") || name.includes("BLOOD") || name.includes("HEMO")) return DEFAULT_PARAMETERS.CBC;
    if (code.includes("LFT") || name.includes("LIVER")) return DEFAULT_PARAMETERS.LFT;
    if (code.includes("RFT") || name.includes("RENAL") || name.includes("KIDNEY")) return DEFAULT_PARAMETERS.RFT;

    return DEFAULT_PARAMETERS.CBC;
  }, [activeItem]);

  // Load existing results into form values when activeItem changes
  useEffect(() => {
    if (!activeItem) return;
    const existingResult = activeItem.result;
    if (existingResult?.value && typeof existingResult.value === "object") {
      setParamValues(existingResult.value);
    } else {
      // Clear or preset empty
      setParamValues({});
    }
    setSuccessMsg("");
    setError("");
  }, [activeItem]);

  const handleParamChange = (name, value) => {
    setParamValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Keyboard navigation between parameter inputs (Tab or Enter)
  const handleKeyDown = (e, index) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextInput = inputRefs.current[index + 1];
      if (nextInput) {
        nextInput.focus();
      }
    }
  };

  // Count filled vs empty
  const filledCount = parameters.filter(
    (p) => paramValues[p.name] !== undefined && paramValues[p.name] !== ""
  ).length;
  const emptyCount = Math.max(0, parameters.length - filledCount);

  // Save Results handler
  const handleSaveResults = async (e) => {
    e.preventDefault();
    if (!activeItem) return;

    setError("");
    setSuccessMsg("");
    setSaving(true);

    try {
      // Clean up values
      const cleanedValues = {};
      parameters.forEach((p) => {
        cleanedValues[p.name] = (paramValues[p.name] || "").toString().trim();
      });

      const existingResult = activeItem.result;
      if (existingResult?.id) {
        // Update result
        await resultsApi.update(existingResult.id, {
          value: cleanedValues,
          status: "COMPLETED",
        });
      } else {
        // Create result
        await resultsApi.create({
          orderedTestItemId: activeItem.id,
          value: cleanedValues,
          status: "COMPLETED",
        });
      }

      // Also update order status to IN_PROGRESS or COMPLETED if needed
      await ordersApi.update(selectedOrder.id, {
        status: "IN_PROGRESS",
      });

      setSuccessMsg("Results saved successfully!");
      loadData();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  // Patient info for header banner
  const patient = selectedOrder?.patient;
  const pName = `${patient?.name || ""} ${patient?.fullName || ""}`.trim() || "Muhammad Ali Khan";
  const cnic = patient?.cnic || "35201-1234567-1";
  const initials = getInitials(pName);
  const orderNumStr = selectedOrder
    ? `ORD-${selectedOrder.id.replace(/-/g, "").slice(0, 3).toUpperCase()}`
    : "ORD-001";

  const panelName = activeItem?.testDefinition?.name?.toUpperCase() || "HEMATOLOGY PANEL";

  return (
    <div className="results-page">
      {/* Header matching Image 4 */}
      <header className="page-header-simple">
        <div>
          <h1 className="page-title">Result Entry</h1>
          <p className="page-subtitle">
            Enter test values quickly — use Tab or Enter to move between fields
          </p>
        </div>
      </header>

      <ErrorMessage error={error} />
      {successMsg && (
        <div className="alert-success-clean">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <Loading text="Loading test orders for result entry…" />
      ) : selectedOrder ? (
        <div className="result-entry-container">
          {/* Top Controls: Select Order & Select Test */}
          <div className="result-controls-card">
            {/* Order Select */}
            <div className="order-picker-group">
              <label className="control-label">Select Order</label>
              <div className="select-wrapper-clean">
                <select
                  value={selectedOrderId}
                  onChange={(e) => {
                    setSelectedOrderId(e.target.value);
                    setSelectedItemIndex(0);
                  }}
                >
                  {orders.map((o, idx) => {
                    const code = `ORD-${o.id.replace(/-/g, "").slice(0, 3).toUpperCase() || String(idx + 1).padStart(3, "0")}`;
                    const name = `${o.patient?.name || ""} ${o.patient?.fullName || ""}`.trim() || "Patient";
                    const pendingCount = (o.orderedTestItems || []).length || 1;
                    return (
                      <option key={o.id} value={o.id}>
                        {code} — {name} ({pendingCount} pending)
                      </option>
                    );
                  })}
                </select>
                <ChevronDown size={16} className="select-arrow" />
              </div>
            </div>

            {/* Test Selector Pills */}
            <div className="test-picker-group">
              <label className="control-label">Select Test</label>
              <div className="test-pills-row">
                {orderItems.length > 0 ? (
                  orderItems.map((item, idx) => {
                    const code = (
                      item.testDefinition?.code || `TEST-${idx + 1}`
                    ).toUpperCase();
                    const isSelected = selectedItemIndex === idx;
                    return (
                      <button
                        key={item.id || idx}
                        type="button"
                        className={`test-picker-pill ${
                          isSelected ? "active" : ""
                        }`}
                        onClick={() => setSelectedItemIndex(idx)}
                      >
                        {code.length > 7 ? code.slice(0, 6) + "…" : code}
                      </button>
                    );
                  })
                ) : (
                  <button type="button" className="test-picker-pill active">
                    CBC
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Patient Banner Card matching Image 4 */}
          <div className="patient-summary-banner">
            <div className="banner-patient-side">
              <span className="patient-avatar-circle-lg">{initials}</span>
              <div className="banner-patient-text">
                <h2 className="banner-name">{pName}</h2>
                <span className="banner-sub">
                  {cnic} · {orderNumStr}
                </span>
              </div>
            </div>

            <div className="banner-test-side">
              <span className="banner-test-name">
                {activeItem?.testDefinition?.name || "Complete Blood Count"}
              </span>
              <span className="status-pill status-badge-inprogress">
                In Progress
              </span>
            </div>
          </div>

          {/* Parameters Table matching Image 4 */}
          <form onSubmit={handleSaveResults} className="parameters-form">
            <div className="table-card">
              <table className="parameters-table">
                <thead>
                  <tr>
                    <th style={{ width: "48px" }}>#</th>
                    <th style={{ width: "320px" }}>Parameter</th>
                    <th style={{ width: "200px" }}>Result</th>
                    <th style={{ width: "120px" }}>Unit</th>
                    <th style={{ width: "160px" }}>Normal Range</th>
                    <th style={{ width: "90px" }}>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Category divider header */}
                  <tr className="panel-divider-row">
                    <td colSpan={6}>{panelName}</td>
                  </tr>

                  {parameters.map((param, index) => {
                    const val = paramValues[param.name] ?? "";
                    const flag = computeFlag(val, param.referenceRange);

                    return (
                      <tr key={param.id || param.name || index}>
                        <td className="cell-num">{index + 1}</td>
                        <td className="cell-param-name">{param.name}</td>
                        <td className="cell-input">
                          <input
                            ref={(el) => (inputRefs.current[index] = el)}
                            type="text"
                            className="param-input"
                            placeholder="—"
                            value={val}
                            onChange={(e) =>
                              handleParamChange(param.name, e.target.value)
                            }
                            onKeyDown={(e) => handleKeyDown(e, index)}
                          />
                        </td>
                        <td className="cell-unit">{param.unit || "—"}</td>
                        <td className="cell-range">
                          {param.referenceRange || "—"}
                        </td>
                        <td className="cell-flag">
                          {flag === "High" && (
                            <span className="flag-badge flag-high">High</span>
                          )}
                          {flag === "Low" && (
                            <span className="flag-badge flag-low">Low</span>
                          )}
                          {flag === "Normal" && (
                            <span className="flag-badge flag-normal">Normal</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Floating Action Bar matching Image 4 */}
            <div className="results-action-bar">
              <div className="bar-count-info">
                <span>
                  <strong>{filledCount}</strong> / {parameters.length} values
                  entered
                </span>
              </div>

              <div className="bar-submit-side">
                {emptyCount > 0 ? (
                  <div className="empty-warning-badge">
                    <AlertTriangle size={14} />
                    <span>{emptyCount} fields empty</span>
                  </div>
                ) : (
                  <div className="complete-badge">
                    <CheckCircle2 size={14} />
                    <span>All fields filled</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={saving}
                >
                  <Save size={16} />
                  <span>{saving ? "Saving…" : "Save Results"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <Empty>No orders available for result entry.</Empty>
      )}
    </div>
  );
}
