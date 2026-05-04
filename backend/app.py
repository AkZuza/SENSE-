from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import numpy as np
import pandas as pd
import requests
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
def process_eeg(file):
    try:
        df = pd.read_csv(file)

        mean_val = df.mean().mean()
        std_val = df.std().mean()

        return mean_val, std_val
    except Exception as e:
        print("EEG processing error:", e)
        return 0, 0


# ---------------- RISK MODEL ----------------
def predict_risk(mir134, il6, s100b, eeg_mean, eeg_std):
    score = (
        mir134 * 0.3 +
        il6 * 0.25 +
        s100b * 0.25 +
        eeg_mean * 0.1 +
        eeg_std * 0.1
    )

    prediction = "High Risk" if score > 5 else "Low Risk"

    return score, prediction


# ---------------- LLM REPORT ----------------
def generate_report(data):
    try:
        prompt = f"""
        Explain the following biomarker values in simple terms:

        miR-134: {data['mir134']}
        IL-6: {data['il6']}
        S100B: {data['s100b']}
        """

        API_URL = "https://api-inference.huggingface.co/models/google/flan-t5-large"
        headers = {
            "Authorization": f"Bearer {HF_API_KEY}"
        }

        response = requests.post(
            API_URL,
            headers=headers,
            json={"inputs": prompt},
            timeout=10
        )

        output = response.json()

        if isinstance(output, list):
            return output[0].get("generated_text", "No report generated")

        return str(output)

    except Exception as e:
        print("LLM error:", e)
        return "Report generation failed"


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

        eeg_mean, eeg_std = process_eeg(eeg_file) if eeg_file else (0, 0)

        score, prediction = predict_risk(
            mir134, il6, s100b, eeg_mean, eeg_std
        )

        # 🔥 Generate LLM report
        report = generate_report({
            "mir134": mir134,
            "il6": il6,
            "s100b": s100b
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
            eeg_mean=eeg_mean,
            eeg_std=eeg_std,
            risk_score=round(score, 2),
            risk_prediction=prediction,
            report=report
        )
        db.session.add(record)
        db.session.commit()

        return jsonify({
            "prediction": prediction,
            "score": round(score, 2),
            "report": report
        })

    except Exception as e:
        print("Error:", e)
        return jsonify({"error": "Invalid input"}), 400


# ---------------- RUN SERVER ----------------
if __name__ == "__main__":
    app.run(debug=True)