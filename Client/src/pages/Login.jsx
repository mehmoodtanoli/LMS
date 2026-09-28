import { useState } from "react";

import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

import { apiError } from "../api/client";

import { ErrorMessage } from "../components/Common";
import { Activity } from "lucide-react";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      await login(form);
      navigate("/");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Activity className="brand-icon" size={32} color="var(--accent-primary)" />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>MEDI-LAB</span>
            <small style={{ fontSize: '0.65em', color: 'var(--text-secondary)' }}>LIMS Workspace</small>
          </div>
        </div>

        <h1>Sign in</h1>

        <p>Use your laboratory account to continue.</p>

        <ErrorMessage error={error} />

        <label>
          Email
          <input
            type="email"
            required
            autoComplete="email"
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
          Password
          <input
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={form.password}
            onChange={(e) =>
              setForm({
                ...form,
                password: e.target.value,
              })
            }
          />
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(e) => setShowPassword(e.target.checked)}
          />
          Show password
        </label>

        <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
