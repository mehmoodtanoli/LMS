import { useEffect, useState } from "react";

import { Link, useNavigate, useParams } from "react-router-dom";

import { adminUsersApi, laboratoriesApi } from "../api/resources";

import { apiError } from "../api/client";

import { useAuth } from "../auth/AuthContext";

import { Empty, ErrorMessage, Loading, Status } from "../components/Common";

export default function Users() {
  const { user: currentUser } = useAuth();

  const isLabAdmin = currentUser?.role === "LAB_ADMIN";

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError("");

    adminUsersApi
      .list({ page: 1, limit: 100 })
      .then((r) => setUsers(r.data.users))
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggle = async (user) => {
    try {
      setError("");

      await adminUsersApi.setStatus(user.id, !user.isActive);

      load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{isLabAdmin ? "Lab Technicians" : "Users"}</h1>

          <p>
            {isLabAdmin
              ? "Manage the technicians belonging to your laboratory."
              : "Manage Super Admin, Lab Admin, and Lab Technician accounts."}
          </p>
        </div>

        <Link className="button" to="/admin/users/new">
          {isLabAdmin ? "New lab technician" : "New user"}
        </Link>
      </header>

      <ErrorMessage error={error} />

      <input
        className="search"
        placeholder="Search users by email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <Loading />
      ) : filtered.length ? (
        <section className="panel">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Laboratory</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link to={`/admin/users/${u.id}`}>{u.email}</Link>
                  </td>

                  <td>{u.role}</td>

                  <td>{u.laboratory?.name || "—"}</td>

                  <td>
                    <Status value={u.isActive ? "ACTIVE" : "INACTIVE"} />
                  </td>

                  <td className="actions">
                    <Link to={`/admin/users/${u.id}/edit`}>Edit</Link>

                    <button className="link" onClick={() => toggle(u)}>
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <Empty>
          {isLabAdmin ? "No lab technicians found." : "No matching users."}
        </Empty>
      )}
    </>
  );
}

const blank = {
  email: "",
  password: "",
  role: "LAB_ADMIN",
  laboratoryId: "",
};

export function UserForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { user: currentUser } = useAuth();

  const isLabAdmin = currentUser?.role === "LAB_ADMIN";

  const [form, setForm] = useState({
    ...blank,
    role: isLabAdmin ? "LAB_TECH" : "LAB_ADMIN",
  });

  const [laboratories, setLaboratories] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(Boolean(id));

  useEffect(() => {
    if (!isLabAdmin) {
      laboratoriesApi
        .list({ page: 1, limit: 100 })
        .then((r) => setLaboratories(r.data.laboratories))
        .catch((e) => setError(apiError(e)));
    }
  }, [isLabAdmin]);

  useEffect(() => {
    if (id) {
      adminUsersApi
        .get(id)
        .then((r) => {
          const targetUser = r.data.user;

          setForm({
            ...blank,
            email: targetUser.email,
            role: isLabAdmin ? "LAB_TECH" : targetUser.role,
            laboratoryId: targetUser.laboratoryId || "",
          });
        })
        .catch((e) => setError(apiError(e)))
        .finally(() => setBusy(false));
    }
  }, [id, isLabAdmin]);

  const submit = async (e) => {
    e.preventDefault();

    setError("");
    setBusy(true);

    const data = {
      email: form.email,
    };

    if (isLabAdmin) {
      data.role = "LAB_TECH";
    } else {
      data.role = form.role;

      data.laboratoryId =
        form.role === "LAB_ADMIN" || form.role === "LAB_TECH"
          ? form.laboratoryId
          : undefined;
    }

    if (!id || form.password) {
      data.password = form.password;
    }

    try {
      const response = id
        ? await adminUsersApi.update(id, data)
        : await adminUsersApi.create(data);

      navigate(`/admin/users/${response.data.user.id}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (busy && id) {
    return <Loading />;
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>
            {id
              ? isLabAdmin
                ? "Edit lab technician"
                : "Edit user"
              : isLabAdmin
                ? "New lab technician"
                : "New user"}
          </h1>
        </div>
      </header>

      <form className="panel form-grid" onSubmit={submit}>
        <ErrorMessage error={error} />

        <label>
          Email
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm({
                ...form,
                email: e.target.value,
              })
            }
          />
        </label>

        <label>
          {id ? "New password (optional)" : "Password"}

          <input
            required={!id}
            type="password"
            minLength={6}
            value={form.password}
            onChange={(e) =>
              setForm({
                ...form,
                password: e.target.value,
              })
            }
          />
        </label>

        {isLabAdmin ? (
          <>
            <label>
              Role
              <input value="LAB_TECH" disabled readOnly />
            </label>

            <label>
              Laboratory
              <input
                value={currentUser?.laboratory?.name || "Your laboratory"}
                disabled
                readOnly
              />
            </label>
          </>
        ) : (
          <>
            <label>
              Role
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value,
                    laboratoryId:
                      e.target.value === "SUPERADMIN" ? "" : form.laboratoryId,
                  })
                }
              >
                <option value="LAB_ADMIN">LAB_ADMIN</option>
                <option value="LAB_TECH">LAB_TECH</option>
                <option value="SUPERADMIN">SUPERADMIN</option>
              </select>
            </label>

            {(form.role === "LAB_ADMIN" || form.role === "LAB_TECH") && (
              <label>
                Laboratory
                <select
                  required
                  value={form.laboratoryId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      laboratoryId: e.target.value,
                    })
                  }
                >
                  <option value="">Select a laboratory</option>

                  {laboratories.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}

        <div className="full">
          <button disabled={busy}>{busy ? "Saving…" : "Save user"}</button>
        </div>
      </form>
    </>
  );
}

export function UserDetail() {
  const { id } = useParams();

  const { user: currentUser } = useAuth();

  const isLabAdmin = currentUser?.role === "LAB_ADMIN";

  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  const load = () =>
    adminUsersApi
      .get(id)
      .then((r) => setUser(r.data.user))
      .catch((e) => setError(apiError(e)));

  useEffect(load, [id]);

  const toggle = async () => {
    try {
      setError("");

      await adminUsersApi.setStatus(id, !user.isActive);

      load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  if (error) {
    return <ErrorMessage error={error} />;
  }

  if (!user) {
    return <Loading />;
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{user.email}</h1>

          <p>
            {user.role} ·{" "}
            <Status value={user.isActive ? "ACTIVE" : "INACTIVE"} />
          </p>
        </div>

        <div className="page-actions">
          <Link className="button secondary" to="edit">
            Edit
          </Link>

          <button className="secondary" onClick={toggle}>
            {user.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
      </header>

      <section className="details">
        <div>
          <b>Laboratory</b>
          {user.laboratory?.name || "—"}
        </div>

        <div>
          <b>Created</b>
          {new Date(user.createdAt).toLocaleDateString()}
        </div>
      </section>
    </>
  );
}
