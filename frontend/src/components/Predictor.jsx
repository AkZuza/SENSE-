import React, { useState } from "react";
import axios from "axios";

const Predictor = ({ user }) => {
  const [form, setForm] = useState({
    patient_name: "",
    age: "",
    gender: "Other",
    mir134: "",
    il6: "",
    s100b: ""
  });

  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Validation for biomarker float inputs
    if (["mir134", "il6", "s100b"].includes(name)) {
      if (/^\d*\.?\d*$/.test(value)) {
        setForm({ ...form, [name]: value });
      }
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async () => {
    if (!form.mir134 || !form.il6 || !form.s100b || !form.patient_name || !form.age) {
      alert("Please enter all required fields");
      return;
    }

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("user_id", user?.id);
    formData.append("patient_name", form.patient_name);
    formData.append("age", form.age);
    formData.append("gender", form.gender);
    
    formData.append("mir134", parseFloat(form.mir134));
    formData.append("il6", parseFloat(form.il6));
    formData.append("s100b", parseFloat(form.s100b));

    if (file) formData.append("eeg", file);

    try {
      const res = await axios.post(
        "http://localhost:5000/predict",
        formData
      );
      setResult(res.data);
    } catch (err) {
      console.error(err);
      setResult({
        prediction: "Error",
        score: "-",
        report: "Failed to connect to backend"
      });
    }

    setLoading(false);
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.heading}>Input Parameters</h2>

      {/* Patient Metadata */}
      <div style={styles.section}>
        <h3 style={styles.subheading}>Patient Information</h3>
        <div style={styles.inputGrid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Patient Name</label>
            <input
              type="text"
              name="patient_name"
              placeholder="e.g. John Doe"
              value={form.patient_name}
              onChange={handleChange}
              style={styles.input}
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Age</label>
            <input
              type="number"
              name="age"
              placeholder="e.g. 35"
              value={form.age}
              onChange={handleChange}
              style={styles.input}
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Gender</label>
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* EEG Upload */}
      <div style={styles.uploadBox}>
        <label style={styles.uploadLabel}>
          Upload EEG Data (CSV)
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </label>
        <p style={styles.uploadText}>
          {file ? file.name : "Click to upload or drag file"}
        </p>
      </div>

      {/* Biomarkers */}
      <div style={styles.section}>
        <h3 style={styles.subheading}>Salivary Biomarkers</h3>
        <div style={styles.inputGrid}>
          {["mir134", "il6", "s100b"].map((key) => (
            <div key={key} style={styles.inputGroup}>
              <label style={styles.label}>{key.toUpperCase()}</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder={`Enter ${key.toUpperCase()}`}
                name={key}
                value={form[key]}
                onChange={handleChange}
                style={styles.input}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Button */}
      <button onClick={handleSubmit} style={styles.button}>
        {loading ? "Processing..." : "Run Analysis & Save"}
      </button>

      {/* Result */}
      {result && (
        <div style={styles.result}>
          <h3>
            Prediction:{" "}
            <span
              style={{
                color:
                  result.prediction === "High Risk"
                    ? "#ef4444"
                    : "#22c55e"
              }}
            >
              {result.prediction}
            </span>
          </h3>

          <p style={{ marginTop: "5px", color: "#94a3b8" }}>Score: {result.score}</p>

          <div style={{ marginTop: "15px" }}>
            <h4 style={{ color: "#38bdf8", marginBottom: "5px" }}>Explanation</h4>
            <p style={styles.reportText}>
              {result.report || "No explanation available"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  card: {
    backgroundColor: "#1e293b",
    padding: "25px",
    borderRadius: "16px",
    marginBottom: "20px",
    color: "#e2e8f0",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
  },
  heading: {
    marginBottom: "20px",
    fontSize: "22px",
    borderBottom: "1px solid #334155",
    paddingBottom: "10px"
  },
  subheading: {
    color: "#38bdf8",
    marginBottom: "15px",
    fontSize: "18px"
  },
  section: {
    marginBottom: "25px",
    backgroundColor: "#0f172a",
    padding: "20px",
    borderRadius: "12px",
    border: "1px solid #334155"
  },
  inputGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "15px"
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column"
  },
  label: {
    marginBottom: "8px",
    fontSize: "14px",
    fontWeight: "500",
    color: "#cbd5f5"
  },
  input: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#1e293b",
    border: "1px solid #475569",
    color: "white",
    borderRadius: "8px",
    fontSize: "14px",
    boxSizing: "border-box"
  },
  // Upload
  uploadBox: {
    border: "2px dashed #38bdf8",
    padding: "30px",
    textAlign: "center",
    borderRadius: "12px",
    marginBottom: "25px",
    cursor: "pointer",
    backgroundColor: "#020617",
    transition: "background-color 0.2s"
  },
  uploadLabel: {
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    display: "block",
    color: "#e2e8f0"
  },
  uploadText: {
    fontSize: "13px",
    color: "#94a3b8",
    marginTop: "10px"
  },
  button: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#2563eb",
    border: "none",
    color: "white",
    cursor: "pointer",
    borderRadius: "8px",
    fontWeight: "600",
    fontSize: "16px",
    transition: "background-color 0.2s"
  },
  result: {
    marginTop: "25px",
    padding: "20px",
    backgroundColor: "#020617",
    borderRadius: "12px",
    border: "1px solid #334155"
  },
  reportText: {
    color: "#cbd5f5",
    lineHeight: "1.6",
    fontSize: "14px",
    backgroundColor: "#0f172a",
    padding: "15px",
    borderRadius: "8px",
    border: "1px solid #1e293b"
  }
};

export default Predictor;