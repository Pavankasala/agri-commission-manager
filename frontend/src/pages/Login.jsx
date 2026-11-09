import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_ENDPOINTS } from "../api/config";
import "../App.css";

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [approvalNotice, setApprovalNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLoginResponse = (userData, token) => {
    const userObj = userData || { name: email.split("@")[0] || "Operator", email };
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
                  setApprovalNotice(null);
                  const backendRes = await axios.post(API_ENDPOINTS.GOOGLE_AUTH, {
                    credential: response.credential
                  });
                  if (backendRes.data && backendRes.data.success) {
                    if (backendRes.data.pending_approval) {
                      setApprovalNotice({
                        type: "pending",
                        message: backendRes.data.message || "Your Google account has been registered, but access is awaiting administrator approval."
                      });
                      return;
                    }
                    const flaskJwtToken = backendRes.data.access_token || backendRes.data.token;
                    handleLoginResponse(backendRes.data.user, flaskJwtToken);
                  } else {
                    setError(backendRes.data?.message || "Google sign-in failed. Please try again.");
                  }
                } catch (e) {
                  if (e.response?.data?.pending_approval || e.response?.data?.rejected) {
                    setApprovalNotice({
                      type: e.response.data.rejected ? "rejected" : "pending",
                      message: e.response.data.message || "Your access is pending administrator approval."
                    });
                  } else {
                    setError(e.response?.data?.message || "Google sign-in failed. Please try again.");
                  }
                }
              }
            }
          });
          const btnDiv = document.getElementById("googleBtnContainer");
          if (btnDiv) {
            btnDiv.innerHTML = "";
            window.google.accounts.id.renderButton(btnDiv, {
              type: "standard",
              theme: "outline",
              size: "large",
              text: "continue_with",
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
    if (!email) {
      setError("Please enter your email or username!");
      return;
    }
    if (!password) {
      setError("Please enter your password!");
      return;
    }
    setError("");
    setApprovalNotice(null);
    setLoading(true);

    try {
      const response = await axios.post(API_ENDPOINTS.LOGIN, {
        username: email,
        email: email,
        password: password,
      });

      if (response.data && response.data.success) {
        if (response.data.pending_approval) {
          setApprovalNotice({
            type: "pending",
            message: response.data.message || "Your account is awaiting administrator approval."
          });
          return;
        }
        handleLoginResponse(response.data.user, response.data.access_token);
      } else {
        setError(response.data?.message || "Incorrect email or password");
      }
    } catch (err) {
      if (err.response?.data?.pending_approval || err.response?.data?.rejected) {
        setApprovalNotice({
          type: err.response.data.rejected ? "rejected" : "pending",
          message: err.response.data.message || "Your access is pending administrator approval."
        });
      } else {
        const msg = err.response?.data?.message || "Unable to connect to backend server. Please verify your internet or backend connection.";
        setError(msg);
      }
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
            <h2>Grow smarter. Farm better.</h2>
            <p>
              Manage your agricultural commission bills, farmer balances, cash collections,
              and sales reports from one place.
            </p>
          </div>

          <div className="brand-footer">
            Built for farmers, designed for growth.
          </div>
        </section>

        <section className="auth-form-side">
          <div className="auth-form-wrapper">
            <div className="auth-heading">
              <h1>Welcome back</h1>
              <p>Enter your details to access your dashboard.</p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email or Username</label>
                <input
                  id="email"
                  type="text"
                  name="email"
                  placeholder="admin or farmer@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {approvalNotice && (
                <div style={{
                  margin: "14px 0",
                  padding: "14px 16px",
                  borderRadius: "8px",
                  border: approvalNotice.type === "rejected" ? "1px solid #fecaca" : "1px solid #fed7aa",
                  backgroundColor: approvalNotice.type === "rejected" ? "#fef2f2" : "#fffbeb",
                  color: approvalNotice.type === "rejected" ? "#991b1b" : "#9a3412",
                  fontSize: "14px",
                  lineHeight: "1.5",
                  textAlign: "left"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "4px" }}>
                    <span>{approvalNotice.type === "rejected" ? "🚫" : "⏳"}</span>
                    <span>{approvalNotice.type === "rejected" ? "Access Declined" : "Account Pending Approval"}</span>
                  </div>
                  <p style={{ margin: 0 }}>{approvalNotice.message}</p>
                  {approvalNotice.type === "pending" && (
                    <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#b45309" }}>
                      Please contact your system administrator to approve your account. Once approved, you can log in immediately.
                    </p>
                  )}
                </div>
              )}

              {error && <p className="auth-error">{error}</p>}

              <button className="auth-button" type="submit" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            <div style={{ margin: "20px 0", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", margin: "15px 0" }}>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }}></div>
                <span style={{ padding: "0 10px", color: "#64748b", fontSize: "14px" }}>OR</span>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }}></div>
              </div>

              <div id="googleBtnContainer" style={{ display: "flex", justifyContent: "center", width: "100%", minHeight: "44px" }}></div>


            </div>

            <p className="auth-switch">
              Don't have an account? <Link to="/signup">Create account</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
