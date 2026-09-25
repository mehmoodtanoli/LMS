import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { testsApi } from "../api/resources";
import { apiError } from "../api/client";
import {
  Empty,
  ErrorMessage,
  Loading,
  date,
} from "../components/Common";

const blankParameter = {
  name: "",
  unit: "",
  referenceRange: "",
};

const blankTest = {
  code: "",
  name: "",
  description: "",
  laboratoryId: "",
  parameters: [],
};

export default function Tests() {
  const [tests, setTests] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);

    testsApi
      .list({ page: 1, limit: 100 })
      .then((r) => setTests(r.data.tests))
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = tests.filter((test) => {
    const query = search.toLowerCase();

    return (
      test.code.toLowerCase().includes(query) ||
      test.name.toLowerCase().includes(query) ||
      (test.description || "").toLowerCase().includes(query)
    );
  });

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Tests</h1>
          <p>Manage reusable laboratory test templates.</p>
        </div>

        <Link className="button" to="/admin/tests/new">
          New test
        </Link>
      </header>

      <ErrorMessage error={error} />

      <input
        className="search"
        placeholder="Search tests by code or name"
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
                <th>Code</th>
                <th>Name</th>
                <th>Scope</th>
                <th>Parameters</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {filtered.map((test) => (
                <tr key={test.id}>
                  <td>{test.code}</td>

                  <td>
                    <Link to={`/admin/tests/${test.id}`}>
                      {test.name}
                    </Link>
                  </td>

                  <td>
                    {test.laboratoryId
                      ? "Laboratory"
                      : "Global"}
                  </td>

                  <td>{test.parameters?.length ?? 0}</td>

                  <td>{date(test.createdAt)}</td>

                  <td className="actions">
                    <Link to={`/admin/tests/${test.id}`}>
                      View
                    </Link>

                    <Link to={`/admin/tests/${test.id}/edit`}>
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <Empty>No matching tests.</Empty>
      )}
    </>
  );
}

