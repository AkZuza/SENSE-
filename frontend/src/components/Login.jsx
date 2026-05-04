import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const Login = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");

    const endpoint = isRegister ? "/register" : "/login";
    try {
      const res = await axios.post(`http://localhost:5000${endpoint}`, form);
      if (isRegister) {
        setIsRegister(false);
        setForm({ username: "", password: "" });
        alert("Registration successful. Please login.");
      } else {
        onLogin(res.data.user_id, res.data.username);
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.error || "An error occurred");
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>{isRegister ? "Create Account" : "Welcome Back"}</h2>
        <p style={styles.subtitle}>
          {isRegister
            ? "Sign up to access the Risk Assessment platform."
            : "Sign in to your account."}
        </p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              style={styles.input}
              placeholder="Enter your username"
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Processing..." : isRegister ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <p style={styles.toggleText}>
          {isRegister ? "Already have an account? " : "Don't have an account? "}
          <span
            style={styles.toggleLink}
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
          >
            {isRegister ? "Sign In" : "Sign Up"}
          </span>
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#0f172a",
    fontFamily: "Inter, sans-serif"
  },
  card: {
    backgroundColor: "#1e293b",
    padding: "40px",
    borderRadius: "16px",
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
    width: "100%",
    maxWidth: "400px",
    textAlign: "center"
  },
  title: {
    color: "#e2e8f0",
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "10px"
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "14px",
    marginBottom: "30px"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },
  inputGroup: {
    textAlign: "left"
  },
  label: {
    display: "block",
    color: "#cbd5f5",
    fontSize: "14px",
    marginBottom: "8px",
    fontWeight: "500"
  },
  input: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "white",
    fontSize: "14px",
    boxSizing: "border-box"
  },
  button: {
    padding: "14px",
    backgroundColor: "#2563eb",
    border: "none",
    borderRadius: "8px",
    color: "white",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.2s"
  },
  error: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    color: "#ef4444",
    padding: "10px",
    borderRadius: "8px",
    marginBottom: "20px",
    fontSize: "14px"
  },
  toggleText: {
    color: "#94a3b8",
    marginTop: "20px",
    fontSize: "14px"
  },
  toggleLink: {
    color: "#38bdf8",
    cursor: "pointer",
    fontWeight: "600"
  }
};

export default Login;
