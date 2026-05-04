import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Predictor from "./components/Predictor";
import InfoCards from "./components/InfoCards";
import Login from "./components/Login";

const Dashboard = ({ user, onLogout }) => {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div>
            <h1 style={styles.title}>
              Multimodal Epilepsy Risk Assessment
            </h1>
            <p style={styles.subtitle}>
              Integration of salivary biomarkers and EEG signals for non-invasive neurological risk evaluation
            </p>
          </div>
          <div style={styles.userSection}>
            <span style={styles.welcomeText}>Welcome, {user.username}</span>
            <button onClick={onLogout} style={styles.logoutButton}>Logout</button>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <Predictor user={user} />

      {/* Info Section BELOW */}
      <InfoCards />
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);

  const handleLogin = (id, username) => {
    setUser({ id, username });
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={user ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />} 
        />
        <Route 
          path="/dashboard" 
          element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} 
        />
      </Routes>
    </Router>
  );
};

const styles = {
  container: {
    backgroundColor: "#0f172a",
    minHeight: "100vh",
    color: "#e2e8f0",
    padding: "30px",
    fontFamily: "Inter, sans-serif"
  },
  header: {
    marginBottom: "25px"
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: "600"
  },
  subtitle: {
    marginTop: "10px",
    color: "#94a3b8"
  },
  userSection: {
    display: "flex",
    alignItems: "center",
    gap: "15px"
  },
  welcomeText: {
    color: "#cbd5f5",
    fontWeight: "500"
  },
  logoutButton: {
    padding: "8px 16px",
    backgroundColor: "#ef4444",
    border: "none",
    borderRadius: "6px",
    color: "white",
    cursor: "pointer",
    fontWeight: "600"
  }
};

export default App;