import { useEffect, useState, useMemo } from "react";
import { ordersApi, paymentsApi } from "../api/resources";
import { apiError } from "../api/client";
import { Empty, ErrorMessage, Loading, date, patientName } from "../components/Common";
import { Plus, CreditCard, Search, X, Check, ArrowDownLeft, Clock } from "lucide-react";

function getInitials(name) {
  if (!name) return "PT";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({
    orderId: "",
    amount: "",
    status: "PAID",
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

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await paymentsApi.create({
        orderId: form.orderId,
        amount: form.amount,
        status: form.status,
        ...(form.paidAt ? { paidAt: form.paidAt } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      setForm({
        orderId: "",
        amount: "",
        status: "PAID",
        paidAt: new Date().toISOString().split("T")[0],
        notes: "",
      });
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
          onClick={() => setIsModalOpen(true)}
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
                const isPaid = payment.status === "PAID";

                return (
                  <tr key={payment.id}>
                    <td className="cell-patient">
                      <div className="patient-avatar-box">
                        <span className="patient-avatar-circle">{initials}</span>
                        <div className="patient-info">
                          <span className="patient-name">{pName}</span>
                          <span className="patient-cnic">
                            {payment.order?.patient?.cnic || "35201-1234567-1"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="cell-order-num">{orderCode}</td>

                    <td className="cell-amount">
                      <span className="amount-val">
                        Rs {Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>

                    <td className="cell-status">
                      <span
                        className={`status-pill ${
                          isPaid ? "status-badge-finalized" : "status-badge-pending"
                        }`}
                      >
                        {payment.status?.replace("_", " ")}
                      </span>
                    </td>

                    <td className="cell-created">{date(payment.paidAt)}</td>

                    <td className="cell-demographics">{payment.notes || "—"}</td>
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
                  onChange={(e) => setForm({ ...form, orderId: e.target.value })}
                >
                  <option value="">Select an order...</option>
                  {orders.map((o) => {
                    const name = patientName(o.patient);
                    const testsStr = o.orderedTestItems
                      ?.map((x) => x.testDefinition?.code || x.testDefinition?.name)
                      .join(", ");
                    return (
                      <option key={o.id} value={o.id}>
                        {name} — {testsStr || "Diagnostic tests"}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group-clean">
                <label>Amount (Rs) <span className="required-star">*</span></label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  placeholder="e.g. 1500"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>

              <div className="form-group-clean">
                <label>Payment Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="PAID">PAID</option>
                  <option value="UNPAID">UNPAID</option>
                  <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                  <option value="REFUNDED">REFUNDED</option>
                </select>
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
                <label>Notes</label>
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
                  disabled={submitting}
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
