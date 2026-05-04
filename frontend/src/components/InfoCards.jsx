import React from "react";

const InfoCards = () => {
  return (
    <div style={styles.container}>
      
      {/* Card 1 */}
      <div style={styles.card}>
        <h3 style={styles.heading}>Salivary Biomarkers</h3>
        <p style={styles.text}>
          This system utilizes three key salivary biomarkers that reflect underlying neurological and inflammatory processes:
        </p>

        <ul style={styles.list}>
          <li>
            <strong>miR-134</strong>: A neuron-specific microRNA associated with synaptic plasticity and neuronal injury.
            Elevated levels have been linked to seizure activity and altered neural signaling.
          </li>
          <li>
            <strong>IL-6</strong>: A pro-inflammatory cytokine indicating neuroinflammatory responses, often elevated
            in neurological disorders including epilepsy.
          </li>
          <li>
            <strong>S100B</strong>: A calcium-binding protein used as a marker for blood-brain barrier disruption
            and glial cell activation.
          </li>
        </ul>
      </div>

      {/* Card 2 */}
      <div style={styles.card}>
        <h3 style={styles.heading}>EEG Signal Integration</h3>
        <p style={styles.text}>
          Electroencephalography (EEG) captures temporal brain activity through electrical signals recorded
          from the scalp. These signals provide direct insight into neuronal firing patterns.
        </p>

        <p style={styles.text}>
          The system processes uploaded EEG data to extract statistical features such as:
        </p>

        <ul style={styles.list}>
          <li>Mean signal amplitude</li>
          <li>Signal variance and standard deviation</li>
          <li>Temporal fluctuations indicating abnormal activity</li>
        </ul>

        <p style={styles.text}>
          These features help identify irregular neural dynamics associated with seizure risk.
        </p>
      </div>

      {/* Card 3 */}
      <div style={styles.card}>
        <h3 style={styles.heading}>System Methodology</h3>

        <ol style={styles.list}>
          <li>Input salivary biomarker concentrations</li>
          <li>Upload EEG signal data (CSV format)</li>
          <li>Extract statistical and temporal features from EEG</li>
          <li>Combine multimodal inputs into a predictive model</li>
          <li>Generate a risk score and classification output</li>
        </ol>

        <p style={styles.text}>
          This approach integrates systemic biochemical indicators with real-time neural activity,
          enabling a more comprehensive assessment compared to single-modality systems.
        </p>

        <p style={styles.disclaimer}>
          Disclaimer: This system is a research prototype and is not intended for clinical diagnosis or medical decision-making.
        </p>
      </div>

    </div>
  );
};

const styles = {
  container: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
    marginTop: "30px"
  },
  card: {
    backgroundColor: "#1e293b",
    padding: "20px",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
  },
  heading: {
    marginBottom: "10px",
    color: "#38bdf8"
  },
  text: {
    fontSize: "14px",
    color: "#cbd5f5",
    lineHeight: "1.6"
  },
  list: {
    fontSize: "14px",
    color: "#cbd5f5",
    lineHeight: "1.6",
    paddingLeft: "18px"
  },
  disclaimer: {
    marginTop: "10px",
    fontSize: "12px",
    color: "#94a3b8"
  }
};

export default InfoCards;