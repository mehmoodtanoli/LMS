import { useEffect, useState } from "react";
import { Building2, Image, Mail, MapPin, Phone, Save, Settings } from "lucide-react";
import { laboratorySettingsApi } from "../api/resources";
import { apiError } from "../api/client";
import { ErrorMessage, Loading } from "../components/Common";

const initialForm = {
  name: "",
  address: "",
  phone: "",
  email: "",
  logoUrl: "",
  tagline: "",
};

export default function LaboratorySettings() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    laboratorySettingsApi
      .get()
      .then((response) => {
        const laboratory = response.data.laboratory;
        setForm({
          name: laboratory.name || "",
          address: laboratory.address || "",
          phone: laboratory.phone || "",
          email: laboratory.email || "",
          logoUrl: laboratory.logoUrl || "",
          tagline: laboratory.tagline || "",
        });
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setError("");
    setSuccess("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!form.name.trim()) {
      setError("Laboratory name is required.");
      return;
    }

    setSaving(true);
    try {
      const response = await laboratorySettingsApi.update(form);
      const laboratory = response.data.laboratory;
      setForm({
        name: laboratory.name || "",
        address: laboratory.address || "",
        phone: laboratory.phone || "",
        email: laboratory.email || "",
        logoUrl: laboratory.logoUrl || "",
        tagline: laboratory.tagline || "",
      });
      setSuccess("Laboratory settings saved successfully.");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading text="Loading laboratory settings…" />;

  return (
    <div className="settings-page">
      <header className="page-header-simple">
        <div>
          <h1 className="page-title">Laboratory Settings</h1>
          <p className="page-subtitle">Keep your laboratory profile and report details up to date.</p>
        </div>
        <Settings size={28} color="#1d4ed8" aria-hidden="true" />
      </header>

      <ErrorMessage error={error} />
      {success && <div className="alert success">{success}</div>}

      <form className="settings-card" onSubmit={submit}>
        <div className="settings-section-heading">
          <Building2 size={18} />
          <div>
            <h2>Laboratory profile</h2>
            <p>This information appears on newly generated reports.</p>
          </div>
        </div>

        <div className="settings-form-grid">
          <label className="form-group-clean">
            <span>Laboratory Name <span className="required-star">*</span></span>
            <input value={form.name} onChange={updateField("name")} required />
          </label>
          <label className="form-group-clean">
            <span>Tagline</span>
            <input value={form.tagline} onChange={updateField("tagline")} maxLength={160} />
          </label>
          <label className="form-group-clean settings-field-wide">
            <span><MapPin size={14} /> Address</span>
            <textarea value={form.address} onChange={updateField("address")} rows={3} maxLength={500} />
          </label>
          <label className="form-group-clean">
            <span><Phone size={14} /> Phone Number</span>
            <input type="tel" value={form.phone} onChange={updateField("phone")} />
          </label>
          <label className="form-group-clean">
            <span><Mail size={14} /> Email Address</span>
            <input type="email" value={form.email} onChange={updateField("email")} />
          </label>
        </div>

        <div className="settings-section-heading settings-section-heading-spaced">
          <Image size={18} />
          <div>
            <h2>Laboratory logo</h2>
            <p>Use a secure, persistent image URL. Direct file uploads are not enabled because no persistent file storage is configured.</p>
          </div>
        </div>
        <label className="form-group-clean">
          <span>Logo URL</span>
          <input type="url" value={form.logoUrl} onChange={updateField("logoUrl")} placeholder="https://example.com/laboratory-logo.png" />
        </label>

        <div className="settings-actions">
          <button type="submit" className="btn-primary-action" disabled={saving}>
            <Save size={16} />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
