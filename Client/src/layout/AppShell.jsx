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
  const laboratory =
    user?.role === "SUPERADMIN" ? null : user?.laboratory || null;
  const laboratoryLogo = laboratory?.logo || laboratory?.logoUrl;
  const laboratoryAddress = laboratory?.address;
  const laboratoryContact = laboratory?.phone || laboratory?.contactNumber;
  const laboratoryEmail = laboratory?.email || laboratory?.contactEmail;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        {/* Brand Header */}
        <div className="brand">
          <div className="brand-icon-box" style={{ background: "#0e2c4d", border: "1px solid rgba(56, 189, 248, 0.25)" }}>
            {laboratoryLogo ? (
              <img
                src={laboratoryLogo}
                alt=""
                style={{ width: "24px", height: "24px", objectFit: "contain" }}
              />
            ) : (
              <Activity size={24} color="#38bdf8" />
            )}
          </div>
          <div className="brand-text">
            <span className="brand-title">
              {laboratory?.name || "Laboratory Management System"}
            </span>
            <span className="brand-subtitle">Simplifying Laboratory Management</span>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          {links
            .filter(([to]) => {
              if (user?.role === "LAB_TECH") {
                return to === "/" || to === "/results" || to === "/orders";
              }
              return true;
            })
            .map(([to, label, Icon]) => (
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

          {(user?.role === "SUPERADMIN" || user?.role === "LAB_ADMIN") && (
            <div className="nav-group">
              <span className="nav-group-title">Administration</span>
              {user?.role === "SUPERADMIN" && (
                <NavLink
                  to="/admin/laboratories"
                  className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                >
                  <Activity size={18} className="nav-icon" />
                  <span>Laboratories</span>
                </NavLink>
              )}
              <NavLink
                to="/admin/users"
                className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              >
                <Users size={18} className="nav-icon" />
                <span>Users</span>
              </NavLink>
              <NavLink
                to="/admin/tests"
                className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              >
                <TestTube2 size={18} className="nav-icon" />
                <span>Tests Catalog</span>
              </NavLink>
            </div>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {(laboratoryAddress || laboratoryContact || laboratoryEmail) && (
            <div className="sidebar-address">
              {laboratoryAddress && <p>{laboratoryAddress}</p>}
              {(laboratoryContact || laboratoryEmail) && (
                <p>
                  {laboratoryContact && `Contact: ${laboratoryContact}`}
                  {laboratoryContact && laboratoryEmail && " · "}
                  {laboratoryEmail}
                </p>
              )}
            </div>
          )}

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
