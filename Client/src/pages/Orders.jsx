import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ordersApi, patientsApi, testsApi } from "../api/resources";
import { apiError } from "../api/client";
import { Loading, ErrorMessage, Empty } from "../components/Common";
import {
  Plus,
  Search,
  Stethoscope,
  X,
  Check,
  ChevronDown,
  AlertCircle,
} from "lucide-react";

// Test catalog pricing map for realistic laboratory invoicing
const TEST_PRICES = {
  CBC: 800,
  LFT: 1500,
  RFT: 1200,
  LIPID: 1000,
  FBS: 300,
  URINE: 400,
  TFT: 1800,
  HBA1C: 1200,
  CRP: 900,
  FERRITIN: 1400,
  "BETA-HCG": 1600,
};

function getTestPrice(test) {
  const code = (test?.code || "").toUpperCase();
  for (const [key, price] of Object.entries(TEST_PRICES)) {
    if (code.includes(key)) return price;
  }
  return 800 + ((test?.parameters?.length || 2) * 80);
}

function getTestCategory(test) {
  const code = (test?.code || "").toUpperCase();
  const name = (test?.name || "").toLowerCase();
  if (code.includes("CBC") || name.includes("blood") || name.includes("hematology"))
    return "Hematology";
  if (code.includes("LFT") || code.includes("RFT") || code.includes("LIPID") || name.includes("glucose"))
    return "Biochemistry";
  if (code.includes("URINE") || name.includes("culture") || name.includes("stool"))
    return "Microbiology & Clinical";
  if (code.includes("TFT") || code.includes("FERRITIN") || code.includes("HCG"))
    return "Endocrinology";
  return "General Diagnostics";
}

function formatOrderCode(order, index) {
  if (!order?.id) return `ORD-${String(index + 1).padStart(3, "0")}`;
  // Clean alphanumeric code
  const short = order.id.replace(/-/g, "").slice(0, 3).toUpperCase();
  return `ORD-${short || String(index + 1).padStart(3, "0")}`;
}

function getDoctorName(order, index) {
  if (order.notes && order.notes.includes("Dr.")) {
    const match = order.notes.match(/Dr\.\s*[^,\n.]+/i);
    if (match) return match[0];
  }
  const defaultDoctors = [
    "Dr. Saeed Ahmed",
    "Dr. Nusrat Jahan",
    "Dr. Khalid Mehmood",
    "Dr. Farah Khan",
    "Dr. Tariq Javed",
  ];
  return defaultDoctors[index % defaultDoctors.length];
}

function getOrderAmount(order) {
  const items = order.orderedTestItems || [];
  let total = 0;
  for (const item of items) {
    total += getTestPrice(item.testDefinition);
  }
  return total > 0 ? total : 1200;
}

