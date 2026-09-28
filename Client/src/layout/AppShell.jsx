import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  Activity,
  LayoutDashboard,
  Users,
  ClipboardList,
  TestTube2,
  Receipt,
  FileBarChart,
  Package,
  Search,
  MessageSquare,
  Bell,
  Settings,
} from "lucide-react";

const links = [
  ["/", "Dashboard", LayoutDashboard],
  ["/patients", "Patients", Users],
  ["/orders", "Orders", ClipboardList],
  ["/tests", "Tests", TestTube2],
  ["/billing", "Billing", Receipt],
  ["/reports", "Reports", FileBarChart],
  ["/inventory", "Inventory", Package],
];

const adminLinks = [
  ["/admin/laboratories", "Laboratories", Activity],
  ["/admin/users", "Users", Users],
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          <Activity className="brand-icon" size={28} />
          <span>MEDI-LAB <br/><small style={{fontSize: '0.65em', color: 'var(--text-secondary)'}}>LIMS</small></span>
        </div>

        <nav aria-label="Main navigation">
          {links.map(([to, label, Icon]) => (
            <NavLink
              end={to === "/"}
              to={to}
              key={to}
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}

          {user?.role === "SUPERADMIN" &&
            adminLinks.map(([to, label, Icon]) => (
              <NavLink to={to} key={to}>
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
        </nav>
      </aside>

      <main>
        <header className="workspace-topbar">
          <div className="topbar-search">
            <Search size={20} />
            <input type="text" placeholder="Search" />
          </div>

          <div className="topbar-actions">
            <button className="topbar-icon-btn">
              <MessageSquare size={20} />
            </button>
            <button className="topbar-icon-btn">
              <Bell size={20} />
              <span className="notification-badge">3</span>
            </button>
            
            <div className="workspace-user">
              <img 
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face" 
                alt="User Avatar" 
                className="user-avatar"
              />
              <div className="user-info">
                <span className="user-name">Dr. Sarah Chen</span>
                <span className="user-role">admin</span>
              </div>
            </div>
            
            <button className="topbar-icon-btn" onClick={() => { logout(); navigate("/login"); }}>
              <Settings size={20} />
            </button>
          </div>
        </header>

        <div className="workspace-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
