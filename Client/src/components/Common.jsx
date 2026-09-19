export function Loading({ text = "Loading…" }) { return <div className="state">{text}</div>; }
export function ErrorMessage({ error }) { return error ? <div className="alert error">{error}</div> : null; }
export function Empty({ children = "No records found." }) { return <div className="state">{children}</div>; }
export function Status({ value }) { return <span className={`badge ${String(value).toLowerCase().replaceAll("_", "-")}`}>{String(value || "—").replaceAll("_", " ")}</span>; }
export const patientName = (patient) => patient?.fullName || patient?.name || "—";
export const date = (value) => value ? new Date(value).toLocaleDateString() : "—";
