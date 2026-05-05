import React, { useState } from "react";
import axios from "axios";
import Plot from "react-plotly.js";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

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
      const res = await axios.post("http://localhost:5000/predict", formData);
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

  const downloadPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(30, 41, 59); // Dark blue header
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Clinical AI Risk Assessment", 105, 20, { align: "center" });

    // Patient Info Table
    doc.autoTable({
      startY: 40,
      head: [['Patient Details', 'Value']],
      body: [
        ['Name', form.patient_name || "Unknown"],
        ['Age', form.age || "Unknown"],
        ['Gender', form.gender],
        ['Risk Prediction', result.prediction],
        ['Combined Risk Score', typeof result.score === 'number' ? result.score.toFixed(1) : result.score],
      ],
      theme: 'grid',
      headStyles: { fillColor: [56, 189, 248] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
    });

    // Biomarkers Table
    let previousY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 70;
    doc.autoTable({
      startY: previousY + 10,
      head: [['Biomarker Analysis', 'Level']],
      body: [
        ['miR-134', form.mir134],
        ['IL-6', form.il6],
        ['S100B', form.s100b],
      ],
      theme: 'grid',
      headStyles: { fillColor: [56, 189, 248] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
    });

    // EEG Table
    previousY = doc.lastAutoTable ? doc.lastAutoTable.finalY : previousY + 40;
    if (result.eeg_data && result.eeg_data.meta) {
      const m = result.eeg_data.meta;
      doc.autoTable({
        startY: previousY + 10,
        head: [['EEG Segment Summary', 'Value']],
        body: [
          ['Total Windows', m.n_windows],
          ['Ictal Windows', m.ictal_windows],
          ['Pre-ictal Windows', m.preictal_windows],
          ['Interictal Windows', m.interictal_windows],
        ],
        theme: 'grid',
        headStyles: { fillColor: [56, 189, 248] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
      });
      previousY = doc.lastAutoTable ? doc.lastAutoTable.finalY : previousY + 40;
    }

    // AI Explanation
    let finalY = previousY + 15;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("AI Clinical Explanation", 14, finalY);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const splitText = doc.splitTextToSize(result.report || "No explanation available", 180);
    
    // Check if text fits, if not add page
    if (finalY + 10 + (splitText.length * 6) > 280) {
      doc.addPage();
      finalY = 20;
    }
    
    doc.text(splitText, 14, finalY + 8);
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated automatically by Multimodal Epilepsy Risk Assessment AI - Page ${i}`, 105, 290, { align: 'center' });
    }

    doc.save(`${form.patient_name || "Patient"}_Clinical_Report.pdf`);
  };

  const renderPlot = (fig, title) => {
    if (!fig) return null;
    return (
      <div style={styles.chartContainer}>
        <h4 style={styles.chartTitle}>{title}</h4>
        <div style={styles.plotWrapper}>
          <Plot
            data={fig.data}
            layout={{
              ...fig.layout,
              autosize: true,
              margin: { l: 40, r: 20, t: 30, b: 40 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              font: { color: "#e2e8f0" }
            }}
            useResizeHandler={true}
            style={{ width: "100%", height: "100%" }}
            config={{ displayModeBar: false }}
          />
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.heading}>Input Parameters</h2>

        {/* Patient Metadata */}
        <div style={styles.section}>
          <h3 style={styles.subheading}>Patient Information</h3>
          <div style={styles.inputGrid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Patient Name</label>
              <input type="text" name="patient_name" placeholder="e.g. John Doe" value={form.patient_name} onChange={handleChange} style={styles.input} />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Age</label>
              <input type="number" name="age" placeholder="e.g. 35" value={form.age} onChange={handleChange} style={styles.input} />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Gender</label>
              <select name="gender" value={form.gender} onChange={handleChange} style={styles.input}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Biomarkers */}
        <div style={styles.section}>
          <h3 style={styles.subheading}>Salivary Biomarkers</h3>
          <div style={styles.inputGrid}>
            {["mir134", "il6", "s100b"].map((key) => (
              <div key={key} style={styles.inputGroup}>
                <label style={styles.label}>{key.toUpperCase()}</label>
                <input type="text" inputMode="decimal" placeholder={`Enter ${key.toUpperCase()}`} name={key} value={form[key]} onChange={handleChange} style={styles.input} />
              </div>
            ))}
          </div>
        </div>

        {/* EEG Upload */}
        <div style={styles.uploadBox}>
          <label style={styles.uploadLabel}>
            Upload EEG Data (.edf)
            <input type="file" accept=".edf" onChange={handleFileChange} style={{ display: "none" }} />
          </label>
          <p style={styles.uploadText}>{file ? file.name : "Click to upload or drag EDF file"}</p>
        </div>

        <button onClick={handleSubmit} style={styles.button} disabled={loading}>
          {loading ? "Processing Analysis..." : "Run Multi-Modal Analysis"}
        </button>
      </div>

      {/* Results Section */}
      {result && (
        <div style={styles.resultsWrapper}>
          <div style={styles.resultHeader}>
            <div>
              <h2 style={styles.resultTitle}>Risk Assessment: <span style={{ color: result.prediction === "High Risk" ? "#ef4444" : result.prediction === "Moderate Risk" ? "#f59e0b" : "#22c55e" }}>{result.prediction}</span></h2>
              <p style={{ color: "#94a3b8", fontSize: "16px", marginTop: "5px" }}>Combined Risk Score: {result.score.toFixed(1)}</p>
            </div>
          </div>
          
          <div style={styles.card}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
               <h3 style={{ ...styles.subheading, margin: 0 }}>Clinical AI Report</h3>
               <button onClick={downloadPDF} style={styles.downloadButton}>
                 ⬇ Download PDF
               </button>
             </div>
             <p style={styles.reportText}>{result.report || "No explanation available"}</p>
          </div>

          {result.eeg_data && (
            <div style={styles.eegDashboard}>
              <h2 style={{ ...styles.heading, marginTop: "10px", color: "#38bdf8" }}>🧠 EEG Seizure Analysis</h2>
              
              {/* Summary Cards */}
              <div style={styles.statsGrid}>
                {[
                  { label: "Total Windows", value: result.eeg_data.meta.n_windows, color: "#94a3b8" },
                  { label: "Ictal", value: result.eeg_data.meta.ictal_windows, color: "#ef4444" },
                  { label: "Pre-ictal", value: result.eeg_data.meta.preictal_windows, color: "#f59e0b" },
                  { label: "Interictal", value: result.eeg_data.meta.interictal_windows, color: "#3b82f6" },
                  { label: "Segments", value: result.eeg_data.meta.n_segments, color: "#a855f7" },
                  { label: "Duration", value: `${Math.round(result.eeg_data.meta.duration_s)}s`, color: "#22c55e" }
                ].map((stat, i) => (
                  <div key={i} style={styles.statCard}>
                    <div style={styles.statLabel}>{stat.label}</div>
                    <div style={{ ...styles.statValue, color: stat.color }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div style={styles.chartsLayout}>
                {renderPlot(result.eeg_data.figs?.timeline, "Segment Timeline")}
                {renderPlot(result.eeg_data.figs?.eeg, "Raw EEG Signal")}
                
                <div style={styles.chartRow}>
                  {renderPlot(result.eeg_data.figs?.bandpower, "Band Power Heatmap")}
                  {renderPlot(result.eeg_data.figs?.pie, "Window Composition")}
                </div>

                <div style={styles.chartRow}>
                  {renderPlot(result.eeg_data.figs?.confidence, "Confidence Distribution")}
                  {renderPlot(result.eeg_data.figs?.channel, "Signal RMS by Class")}
                </div>
              </div>

              {/* Segments Table */}
              {result.eeg_data.segments && result.eeg_data.segments.length > 0 && (
                <div style={styles.chartContainer}>
                  <h4 style={styles.chartTitle}>Detected Segments</h4>
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Class</th>
                          <th style={styles.th}>Start (s)</th>
                          <th style={styles.th}>End (s)</th>
                          <th style={styles.th}>Duration (s)</th>
                          <th style={styles.th}>Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.eeg_data.segments.map((seg, i) => (
                          <tr key={i} style={styles.tr}>
                            <td style={{ ...styles.td, color: seg.label === 'Ictal' ? '#ef4444' : seg.label === 'Pre-ictal' ? '#f59e0b' : '#3b82f6', fontWeight: 'bold' }}>{seg.label}</td>
                            <td style={styles.td}>{seg.t_start.toFixed(1)}</td>
                            <td style={styles.td}>{seg.t_end.toFixed(1)}</td>
                            <td style={styles.td}>{seg.duration_s.toFixed(1)}</td>
                            <td style={styles.td}>{(seg.mean_prob * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },
  card: {
    backgroundColor: "#1e293b",
    padding: "25px",
    borderRadius: "16px",
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
  resultsWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },
  resultHeader: {
    backgroundColor: "#1e293b",
    padding: "20px",
    borderRadius: "12px",
    borderLeft: "6px solid #38bdf8"
  },
  resultTitle: {
    margin: 0,
    fontSize: "24px"
  },
  downloadButton: {
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    transition: "background-color 0.2s"
  },
  reportText: {
    color: "#cbd5f5",
    lineHeight: "1.6",
    fontSize: "15px",
    backgroundColor: "#0f172a",
    padding: "20px",
    borderRadius: "8px",
    border: "1px solid #1e293b"
  },
  eegDashboard: {
    backgroundColor: "#1e293b",
    padding: "25px",
    borderRadius: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "15px",
    marginBottom: "10px"
  },
  statCard: {
    backgroundColor: "#0f172a",
    padding: "15px",
    borderRadius: "10px",
    border: "1px solid #334155",
    textAlign: "center"
  },
  statLabel: {
    color: "#94a3b8",
    fontSize: "13px",
    marginBottom: "5px",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: "0.5px"
  },
  statValue: {
    fontSize: "24px",
    fontWeight: "bold"
  },
  chartsLayout: {
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },
  chartContainer: {
    backgroundColor: "#0f172a",
    borderRadius: "12px",
    border: "1px solid #334155",
    overflow: "hidden"
  },
  chartTitle: {
    padding: "15px 20px",
    margin: 0,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderBottom: "1px solid #334155",
    fontSize: "16px",
    color: "#cbd5f5"
  },
  plotWrapper: {
    height: "350px",
    width: "100%"
  },
  chartRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px"
  },
  tableWrapper: {
    overflowX: "auto",
    padding: "15px"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left"
  },
  th: {
    padding: "12px",
    borderBottom: "1px solid #334155",
    color: "#94a3b8",
    fontWeight: "600"
  },
  tr: {
    borderBottom: "1px solid #1e293b"
  },
  td: {
    padding: "12px",
    color: "#e2e8f0"
  }
};

export default Predictor;