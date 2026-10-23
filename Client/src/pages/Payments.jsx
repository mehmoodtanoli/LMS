import { useEffect, useState, useMemo } from "react";
import { ordersApi, paymentsApi } from "../api/resources";
import { apiError } from "../api/client";
import { Empty, ErrorMessage, Loading, date, patientName } from "../components/Common";
import { Plus, CreditCard, Search, X, Check, ArrowDownLeft, Clock, AlertCircle } from "lucide-react";

function getInitials(name) {
  if (!name) return "PT";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedBilling, setSelectedBilling] = useState(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [form, setForm] = useState({
    orderId: "",
    amount: "",
    paidAt: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      paymentsApi.list({ page: 1, limit: 100 }),
      ordersApi.list({ page: 1, limit: 100 }),
    ])
      .then(([p, o]) => {
        setPayments(p.data.payments || []);
        setOrders(o.data.orders || []);
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleOrderChange = async (orderId) => {
    setForm((prev) => ({ ...prev, orderId, amount: "" }));
    setSelectedBilling(null);

    if (!orderId) return;

    setLoadingBilling(true);
    try {
      const res = await paymentsApi.billing(orderId);
      const billing = res.data.billing;
      setSelectedBilling(billing);
      if (billing && billing.remainingAmount > 0) {
        setForm((prev) => ({ ...prev, amount: String(billing.remainingAmount) }));
      }
    } catch (err) {
      console.error("Failed to load order billing:", err);
    } finally {
      setLoadingBilling(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    // Omit status: server sets PAID and validates remaining balance (Fixes A3, Rule 1)
    try {
      await paymentsApi.create({
        orderId: form.orderId,
        amount: Number(form.amount),
        ...(form.paidAt ? { paidAt: form.paidAt } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });

      setForm({
        orderId: "",
        amount: "",
        paidAt: new Date().toISOString().split("T")[0],
        notes: "",
      });
      setSelectedBilling(null);
      setIsModalOpen(false);
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics
  const totalCollected = useMemo(() => {
    return payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [payments]);

  const totalPending = useMemo(() => {
    return payments
      .filter((p) => p.status === "UNPAID" || p.status === "PARTIALLY_PAID")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [payments]);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const s = (p.status || "UNPAID").toUpperCase();
      if (statusFilter !== "ALL" && s !== statusFilter) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const pName = patientName(p.order?.patient).toLowerCase();
      const notes = (p.notes || "").toLowerCase();
      return pName.includes(q) || notes.includes(q);
    });
  }, [payments, statusFilter, search]);

  return (
    <div className="payments-page">
      <header className="page-header-simple">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Track receipts, pending billing, and invoices</p>
        </div>

        <button
          className="btn-primary-action"
          onClick={() => {
            setSelectedBilling(null);
            setIsModalOpen(true);
          }}
        >
          <Plus size={16} />
          <span>Record Payment</span>
        </button>
      </header>

      <ErrorMessage error={error} />

      {/* Summary KPI Cards */}
      <div className="metrics-row-top" style={{ marginBottom: "24px" }}>
        <div className="stat-card stat-card-prominent">
          <div className="stat-card-header">
            <span className="stat-label">Total Revenue Collected</span>
            <CreditCard size={18} className="stat-icon-prominent" />
          </div>
          <div className="stat-value">Rs {totalCollected.toLocaleString()}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Pending / Unpaid Dues</span>
            <Clock size={18} className="stat-icon-neutral" />
          </div>
          <div className="stat-value">Rs {totalPending.toLocaleString()}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total Transactions</span>
            <span className="currency-symbol-icon">#</span>
          </div>
          <div className="stat-value">{payments.length}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="orders-toolbar" style={{ marginBottom: "20px" }}>
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search payments by patient or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-pill-group">
          {[
            { id: "ALL", label: "All" },
            { id: "PAID", label: "Paid" },
            { id: "UNPAID", label: "Unpaid" },
            { id: "PARTIALLY_PAID", label: "Partial" },
          ].map((pill) => (
            <button
              key={pill.id}
              className={`filter-pill-btn ${statusFilter === pill.id ? "active" : ""}`}
              onClick={() => setStatusFilter(pill.id)}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <Loading text="Loading payments…" />
      ) : filteredPayments.length ? (
        <div className="table-card">
          <table className="clean-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Order Ref</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Paid Date</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => {
                const pName = patientName(payment.order?.patient);
                const initials = getInitials(pName);
                const orderCode = payment.order
                  ? `ORD-${payment.order.id.replace(/-/g, "").slice(0, 3).toUpperCase()}`
                  : "ORD-001";

                return (
                  <tr key={payment.id}>
                    <td className="cell-patient">
                      <div className="patient-avatar-box">
                        <span className="patient-avatar-circle">{initials}</span>
                        <div className="patient-info">
                          <span className="patient-name">{pName}</span>
                          <span className="patient-cnic">
                            {payment.order?.patient?.cnic || "—"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="cell-order-num">{orderCode}</td>

                    <td className="cell-amount">
                      <span className="amount-val">
                        Rs {Number(payment.amount || 0).toLocaleString()}
                      </span>
                    </td>

                    <td className="cell-status">
                      <span
                        className={`status-pill ${
                          payment.status === "PAID"
                            ? "status-badge-completed"
                            : payment.status === "PARTIALLY_PAID"
                            ? "status-badge-inprogress"
                            : "status-badge-pending"
                        }`}
                      >
                        {payment.status}
                      </span>
                    </td>

                    <td className="cell-created">{date(payment.paidAt)}</td>

                    <td className="cell-doctor">{payment.notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No payment records found.</Empty>
      )}

      {/* Record Payment Modal */}
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
            style={{ maxWidth: "560px" }}
          >
            <div className="modal-header-clean">
              <h2>Record Payment</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="modal-form-clean">
              <div className="form-group-clean">
                <label>
                  Choose Test Order <span className="required-star">*</span>
                </label>
                <select
                  required
                  value={form.orderId}
                  onChange={(e) => handleOrderChange(e.target.value)}
                >
                  <option value="">Select an order...</option>
                  {orders.map((o) => {
                    const name = patientName(o.patient);
                    const testsStr = o.orderedTestItems
                      ?.map((x) => x.testDefinition?.code || x.testDefinition?.name)
                      .join(", ");
                    const code = `ORD-${o.id.replace(/-/g, "").slice(0, 3).toUpperCase()}`;
                    return (
                      <option key={o.id} value={o.id}>
                        {code} · {name} — {testsStr || "Diagnostic tests"}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Dynamic Billing Summary Box (Fixes A3, Rule 1) */}
              {loadingBilling && (
                <div style={{ fontSize: "0.85rem", color: "#64748b", margin: "8px 0" }}>
                  Calculating order billing and balance…
                </div>
              )}

              {selectedBilling && (
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    margin: "10px 0 14px",
                    fontSize: "0.86rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ color: "#64748b" }}>Order Total:</span>
                    <strong>Rs {selectedBilling.totalAmount.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ color: "#64748b" }}>Already Paid:</span>
                    <span style={{ color: "#16a34a", fontWeight: 600 }}>
                      Rs {selectedBilling.paidAmount.toLocaleString()}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderTop: "1px solid #e2e8f0",
                      paddingTop: "6px",
                      marginTop: "6px",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Remaining Balance Due:</span>
                    <strong
                      style={{
                        color: selectedBilling.remainingAmount > 0 ? "#dc2626" : "#16a34a",
                        fontSize: "0.95rem",
                      }}
                    >
                      Rs {selectedBilling.remainingAmount.toLocaleString()}
                    </strong>
                  </div>
                  {selectedBilling.remainingAmount <= 0 && (
                    <div
                      style={{
                        marginTop: "8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        color: "#16a34a",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                      }}
                    >
                      <Check size={14} />
                      <span>This order has already been paid in full.</span>
                    </div>
                  )}
                </div>
              )}

              <div className="form-group-clean">
                <label>
                  Payment Amount (Rs) <span className="required-star">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedBilling && selectedBilling.totalAmount > 0 ? selectedBilling.remainingAmount : undefined}
                  step="0.01"
                  placeholder="e.g. 1500"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
                {selectedBilling && selectedBilling.remainingAmount > 0 && (
                  <span className="field-hint">
                    Maximum payable amount capped at remaining balance of Rs {selectedBilling.remainingAmount}
                  </span>
                )}
              </div>

              <div className="form-group-clean">
                <label>Payment Date</label>
                <input
                  type="date"
                  value={form.paidAt}
                  onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
                />
              </div>

              <div className="form-group-clean">
                <label>Payment Notes / Receipt Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Paid in cash at reception"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

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
                  disabled={
                    submitting ||
                    (selectedBilling &&
                      selectedBilling.totalAmount > 0 &&
                      selectedBilling.remainingAmount <= 0)
                  }
                >
                  {submitting ? "Saving…" : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
