import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ordersApi, patientsApi, paymentsApi, reportsApi, resultsApi } from "../api/resources";
import { apiError } from "../api/client";
import { ErrorMessage, Loading } from "../components/Common";

const all = { page: 1, limit: 100 };
const today = (value) => { const date = new Date(value); const now = new Date(); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate(); };

export default function Dashboard() {
  const [data, setData] = useState(null); const [error, setError] = useState("");
  useEffect(() => { Promise.all([patientsApi.list(all), ordersApi.list(all), resultsApi.list(all), reportsApi.list(all), paymentsApi.list(all)]).then(([patients, orders, results, reports, payments]) => setData({ patients: patients.data.patients, orders: orders.data.orders, results: results.data.results, reports: reports.data.reports, payments: payments.data.payments })).catch((e) => setError(apiError(e))); }, []);
  if (error) return <ErrorMessage error={error} />; if (!data) return <Loading text="Loading dashboard…" />;
  const stats = [
    ["Patients today", data.patients.filter((patient) => today(patient.createdAt)).length, "/patients"],
    ["Pending orders", data.orders.filter((order) => order.status === "PENDING").length, "/orders"],
    ["Results waiting", data.results.filter((result) => ["PENDING", "IN_PROGRESS"].includes(result.status)).length, "/results"],
    ["Reports finalized", data.reports.filter((report) => report.status === "FINAL").length, "/reports"],
    ["Unpaid / partial", data.payments.filter((payment) => ["UNPAID", "PARTIALLY_PAID"].includes(payment.status)).length, "/payments"],
  ];
  return <><header className="page-header"><div><h1>Dashboard</h1><p>Today’s overview</p></div><Link className="button" to="/patients/new">New patient</Link></header><section className="metrics">{stats.map(([label, value, to]) => <Link key={label} to={to}><strong>{value}</strong><span>{label}</span></Link>)}</section><section className="panel"><div className="panel-heading"><h2>Shortcuts</h2></div><div className="page-actions"><Link className="button secondary" to="/patients">Patients</Link><Link className="button secondary" to="/orders">Test orders</Link><Link className="button secondary" to="/results">Results</Link><Link className="button secondary" to="/reports">Reports</Link><Link className="button secondary" to="/payments">Payments</Link></div></section></>;
}
