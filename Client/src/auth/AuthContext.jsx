import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../api/resources";
import { identifyAnalyticsUser } from "../analytics";

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // The session is an httpOnly cookie; the server clears it on logout.
  const clearSession = () => setUser(null);
  const logout = () => {
    setUser(null);
    authApi.logout().catch(() => {});
  };
  useEffect(() => {
    // Tokens from before the cookie change are no longer used.
    try { localStorage.removeItem("lms_token"); } catch { /* storage blocked */ }
    const restore = async () => {
      try { setUser((await authApi.me()).data.user); } catch { clearSession(); }
      finally { setLoading(false); }
    };
    restore();
    window.addEventListener("lms:unauthorized", logout);
    return () => window.removeEventListener("lms:unauthorized", logout);
  }, []);
  useEffect(() => {
    identifyAnalyticsUser(user);
  }, [user]);
  const login = async (credentials) => {
    const response = await authApi.login(credentials);
    setUser(response.data.user);
  };
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
