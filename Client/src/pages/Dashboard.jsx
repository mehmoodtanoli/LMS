import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FileText, Package, LineChart, FileTerminal, AlertTriangle } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";

const chartData1 = [
  { name: 'A', value: 200 }, { name: 'B', value: 230 }, { name: 'C', value: 210 }, 
  { name: 'D', value: 250 }, { name: 'E', value: 247 }
];
const chartData2 = [
  { name: 'A', value: 45 }, { name: 'B', value: 42 }, { name: 'C', value: 48 }, 
  { name: 'D', value: 35 }, { name: 'E', value: 39 }
];
const chartData3 = [
  { name: 'A', value: 15000 }, { name: 'B', value: 16500 }, { name: 'C', value: 16000 }, 
  { name: 'D', value: 18000 }, { name: 'E', value: 18450.50 }
];
const chartData4 = [
  { name: 'A', value: 1000 }, { name: 'B', value: 1100 }, { name: 'C', value: 1050 }, 
  { name: 'D', value: 1150 }, { name: 'E', value: 1214 }
];

const pendingOrders = [
  { id: "L-09123", patient: "Emily Carter", test: "CBC & Lipid Panel", status: "Awaiting Sample", priority: "High", due: "24 Oct 2023 11:30" },
  { id: "L-09122", patient: "Mark Johnson", test: "HbA1c, BMP", status: "Processing", priority: "Normal", due: "24 Oct 2023 14:15" },
  { id: "L-09121", patient: "Sophia Lee", test: "Thyroid Panel", status: "Awaiting Sample", priority: "Normal", due: "24 Oct 2023 16:00" },
  { id: "L-09120", patient: "James Davis", test: "Liver Function", status: "Analyzing", priority: "High", due: "23 Oct 2023 09:00" },
  { id: "L-09119", patient: "Olivia Brown", test: "Urine Culture", status: "Awaiting Sample", priority: "Urgent", due: "24 Oct 2023 10:45" },
];

const overdueOrders = [
  { id: "L-09095", patient: "Daniel Kim", due: "23 Oct 09:30", days: "1 Day Late" },
  { id: "L-09091", patient: "Jessica Chen", due: "22 Oct 15:45", days: "2 Days Late" },
];

export default function Dashboard() {
  return (
    <div className="dashboard-grid">
      <header className="page-header" style={{ marginBottom: 0 }}>
        <h1>Dashboard</h1>
      </header>

      {/* Quick Actions */}
      <section className="panel" style={{ marginBottom: 0 }}>
        <div className="quick-actions-bar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="panel-title">Quick Actions</h2>
              <select className="quick-actions-search">
                <option>All Search Actions</option>
              </select>
            </div>
            
            <div className="quick-actions-btns">
              <Link to="/patients/new" className="btn btn-primary">
                <Plus size={16} /> Register Patient
              </Link>
              <Link to="/orders/new" className="btn btn-primary" style={{ backgroundColor: '#3b82f6' }}>
                <FileText size={16} /> Create Order
              </Link>
              <button className="btn btn-outline">
                <Package size={16} /> Dispatch Samples
              </button>
              <button className="btn btn-outline">
                <LineChart size={16} /> Access Reports
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Stats */}
      <section>
        <h2 className="panel-title" style={{ marginBottom: '16px' }}>Dynamic Stats</h2>
        <div className="dynamic-stats">
          <div className="stat-box">
            <div className="icon blue-icon">
              <FileTerminal size={24} />
            </div>
            <div className="stat-info">
              <span className="label">Pending Tests</span>
              <span className="value">2,77 <span className="trend-badge trend-up">+8%</span></span>
            </div>
          </div>
          
          <div className="stat-box">
            <div className="icon warning-icon">
              <AlertTriangle size={24} />
            </div>
            <div className="stat-info">
              <span className="label">Overdue Alerts Today</span>
              <span className="value">1,214 <span className="trend-badge trend-down">-5%</span></span>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Grid */}
      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="label">Pending Tests</span>
            <span className="trend-badge trend-up">+8%</span>
          </div>
          <div className="metric-value">247</div>
          <div className="metric-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData1}>
                <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f633" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-header">
            <span className="label">Overdue Orders</span>
            <span className="trend-badge trend-down">-5%</span>
          </div>
          <div className="metric-value">39</div>
          <div className="metric-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData2}>
                <Area type="monotone" dataKey="value" stroke="#f59e0b" fill="#f59e0b33" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-header">
            <span className="label">Today's Revenue</span>
            <span className="trend-badge trend-up">+12%</span>
          </div>
          <div className="metric-value">$18,450.50</div>
          <div className="metric-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData3}>
                <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-header">
            <span className="label">Samples Received Today</span>
            <span className="trend-badge trend-up">+15%</span>
          </div>
          <div className="metric-value">1,214</div>
          <div className="metric-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData4}>
                <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f633" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Tables Grid */}
      <section className="tables-grid">
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px' }}>
            <h2 className="panel-title" style={{ marginBottom: '16px' }}>Pending Tests & Orders</h2>
            <div className="table-filters">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '8px' }}>Active Filters:</span>
              <span className="filter-badge">Today</span>
              <span className="filter-badge">All Labs</span>
              <span className="filter-badge">Pending Status</span>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Patient Name</th>
                <th>Test Type</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingOrders.map((order, i) => (
                <tr key={i}>
                  <td>{order.id}</td>
                  <td>{order.patient}</td>
                  <td>{order.test}</td>
                  <td>
                    <span className={`badge ${order.status === 'Awaiting Sample' ? 'badge-warning' : order.status === 'Processing' ? 'badge-primary' : 'badge-success'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>{order.priority}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{order.due.split(' ')[0]} {order.due.split(' ')[1]} {order.due.split(' ')[2]}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{order.due.split(' ')[3]}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <a href="#" style={{ fontSize: '0.75rem' }}>[Track]</a>
                      <a href="#" style={{ fontSize: '0.75rem' }}>[Details]</a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px' }}>
            <h2 className="panel-title">Overdue Orders (Past 24H)</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Patient</th>
                <th>Due</th>
                <th>Days Late</th>
              </tr>
            </thead>
            <tbody>
              {overdueOrders.map((order, i) => (
                <tr key={i}>
                  <td>{order.id}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{order.patient.split(' ')[0]}</span>
                      <span>{order.patient.split(' ')[1]}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{order.due.split(' ')[0]} {order.due.split(' ')[1]}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{order.due.split(' ')[2]}</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-warning" style={{ backgroundColor: '#c2410c', color: 'white' }}>
                      {order.days}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
