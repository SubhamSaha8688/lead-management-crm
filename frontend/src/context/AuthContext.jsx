import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext(null);
const TOKEN_KEY = "lead_crm_token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Setup Axios Request and Response Interceptors once
  useEffect(() => {
    // 1. Request Interceptor: Attach Bearer token to all outgoing requests
    const reqInterceptor = axios.interceptors.request.use((config) => {
      const activeToken = localStorage.getItem(TOKEN_KEY);
      if (activeToken) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${activeToken}`;
      }
      return config;
    });

    // 2. Response Interceptor: Intercept 401s to prompt login
    const resInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          // Only prompt login if not already hitting the login endpoint
          if (!error.config?.url?.includes("/api/auth/login")) {
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
          setToken(savedToken);
          setUser(res.data.user || { name: "Subham Saha", role: "Learning Consultant" });
          setShowLoginModal(false);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setShowLoginModal(true);
        }
      } catch (e) {
        // If verify fails (expired or invalid), prompt login
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setShowLoginModal(true);
      } finally {
        setIsLoading(false);
      }
    };

    verifyStoredToken();
  }, []);

  // Login handler
  const login = async (pin) => {
    try {
      const res = await axios.post("/api/auth/login", { pin });
      if (res.data && res.data.success && res.data.token) {
        const newToken = res.data.token;
        localStorage.setItem(TOKEN_KEY, newToken);
        setToken(newToken);
        setUser(res.data.user || { name: "Subham Saha" });
        setShowLoginModal(false);
        return { success: true };
      }
      return {
        success: false,
        message: res.data?.message || "Invalid PIN. Please try again."
      };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || "Login failed. Please verify your PIN."
      };
    }
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setShowLoginModal(true);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token,
        isLoading,
        showLoginModal,
        setShowLoginModal,
        login,
        logout
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
