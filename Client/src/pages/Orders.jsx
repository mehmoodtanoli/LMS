import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { ordersApi, patientsApi, testsApi } from "../api/resources";
import { apiError } from "../api/client";

import {
  Empty,
  ErrorMessage,
  Loading,
  Status,
  date,
  patientName,
} from "../components/Common";

const CATEGORIES = ["All", "Hematology", "Biochemistry", "Urine", "Other"];

function getTestCategory(test) {
  const category = test.category?.name ?? test.categoryName ?? test.category;

  if (category && typeof category === "object") {
    const name = category.name ?? category.label;
    return typeof name === "string" && name.trim() ? name.trim() : "Other";
  }

  if (typeof category !== "string" || !category.trim()) {
    return "Other";
  }

  const value = category.trim();

  const knownCategory = CATEGORIES.find(
    (item) => item.toLowerCase() === value.toLowerCase(),
  );

  return knownCategory || value;
}

function getTestPrice(test) {
  const rawPrice = test.price;

  if (
    rawPrice === null ||
    rawPrice === undefined ||
    rawPrice === "" ||
    typeof rawPrice === "boolean"
  ) {
    return null;
  }

  const price = Number(rawPrice);

  return Number.isFinite(price) && price >= 0 ? price : null;
}

function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function displayPrice(test) {
  const price = getTestPrice(test);
  return price === null ? "Price not set" : money(price);
}

