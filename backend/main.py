import os
import json
import pickle
from typing import Literal

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

HERE = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="COPD Screening Estimate API", version="4.0")

FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS", "http://localhost:5173"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL = pickle.load(open(os.path.join(HERE, 'final_model.pkl'), 'rb'))
INFO = json.load(open(os.path.join(HERE, 'model_info.json')))
CONFORMAL = json.load(open(os.path.join(HERE, 'conformal.json')))
QHAT = CONFORMAL['qhat']

# Must match the order used in train_final.py
FEATURES = ['RIDAGEYR', 'SMQ020_ever', 'MCQ010_asthma', 'BMXBMI']
FACTOR_NAMES = {
    'RIDAGEYR': 'Age (years)',
    'SMQ020_ever': 'Ever smoked 100+ cigarettes',
    'MCQ010_asthma': 'Asthma',
    'BMXBMI': 'BMI (kg/mÂ²)',
}
DISCLAIMER = ("Research prototype. Not a diagnostic tool. "
              "Spirometry is the diagnostic standard.")

FIELDS = [
    {"key": "RIDAGEYR", "label": "Age (years)", "type": "number",
     "min": 20, "max": 80, "step": 1},
    {"key": "SMQ020", "label": "Have you smoked at least 100 cigarettes in your life?",
     "type": "select", "options": [{"value": 1, "label": "Yes"}, {"value": 2, "label": "No"}]},
    {"key": "MCQ010", "label": "Has a doctor ever told you that you have asthma?",
     "type": "select", "options": [{"value": 1, "label": "Yes"}, {"value": 2, "label": "No"}]},
    {"key": "BMXBMI", "label": "Body mass index (kg/mÂ²)", "type": "number",
     "min": 10, "max": 80, "step": 0.1},
]


class PatientInput(BaseModel):
    RIDAGEYR: int = Field(..., ge=20, le=80)
    SMQ020: Literal[1, 2]
    MCQ010: Literal[1, 2]
    BMXBMI: float = Field(..., ge=10, le=80)


def conformal_labels(prob: float) -> list[str]:
    """Labels whose nonconformity score is within the calibrated threshold."""
    labels = []
    if 1 - prob <= QHAT:
        labels.append("COPD")
    if prob <= QHAT:
        labels.append("No COPD")
    return labels


def set_text(labels: list[str]) -> str:
    if labels == ["No COPD"]:
        return ("Consistent with no COPD at 90% coverage. "
                "This estimate alone does not replace spirometry.")
    if labels == ["COPD"]:
        return "COPD is plausible at 90% coverage. Confirm with spirometry."
    return "Uncertain at 90% coverage. Spirometry is recommended."


@app.get("/")
async def root():
    return {"message": "COPD Screening Estimate API", "version": "4.0", "status": "online"}


@app.get("/features")
async def features():
    return {"features": FIELDS}


@app.get("/model-info")
async def model_info():
    return INFO


@app.post("/predict")
async def predict(p: PatientInput):
    row = np.array([[
        p.RIDAGEYR,
        1 if p.SMQ020 == 1 else 0,
        1 if p.MCQ010 == 1 else 0,
        p.BMXBMI,
    ]], dtype=float)

    prob = float(MODEL.predict_proba(row)[0, 1])

    # Each factor's contribution relative to the average adult in the study
    scaler = MODEL.named_steps['standardscaler']
    coefs = MODEL.named_steps['logisticregression'].coef_[0]
    z = scaler.transform(row)[0]
    contributions = coefs * z

    factors = [
        {"name": FACTOR_NAMES[f],
         "effect": ("pushes estimate above the study average" if c > 0
                    else "pushes estimate below the study average")}
        for f, c in zip(FEATURES, contributions)
    ]

    labels = conformal_labels(prob)

    return {
        "probability": round(prob, 4),
        "percent": round(prob * 100, 1),
        "population_percent": INFO["sample"]["copd_percent"],
        "prediction_set": labels,
        "prediction_set_text": set_text(labels),
        "coverage_target_percent": CONFORMAL["target_coverage_percent"],
        "factors": factors,
        "disclaimer": DISCLAIMER,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
