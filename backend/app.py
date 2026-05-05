from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv
import os
import tempfile
from eeg_processor import run_inference, build_figures
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()
HF_API_KEY = os.getenv("HF_API_KEY")

app = Flask(__name__)
CORS(app)

# Database Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# ---------------- MODELS ----------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)

class PatientRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    patient_name = db.Column(db.String(100), nullable=False)
    age = db.Column(db.Integer, nullable=False)
    gender = db.Column(db.String(20), nullable=False)
    mir134 = db.Column(db.Float, nullable=False)
    il6 = db.Column(db.Float, nullable=False)
    s100b = db.Column(db.Float, nullable=False)
    eeg_mean = db.Column(db.Float, nullable=False)
    eeg_std = db.Column(db.Float, nullable=False)
    risk_score = db.Column(db.Float, nullable=False)
    risk_prediction = db.Column(db.String(20), nullable=False)
    report = db.Column(db.Text, nullable=False)

with app.app_context():
    db.create_all()

# ---------------- AUTH ROUTES ----------------
@app.route("/register", methods=["POST"])
def register():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 400

    new_user = User(username=username, password_hash=generate_password_hash(password))
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "User registered successfully"}), 201

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    user = User.query.filter_by(username=username).first()

    if user and check_password_hash(user.password_hash, password):
        return jsonify({
            "message": "Login successful",
            "user_id": user.id,
            "username": user.username
        }), 200

    return jsonify({"error": "Invalid username or password"}), 401


# ---------------- EEG PROCESSING ----------------
def process_eeg(file_obj):
    # Save the file temporarily
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, file_obj.filename)
    file_obj.save(temp_path)
    
    try:
        df, segments, raw_eeg, raw_t, meta = run_inference(temp_path)
        figs = build_figures(df, segments, raw_eeg, raw_t, meta)
        
        return {
            "df": df.to_dict('records'),
            "segments": segments,
            "meta": meta,
            "figs": figs
        }
    except Exception as e:
        print("EEG processing error:", e)
        return None
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ---------------- RISK MODEL ----------------
def predict_risk(mir134, il6, s100b, eeg_meta=None):
    score = 0
    
    # miR-134 rules (below 1.5: low, 1.5-3: mod, >3: high)
    if mir134 > 3:
        score += 3
    elif mir134 >= 1.5:
        score += 2
    else:
        score += 1
        
    # IL-6 rules (1-10: healthy, 10-30: mid, >30: high)
    if il6 > 30:
        score += 3
    elif il6 >= 10:
        score += 2
    else:
        score += 1
        
    # S100B rules (<0.05: healthy, 0.05-0.1: mod, >0.1: high)
    if s100b > 0.1:
        score += 3
    elif s100b >= 0.05:
        score += 2
    else:
        score += 1
    
    # Add EEG risk if available
    if eeg_meta:
        total = max(eeg_meta.get("n_windows", 1), 1)
        ictal_ratio = eeg_meta.get("ictal_windows", 0) / total
        preictal_ratio = eeg_meta.get("preictal_windows", 0) / total
        score += (ictal_ratio * 5.0) + (preictal_ratio * 2.0)

    # Determine final prediction
    if score >= 7:
        prediction = "High Risk"
    elif score >= 5:
        prediction = "Moderate Risk"
    else:
        prediction = "Low Risk"
        
    return score, prediction


# ---------------- LLM REPORT ----------------
def generate_report(data):
    try:
        eeg_info = "No EEG data provided."
        if data.get("meta"):
            meta = data["meta"]
            eeg_info = f"{meta.get('ictal_windows', 0)} ictal windows and {meta.get('preictal_windows', 0)} pre-ictal windows detected out of {meta.get('n_windows', 0)} total."

        system_content = """You are a factual medical AI assisting a patient. 
Write a concise, easy-to-understand summary explaining their results based ONLY on the provided findings. 
Use plain language that the general public can understand. Avoid complex medical jargon. Explain what the biomarker levels and EEG findings mean in simple, everyday terms.
Do not hallucinate, do not add external information, and do not make assumptions beyond what is explicitly given."""

        user_content = f"""Biomarkers:
miR-134: {data.get('mir134', 'N/A')}
IL-6: {data.get('il6', 'N/A')}
S100B: {data.get('s100b', 'N/A')}

EEG Analysis:
{eeg_info}

Risk Prediction: {data.get('prediction', 'Unknown')}"""

        API_URL = "https://router.huggingface.co/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {HF_API_KEY}"
        }

        payload = {
            "model": "deepseek-ai/DeepSeek-V4-Pro:novita",
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_content}
            ],
            "max_tokens": 250,
            "temperature": 0.1
        }

        response = requests.post(
            API_URL,
            headers=headers,
            json=payload,
            timeout=60
        )

        try:
            output = response.json()
        except Exception as e:
            return f"API Error ({response.status_code}): {response.text}"

        if "choices" in output and len(output["choices"]) > 0:
            return output["choices"][0]["message"]["content"].strip()
        elif "error" in output:
            return f"Model error: {output['error']}"

        return f"Unexpected API response: {str(output)}"

    except Exception as e:
        print("LLM error:", e)
        return f"Report generation failed: {str(e)}"


# ---------------- API ROUTE ----------------
@app.route("/predict", methods=["POST"])
def predict():
    try:
        # User & Patient Data
        user_id = request.form.get("user_id")
        patient_name = request.form.get("patient_name", "Unknown")
        age = int(request.form.get("age", 0))
        gender = request.form.get("gender", "Unknown")

        if not user_id:
             return jsonify({"error": "User ID is required"}), 401

        mir134 = float(request.form.get("mir134", 0))
        il6 = float(request.form.get("il6", 0))
        s100b = float(request.form.get("s100b", 0))

        eeg_file = request.files.get("eeg")

        eeg_results = None
        if eeg_file and eeg_file.filename.endswith('.edf'):
            eeg_results = process_eeg(eeg_file)

        eeg_meta = eeg_results["meta"] if eeg_results else None

        score, prediction = predict_risk(
            mir134, il6, s100b, eeg_meta
        )

        # 🔥 Generate LLM report
        report = generate_report({
            "mir134": mir134,
            "il6": il6,
            "s100b": s100b,
            "meta": eeg_meta,
            "prediction": prediction
        })

        # Save to DB
        record = PatientRecord(
            user_id=user_id,
            patient_name=patient_name,
            age=age,
            gender=gender,
            mir134=mir134,
            il6=il6,
            s100b=s100b,
            eeg_mean=0, # Deprecated with EDF approach, maintaining for DB compatibility
            eeg_std=0,  # Deprecated with EDF approach, maintaining for DB compatibility
            risk_score=round(score, 2),
            risk_prediction=prediction,
            report=report
        )
        db.session.add(record)
        db.session.commit()

        response_data = {
            "prediction": prediction,
            "score": round(score, 2),
            "report": report
        }
        
        if eeg_results:
            response_data["eeg_data"] = eeg_results

        return jsonify(response_data)

    except Exception as e:
        print("Error:", e)
        return jsonify({"error": "Invalid input"}), 400


# ---------------- RUN SERVER ----------------
if __name__ == "__main__":
    app.run(debug=True)