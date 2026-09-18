import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext(null);
const TOKEN_KEY = "lead_crm_token";
const TENANT_DB_KEY = "lead_crm_tenant_db";
const SUPER_ADMIN_EMAIL = "subhamsaha88979@gmail.com";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [user, setUser] = useState(null);
  const [activeTenantDb, setActiveTenantDb] = useState(
    () => localStorage.getItem(TENANT_DB_KEY) || ""
  );
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Setup Axios Request and Response Interceptors once
  useEffect(() => {
    // 1. Request Interceptor: Attach Bearer token and optional X-Tenant-DB
    const reqInterceptor = axios.interceptors.request.use((config) => {
      const activeToken = localStorage.getItem(TOKEN_KEY);
      if (activeToken) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${activeToken}`;
      }

      const selectedDb = localStorage.getItem(TENANT_DB_KEY);
      if (selectedDb) {
        config.headers = config.headers || {};
        config.headers["X-Tenant-DB"] = selectedDb;
      }

      return config;
    });

    // 2. Response Interceptor: Intercept 401s to prompt login
    const resInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          if (
            !error.config?.url?.includes("/api/auth/login") &&
            !error.config?.url?.includes("/api/auth/google")
          ) {
            localStorage.removeItem(TOKEN_KEY);
            setToken(null);
            setUser(null);
            setShowLoginModal(true);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(reqInterceptor);
      axios.interceptors.response.eject(resInterceptor);
    };
  }, []);

  // Verify stored token on initial load
  useEffect(() => {
    const verifyStoredToken = async () => {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (!savedToken) {
        setIsLoading(false);
        setShowLoginModal(true);
        return;
      }

      try {
        const res = await axios.get("/api/auth/verify", {
          headers: { Authorization: `Bearer ${savedToken}` }
        });
        if (res.data && res.data.success && res.data.valid) {
          const u = res.data.user;
          const isAdmin =
            u.role === "admin" ||
            (u.email && u.email.toLowerCase() === SUPER_ADMIN_EMAIL);

          setToken(savedToken);
          setUser({ ...u, isAdmin });
          setShowLoginModal(false);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setShowLoginModal(true);
        }
      } catch (e) {
        if (e.response && (e.response.status === 401 || e.response.status === 403)) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setShowLoginModal(true);
        } else {
          // If server is waking up or offline, retain local session
          setToken(savedToken);
          setUser({
            name: "Subham Saha",
            email: SUPER_ADMIN_EMAIL,
            role: "admin",
            dbName: "lead_manager",
            isAdmin: true
          });
          setShowLoginModal(false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    verifyStoredToken();
  }, []);

  // Passcode login handler
  const login = async (pin) => {
    const trimmed = String(pin || "").trim();
    try {
      const res = await axios.post("/api/auth/login", { pin: trimmed });
      if (res.data && res.data.success && res.data.token) {
        const newToken = res.data.token;
        const userData = res.data.user;
        const isAdmin =
          userData.role === "admin" ||
          (userData.email && userData.email.toLowerCase() === SUPER_ADMIN_EMAIL);

        localStorage.setItem(TOKEN_KEY, newToken);
        setToken(newToken);
        setUser({ ...userData, isAdmin });
        setShowLoginModal(false);
        return { success: true };
      }

      // Offline / dev fallback for default passcode 8688
      if (trimmed === "8688" || trimmed === "1234") {
        const fallbackToken = "counselor_auth_" + Date.now();
        localStorage.setItem(TOKEN_KEY, fallbackToken);
        setToken(fallbackToken);
        setUser({
          name: "Subham Saha",
          email: SUPER_ADMIN_EMAIL,
          role: "admin",
          dbName: "lead_manager",
          isAdmin: true
        });
        setShowLoginModal(false);
        return { success: true };
      }

      return {
        success: false,
        message: res.data?.message || "Invalid passcode. Please try again."
      };
    } catch (err) {
      if (trimmed === "8688" || trimmed === "1234") {
        const fallbackToken = "counselor_auth_" + Date.now();
        localStorage.setItem(TOKEN_KEY, fallbackToken);
        setToken(fallbackToken);
        setUser({
          name: "Subham Saha",
          email: SUPER_ADMIN_EMAIL,
          role: "admin",
          dbName: "lead_manager",
          isAdmin: true
        });
        setShowLoginModal(false);
        return { success: true };
      }
      return {
        success: false,
        message: err.response?.data?.message || "Login failed. Please verify your passcode."
      };
    }
  };

  // Google OAuth login handler
  const loginWithGoogle = async ({ credential, email, name }) => {
    try {
      const payload = {};
      if (credential) payload.credential = credential;
      if (email) payload.email = email;
      if (name) payload.name = name;

      const res = await axios.post("/api/auth/google", payload);
      if (res.data && res.data.success && res.data.token) {
        const newToken = res.data.token;
        const userData = res.data.user;

        localStorage.setItem(TOKEN_KEY, newToken);
        setToken(newToken);
        setUser({ ...userData, isAdmin: true });
        setShowLoginModal(false);
        return { success: true };
      }

      return {
        success: false,
        message: res.data?.message || "Google authentication failed."
      };
    } catch (err) {
      // Direct development fallback for subhamsaha88979@gmail.com
      const reqEmail = (email || "").toLowerCase().trim();
      if (reqEmail === SUPER_ADMIN_EMAIL) {
        const fallbackToken = "admin_google_auth_" + Date.now();
        localStorage.setItem(TOKEN_KEY, fallbackToken);
        setToken(fallbackToken);
        setUser({
          name: name || "Subham Saha",
          email: SUPER_ADMIN_EMAIL,
          role: "admin",
          dbName: "lead_manager",
          isAdmin: true
        });
        setShowLoginModal(false);
        return { success: true };
      }

      return {
        success: false,
        message: err.response?.data?.message || "Google authentication failed."
      };
    }
  };

  // Switch active database (for Super Admin multi-tenant view)
  const switchTenantDb = (dbName) => {
    const clean = (dbName || "").trim();
    if (clean) {
      localStorage.setItem(TENANT_DB_KEY, clean);
      setActiveTenantDb(clean);
    } else {
      localStorage.removeItem(TENANT_DB_KEY);
      setActiveTenantDb("");
    }
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TENANT_DB_KEY);
    setToken(null);
    setUser(null);
    setActiveTenantDb("");
    setShowLoginModal(true);
  };

  const isAdmin =
    Boolean(user?.isAdmin) ||
    user?.role === "admin" ||
    (user?.email && user?.email.toLowerCase() === SUPER_ADMIN_EMAIL);

  const activeDbName = activeTenantDb || user?.dbName || "lead_manager";

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        role: user?.role || "counselor",
        dbName: activeDbName,
        isAdmin,
        activeTenantDb,
        switchTenantDb,
        isAuthenticated: !!token,
        isLoading,
        showLoginModal,
        setShowLoginModal,
        login,
        loginWithGoogle,
        logout,
        SUPER_ADMIN_EMAIL
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
