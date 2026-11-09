import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_ENDPOINTS } from "../api/config";
import "../App.css";

export default function Signup({ onLoginSuccess }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [registeredPending, setRegisteredPending] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignupSuccess = (userData, token) => {
    const userObj = userData || { name, email };
    if (onLoginSuccess) {
      onLoginSuccess(userObj);
    }
    localStorage.setItem("user", JSON.stringify(userObj));
    if (token) {
      localStorage.setItem("token", token);
    }
    navigate("/home");
  };

  // Google Identity Services (GIS) Initialization
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    let isInitialized = false;
    const initGsi = () => {
      if (isInitialized) return;
      if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response) => {
              if (response && response.credential) {
                try {
                  setError("");
                  const backendRes = await axios.post(API_ENDPOINTS.GOOGLE_AUTH, {
                    credential: response.credential
                  });
                  if (backendRes.data && backendRes.data.success) {
                    if (backendRes.data.pending_approval) {
                      setRegisteredPending({
                        name: backendRes.data.user?.name || "New User",
                        email: backendRes.data.user?.email || "Google Account",
                        message: backendRes.data.message || "Your account has been registered and is awaiting administrator approval."
                      });
                      return;
                    }
                    const flaskJwtToken = backendRes.data.access_token || backendRes.data.token;
                    handleSignupSuccess(backendRes.data.user, flaskJwtToken);
                  } else {
                    setError(backendRes.data?.message || "Google sign-up failed. Please try again.");
                  }
                } catch (e) {
                  if (e.response?.data?.pending_approval || e.response?.data?.rejected) {
                    setRegisteredPending({
                      name: e.response.data.user?.name || "User",
                      email: e.response.data.user?.email || "",
                      message: e.response.data.message || "Your account is pending administrator approval."
                    });
                  } else {
                    setError(e.response?.data?.message || "Google sign-up failed. Please try again.");
                  }
                }
              }
            }
          });
          const btnDiv = document.getElementById("googleBtnContainerSignup");
          if (btnDiv) {
            btnDiv.innerHTML = "";
            window.google.accounts.id.renderButton(btnDiv, {
              type: "standard",
              theme: "outline",
              size: "large",
              text: "signup_with",
              shape: "rectangular",
              width: 320
            });
          }
          isInitialized = true;
        } catch (e) {}
      }
    };

    initGsi();
    const interval = setInterval(initGsi, 300);
    const timeout = setTimeout(() => clearInterval(interval), 4000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);





  async function handleSubmit(e) {
    e.preventDefault();
    if (!name) {
      setError("Please enter your full name");
      return;
    }
    if (!email) {
      setError("Please enter a valid email address!");
      return;
    }
    if (!password) {
      setError("Please enter a password!");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters!");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const response = await axios.post(API_ENDPOINTS.SIGNUP, {
        name,
        email,
        password,
      });

      if (response.data && response.data.success) {
        if (response.data.pending_approval) {
          setRegisteredPending({
            name,
            email,
            message: response.data.message || "Your account has been submitted and is pending administrator approval."
          });
          return;
        }
        const token = response.data.access_token || response.data.token;
        handleSignupSuccess(response.data.user || { name, email }, token);
      } else {
        setError(response.data?.message || "Signup failed. Please try again.");
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        (typeof err.response?.data === "string" && err.response.data.includes("already exists")
          ? "An account with this email already exists. Please sign in."
          : null) ||
        (typeof err.response?.data === "string" && !err.response.data.startsWith("<")
          ? err.response.data
          : null) ||
        "Sign-up failed. Please verify your details or try again.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="auth-page">
      <div className="auth-container">
        <section className="auth-brand">
          <div className="brand-logo">
            <div className="brand-icon">🌱</div>
            Agri Commission Manager
          </div>

          <div className="brand-content">
            <h2>Start growing with us.</h2>
            <p>
              Create your account and get access to tools designed to
              make managing your bills and commissions simpler and smarter.
            </p>
          </div>

          <div className="brand-footer">
            Technology that grows with your business.
          </div>
        </section>

        <section className="auth-form-side">
          <div className="auth-form-wrapper">
            {registeredPending ? (
              <div style={{ textAlign: "center", padding: "24px 12px" }}>
                <div style={{ fontSize: "52px", marginBottom: "16px" }}>⏳</div>
                <h1 style={{ fontSize: "24px", color: "#0f172a", marginBottom: "8px", fontWeight: "800" }}>
                  Registration Received
                </h1>
                <p style={{ color: "#64748b", fontSize: "15px", marginBottom: "20px" }}>
                  Your account request has been submitted to the administrator.
                </p>

                <div style={{
                  backgroundColor: "#fffbeb",
                  border: "1px solid #fed7aa",
                  borderRadius: "10px",
                  padding: "16px",
                  margin: "20px 0",
                  textAlign: "left",
                  color: "#9a3412"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "6px" }}>
                    <span>🔒</span>
                    <span>Admin Approval Required</span>
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: "14px" }}>
                    Account registered for <strong>{registeredPending.name}</strong> ({registeredPending.email}).
                  </p>
                  <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5" }}>
                    {registeredPending.message}
                  </p>
                  <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#b45309" }}>
                    Once the administrator verifies and approves your access, you can sign in with your credentials.
                  </p>
                </div>

                <button
                  className="auth-button"
                  type="button"
                  onClick={() => navigate("/login")}
                  style={{ width: "100%", marginTop: "10px" }}
                >
                  Go to Login Page
                </button>
              </div>
            ) : (
              <>
                <div className="auth-heading">
                  <h1>Create account</h1>
                  <p>Enter your information to get started.</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label htmlFor="name">Full name</label>
                    <input
                      id="name"
                      type="text"
                      name="name"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="signup-email">Email address</label>
                    <input
                      id="signup-email"
                      type="email"
                      name="email"
                      placeholder="farmer@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="signup-password">Password</label>
                    <input
                      id="signup-password"
                      type="password"
                      name="password"
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirm-password">Confirm password</label>
                    <input
                      id="confirm-password"
                      type="password"
                      name="confirmPassword"
                      placeholder="Enter password again"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>

                  {error && <p className="auth-error">{error}</p>}

                  <button className="auth-button" type="submit" disabled={loading}>
                    {loading ? "Creating Account..." : "Create Account"}
                  </button>
                </form>

                <div style={{ margin: "20px 0", textAlign: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", margin: "15px 0" }}>
                    <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }}></div>
                    <span style={{ padding: "0 10px", color: "#64748b", fontSize: "14px" }}>OR</span>
                    <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }}></div>
                  </div>

                  <div id="googleBtnContainerSignup" style={{ display: "flex", justifyContent: "center", width: "100%", minHeight: "44px" }}></div>
                </div>

                <p className="auth-switch">
                  Already have an account? <Link to="/login">Login</Link>
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
