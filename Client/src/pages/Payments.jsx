import { useEffect, useState } from "react";

import { ordersApi, paymentsApi } from "../api/resources";

import { apiError } from "../api/client";

import {
  Empty,
  ErrorMessage,
  Loading,
  Status,
  date,
  patientName,
} from "../components/Common";

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function calculateBilling(order) {
  const totalAmount = (order.orderedTestItems || []).reduce(
    (sum, item) => sum + toNumber(item.price),
    0,
  );

  const paidAmount = (order.payments || [])
    .filter((payment) => payment.status !== "REFUNDED")
    .reduce((sum, payment) => sum + toNumber(payment.amount), 0);

  const remainingAmount = Math.max(totalAmount - paidAmount, 0);

  let paymentStatus = "UNPAID";

  if (paidAmount >= totalAmount && totalAmount > 0) {
    paymentStatus = "PAID";
  } else if (paidAmount > 0) {
    paymentStatus = "PARTIALLY_PAID";
  }

  return {
    totalAmount,
    paidAmount,
    remainingAmount,
    paymentStatus,
  };
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({
    orderId: "",
    amount: "",
    status: "UNPAID",
    paidAt: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [printPayment, setPrintPayment] = useState(null);

  const load = () => {
    setLoading(true);

    Promise.all([
      paymentsApi.list({ page: 1, limit: 100 }),
      ordersApi.list({ page: 1, limit: 100 }),
    ])
      .then(([p, o]) => {
        setPayments(p.data.payments);
        setOrders(o.data.orders);
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (!printPayment) {
      return undefined;
    }

    const printTimer = window.setTimeout(() => {
      window.print();
    }, 100);

    const handleAfterPrint = () => {
      setPrintPayment(null);
    };

    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.clearTimeout(printTimer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printPayment]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

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
        status: "UNPAID",
        paidAt: "",
        notes: "",
      });

      load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const handlePrint = (payment) => {
    setPrintPayment(payment);
  };

  const billing = printPayment ? calculateBilling(printPayment.order) : null;

  return (
    <>
      <header className="page-header no-print">
        <div>
          <h1>Payments</h1>
          <p>Record payment entries against a test order.</p>
        </div>
      </header>

      <div className="no-print">
        <ErrorMessage error={error} />

        <form className="panel form-grid" onSubmit={submit}>
          <h2 className="full">Record payment</h2>

          <label className="full">
            Order
            <select
              required
              value={form.orderId}
              onChange={(e) => setForm({ ...form, orderId: e.target.value })}
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
            Amount
            <input
              required
              min="0.01"
              step="0.01"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </label>

          <label>
            Status
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option>UNPAID</option>
              <option>PARTIALLY_PAID</option>
              <option>PAID</option>
              <option>REFUNDED</option>
            </select>
          </label>

          <label>
            Paid date
            <input
              type="date"
              value={form.paidAt}
              onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
            />
          </label>

          <label>
            Notes
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>

          <div className="full">
            <button>Save payment</button>
          </div>
        </form>

        {loading ? (
          <Loading />
        ) : payments.length ? (
          <section className="panel">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Paid on</th>
                  <th>Notes</th>
                  <th>Print</th>
                </tr>
              </thead>

              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{patientName(payment.order.patient)}</td>

                    <td>{toNumber(payment.amount).toFixed(2)}</td>

                    <td>
                      <Status value={payment.status} />
                    </td>

                    <td>{date(payment.paidAt)}</td>

                    <td>{payment.notes || "—"}</td>

                    <td>
                      <button
                        type="button"
                        className="secondary print-button"
                        onClick={() => handlePrint(payment)}
                      >
                        Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <Empty>No payments recorded.</Empty>
        )}
      </div>

      {printPayment && billing && (
        <div className="thermal-receipt">
          <div className="thermal-receipt-header">
            <h1>{printPayment.laboratory?.name || "Laboratory"}</h1>
            <p>Payment Receipt</p>
          </div>

          <div className="thermal-receipt-meta">
            <div>
              <span>Patient</span>
              <strong>{patientName(printPayment.order.patient)}</strong>
            </div>

            {printPayment.order.patient?.cnic && (
              <div>
                <span>CNIC</span>
                <strong>{printPayment.order.patient.cnic}</strong>
              </div>
            )}

            <div>
              <span>Order</span>
              <strong>{printPayment.order.id.slice(0, 8)}</strong>
            </div>

            <div>
              <span>Date</span>
              <strong>{date(printPayment.paidAt)}</strong>
            </div>
          </div>

          <div className="thermal-receipt-section">
            <div className="thermal-receipt-title">
              <span>Test</span>
              <span>Amount</span>
            </div>

            {printPayment.order.orderedTestItems.map((item) => (
              <div className="thermal-receipt-row" key={item.id}>
                <span>
                  {item.testDefinition.code
                    ? `${item.testDefinition.code} - `
                    : ""}
                  {item.testDefinition.name}
                </span>

                <strong>{toNumber(item.price).toFixed(2)}</strong>
              </div>
            ))}
          </div>

          <div className="thermal-receipt-totals">
            <div>
              <span>Total</span>
              <strong>{billing.totalAmount.toFixed(2)}</strong>
            </div>

            <div>
              <span>Paid</span>
              <strong>{billing.paidAmount.toFixed(2)}</strong>
            </div>

            <div>
              <span>Remaining</span>
              <strong>{billing.remainingAmount.toFixed(2)}</strong>
            </div>

            <div className="thermal-receipt-status">
              <span>Status</span>
              <strong>{billing.paymentStatus}</strong>
            </div>
          </div>

          <div className="thermal-receipt-payment">
            <div>
              <span>This payment</span>
              <strong>{toNumber(printPayment.amount).toFixed(2)}</strong>
            </div>

            {printPayment.notes && (
              <div>
                <span>Notes</span>
                <strong>{printPayment.notes}</strong>
              </div>
            )}
          </div>

          <div className="thermal-receipt-footer">
            <p>Thank you</p>
          </div>
        </div>
      )}
    </>
  );
}
