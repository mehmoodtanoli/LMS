import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ordersApi, resultsApi } from "../api/resources";
import { apiError } from "../api/client";
import { Loading, ErrorMessage, Empty, patientName } from "../components/Common";
import { useAuth } from "../auth/AuthContext";
import {
  Save,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Lock,
  Edit3,
  X,
  FileCheck,
} from "lucide-react";

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

export default function Results() {
  const { user } = useAuth();
  const canFinalize = user?.role === "SUPERADMIN" || user?.role === "LAB_ADMIN";

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

  // Confirmation & Amendment Modals (Fixes A6)
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [amendModalOpen, setAmendModalOpen] = useState(false);
  const [amendmentReason, setAmendmentReason] = useState("");

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

  const isFinalized = activeItem?.result?.status === "FINALIZED";

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

  // Save Results (Draft/Completed) handler
  const handleSaveResults = async (targetStatus = "COMPLETED") => {
    if (!activeItem) return;

    setError("");
    setSuccessMsg("");
    setSaving(true);

    try {
      const cleanedValues = {};
      parameters.forEach((p) => {
        cleanedValues[p.name] = (paramValues[p.name] || "").toString().trim();
      });

      const existingResult = activeItem.result;
      if (existingResult?.id) {
        await resultsApi.update(existingResult.id, {
          value: cleanedValues,
          status: targetStatus,
        });
      } else {
        await resultsApi.create({
          orderedTestItemId: activeItem.id,
          value: cleanedValues,
          status: targetStatus,
        });
      }

      await ordersApi.update(selectedOrder.id, {
        status: "IN_PROGRESS",
      });

      setSuccessMsg(
        targetStatus === "FINALIZED"
          ? "Result finalized successfully!"
          : "Results saved successfully!"
      );
      setConfirmFinalizeOpen(false);
      loadData();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  // Amend Result handler (Fixes A6)
  const handleAmendSubmit = async (e) => {
    e.preventDefault();
    if (!activeItem?.result?.id || !amendmentReason.trim()) return;

    setError("");
    setSuccessMsg("");
    setSaving(true);

    try {
      const cleanedValues = {};
      parameters.forEach((p) => {
        cleanedValues[p.name] = (paramValues[p.name] || "").toString().trim();
      });

      await resultsApi.amend(activeItem.result.id, {
        value: cleanedValues,
        amendmentReason: amendmentReason.trim(),
        status: "FINALIZED",
      });

      setSuccessMsg("Result amended and updated successfully!");
      setAmendModalOpen(false);
      setAmendmentReason("");
      loadData();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  // Patient info for header banner
  const patient = selectedOrder?.patient;
  const pName = patient ? patientName(patient) : "Patient";
  const cnic = patient?.cnic || "—";
  const initials = getInitials(pName);
  const orderNumStr = selectedOrder
    ? `ORD-${selectedOrder.id.replace(/-/g, "").slice(0, 3).toUpperCase()}`
    : "ORD-001";

  const panelName = activeItem?.testDefinition?.name?.toUpperCase() || "HEMATOLOGY PANEL";

  return (
    <div className="results-page">
      <header className="page-header-simple">
        <div>
          <h1 className="page-title">Result Entry</h1>
          <p className="page-subtitle">
            Enter test investigation values quickly — use Tab or Enter to move between fields
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
                  {orders.map((o) => {
                    const name = patientName(o.patient);
                    const code = `ORD-${o.id.replace(/-/g, "").slice(0, 3).toUpperCase()}`;
                    return (
                      <option key={o.id} value={o.id}>
                        {code} · {name} ({o.orderedTestItems?.length || 1} test)
                      </option>
                    );
                  })}
                </select>
                <ChevronDown size={16} className="select-arrow" />
              </div>
            </div>

            {/* Test item pills if order has multiple tests */}
            {orderItems.length > 1 && (
              <div className="test-items-pill-row">
                {orderItems.map((item, idx) => {
                  const testCode = item.testDefinition?.code || `Test ${idx + 1}`;
                  const isFinal = item.result?.status === "FINALIZED";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`test-item-pill ${
                        selectedItemIndex === idx ? "active" : ""
                      }`}
                      onClick={() => setSelectedItemIndex(idx)}
                    >
                      <span>{testCode}</span>
                      {isFinal && <Lock size={12} style={{ marginLeft: "4px" }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Patient Demographics Bar */}
          <div className="patient-banner-clean">
            <div className="patient-banner-left">
              <div className="patient-avatar-box">
                <span className="patient-avatar-circle">{initials}</span>
                <div className="patient-info">
                  <span className="patient-name">{pName}</span>
                  <span className="patient-cnic">CNIC: {cnic}</span>
                </div>
              </div>
            </div>

            <div className="patient-banner-right">
              <div className="meta-item">
                <span className="meta-lbl">Order Ref</span>
                <span className="meta-val">{orderNumStr}</span>
              </div>
              <div className="meta-item">
                <span className="meta-lbl">Result Status</span>
                <span
                  className={`status-pill ${
                    isFinalized
                      ? "status-badge-completed"
                      : activeItem?.result?.status === "COMPLETED"
                      ? "status-badge-inprogress"
                      : "status-badge-pending"
                  }`}
                >
                  {activeItem?.result?.status || "PENDING"}
                </span>
              </div>
            </div>
          </div>

          {/* Finalized Notice */}
          {isFinalized && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#166534",
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Lock size={16} />
                <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>
                  This result has been FINALIZED and verified for reporting.
                </span>
              </div>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setAmendModalOpen(true)}
                style={{ fontSize: "0.82rem", height: "32px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Edit3 size={14} />
                <span>Amend Result</span>
              </button>
            </div>
          )}

          {/* Result Entry Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveResults("COMPLETED");
            }}
            className="results-form"
          >
            <div className="table-card">
              <table className="clean-table results-entry-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>#</th>
                    <th style={{ width: "32%" }}>Test Investigation / Parameter</th>
                    <th style={{ width: "24%" }}>Observed Value</th>
                    <th style={{ width: "12%" }}>Unit</th>
                    <th style={{ width: "20%" }}>Reference Range</th>
                    <th style={{ width: "12%" }}>Flag</th>
                  </tr>
                </thead>
                <tbody>
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
                            disabled={isFinalized}
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

            {/* Bottom Floating Action Bar */}
            <div className="results-action-bar">
              <div className="bar-count-info">
                <span>
                  <strong>{filledCount}</strong> / {parameters.length} values entered
                </span>
              </div>

              <div className="bar-submit-side" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
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

                {/* Save Draft Button */}
                <button
                  type="submit"
                  className="btn-cancel"
                  disabled={saving || isFinalized}
                  style={{ height: "38px" }}
                >
                  <Save size={15} />
                  <span>{saving ? "Saving…" : "Save Draft"}</span>
                </button>

                {/* Finalize Button - Hidden for LAB_TECH, requires non-empty values (Fixes A6) */}
                {canFinalize && !isFinalized && (
                  <button
                    type="button"
                    className="btn-primary-action"
                    disabled={saving || emptyCount > 0}
                    onClick={() => setConfirmFinalizeOpen(true)}
                    title={
                      emptyCount > 0
                        ? "Enter all observation values before finalizing"
                        : "Finalize and verify this test result"
                    }
                  >
                    <FileCheck size={16} />
                    <span>Finalize Results</span>
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* Confirm Finalize Modal */}
          {confirmFinalizeOpen && (
            <div
              className="modal-backdrop"
              onClick={() => setConfirmFinalizeOpen(false)}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="modal-card-clean"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "460px" }}
              >
                <div className="modal-header-clean">
                  <h2>Confirm Finalization</h2>
                  <button
                    type="button"
                    className="modal-close-btn"
                    onClick={() => setConfirmFinalizeOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div style={{ padding: "12px 0 20px" }}>
                  <p style={{ margin: "0 0 10px", color: "#334155", fontSize: "0.92rem", lineHeight: 1.5 }}>
                    Are you sure you want to finalize results for <strong>{panelName}</strong>?
                  </p>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem", lineHeight: 1.5 }}>
                    Once finalized, these verified values will be locked and available for clinical diagnostic reports. Any subsequent correction will require an official audit amendment.
                  </p>
                </div>
                <div className="modal-actions-clean">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setConfirmFinalizeOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary-action"
                    disabled={saving}
                    onClick={() => handleSaveResults("FINALIZED")}
                  >
                    {saving ? "Finalizing…" : "Confirm & Finalize"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Amend Result Modal (Fixes A6) */}
          {amendModalOpen && (
            <div
              className="modal-backdrop"
              onClick={() => setAmendModalOpen(false)}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="modal-card-clean"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "520px" }}
              >
                <div className="modal-header-clean">
                  <h2>Amend Finalized Result</h2>
                  <button
                    type="button"
                    className="modal-close-btn"
                    onClick={() => setAmendModalOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleAmendSubmit} className="modal-form-clean">
                  <p style={{ color: "#475569", fontSize: "0.88rem", margin: "0 0 14px", lineHeight: 1.5 }}>
                    Please provide an audit reason for amending this finalized medical record:
                  </p>

                  <div className="form-group-clean">
                    <label>
                      Amendment Reason <span className="required-star">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Corrected typo in Platelet Count per pathologist review"
                      value={amendmentReason}
                      onChange={(e) => setAmendmentReason(e.target.value)}
                    />
                  </div>

                  <div className="modal-actions-clean">
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setAmendModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary-action"
                      disabled={saving || !amendmentReason.trim()}
                    >
                      {saving ? "Saving Amendment…" : "Submit Amendment"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Empty>No orders available for result entry.</Empty>
      )}
    </div>
  );
}
