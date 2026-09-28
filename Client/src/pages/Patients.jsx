import { useEffect, useState } from "react";

import { Link, useNavigate, useParams } from "react-router-dom";

import {
  patientsApi,
  ordersApi,
  paymentsApi,
  reportsApi,
  resultsApi,
  testsApi,
} from "../api/resources";

import { apiError } from "../api/client";

import { useAuth } from "../auth/AuthContext";

import {
  Empty,
  ErrorMessage,
  Loading,
  Status,
  date,
  patientName,
} from "../components/Common";

const blank = {
  name: "",
  fullName: "",
  age: "",
  gender: "MALE",
  cnic: "",
  phone: "",
  address: "",
  laboratoryId: "",
};

export default function Patients() {
  const [patients, setPatients] = useState([]),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  const load = () => {
    setLoading(true);

    patientsApi
      .list({ page: 1, limit: 100 })
      .then((r) => setPatients(r.data.patients))
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const remove = async (id) => {
    if (
      !window.confirm(
        "Delete this patient? Related records may prevent deletion.",
      )
    )
      return;

    try {
      await patientsApi.remove(id);
      load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const filtered = patients.filter((p) =>
    `${p.name} ${p.fullName || ""} ${p.cnic} ${p.phone || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Patients</h1>
          <p>Register and manage laboratory patients.</p>
        </div>

        <Link className="button" to="/patients/new">
          New patient
        </Link>
      </header>

      <ErrorMessage error={error} />

      <input
        className="search"
        placeholder="Search loaded patients by name, CNIC, or phone"
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
                <th>Name</th>
                <th>CNIC</th>
                <th>Phone</th>
                <th>Age / gender</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/patients/${p.id}`}>{patientName(p)}</Link>
                  </td>

                  <td>{p.cnic}</td>

                  <td>{p.phone || "—"}</td>

                  <td>
                    {p.age} / {p.gender}
                  </td>

                  <td className="actions">
                    <Link to={`/patients/${p.id}/edit`}>Edit</Link>

                    <button
                      className="link danger"
                      onClick={() => remove(p.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <Empty>No matching patients.</Empty>
      )}
    </>
  );
}

export function PatientForm() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(Boolean(id));

  useEffect(() => {
    if (id) {
      patientsApi
        .get(id)
        .then((r) =>
          setForm({
            ...blank,
            ...r.data.patient,
            age: String(r.data.patient.age),
          }),
        )
        .catch((e) => setError(apiError(e)))
        .finally(() => setBusy(false));
    }
  }, [id]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const name = form.name.trim();
    const fullName = form.fullName.trim();
    const cnic = form.cnic.replace(/\D/g, "");
    const phone = form.phone.trim();
    const age = Number(form.age);

    if (!name) {
      setError("First name is required.");
      return;
    }

    if (!fullName) {
      setError("Last name is required.");
      return;
    }

    if (!/^\d{13}$/.test(cnic)) {
      setError("CNIC must contain exactly 13 digits.");
      return;
    }

    if (!/^03\d{9}$/.test(phone)) {
      setError(
        "Phone number must be a valid Pakistani mobile number, e.g. 03001234567.",
      );
      return;
    }

    if (!Number.isInteger(age) || age < 1 || age > 120) {
      setError("Age must be a whole number between 1 and 120.");
      return;
    }

    if (!["MALE", "FEMALE", "OTHER"].includes(form.gender)) {
      setError("Please select a valid gender.");
      return;
    }

    const data = {
      ...form,
      name,
      fullName,
      cnic,
      phone,
      age,
    };

    if (!data.address?.trim()) delete data.address;
    else data.address = data.address.trim();

    if (!data.laboratoryId) delete data.laboratoryId;

    setBusy(true);

    try {
      const response = id
        ? await patientsApi.update(id, data)
        : await patientsApi.create(data);

      navigate(`/patients/${response.data.patient.id}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (busy && id) return <Loading />;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{id ? "Edit patient" : "New patient"}</h1>
        </div>
      </header>

      <form className="panel form-grid" onSubmit={submit}>
        <ErrorMessage error={error} />

        <label>
          First name
          <input
            required
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
              })
            }
          />
        </label>

        <label>
          Last name
          <input
            required
            value={form.fullName}
            onChange={(e) =>
              setForm({
                ...form,
                fullName: e.target.value,
              })
            }
          />
        </label>

        <label>
          Age
          <input
            required
            type="number"
            min="1"
            max="120"
            step="1"
            value={form.age}
            onChange={(e) =>
              setForm({
                ...form,
                age: e.target.value,
              })
            }
          />
        </label>

        <label>
          Gender
          <select
            required
            value={form.gender}
            onChange={(e) =>
              setForm({
                ...form,
                gender: e.target.value,
              })
            }
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </label>

        <label>
          CNIC
          <input
            required
            inputMode="numeric"
            maxLength="13"
            pattern="[0-9]{13}"
            placeholder="13 digits"
            value={form.cnic}
            onChange={(e) =>
              setForm({
                ...form,
                cnic: e.target.value.replace(/\D/g, "").slice(0, 13),
              })
            }
          />
        </label>

        <label>
          Phone
          <input
            required
            type="tel"
            inputMode="numeric"
            maxLength="11"
            pattern="03[0-9]{9}"
            placeholder="03001234567"
            value={form.phone}
            onChange={(e) =>
              setForm({
                ...form,
                phone: e.target.value.replace(/\D/g, "").slice(0, 11),
              })
            }
          />
        </label>

        {user.role === "SUPERADMIN" && !id && (
          <label>
            Laboratory ID
            <input
              required
              value={form.laboratoryId}
              onChange={(e) =>
                setForm({
                  ...form,
                  laboratoryId: e.target.value,
                })
              }
            />
          </label>
        )}

        <label className="full">
          Address
          <textarea
            value={form.address}
            onChange={(e) =>
              setForm({
                ...form,
                address: e.target.value,
              })
            }
          />
        </label>

        <div className="full">
          <button disabled={busy}>{busy ? "Saving…" : "Save patient"}</button>
        </div>
      </form>
    </>
  );
}

export function PatientDetail() {
  const { id } = useParams();

  const [patient, setPatient] = useState(null),
    [related, setRelated] = useState(null),
    [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      patientsApi.get(id),
      ordersApi.list({ page: 1, limit: 100 }),
      resultsApi.list({ page: 1, limit: 100 }),
      reportsApi.list({ page: 1, limit: 100 }),
      paymentsApi.list({ page: 1, limit: 100 }),
      testsApi.list({ page: 1, limit: 1 }),
    ])
      .then(([p, o, r, rep, pay]) => {
        const orders = o.data.orders.filter((x) => x.patientId === id);

        const orderIds = new Set(orders.map((x) => x.id));

        setPatient(p.data.patient);

        setRelated({
          orders,
          results: r.data.results.filter((x) =>
            orderIds.has(x.orderedTestItem.order.id),
          ),
          reports: rep.data.reports.filter((x) => orderIds.has(x.orderId)),
          payments: pay.data.payments.filter((x) => orderIds.has(x.orderId)),
        });
      })
      .catch((e) => setError(apiError(e)));
  }, [id]);

  if (error) return <ErrorMessage error={error} />;

  if (!patient || !related) return <Loading />;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{patientName(patient)}</h1>
          <p>
            {patient.cnic} · {patient.age} · {patient.gender}
          </p>
        </div>

        <Link className="button secondary" to="edit">
          Edit patient
        </Link>
      </header>

      <section className="details">
        <div>
          <b>Phone</b>
          {patient.phone || "—"}
        </div>

        <div>
          <b>Address</b>
          {patient.address || "—"}
        </div>
      </section>

      <section className="panel">
        <h2>Related workflow</h2>

        <p>
          {related.orders.length} orders · {related.results.length} results ·{" "}
          {related.reports.length} reports · {related.payments.length} payments
        </p>

        {related.orders.length ? (
          <table>
            <thead>
              <tr>
                <th>Test</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>
              {related.orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    {o.orderedTestItems
                      .map((item) => item.testDefinition.name)
                      .join(", ")}
                  </td>

                  <td>
                    <Status value={o.status} />
                  </td>

                  <td>{date(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No orders for this patient.</Empty>
        )}
      </section>
    </>
  );
}
