import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../api/resources";

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const logout = () => { localStorage.removeItem("lms_token"); setUser(null); };
  useEffect(() => {
    const restore = async () => {
      if (!localStorage.getItem("lms_token")) { setLoading(false); return; }
      try { setUser((await authApi.me()).data.user); } catch { logout(); }
      finally { setLoading(false); }
    };
    restore();
    window.addEventListener("lms:unauthorized", logout);
    return () => window.removeEventListener("lms:unauthorized", logout);
  }, []);
  const login = async (credentials) => {
    const response = await authApi.login(credentials);
    localStorage.setItem("lms_token", response.data.token);
    setUser(response.data.user);
  };
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
