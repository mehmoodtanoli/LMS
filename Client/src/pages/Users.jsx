import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { adminUsersApi, laboratoriesApi } from "../api/resources";
import { apiError } from "../api/client";
import { Empty, ErrorMessage, Loading, Status } from "../components/Common";

export default function Users() {
  const [users, setUsers] = useState([]), [search, setSearch] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); adminUsersApi.list({ page: 1, limit: 100 }).then((r) => setUsers(r.data.users)).catch((e) => setError(apiError(e))).finally(() => setLoading(false)); }; useEffect(load, []);
  const toggle = async (user) => { try { await adminUsersApi.setStatus(user.id, !user.isActive); load(); } catch (e) { setError(apiError(e)); } };
  const filtered = users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()));
  return <><header className="page-header"><div><h1>Users</h1><p>Manage Super Admin and Lab Admin accounts.</p></div><Link className="button" to="/admin/users/new">New user</Link></header><ErrorMessage error={error} /><input className="search" placeholder="Search users by email" value={search} onChange={(e) => setSearch(e.target.value)} />{loading ? <Loading /> : filtered.length ? <section className="panel"><table><thead><tr><th>Email</th><th>Role</th><th>Laboratory</th><th>Status</th><th /></tr></thead><tbody>{filtered.map((u) => <tr key={u.id}><td><Link to={`/admin/users/${u.id}`}>{u.email}</Link></td><td>{u.role}</td><td>{u.laboratory?.name || "—"}</td><td><Status value={u.isActive ? "ACTIVE" : "INACTIVE"} /></td><td className="actions"><Link to={`/admin/users/${u.id}/edit`}>Edit</Link><button className="link" onClick={() => toggle(u)}>{u.isActive ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></section> : <Empty>No matching users.</Empty>}</>;
}

const blank = { email: "", password: "", role: "LAB_ADMIN", laboratoryId: "" };

export function UserForm() {
  const { id } = useParams(), navigate = useNavigate();
  const [form, setForm] = useState(blank), [laboratories, setLaboratories] = useState([]), [error, setError] = useState(""), [busy, setBusy] = useState(Boolean(id));
  useEffect(() => { laboratoriesApi.list({ page: 1, limit: 100 }).then((r) => setLaboratories(r.data.laboratories)); }, []);
  useEffect(() => { if (id) adminUsersApi.get(id).then((r) => setForm({ ...blank, email: r.data.user.email, role: r.data.user.role, laboratoryId: r.data.user.laboratoryId || "" })).catch((e) => setError(apiError(e))).finally(() => setBusy(false)); }, [id]);
  const submit = async (e) => {
    e.preventDefault(); setError(""); setBusy(true);
    const data = { email: form.email, role: form.role, laboratoryId: form.role === "LAB_ADMIN" ? form.laboratoryId : undefined };
    if (!id || form.password) data.password = form.password;
    try { const response = id ? await adminUsersApi.update(id, data) : await adminUsersApi.create(data); navigate(`/admin/users/${response.data.user.id}`); } catch (err) { setError(apiError(err)); } finally { setBusy(false); }
  };
  if (busy && id) return <Loading />;
  return <><header className="page-header"><div><h1>{id ? "Edit user" : "New user"}</h1></div></header><form className="panel form-grid" onSubmit={submit}><ErrorMessage error={error} /><label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>{id ? "New password (optional)" : "Password"}<input required={!id} type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label><label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="LAB_ADMIN">LAB_ADMIN</option><option value="SUPERADMIN">SUPERADMIN</option></select></label>{form.role === "LAB_ADMIN" && <label>Laboratory<select required value={form.laboratoryId} onChange={(e) => setForm({ ...form, laboratoryId: e.target.value })}><option value="">Select a laboratory</option>{laboratories.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}<div className="full"><button disabled={busy}>{busy ? "Saving…" : "Save user"}</button></div></form></>;
}

export function UserDetail() {
  const { id } = useParams(); const [user, setUser] = useState(null), [error, setError] = useState("");
  const load = () => adminUsersApi.get(id).then((r) => setUser(r.data.user)).catch((e) => setError(apiError(e))); useEffect(load, [id]);
  const toggle = async () => { try { await adminUsersApi.setStatus(id, !user.isActive); load(); } catch (e) { setError(apiError(e)); } };
  if (error) return <ErrorMessage error={error} />; if (!user) return <Loading />;
  return <><header className="page-header"><div><h1>{user.email}</h1><p>{user.role} · <Status value={user.isActive ? "ACTIVE" : "INACTIVE"} /></p></div><div className="page-actions"><Link className="button secondary" to="edit">Edit</Link><button className="secondary" onClick={toggle}>{user.isActive ? "Deactivate" : "Activate"}</button></div></header><section className="details"><div><b>Laboratory</b>{user.laboratory?.name || "—"}</div><div><b>Created</b>{new Date(user.createdAt).toLocaleDateString()}</div></section></>;
}
