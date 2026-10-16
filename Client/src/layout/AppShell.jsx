import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  FlaskConical,
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  CreditCard,
  TestTube2,
  Activity,
  LogOut,
  ShieldAlert,
} from "lucide-react";

const links = [
  ["/", "Dashboard", LayoutDashboard],
  ["/patients", "Patients", Users],
  ["/orders", "Test Orders", ClipboardList],
  ["/results", "Result Entry", FlaskConical],
  ["/reports", "Reports", FileText],
  ["/payments", "Payments", CreditCard],
];

const adminLinks = [
  ["/admin/laboratories", "Laboratories", Activity],
  ["/admin/users", "Users", Users],
  ["/admin/tests", "Tests Catalog", TestTube2],
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const userDisplayName = user?.name || user?.email?.split("@")[0] || "Staff Member";
  const userInitials = (userDisplayName || "US")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        {/* Brand Header */}
        <div className="brand">
          <div className="brand-icon-box">
            <FlaskConical size={20} className="brand-icon" />
          </div>
          <div className="brand-text">
            <span className="brand-title">City Diagnostics</span>
            <span className="brand-subtitle">Laboratory Management</span>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          {links.map(([to, label, Icon]) => (
            <NavLink
              end={to === "/"}
              to={to}
              key={to}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              <Icon size={18} className="nav-icon" />
              <span>{label}</span>
            </NavLink>
          ))}

          {user?.role === "SUPERADMIN" && (
            <div className="nav-group">
              <span className="nav-group-title">Administration</span>
              {adminLinks.map(([to, label, Icon]) => (
                <NavLink
                  to={to}
                  key={to}
                  className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                >
                  <Icon size={18} className="nav-icon" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-address">
            <p>64-G, Gulberg III, Lahore, Pakistan</p>
            <p>+92 42 3555 1234</p>
          </div>

          <div className="sidebar-user">
            <div className="user-avatar-badge" title={user?.email}>
              {userInitials}
            </div>
            <div className="user-details">
              <span className="user-name">{userDisplayName}</span>
              <span className="user-role-badge">
                {user?.role?.toLowerCase() || "operator"}
              </span>
            </div>
            <button
              className="sidebar-logout-btn"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="workspace-main">
        <div className="workspace-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
