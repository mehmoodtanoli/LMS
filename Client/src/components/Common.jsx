export function Loading({ text = "Loading…" }) {
  return <div className="state">{text}</div>;
}

export function ErrorMessage({ error }) {
  return error ? <div className="alert error">{error}</div> : null;
}

export function Empty({ children = "No records found." }) {
  return <div className="state">{children}</div>;
}

export function Status({ value }) {
  return (
    <span className={`badge ${String(value).toLowerCase().replaceAll("_", "-")}`}>
      {String(value || "—").replaceAll("_", " ")}
    </span>
  );
}

// Display First Name + Last Name, handling legacy rows gracefully (Fixes A4)
export const patientName = (patient) => {
  if (!patient) return "—";
  const firstName = patient.name ? String(patient.name).trim() : "";
  const lastName = patient.fullName ? String(patient.fullName).trim() : "";
  if (!firstName && !lastName) return "—";
  if (!lastName) return firstName;
  if (!firstName) return lastName;
  if (
    lastName.toLowerCase() === firstName.toLowerCase() ||
    lastName.toLowerCase().startsWith(firstName.toLowerCase() + " ")
  ) {
    return lastName;
  }
  return `${firstName} ${lastName}`;
};

export const formatAge = (patient) => {
  if (!patient || patient.age === undefined || patient.age === null) return "—";
  const unit = (patient.ageUnit || "YEARS").toUpperCase();
  if (unit === "MONTHS") return `${patient.age} mo`;
  if (unit === "DAYS") return `${patient.age} d`;
  return `${patient.age} Y`;
};

export const date = (value) => (value ? new Date(value).toLocaleDateString() : "—");
