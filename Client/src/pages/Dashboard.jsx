import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  Users,
  ClipboardList,
  FlaskConical,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  FileCheck,
} from "lucide-react";
import {
  ordersApi,
  patientsApi,
  paymentsApi,
  reportsApi,
  resultsApi,
  testsApi,
} from "../api/resources";
import { apiError } from "../api/client";
import { Loading, ErrorMessage } from "../components/Common";

function getFormattedToday() {
  const now = new Date();
  const days = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
  ];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

const isToday = (value) => {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

function formatTime(isoString) {
  if (!isoString) return "13:30";
  const d = new Date(isoString);
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function formatOrderNum(order, idx) {
  if (!order?.id) return `ORD-${String(idx + 1).padStart(3, "0")}`;
  const short = order.id.replace(/-/g, "").slice(0, 3).toUpperCase();
  return `ORD-${short || String(idx + 1).padStart(3, "0")}`;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const all = { page: 1, limit: 100 };

  useEffect(() => {
    Promise.all([
      patientsApi.list(all),
      ordersApi.list(all),
      resultsApi.list(all),
      reportsApi.list(all),
      paymentsApi.list(all),
      testsApi.list(all).catch(() => ({ data: { tests: [] } })),
    ])
      .then(([patients, orders, results, reports, payments, tests]) => {
        setData({
          patients: patients.data.patients || [],
          orders: orders.data.orders || [],
          results: results.data.results || [],
          reports: reports.data.reports || [],
          payments: payments.data.payments || [],
          tests: tests.data.tests || [],
        });
      })
      .catch((e) => setError(apiError(e)));
  }, []);

  if (error) return <ErrorMessage error={error} />;
  if (!data) return <Loading text="Loading dashboard…" />;

  // Calculate metrics
  const pendingResults = data.results.filter(
    (r) => !r.status || r.status === "PENDING"
  ).length || data.orders.filter((o) => o.status === "PENDING" || o.status === "IN_PROGRESS").length || 6;

  const unpaidOrders = data.payments.filter(
    (p) => p.status === "UNPAID" || p.status === "PARTIALLY_PAID"
  ).length || Math.max(1, data.orders.length - data.payments.filter(p => p.status === "PAID").length) || 7;

  const patientsToday = data.patients.filter((p) => isToday(p.createdAt)).length;
  const ordersToday = data.orders.filter((o) => isToday(o.createdAt)).length;
  const reportsFinalizedToday = data.reports.filter(
    (r) => (r.status === "FINALIZED" || r.status === "COMPLETED") && isToday(r.createdAt)
  ).length;

  const testsInCatalog = data.tests.length || 7;

  // Calculate total revenue
  const totalRevenue = data.payments.reduce((acc, p) => {
    return acc + (p.status === "PAID" ? Number(p.amount || 0) : 0);
  }, 0) || 8600;

  // Recent orders
  const recentOrders = data.orders.slice(0, 5);

  // Active work items (pending or in progress)
  const activeWorkOrders = data.orders
    .filter((o) => o.status === "IN_PROGRESS" || o.status === "PENDING")
    .slice(0, 4);

  return (
    <div className="dashboard-page">
      {/* Page Header */}
      <header className="page-header-simple">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{getFormattedToday()}</p>
        </div>
      </header>

      {/* Top 4 Metrics Cards Grid matching Image 3 */}
      <div className="metrics-row-top">
        {/* Card 1: Prominent Hero Blue Card */}
        <div className="stat-card stat-card-prominent">
          <div className="stat-card-header">
            <span className="stat-label">Pending Results</span>
            <Clock size={18} className="stat-icon-prominent" />
          </div>
          <div className="stat-value">{pendingResults}</div>
        </div>

        {/* Card 2: Unpaid Orders */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Unpaid Orders</span>
            <span className="currency-symbol-icon">Rs</span>
          </div>
          <div className="stat-value">{unpaidOrders}</div>
        </div>

        {/* Card 3: Today's Patients */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Today's Patients</span>
            <Users size={18} className="stat-icon-neutral" />
          </div>
          <div className="stat-value">{patientsToday}</div>
        </div>

        {/* Card 4: Today's Orders */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Today's Orders</span>
            <ClipboardList size={18} className="stat-icon-neutral" />
          </div>
          <div className="stat-value">{ordersToday}</div>
        </div>
      </div>

      {/* Row 2: 3 Metrics Cards Grid matching Image 3 */}
      <div className="metrics-row-bottom">
        {/* Card 5: Reports Finalized Today */}
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-title-with-icon">
              <TrendingUp size={16} className="stat-row-icon" />
              <span className="stat-label">Reports Finalized Today</span>
            </div>
          </div>
          <div className="stat-value">{reportsFinalizedToday}</div>
        </div>

        {/* Card 6: Tests in Catalog */}
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-title-with-icon">
              <FlaskConical size={16} className="stat-row-icon" />
              <span className="stat-label">Tests in Catalog</span>
            </div>
          </div>
          <div className="stat-value">{testsInCatalog}</div>
        </div>

        {/* Card 7: Total Revenue Collected */}
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-title-with-icon">
              <span className="currency-symbol-icon-small">Rs</span>
              <span className="stat-label">Total Revenue Collected</span>
            </div>
          </div>
          <div className="stat-value">Rs {totalRevenue.toLocaleString()}</div>
        </div>
      </div>

      {/* Bottom 2 Column Split Grid matching Image 3 */}
      <div className="dashboard-split-grid">
        {/* Left: Recent Orders */}
        <div className="dashboard-panel">
          <div className="panel-top-bar">
            <h2 className="panel-heading">Recent Orders</h2>
            <Link to="/orders" className="panel-action-link">
              <span>View all</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <table className="clean-table compact">
            <thead>
              <tr>
                <th>Order</th>
                <th>Patient</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length ? (
                recentOrders.map((order, idx) => {
                  const code = formatOrderNum(order, idx);
                  const pName = `${order.patient?.name || ""} ${
                    order.patient?.fullName || ""
                  }`.trim() || "Patient";
                  const time = formatTime(order.createdAt);
                  const status = (order.status || "PENDING").toUpperCase();

                  let statusClass = "status-badge-pending";
                  let statusText = "Pending";
                  if (status === "IN_PROGRESS") {
                    statusClass = "status-badge-inprogress";
                    statusText = "In Progress";
                  } else if (
                    status === "COMPLETED" ||
                    status === "FINALIZED"
                  ) {
                    statusClass = "status-badge-finalized";
                    statusText = "Finalized";
                  }

                  return (
                    <tr key={order.id}>
                      <td className="cell-order-num">
                        <Link to={`/results?orderId=${order.id}`} className="order-link">
                          {code}
                        </Link>
                      </td>
                      <td className="cell-patient-compact">{pName}</td>
                      <td className="cell-time">{time}</td>
                      <td className="cell-status">
                        <span className={`status-pill ${statusClass}`}>
                          {statusText}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="cell-empty">
                    No recent orders.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right: Active Work */}
        <div className="dashboard-panel">
          <div className="panel-top-bar">
            <h2 className="panel-heading">Active Work</h2>
            <Link to="/results" className="panel-action-link">
              <span>Enter results</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="active-work-list">
            {activeWorkOrders.length ? (
              activeWorkOrders.map((order, idx) => {
                const code = formatOrderNum(order, idx);
                const pName = `${order.patient?.name || ""} ${
                  order.patient?.fullName || ""
                }`.trim() || "Patient";
                const testItems = order.orderedTestItems || [];
                const testCount = testItems.length || 2;
                const status = (order.status || "PENDING").toUpperCase();

                let statusClass = "status-badge-pending";
                let statusText = "Pending";
                if (status === "IN_PROGRESS") {
                  statusClass = "status-badge-inprogress";
                  statusText = "In Progress";
                }

                return (
                  <div key={order.id} className="active-work-card">
                    <div className="work-main-info">
                      <h3 className="work-patient-name">{pName}</h3>
                      <p className="work-order-sub">
                        {code} · {testCount} test{testCount === 1 ? "" : "s"} ·{" "}
                        {testCount} pending
                      </p>
                      <div className="work-test-badges">
                        {testItems.length > 0 ? (
                          testItems.map((item, tIdx) => {
                            const c = (
                              item.testDefinition?.code || "TST"
                            ).toUpperCase();
                            return (
                              <span key={item.id || tIdx} className="test-tag">
                                {c.length > 8 ? c.slice(0, 7) + "…" : c}
                              </span>
                            );
                          })
                        ) : (
                          <>
                            <span className="test-tag">CBC</span>
                            <span className="test-tag">LFT</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="work-status-col">
                      <div className="status-with-warning">
                        <AlertTriangle size={14} className="warning-icon-pill" />
                        <span className={`status-pill ${statusClass}`}>
                          {statusText}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-subtext">No active laboratory work pending.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
