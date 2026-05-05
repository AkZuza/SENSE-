# SENSE-  
**Multimodal Epilepsy Risk Assessment System**

SENSE- is a full-stack system for **epilepsy risk prediction** that combines:

- EEG signal analysis using deep learning (EEGNet)
- Biomarker-based risk scoring (miR-134, IL-6, S100B)
- Interactive web dashboard for clinicians/users

The system integrates **signal processing, ML inference, and clinical heuristics** into a unified pipeline.

---

## 🧠 Core Idea

SENSE- performs **multimodal analysis**:

1. **EEG data (EDF files)** → processed using EEGNet  
2. **Biomarkers (saliva-based)** → rule-based scoring  
3. Combined → **risk prediction + report generation**

---

## ⚙️ Tech Stack

### Backend
- Flask
- PyTorch (EEGNet)
- MNE (EEG processing)
- SQLite (database)
- Plotly (visualizations)

### Frontend
- React (Vite)
- Plotly.js (EEG graphs)
- Axios (API calls)
- jsPDF (report generation)

---

## 📁 Project Structure

```
SENSE--main/
│
├── backend/
│   ├── app.py
│   ├── eeg_processor.py
│   ├── eegnet_3class_chb01.pt
│   ├── eegnet_3class_chb01_secondary.pt
│   └── requirements.txt
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       └── components/
│           ├── Login.jsx
│           ├── Predictor.jsx
│           └── InfoCards.jsx
│
└── .gitignore
```

---

## 🔐 Features

### 1. Authentication
- User registration & login
- Password hashing (Werkzeug)
- SQLite-backed user system

---

### 2. EEG Processing Pipeline

- Input: **EDF files**
- Processing:
  - Bandpass filtering
  - Window segmentation (2s window, 1s step)
  - Feature extraction (band power: delta → gamma)
- Model:
  - EEGNet (3-class classification):
    - Interictal
    - Pre-ictal
    - Ictal

---

### 3. Deep Learning Model

- Architecture: **EEGNet**
- Input shape: `(Channels=23, Time=512)`
- Framework: PyTorch
- Runs on: CPU / CUDA (if available)

---

### 4. Biomarker-Based Risk Model

Inputs:
- miR-134
- IL-6
- S100B

Output:
- Risk Score
- Risk Category (Low / Moderate / High)

---

### 5. Visualization

- EEG signal plots
- Segment-wise predictions
- Band power distribution
- Interactive Plotly charts

---

### 6. Report Generation

- Stores patient records:
  - Demographics
  - Biomarkers
  - EEG statistics
  - Risk prediction

---

## 🚀 Setup & Installation

### Backend

```
cd backend
pip install -r requirements.txt
python app.py
```

Runs on:
```
http://localhost:5000
```

---

### Frontend

```
cd frontend
npm install
npm run dev
```

Runs on:
```
http://localhost:5173
```

---

## 🔌 API Endpoints

### Auth
- `POST /register`
- `POST /login`

### Prediction
- Combines EEG + biomarkers
- Returns risk score and classification

---

## 🧪 EEG Pipeline Details

- Sampling rate: 256 Hz
- Window: 2 seconds
- Step: 1 second
- Frequency bands:
  - Delta (1–4 Hz)
  - Theta (4–8 Hz)
  - Alpha (8–13 Hz)
  - Beta (13–30 Hz)
  - Gamma (30–80 Hz)

---

## 🧩 Key Highlights

- Multimodal fusion (EEG + biomarkers)
- Real-time processing capability
- Clinically interpretable scoring system
- Full-stack deployment ready

---

## ⚠️ Notes

- Requires **23-channel EDF input**
- Ensure models are present in backend
- Clean EEG signals recommended

---

## 🔮 Future Improvements

- ML-based fusion model
- Real-time EEG streaming
- Cloud deployment
- Mobile integration

---

## 👤 Author

- Akhil Jose (AkZuza)