function patientSearchText(patient) {
  return [
    patientName(patient),
    patient.name,
    patient.fullName,
    patient.cnic,
    patient.mrNumber,
    patient.patientNumber,
    patient.phone,
    patient.phoneNumber,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function patientSecondaryText(patient) {
  return [
    patient.cnic,
    patient.mrNumber || patient.patientNumber,
    patient.phone || patient.phoneNumber,
  ]
    .filter(Boolean)
    .join(" · ");
}

function getRecentTests(orders, tests) {
  const knownIds = new Set(tests.map((test) => test.id));
  const seen = new Set();
  const recent = [];

  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  for (const order of sortedOrders) {
    for (const item of order.orderedTestItems || []) {
      const id = item.testDefinition?.id;

      if (id && knownIds.has(id) && !seen.has(id)) {
        seen.add(id);
        recent.push(id);
      }
    }
  }

  return recent.slice(0, 8);
}

export default function Orders() {
  const [patients, setPatients] = useState([]);
  const [tests, setTests] = useState([]);
  const [orders, setOrders] = useState([]);

  const [patientId, setPatientId] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);

  const [testSearch, setTestSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState([]);

  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("PENDING");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const patientPickerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [patientResponse, testResponse, orderResponse] = await Promise.all([
        patientsApi.list({ page: 1, limit: 100 }),
        testsApi.list({ page: 1, limit: 100 }),
        ordersApi.list({ page: 1, limit: 100 }),
      ]);

      setPatients(patientResponse.data.patients || []);
      setTests(testResponse.data.tests || []);
      setOrders(orderResponse.data.orders || []);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Close the patient dropdown when clicking outside it or pressing Escape.
  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        patientPickerRef.current &&
        !patientPickerRef.current.contains(event.target)
      ) {
        setPatientPickerOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setPatientPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === patientId),
    [patients, patientId],
  );

  const patientResults = useMemo(() => {
    const query = patientSearch.trim().toLowerCase();

    if (query.length < 2) {
      return patients.slice(0, 8);
    }

    return patients
      .filter((patient) => patientSearchText(patient).includes(query))
      .slice(0, 10);
  }, [patients, patientSearch]);

  const filteredTests = useMemo(() => {
    const query = testSearch.trim().toLowerCase();

    return tests.filter((test) => {
      const matchesCategory =
        category === "All" || getTestCategory(test) === category;

      const matchesSearch =
        !query ||
        `${test.code || ""} ${test.name || ""}`.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [tests, testSearch, category]);

  const selectedTests = useMemo(
    () =>
      selected
        .map((id) => tests.find((test) => test.id === id))
        .filter(Boolean),
    [selected, tests],
  );

  const total = selectedTests.reduce((sum, test) => {
    const price = getTestPrice(test);
    return sum + (price ?? 0);
  }, 0);

  const hasMissingPrices = selectedTests.some(
    (test) => getTestPrice(test) === null,
  );

  const recentTestIds = useMemo(
    () => getRecentTests(orders, tests),
    [orders, tests],
  );

  const recentTests = recentTestIds
    .map((id) => tests.find((test) => test.id === id))
    .filter(Boolean);

  const toggleTest = (id) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

    setError("");
  };

  const choosePatient = (patient) => {
    setPatientId(patient.id);
    setPatientSearch(patientName(patient));
    setPatientPickerOpen(false);
    setError("");
  };

  const clearPatient = () => {
    setPatientId("");
    setPatientSearch("");
    setPatientPickerOpen(true);
  };

  const create = async (event) => {
    event.preventDefault();

    if (!patientId) {
      setError("Please select a patient.");
      return;
    }

    if (!selected.length) {
      setError("Please select at least one test.");
      return;
    }

    setError("");
    setCreating(true);

    try {
      await ordersApi.create({
        patientId,
        testDefinitionIds: selected,
        status,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });

      setSelected([]);
      setNotes("");
      setStatus("PENDING");

      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setCreating(false);
    }
  };

  const changeStatus = async (id, nextStatus) => {
    setError("");

    try {
      await ordersApi.update(id, { status: nextStatus });
      await load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Test orders</h1>
          <p>
            Select a patient, add tests, and create one visit with a combined
            bill.
          </p>
        </div>
      </header>

      <ErrorMessage error={error} />

      {loading ? (
        <Loading />
      ) : (
        <>
          <form className="order-builder" onSubmit={create}>
            <div className="order-builder-main">
              <section className="order-section">
                <div className="order-section-heading">
                  <div>
                    <span className="order-step">01</span>
                    <h2>Select patient</h2>
                  </div>

                  {selectedPatient && (
                    <button
                      className="order-text-button"
                      type="button"
                      onClick={clearPatient}
                    >
                      Change
                    </button>
                  )}
                </div>

                <div
                  className="order-patient-picker"
                  ref={patientPickerRef}
                  style={{
                    position: "relative",
                    zIndex: patientPickerOpen ? 20 : "auto",
                  }}
                >
                  <input
                    type="search"
                    value={patientSearch}
                    placeholder="Search patient by name, CNIC or number..."
                    autoComplete="off"
                    aria-expanded={patientPickerOpen}
                    onFocus={() => setPatientPickerOpen(true)}
                    onChange={(event) => {
                      setPatientSearch(event.target.value);
                      setPatientId("");
                      setPatientPickerOpen(true);
                    }}
                  />

                  {patientPickerOpen && (
                    <div
                      className="order-patient-results"
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        maxHeight: 280,
                        overflowY: "auto",
                        background: "var(--surface, #fff)",
                        border: "1px solid var(--border, #e2e8f0)",
                        borderRadius: 8,
                        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
                      }}
                    >
                      {patientSearch.trim().length < 2 ? (
                        patientResults.length ? (
                          patientResults.map((patient) => (
                            <button
                              className="order-patient-option"
                              type="button"
                              key={patient.id}
                              onClick={() => choosePatient(patient)}
                            >
                              <span className="order-patient-avatar">
                                {patientName(patient)
                                  ?.trim()
                                  ?.charAt(0)
                                  ?.toUpperCase() || "P"}
                              </span>

                              <span className="order-patient-info">
                                <strong>{patientName(patient)}</strong>
                                <small>
                                  {patientSecondaryText(patient) ||
                                    "Patient record"}
                                </small>
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className="order-no-results">
                            Start typing at least 2 characters to search
                            patients.
                          </p>
                        )
                      ) : patientResults.length ? (
                        patientResults.map((patient) => (
                          <button
                            className="order-patient-option"
                            type="button"
                            key={patient.id}
                            onClick={() => choosePatient(patient)}
                          >
                            <span className="order-patient-avatar">
                              {patientName(patient)
                                ?.trim()
                                ?.charAt(0)
                                ?.toUpperCase() || "P"}
                            </span>

                            <span className="order-patient-info">
                              <strong>{patientName(patient)}</strong>
                              <small>
                                {patientSecondaryText(patient) ||
                                  "Patient record"}
                              </small>
                            </span>
                          </button>
                        ))
                      ) : (
                        <div
                          className="order-no-results"
                          style={{ padding: 14 }}
                        >
                          <p style={{ margin: "0 0 10px" }}>
                            No matching patients found.
                          </p>

                          <Link
                            to="/patients/new"
                            onClick={() => setPatientPickerOpen(false)}
                            style={{
                              color: "var(--primary, #2563eb)",
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            Register new patient
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {selectedPatient && (
                  <div className="order-selected-patient">
                    <span className="order-patient-check">✓</span>
                    <div>
                      <strong>{patientName(selectedPatient)}</strong>
                      <small>
                        {patientSecondaryText(selectedPatient) ||
                          "Patient selected"}
                      </small>
                    </div>
                  </div>
                )}
              </section>

              <section className="order-section order-test-section">
                <div className="order-section-heading">
                  <div>
                    <span className="order-step">02</span>
                    <h2>Choose tests</h2>
                  </div>

                  <span className="order-count">
                    {selected.length} selected
                  </span>
                </div>

                <input
                  className="order-test-search"
                  type="search"
                  value={testSearch}
                  placeholder="Search tests by name or code..."
                  onChange={(event) => setTestSearch(event.target.value)}
                />

                <div className="order-categories">
                  {CATEGORIES.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={
                        category === item
                          ? "order-category active"
                          : "order-category"
                      }
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                {recentTests.length > 0 &&
                  !testSearch &&
                  category === "All" && (
                    <div className="order-recent-tests">
                      <h3>Recently ordered</h3>

                      <div className="order-recent-chips">
                        {recentTests.map((test) => {
                          const isSelected = selected.includes(test.id);

                          return (
                            <button
                              type="button"
                              key={test.id}
                              className={
                                isSelected
                                  ? "order-recent-chip selected"
                                  : "order-recent-chip"
                              }
                              onClick={() => toggleTest(test.id)}
                            >
                              {isSelected ? "✓ " : "+ "}
                              {test.code || test.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                <div className="order-test-list">
                  {filteredTests.length ? (
                    filteredTests.map((test) => {
                      const isSelected = selected.includes(test.id);
                      const testCategory = getTestCategory(test);
                      const price = getTestPrice(test);

                      return (
                        <button
                          type="button"
                          key={test.id}
                          className={
                            isSelected
                              ? "order-test-option selected"
                              : "order-test-option"
                          }
                          onClick={() => toggleTest(test.id)}
                        >
                          <span className="order-test-add">
                            {isSelected ? "✓" : "+"}
                          </span>

                          <span className="order-test-info">
                            <strong>{test.name}</strong>
                            <small>
                              {test.code || "No code"} · {testCategory}
                            </small>
                          </span>

                          <span
                            className="order-test-price"
                            style={
                              price === null
                                ? { color: "var(--text-muted, #94a3b8)" }
                                : undefined
                            }
                          >
                            {displayPrice(test)}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="order-empty-tests">
                      {tests.length
                        ? "No tests match your search."
                        : "No test definitions are available."}
                    </p>
                  )}
                </div>
              </section>

              <section className="order-section">
                <div className="order-section-heading">
                  <div>
                    <span className="order-step">03</span>
                    <h2>Visit details</h2>
                  </div>
                </div>

                <div className="order-details-grid">
                  <label>
                    Starting status
                    <select
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                    >
                      <option value="PENDING">Pending</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </label>

                  <label>
                    Notes <span className="order-optional">(optional)</span>
                    <input
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Clinical notes or instructions"
                    />
                  </label>
                </div>
              </section>
            </div>

            <aside
              className="order-summary"
              style={{
                padding: 24,
                boxSizing: "border-box",
                alignSelf: "start",
                position: "sticky",
                top: 20,
              }}
            >
              <div className="order-summary-heading">
                <div>
                  <span className="order-summary-eyebrow">CURRENT VISIT</span>
                  <h2>Selected tests</h2>
                </div>

                <span className="order-summary-badge">{selected.length}</span>
              </div>

              {selectedPatient ? (
                <div className="order-summary-patient">
                  <small>Patient</small>
                  <strong>{patientName(selectedPatient)}</strong>
                </div>
              ) : (
                <div className="order-summary-hint">
                  Select a patient to begin this visit.
                </div>
              )}

              <div className="order-summary-items">
                {selectedTests.length ? (
                  selectedTests.map((test) => {
                    const price = getTestPrice(test);

                    return (
                      <div className="order-summary-item" key={test.id}>
                        <div>
                          <strong>{test.name}</strong>
                          <small>{test.code || "Test"}</small>

                          <span
                            style={
                              price === null
                                ? { color: "var(--text-muted, #94a3b8)" }
                                : undefined
                            }
                          >
                            {displayPrice(test)}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="order-remove-test"
                          aria-label={`Remove ${test.name}`}
                          onClick={() => toggleTest(test.id)}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="order-summary-empty">
                    <span className="order-summary-empty-icon">+</span>
                    <p>No tests selected yet.</p>
                    <small>Add tests from the list.</small>
                  </div>
                )}
              </div>

              {hasMissingPrices && (
                <p
                  role="status"
                  style={{
                    margin: "12px 0",
                    padding: "10px 12px",
                    borderRadius: 6,
                    background: "#fff7ed",
                    color: "#9a3412",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  Some selected tests have no price configured. They are
                  included in this visit, but the displayed total excludes tests
                  without prices.
                </p>
              )}

              <div className="order-summary-total">
                <span>Total amount</span>
                <strong>{money(total)}</strong>
              </div>

              <button
                className="order-create-button"
                type="submit"
                disabled={creating || !patientId || !selected.length}
              >
                {creating
                  ? "Creating visit..."
                  : `Create visit · ${selected.length} test${
                      selected.length === 1 ? "" : "s"
                    }`}
              </button>

              <p className="order-summary-footnote">
                All selected tests will be added to one patient order.
              </p>
            </aside>
          </form>

          <section className="panel order-history">
            <div className="order-history-heading">
              <div>
                <h2>Recent orders</h2>
                <p>Review visits and update their status.</p>
              </div>

              <span className="order-history-count">{orders.length} shown</span>
            </div>

            {orders.length ? (
              <div className="order-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Tests</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Update status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {orders.map((order) => {
                      const items = order.orderedTestItems || [];

                      const orderTotal = items.reduce((sum, item) => {
                        const itemPrice = item.price;

                        if (
                          itemPrice === null ||
                          itemPrice === undefined ||
                          itemPrice === ""
                        ) {
                          return sum;
                        }

                        const parsedPrice = Number(itemPrice);

                        return Number.isFinite(parsedPrice) && parsedPrice >= 0
                          ? sum + parsedPrice
                          : sum;
                      }, 0);

                      return (
                        <tr key={order.id}>
                          <td>
                            <strong>{patientName(order.patient)}</strong>
                          </td>

                          <td>
                            <div className="order-history-tests">
                              {items.map((item) => (
                                <span key={item.id}>
                                  {item.testDefinition?.name || "Test"}
                                </span>
                              ))}
                            </div>

                            <small className="order-history-total">
                              {items.length} test
                              {items.length === 1 ? "" : "s"} ·{" "}
                              {money(orderTotal)}
                            </small>
                          </td>

                          <td>
                            <Status value={order.status} />
                          </td>

                          <td>{date(order.createdAt)}</td>

                          <td>
                            <select
                              aria-label="Change order status"
                              value={order.status}
                              onChange={(event) =>
                                changeStatus(order.id, event.target.value)
                              }
                            >
                              <option value="PENDING">Pending</option>
                              <option value="IN_PROGRESS">In progress</option>
                              <option value="COMPLETED">Completed</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No orders yet.</Empty>
            )}
          </section>
        </>
      )}
    </>
  );
}
