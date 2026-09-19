import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const links = [["/", "Dashboard"], ["/patients", "Patients"], ["/orders", "Test orders"], ["/results", "Results"], ["/reports", "Reports"], ["/payments", "Payments"]];

export default function AppShell() {
  const { user, logout } = useAuth(); const navigate = useNavigate();
  const context = user.role === "SUPERADMIN" ? "All laboratories" : user.laboratory?.name || "Your laboratory";
  return <div className="app-shell"><aside><div className="brand">LMS <small>Laboratory management</small></div><nav aria-label="Main navigation">{links.map(([to, label]) => <NavLink end={to === "/"} to={to} key={to}>{label}</NavLink>)}</nav></aside><main><header className="workspace-topbar"><span>{context}</span><div className="workspace-user"><strong>{user.email}</strong><button className="link" onClick={() => { logout(); navigate("/login"); }}>Log out</button></div></header><div className="workspace-content"><Outlet /></div></main></div>;
}