export function TestForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(blankTest);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(Boolean(id));

  useEffect(() => {
    if (!id) return;

    testsApi
      .get(id)
      .then((r) => {
        const test = r.data.test;

        setForm({
          code: test.code || "",
          name: test.name || "",
          description: test.description || "",
          laboratoryId: test.laboratoryId || "",
          parameters: (test.parameters || []).map((parameter) => ({
            name: parameter.name || "",
            unit: parameter.unit || "",
            referenceRange: parameter.referenceRange || "",
          })),
        });
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setBusy(false));
  }, [id]);

  const updateParameter = (index, field, value) => {
    setForm((current) => ({
      ...current,
      parameters: current.parameters.map((parameter, parameterIndex) =>
        parameterIndex === index
          ? {
              ...parameter,
              [field]: value,
            }
          : parameter,
      ),
    }));
  };

  const addParameter = () => {
    setForm((current) => ({
      ...current,
      parameters: [
        ...current.parameters,
        { ...blankParameter },
      ],
    }));
  };

  const removeParameter = (index) => {
    setForm((current) => ({
      ...current,
      parameters: current.parameters.filter(
        (_, parameterIndex) => parameterIndex !== index,
      ),
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);

    const parameters = form.parameters.map((parameter, index) => ({
      name: parameter.name.trim(),
      unit: parameter.unit.trim(),
      referenceRange: parameter.referenceRange.trim(),
      order: index + 1,
    }));

    const data = {
      code: form.code.trim(),
      name: form.name.trim(),
      ...(form.description.trim()
        ? { description: form.description.trim() }
        : {}),
      ...(form.laboratoryId.trim()
        ? { laboratoryId: form.laboratoryId.trim() }
        : {}),
      ...(parameters.length
        ? { parameters }
        : {}),
    };

    try {
      const response = id
        ? await testsApi.update(id, data)
        : await testsApi.create(data);

      navigate(`/admin/tests/${response.data.test.id}`);
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
          <h1>{id ? "Edit test" : "New test"}</h1>

          <p>
            Create a reusable test definition and its
            parameters.
          </p>
        </div>
      </header>

      <form
        className="panel form-grid"
        onSubmit={submit}
      >
        <ErrorMessage error={error} />

        <label>
          Code
          <input
            required
            value={form.code}
            onChange={(e) =>
              setForm({
                ...form,
                code: e.target.value,
              })
            }
            placeholder="e.g. CBC"
          />
        </label>

        <label>
          Name
          <input
            required
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
              })
            }
            placeholder="e.g. Complete Blood Count"
          />
        </label>

        <label className="full">
          Description
          <input
            value={form.description}
            onChange={(e) =>
              setForm({
                ...form,
                description: e.target.value,
              })
            }
            placeholder="Optional description"
          />
        </label>

        <label className="full">
          Laboratory ID
          <input
            value={form.laboratoryId}
            onChange={(e) =>
              setForm({
                ...form,
                laboratoryId: e.target.value,
              })
            }
            placeholder="Leave empty for a global template"
          />

          <small className="result-context">
            Leave empty to make this test available to all
            laboratories.
          </small>
        </label>

        <div className="full">
          <div className="panel-heading">
            <h2>Parameters</h2>

            <button
              type="button"
              className="secondary"
              onClick={addParameter}
            >
              Add parameter
            </button>
          </div>

          {form.parameters.length ? (
            <div className="form-grid">
              {form.parameters.map((parameter, index) => (
                <div
                  className="panel full"
                  key={index}
                >
                  <div className="panel-heading">
                    <strong>
                      Parameter {index + 1}
                    </strong>

                    <button
                      type="button"
                      className="link"
                      onClick={() =>
                        removeParameter(index)
                      }
                    >
                      Remove
                    </button>
                  </div>

                  <div className="form-grid">
                    <label>
                      Name
                      <input
                        required
                        value={parameter.name}
                        onChange={(e) =>
                          updateParameter(
                            index,
                            "name",
                            e.target.value,
                          )
                        }
                        placeholder="e.g. Hemoglobin"
                      />
                    </label>

                    <label>
                      Unit
                      <input
                        value={parameter.unit}
                        onChange={(e) =>
                          updateParameter(
                            index,
                            "unit",
                            e.target.value,
                          )
                        }
                        placeholder="e.g. g/dL"
                      />
                    </label>

                    <label className="full">
                      Reference range
                      <input
                        value={
                          parameter.referenceRange
                        }
                        onChange={(e) =>
                          updateParameter(
                            index,
                            "referenceRange",
                            e.target.value,
                          )
                        }
                        placeholder="e.g. 13-17"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty>
              No parameters added. This can be used for
              tests that store a single result value.
            </Empty>
          )}
        </div>

        <div className="full">
          <button disabled={busy}>
            {busy ? "Saving…" : "Save test"}
          </button>
        </div>
      </form>
    </>
  );
}

export function TestDetail() {
  const { id } = useParams();

  const [test, setTest] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    testsApi
      .get(id)
      .then((r) => setTest(r.data.test))
      .catch((e) => setError(apiError(e)));
  }, [id]);

  if (error) {
    return <ErrorMessage error={error} />;
  }

  if (!test) {
    return <Loading />;
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{test.name}</h1>
          <p>
            {test.code} ·{" "}
            {test.laboratoryId
              ? "Laboratory-specific"
              : "Global template"}
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="button secondary"
            to={`/admin/tests/${test.id}/edit`}
          >
            Edit
          </Link>
        </div>
      </header>

      <section className="panel">
        <h2>Test information</h2>

        <p>
          <strong>Code:</strong> {test.code}
        </p>

        <p>
          <strong>Name:</strong> {test.name}
        </p>

        {test.description ? (
          <p>
            <strong>Description:</strong>{" "}
            {test.description}
          </p>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>
            Parameters ({test.parameters?.length ?? 0})
          </h2>
        </div>

        {test.parameters?.length ? (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Parameter</th>
                <th>Unit</th>
                <th>Reference range</th>
              </tr>
            </thead>

            <tbody>
              {test.parameters.map((parameter) => (
                <tr key={parameter.id}>
                  <td>{parameter.order}</td>
                  <td>{parameter.name}</td>
                  <td>{parameter.unit || "—"}</td>
                  <td>
                    {parameter.referenceRange || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No parameters defined.</Empty>
        )}
      </section>
    </>
  );
}
