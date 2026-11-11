import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { supportApi } from "../api/resources";
import { apiError } from "../api/client";
import { ErrorMessage } from "../components/Common";
import {
  LifeBuoy,
  MessageCircle,
  Send,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  Phone,
  RotateCcw,
} from "lucide-react";

const CATEGORIES = [
  { value: "TECHNICAL_ISSUE", label: "Technical Issue / System Bug" },
  { value: "COMPLAINT", label: "Complaint / Operational Issue" },
  { value: "FEATURE_REQUEST", label: "Feature Request / Suggestion" },
  { value: "GENERAL_INQUIRY", label: "General Inquiry" },
  { value: "OTHER", label: "Other" },
];

const initialForm = {
  category: "TECHNICAL_ISSUE",
  subject: "",
  description: "",
  contactInfo: "",
};

export default function Support() {
  const { user } = useAuth();
  const [config, setConfig] = useState({
    whatsappNumber: "",
    operatingHours: "Monday to Saturday, 9:00 AM - 6:00 PM PKT",
  });
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submittedTicket, setSubmittedTicket] = useState(null);

  useEffect(() => {
    supportApi
      .getConfig()
      .then((res) => {
        if (res.data) {
          setConfig((current) => ({
            ...current,
            whatsappNumber: res.data.whatsappNumber || current.whatsappNumber,
            operatingHours: res.data.operatingHours || current.operatingHours,
          }));
        }
      })
      .catch(() => {
        // Fallback gracefully without breaking page render
      });
  }, []);

  const updateField = (field) => (e) => {
    setForm((current) => ({ ...current, [field]: e.target.value }));
    setError("");
  };

  const labName =
    user?.role === "SUPERADMIN"
      ? "System Administrator"
      : user?.laboratory?.name || "Independent Laboratory";

  const userRole = user?.role || "USER";
  const userEmail = user?.email || "Unknown";

  const getWhatsAppLink = () => {
    const rawNumber = config.whatsappNumber || "";
    const cleanNumber = rawNumber.replace(/[^0-9]/g, "");
    if (!cleanNumber) return "";

    const today = new Date().toISOString().slice(0, 10);
    const prefilledMessage =
      `*LMS V1.0 Support Request*\n` +
      `Date: ${today}\n` +
      `Lab: ${labName}\n` +
      `User role: ${userRole}\n` +
      `-------------------------\n` +
      `Hello Support Team, I need assistance with: `;

    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(prefilledMessage)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.subject.trim() || form.subject.trim().length < 4) {
      setError("Please provide a subject with at least 4 characters.");
      return;
    }

    if (!form.description.trim() || form.description.trim().length < 10) {
      setError("Please provide a detailed description (at least 10 characters).");
      return;
    }

    setSubmitting(true);
    try {
      const response = await supportApi.submitTicket({
        category: form.category,
        subject: form.subject.trim(),
        description: form.description.trim(),
        contactInfo: form.contactInfo.trim() || undefined,
      });

      setSubmittedTicket(response.data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm(initialForm);
    setSubmittedTicket(null);
    setError("");
  };

  const whatsAppLink = getWhatsAppLink();

  return (
    <div className="support-page">
      {/* Page Header */}
      <header className="page-header-simple">
        <div>
          <h1 className="page-title">Support & Help Desk</h1>
          <p className="page-subtitle">
            Need technical assistance or wish to report an issue? Connect directly with our team.
          </p>
        </div>
        <LifeBuoy size={28} color="#1d4ed8" aria-hidden="true" />
      </header>

      {/* Auto-detected user context banner */}
      <div className="support-context-banner">
        <ShieldCheck size={20} />
        <div>
          Submitting as: <strong>{userEmail}</strong> &bull; Role: <strong>{userRole}</strong> &bull; Laboratory: <strong>{labName}</strong>
        </div>
      </div>

      <ErrorMessage error={error} />

      {/* Two-Column Responsive Split */}
      <div className="support-grid">
        {/* Left Column: WhatsApp Direct Assistance */}
        <section className="support-channel-card" aria-labelledby="whatsapp-channel-title">
          <div className="settings-section-heading">
            <MessageCircle size={20} />
            <div>
              <h2 id="whatsapp-channel-title">WhatsApp Support</h2>
              <p>For urgent operational issues or rapid turnaround during laboratory hours.</p>
            </div>
          </div>

          <div className="whatsapp-box">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.88rem", color: "#166534" }}>
              <Clock size={16} />
              <span>{config.operatingHours}</span>
            </div>

            {config.whatsappNumber ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.92rem", fontWeight: 600, color: "#14532d" }}>
                <Phone size={16} />
                <span>+{config.whatsappNumber}</span>
              </div>
            ) : null}

            <p style={{ fontSize: "0.84rem", color: "#374151", margin: "4px 0 8px 0", lineHeight: 1.5 }}>
              Opens a direct WhatsApp chat prefilled with your laboratory context. No patient data is shared.
            </p>

            {whatsAppLink ? (
              <a
                href={whatsAppLink}
                target="_blank"
                rel="noopener noreferrer"
                className="whatsapp-btn"
              >
                <MessageCircle size={18} />
                <span>Open WhatsApp Chat</span>
              </a>
            ) : (
              <div style={{ fontSize: "0.82rem", color: "#6b7280", fontStyle: "italic" }}>
                Official WhatsApp support number is being provisioned. Please submit a request form on the right.
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Support Request Form */}
        <section className="support-channel-card" aria-labelledby="form-channel-title">
          <div className="settings-section-heading">
            <Send size={20} />
            <div>
              <h2 id="form-channel-title">Submit a Support Request</h2>
              <p>Log a technical ticket with our engineering team. Tickets receive tracked follow-up.</p>
            </div>
          </div>

          {submittedTicket ? (
            <div className="support-ticket-success-card" style={{ marginTop: "20px" }}>
              <CheckCircle2 size={44} color="#16a34a" />
              <h3 style={{ margin: 0, color: "#14532d", fontSize: "1.15rem", fontWeight: 700 }}>
                Request Submitted Successfully
              </h3>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "#166534", maxWidth: "420px", lineHeight: 1.5 }}>
                Your request has been logged. Please keep your reference code handy for inquiries.
              </p>
              <div className="support-ref-code">
                {submittedTicket.referenceCode}
              </div>
              <button
                type="button"
                className="btn-primary-action"
                onClick={handleReset}
                style={{ marginTop: "8px" }}
              >
                <RotateCcw size={16} />
                <span>Submit Another Request</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ marginTop: "18px" }}>
              <div className="settings-form-grid" style={{ gridTemplateColumns: "1fr", gap: "16px", marginTop: 0 }}>
                <label className="form-group-clean">
                  <span>Category <span className="required-star">*</span></span>
                  <select
                    value={form.category}
                    onChange={updateField("category")}
                    required
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-group-clean">
                  <span>Subject <span className="required-star">*</span></span>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={updateField("subject")}
                    placeholder="e.g. Barcode scanner timeout on order entry"
                    minLength={4}
                    maxLength={150}
                    required
                  />
                  <span style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "2px" }}>
                    {form.subject.length}/150 characters
                  </span>
                </label>

                <label className="form-group-clean">
                  <span>Detailed Description <span className="required-star">*</span></span>
                  <textarea
                    rows={5}
                    value={form.description}
                    onChange={updateField("description")}
                    placeholder="Provide relevant details: what action you took, what happened, and any error message displayed."
                    minLength={10}
                    maxLength={2000}
                    required
                  />
                  <span style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "2px" }}>
                    {form.description.length}/2000 characters
                  </span>
                </label>

                <label className="form-group-clean">
                  <span>Alternate Contact Number or Email (Optional)</span>
                  <input
                    type="text"
                    value={form.contactInfo}
                    onChange={updateField("contactInfo")}
                    placeholder="e.g. +92 300 0000000 or duty-tech@lab.com"
                    maxLength={100}
                  />
                </label>
              </div>

              <div className="support-privacy-notice">
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
                <span>
                  <strong>Privacy Notice:</strong> Do not include patient CNIC numbers, patient names, medical test results, or passwords.
                </span>
              </div>

              <div className="settings-actions" style={{ marginTop: "16px" }}>
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={submitting}
                >
                  <Send size={16} />
                  <span>{submitting ? "Submitting Request…" : "Submit Request"}</span>
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
