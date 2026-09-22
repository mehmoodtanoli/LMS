import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { laboratoriesApi } from "../api/resources";
import { apiError } from "../api/client";
import { Empty, ErrorMessage, Loading, Status, date } from "../components/Common";

export default function Laboratories() {
  const [laboratories, setLaboratories] = useState([]), [search, setSearch] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); laboratoriesApi.list({ page: 1, limit: 100 }).then((r) => setLaboratories(r.data.laboratories)).catch((e) => setError(apiError(e))).finally(() => setLoading(false)); }; useEffect(load, []);
  const toggle = async (lab) => { try { await laboratoriesApi.setStatus(lab.id, !lab.isActive); load(); } catch (e) { setError(apiError(e)); } };
  const filtered = laboratories.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));
  return <><header className="page-header"><div><h1>Laboratories</h1><p>Manage laboratories on the platform.</p></div><Link className="button" to="/admin/laboratories/new">New laboratory</Link></header><ErrorMessage error={error} /><input className="search" placeholder="Search laboratories by name" value={search} onChange={(e) => setSearch(e.target.value)} />{loading ? <Loading /> : filtered.length ? <section className="panel"><table><thead><tr><th>Name</th><th>Status</th><th>Users</th><th>Patients</th><th>Created</th><th /></tr></thead><tbody>{filtered.map((l) => <tr key={l.id}><td><Link to={`/admin/laboratories/${l.id}`}>{l.name}</Link></td><td><Status value={l.isActive ? "ACTIVE" : "INACTIVE"} /></td><td>{l._count?.users ?? "—"}</td><td>{l._count?.patients ?? "—"}</td><td>{date(l.createdAt)}</td><td className="actions"><Link to={`/admin/laboratories/${l.id}/edit`}>Edit</Link><button className="link" onClick={() => toggle(l)}>{l.isActive ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></section> : <Empty>No matching laboratories.</Empty>}</>;
}

export function LaboratoryForm() {
  const { id } = useParams(), navigate = useNavigate(); const [form, setForm] = useState({ name: "" }), [error, setError] = useState(""), [busy, setBusy] = useState(Boolean(id));
  useEffect(() => { if (id) laboratoriesApi.get(id).then((r) => setForm({ name: r.data.laboratory.name })).catch((e) => setError(apiError(e))).finally(() => setBusy(false)); }, [id]);
  const submit = async (e) => { e.preventDefault(); setError(""); setBusy(true); try { const response = id ? await laboratoriesApi.update(id, form) : await laboratoriesApi.create(form); navigate(`/admin/laboratories/${response.data.laboratory.id}`); } catch (err) { setError(apiError(err)); } finally { setBusy(false); } };
  if (busy && id) return <Loading />; return <><header className="page-header"><div><h1>{id ? "Edit laboratory" : "New laboratory"}</h1></div></header><form className="panel form-grid" onSubmit={submit}><ErrorMessage error={error} /><label className="full">Name<input required value={form.name} onChange={(e) => setForm({ name: e.target.value })} /></label><div className="full"><button disabled={busy}>{busy ? "Saving…" : "Save laboratory"}</button></div></form></>;
}

export function LaboratoryDetail() {
  const { id } = useParams(); const [laboratory, setLaboratory] = useState(null), [error, setError] = useState("");
  const load = () => laboratoriesApi.get(id).then((r) => setLaboratory(r.data.laboratory)).catch((e) => setError(apiError(e))); useEffect(load, [id]);
  const toggle = async () => { try { await laboratoriesApi.setStatus(id, !laboratory.isActive); load(); } catch (e) { setError(apiError(e)); } };
  if (error) return <ErrorMessage error={error} />; if (!laboratory) return <Loading />;
  return <><header className="page-header"><div><h1>{laboratory.name}</h1><p><Status value={laboratory.isActive ? "ACTIVE" : "INACTIVE"} /></p></div><div className="page-actions"><Link className="button secondary" to="edit">Edit</Link><button className="secondary" onClick={toggle}>{laboratory.isActive ? "Deactivate" : "Activate"}</button></div></header><section className="panel"><h2>Users ({laboratory.users?.length ?? 0})</h2>{laboratory.users?.length ? <table><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Created</th></tr></thead><tbody>{laboratory.users.map((u) => <tr key={u.id}><td>{u.email}</td><td>{u.role}</td><td><Status value={u.isActive ? "ACTIVE" : "INACTIVE"} /></td><td>{date(u.createdAt)}</td></tr>)}</tbody></table> : <Empty>No users assigned to this laboratory.</Empty>}</section></>;
}
