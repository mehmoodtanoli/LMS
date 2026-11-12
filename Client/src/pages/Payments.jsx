import { useEffect, useState, useMemo } from "react";
import { ordersApi, paymentsApi } from "../api/resources";
import { apiError } from "../api/client";
import { trackAnalyticsEvent } from "../analytics";
import { useAuth } from "../auth/AuthContext";
import { Empty, ErrorMessage, Loading, date, patientName } from "../components/Common";
import { Plus, CreditCard, Search, X, Check, ArrowDownLeft, Clock, AlertCircle, Printer } from "lucide-react";

function getInitials(name) {
  if (!name) return "PT";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function formatAmount(value) {
  const amount = Number(value);
  return value === null || value === undefined || !Number.isFinite(amount)
    ? "—"
    : `Rs ${amount.toFixed(2)}`;
}

export default function Payments() {
  const { user } = useAuth();
  const canRecordPayments = user?.role === "LAB_ADMIN" || user?.role === "SUPERADMIN";
  const canFinalizeBills = user?.role === "LAB_ADMIN";
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedBilling, setSelectedBilling] = useState(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [form, setForm] = useState({
    orderId: "",
    orderTotalAmount: "",
    amount: "",
    method: "CASH",
    paidAt: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(null);

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

  useEffect(() => {
    if (!printReceipt) return undefined;

    document.body.classList.add("printing-thermal-receipt");
    const printTimer = window.setTimeout(() => window.print(), 100);
    const handleAfterPrint = () => setPrintReceipt(null);

    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.clearTimeout(printTimer);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.body.classList.remove("printing-thermal-receipt");
    };
  }, [printReceipt]);

  const handlePrint = async (payment) => {
    setError("");
    try {
      const response = await paymentsApi.billing(payment.orderId);
      setPrintReceipt({ payment, billing: response.data.billing });
    } catch (err) {
      setError(apiError(err));
    }
  };

  const handleOrderChange = async (orderId) => {
    setForm((prev) => ({ ...prev, orderId, amount: "" }));
    setSelectedBilling(null);

    if (!orderId) return;

    setLoadingBilling(true);
    try {
      const res = await paymentsApi.billing(orderId);
      const billing = res.data.billing;
      setSelectedBilling(billing);
      if (billing && billing.remainingAmount !== null && billing.remainingAmount > 0) {
        setForm((prev) => ({ ...prev, amount: String(billing.remainingAmount) }));
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoadingBilling(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await paymentsApi.create({
        orderId: form.orderId,
        ...(selectedBilling?.totalAmount === null
          ? { orderTotalAmount: Number(form.orderTotalAmount) }
          : {}),
        amount: Number(form.amount),
        method: form.method,
        ...(form.paidAt ? { paidAt: form.paidAt } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });

      trackAnalyticsEvent("payment_received");

      setForm({
        orderId: "",
        orderTotalAmount: "",
        amount: "",
        method: "CASH",
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

  const finalizeBill = async () => {
    setError("");
    setSubmitting(true);

    try {
      const response = await ordersApi.finalizeBill(form.orderId, {
        totalAmount: Number(form.orderTotalAmount),
      });
      setSelectedBilling(response.data.billing);
      setForm((prev) => ({ ...prev, orderTotalAmount: "" }));
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
            setForm({
              orderId: "",
              orderTotalAmount: "",
              amount: "",
              method: "CASH",
              paidAt: new Date().toISOString().split("T")[0],
              notes: "",
            });
            setSelectedBilling(null);
            setIsModalOpen(true);
          }}
        >
          <Plus size={16} />
          <span>Manage Billing</span>
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
                <th>Receipt</th>
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
                    <td>
                      <button
                        type="button"
                        className="btn-secondary-action receipt-print-action"
                        onClick={() => handlePrint(payment)}
                      >
                        <Printer size={14} />
                        Print
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No payment records found.</Empty>
      )}

      {/* Unified billing modal; finalization and payment remain separate API operations. */}
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
              <h2>Manage Billing</h2>
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
                    <span style={{ color: "#64748b" }}>Final Bill Amount:</span>
                    <strong>
                      {selectedBilling.totalAmount === null
                        ? "Not finalized"
                        : `Rs ${Number(selectedBilling.totalAmount).toLocaleString()}`}
                    </strong>
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
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Remaining Balance:</span>
                    <strong
                      style={{
                        color: selectedBilling.remainingAmount === null || selectedBilling.remainingAmount > 0 ? "#dc2626" : "#16a34a",
                        fontSize: "0.95rem",
                      }}
                    >
                      {selectedBilling.remainingAmount === null
                        ? "Bill not finalized"
                        : `Rs ${Number(selectedBilling.remainingAmount).toLocaleString()}`}
                    </strong>
                  </div>
                  {selectedBilling.remainingAmount !== null && selectedBilling.remainingAmount <= 0 && (
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

                  {selectedBilling?.payments?.length > 0 && (
                    <div className="form-group-clean">
                      <label>Payment History</label>
                      <div style={{ display: "grid", gap: "6px" }}>
                        {selectedBilling.payments.map((payment) => (
                          <div
                            key={payment.id}
                            style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}
                          >
                            <span>{date(payment.paidAt)} · {payment.method || "CASH"}</span>
                            <strong>Rs {Number(payment.amount).toLocaleString()}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedBilling?.totalAmount === null && canRecordPayments && (
                    <div className="form-group-clean">
                      <label>
                        Total Bill Amount (Rs) <span className="required-star">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="0.01"
                        step="0.01"
                        value={form.orderTotalAmount}
                        onChange={(e) => setForm({ ...form, orderTotalAmount: e.target.value })}
                        placeholder="Enter the final bill amount"
                      />
                      {canFinalizeBills && (
                        <button
                          type="button"
                          className="btn-primary-action"
                          disabled={submitting || !form.orderTotalAmount}
                          onClick={finalizeBill}
                          style={{ marginTop: "8px" }}
                        >
                          {submitting ? "Finalizing…" : "Finalize Bill Without Payment"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="form-group-clean">
                <label>
                  Payment Amount (Rs) {canRecordPayments && <span className="required-star">*</span>}
                </label>
                <input
                  type="number"
                  required={canRecordPayments}
                  disabled={
                    !canRecordPayments ||
                    (selectedBilling && selectedBilling.remainingAmount !== null &&
                      selectedBilling.remainingAmount <= 0)
                  }
                  min="1"
                  max={selectedBilling?.remainingAmount !== null ? selectedBilling?.remainingAmount : undefined}
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
                <label>Payment Method</label>
                <select
                  value={form.method}
                  disabled={
                    !canRecordPayments ||
                    (selectedBilling && selectedBilling.remainingAmount !== null &&
                      selectedBilling.remainingAmount <= 0)
                  }
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="form-group-clean">
                <label>Payment Date</label>
                <input
                  type="date"
                  disabled={
                    !canRecordPayments ||
                    (selectedBilling && selectedBilling.remainingAmount !== null &&
                      selectedBilling.remainingAmount <= 0)
                  }
                  value={form.paidAt}
                  onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
                />
              </div>

              <div className="form-group-clean">
                <label>Payment Notes / Receipt Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Paid in cash at reception"
                  disabled={
                    !canRecordPayments ||
                    (selectedBilling && selectedBilling.remainingAmount !== null &&
                      selectedBilling.remainingAmount <= 0)
                  }
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="modal-actions-clean">
                {canRecordPayments && <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>}
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={
                    submitting ||
                    !canRecordPayments ||
                    !selectedBilling ||
                    (selectedBilling &&
                      selectedBilling.remainingAmount !== null &&
                      selectedBilling.remainingAmount <= 0)
                  }
                >
                  {submitting ? "Saving…" : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {printReceipt && (
        <section className="thermal-receipt" aria-label="Payment receipt">
          <header className="thermal-receipt-header">
            <h1>{printReceipt.payment.laboratory?.name || "Laboratory"}</h1>
            {printReceipt.payment.laboratory?.address && <p>{printReceipt.payment.laboratory.address}</p>}
            {(printReceipt.payment.laboratory?.phone || printReceipt.payment.laboratory?.email) && (
              <p>
                {[printReceipt.payment.laboratory.phone, printReceipt.payment.laboratory.email]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            <h2>Payment Receipt</h2>
          </header>

          <div className="thermal-receipt-meta">
            <div><span>Receipt Ref</span><strong>{printReceipt.payment.id.slice(0, 8).toUpperCase()}</strong></div>
            <div><span>Date &amp; Time</span><strong>{new Date(printReceipt.payment.paidAt).toLocaleString()}</strong></div>
            <div><span>Patient</span><strong>{patientName(printReceipt.payment.order?.patient)}</strong></div>
            <div><span>Identifier</span><strong>{printReceipt.payment.order?.patient?.cnic || "—"}</strong></div>
            <div><span>Order Ref</span><strong>ORD-{printReceipt.payment.orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}</strong></div>
          </div>

          <div className="thermal-receipt-items">
            <div className="thermal-receipt-items-heading">
              <span>Ordered test</span><span>Price</span>
            </div>
            {(printReceipt.payment.order?.orderedTestItems || []).map((item) => (
              <div className="thermal-receipt-line" key={item.id}>
                <span>
                  {item.testDefinition?.code ? `${item.testDefinition.code} - ` : ""}
                  {item.testDefinition?.name || "Diagnostic test"}
                </span>
                <strong>
                  {item.price === null || item.price === undefined || formatAmount(item.price) === "—"
                    ? "Unavailable"
                    : formatAmount(item.price)}
                </strong>
              </div>
            ))}
          </div>

          <div className="thermal-receipt-totals">
            <div><span>Finalized bill</span><strong>{formatAmount(printReceipt.billing.totalAmount)}</strong></div>
            <div><span>This payment</span><strong>{formatAmount(printReceipt.payment.amount)}</strong></div>
            <div><span>Total paid</span><strong>{formatAmount(printReceipt.billing.paidAmount)}</strong></div>
            <div><span>Remaining balance</span><strong>{formatAmount(printReceipt.billing.remainingAmount)}</strong></div>
            <div><span>Payment method</span><strong>{printReceipt.payment.method || "CASH"}</strong></div>
          </div>

          {printReceipt.payment.receivedBy && (
            <div className="thermal-receipt-line">
              <span>Received by</span><strong>{printReceipt.payment.receivedBy}</strong>
            </div>
          )}
          {printReceipt.payment.notes && (
            <div className="thermal-receipt-line">
              <span>Reference</span><strong>{printReceipt.payment.notes}</strong>
            </div>
          )}
          <footer className="thermal-receipt-footer">Thank you</footer>
        </section>
      )}
    </div>
  );
}
