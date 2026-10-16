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
        <div className="login-brand-header">
          <div className="brand-icon-box" style={{ width: "44px", height: "44px", borderRadius: "10px", background: "#0e2a47", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", margin: "0 auto 12px" }}>
            <Activity size={24} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 4px", color: "var(--text-primary)" }}>City Diagnostics</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>Laboratory Management System</p>
        </div>

        <h1 style={{ marginTop: "24px" }}>Sign in</h1>
        <p>Use your laboratory credentials to access the workspace.</p>

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