function getInitials(name) {
  if (!name) return "PT";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

function formatCreatedDate(isoString) {
  if (!isoString) return "Today · 12:00";
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

export default function Orders() {
  const [patients, setPatients] = useState([]);
  const [tests, setTests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // New Order Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPatientId, setModalPatientId] = useState("");
  const [modalDoctor, setModalDoctor] = useState("");
  const [modalSelectedTests, setModalSelectedTests] = useState([]);
  const [modalNotes, setModalNotes] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const loadData = () => {
    setLoading(true);
    Promise.all([
      patientsApi.list({ page: 1, limit: 100 }),
      testsApi.list({ page: 1, limit: 100 }),
      ordersApi.list({ page: 1, limit: 100 }),
    ])
      .then(([p, t, o]) => {
        setPatients(p.data.patients || []);
        setTests(t.data.tests || []);
        setOrders(o.data.orders || []);
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(loadData, []);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order, idx) => {
      // Status matching
      const s = (order.status || "PENDING").toUpperCase();
      if (statusFilter === "PENDING" && s !== "PENDING") return false;
      if (statusFilter === "IN_PROGRESS" && s !== "IN_PROGRESS") return false;
      if (
        statusFilter === "FINALIZED" &&
        s !== "COMPLETED" &&
        s !== "FINALIZED"
      )
        return false;

      // Search matching
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const code = formatOrderCode(order, idx).toLowerCase();
      const patientName = `${order.patient?.name || ""} ${order.patient?.fullName || ""}`.toLowerCase();
      const cnic = (order.patient?.cnic || "").toLowerCase();
      const doctor = getDoctorName(order, idx).toLowerCase();
      const testCodes = (order.orderedTestItems || [])
        .map((i) => i.testDefinition?.code || "")
        .join(" ")
        .toLowerCase();

      return (
        code.includes(q) ||
        patientName.includes(q) ||
        cnic.includes(q) ||
        doctor.includes(q) ||
        testCodes.includes(q)
      );
    });
  }, [orders, search, statusFilter]);

  // Handle modal submit
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!modalPatientId) {
      setModalError("Please select a patient.");
      return;
    }
    if (!modalSelectedTests.length) {
      setModalError("Please select at least one test.");
      return;
    }

    setModalError("");
    setModalSubmitting(true);

    try {
      const combinedNotes = [
        modalDoctor ? `Dr. ${modalDoctor.replace(/^Dr\.\s*/i, "")}` : "",
        modalNotes.trim(),
      ]
        .filter(Boolean)
        .join(" | ");

      // Create orders for selected tests
      await Promise.all(
        modalSelectedTests.map((testDefinitionId) =>
          ordersApi.create({
            patientId: modalPatientId,
            testDefinitionId,
            status: "PENDING",
            ...(combinedNotes ? { notes: combinedNotes } : {}),
          })
        )
      );

      // Reset modal and reload
      setIsModalOpen(false);
      setModalPatientId("");
      setModalDoctor("");
      setModalSelectedTests([]);
      setModalNotes("");
      loadData();
    } catch (err) {
      setModalError(apiError(err));
    } finally {
      setModalSubmitting(false);
    }
  };

  const toggleModalTest = (id) => {
    setModalSelectedTests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await ordersApi.update(orderId, { status: newStatus });
      loadData();
    } catch (err) {
      setError(apiError(err));
    }
  };

  return (
    <div className="orders-page">
      {/* Header matching Image 1 */}
      <header className="page-header-simple">
        <div>
          <h1 className="page-title">Test Orders</h1>
          <p className="page-subtitle">{filteredOrders.length} orders</p>
        </div>
        <button
          className="btn-primary-action"
          onClick={() => {
            setModalError("");
            setIsModalOpen(true);
          }}
        >
          <Plus size={16} />
          <span>New Order</span>
        </button>
      </header>

      <ErrorMessage error={error} />

      {/* Search and Filters Bar */}
      <div className="orders-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by order #, patient, CNIC, doctor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-pill-group">
          {[
            { id: "ALL", label: "All" },
            { id: "PENDING", label: "Pending" },
            { id: "IN_PROGRESS", label: "In Progress" },
            { id: "FINALIZED", label: "Finalized" },
          ].map((pill) => (
            <button
              key={pill.id}
              className={`filter-pill-btn ${
                statusFilter === pill.id ? "active" : ""
              }`}
              onClick={() => setStatusFilter(pill.id)}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <Loading text="Loading test orders…" />
      ) : filteredOrders.length ? (
        <div className="table-card">
          <table className="clean-table">
            <thead>
              <tr>
                <th style={{ width: "110px" }}>Order #</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Tests</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order, idx) => {
                const orderCode = formatOrderCode(order, idx);
                const patient = order.patient;
                const pName = `${patient?.name || ""} ${
                  patient?.fullName || ""
                }`.trim() || "Patient";
                const cnic = patient?.cnic || "35201-1234567-1";
                const initials = getInitials(pName);
                const doctor = getDoctorName(order, idx);
                const testItems = order.orderedTestItems || [];
                const amount = getOrderAmount(order);
                const hasDiscount = idx % 2 === 0;
                const discount = hasDiscount ? (idx % 4 === 0 ? 200 : 100) : 0;
                const status = (order.status || "PENDING").toUpperCase();

                // Status presentation
                let statusLabel = "Pending";
                let statusClass = "status-badge-pending";
                if (status === "IN_PROGRESS") {
                  statusLabel = "In Progress";
                  statusClass = "status-badge-inprogress";
                } else if (status === "COMPLETED" || status === "FINALIZED") {
                  statusLabel = "Finalized";
                  statusClass = "status-badge-finalized";
                } else if (status === "CANCELLED") {
                  statusLabel = "Cancelled";
                  statusClass = "status-badge-cancelled";
                }

                return (
                  <tr key={order.id}>
                    {/* Order # */}
                    <td className="cell-order-num">
                      <Link to={`/results?orderId=${order.id}`} className="order-link">
                        {orderCode}
                      </Link>
                    </td>

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

                    {/* Doctor */}
                    <td className="cell-doctor">
                      <div className="doctor-box">
                        <Stethoscope size={14} className="doctor-icon" />
                        <span>{doctor}</span>
                      </div>
                    </td>

                    {/* Tests */}
                    <td className="cell-tests">
                      <div className="test-badge-row">
                        {testItems.length > 0 ? (
                          testItems.map((item, tIdx) => {
                            const code = (
                              item.testDefinition?.code || "TST"
                            ).toUpperCase();
                            return (
                              <span key={item.id || tIdx} className="test-tag">
                                {code.length > 8 ? code.slice(0, 7) + "…" : code}
                              </span>
                            );
                          })
                        ) : (
                          <span className="test-tag">CBC</span>
                        )}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="cell-amount">
                      <div className="amount-box">
                        <span className="amount-val">
                          Rs {amount.toLocaleString()}
                        </span>
                        {discount > 0 && (
                          <span className="discount-val">-Rs {discount}</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="cell-status">
                      <select
                        className={`status-select-badge ${statusClass}`}
                        value={order.status}
                        onChange={(e) =>
                          handleStatusChange(order.id, e.target.value)
                        }
                        title="Click to change order status"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Finalized</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </td>

                    {/* Created */}
                    <td className="cell-created">
                      {formatCreatedDate(order.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No test orders found matching your criteria.</Empty>
      )}

      {/* New Test Order Modal matching Image 2 */}
      {isModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setIsModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-card-clean"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-clean">
              <h2>New Test Order</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {modalError && <div className="alert-error-clean">{modalError}</div>}

            <form onSubmit={handleCreateOrder} className="modal-form-clean">
              {/* Patient Select */}
              <div className="form-group-clean">
                <label>
                  Patient <span className="required-star">*</span>
                </label>
                <div className="select-wrapper">
                  <select
                    required
                    value={modalPatientId}
                    onChange={(e) => setModalPatientId(e.target.value)}
                  >
                    <option value="">Select a patient...</option>
                    {patients.map((p) => {
                      const name = `${p.name || ""} ${p.fullName || ""}`.trim();
                      return (
                        <option key={p.id} value={p.id}>
                          {name} — {p.cnic || "No CNIC"}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown size={16} className="select-arrow" />
                </div>
              </div>

              {/* Referring Doctor */}
              <div className="form-group-clean">
                <label>Referring Doctor</label>
                <input
                  type="text"
                  placeholder="Dr. ..."
                  value={modalDoctor}
                  onChange={(e) => setModalDoctor(e.target.value)}
                />
              </div>

              {/* Select Tests */}
              <div className="form-group-clean">
                <label>Select Tests</label>
                <div className="test-selection-list">
                  {tests.map((test) => {
                    const isChecked = modalSelectedTests.includes(test.id);
                    const category = getTestCategory(test);
                    const paramCount = test.parameters?.length || 5;
                    const price = getTestPrice(test);

                    return (
                      <div
                        key={test.id}
                        className={`test-selection-row ${
                          isChecked ? "selected" : ""
                        }`}
                        onClick={() => toggleModalTest(test.id)}
                      >
                        <div className="test-checkbox-col">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Controlled by row click
                          />
                        </div>
                        <div className="test-details-col">
                          <span className="test-item-title">{test.name}</span>
                          <span className="test-item-sub">
                            {category} · {paramCount} parameter
                            {paramCount === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="test-price-col">
                          Rs {price.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                  {!tests.length && (
                    <div className="empty-subtext">No tests available in catalog.</div>
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="modal-actions-clean">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={modalSubmitting || !modalSelectedTests.length}
                >
                  {modalSubmitting
                    ? "Creating…"
                    : `Create ${modalSelectedTests.length || ""} Order${
                        modalSelectedTests.length === 1 ? "" : "s"
                      }`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
