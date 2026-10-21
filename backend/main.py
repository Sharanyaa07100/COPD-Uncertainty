
import os
import json
import pickle
from typing import Literal

import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


HERE = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(
    title="COPD Screening Estimate API",
    version="5.0",
)

# Frontend URLs allowed to call this API.
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the trained model and its metadata.
with open(os.path.join(HERE, "final_model.pkl"), "rb") as file:
    MODEL = pickle.load(file)

with open(os.path.join(HERE, "model_info.json"), "r", encoding="utf-8") as file:
    INFO = json.load(file)

with open(os.path.join(HERE, "conformal.json"), "r", encoding="utf-8") as file:
    CONFORMAL = json.load(file)

QHAT = CONFORMAL["qhat"]


# The feature names and order must match train_final.py.
FEATURES = [
    "RIDAGEYR",
    "SMQ020_ever",
    "MCQ010_asthma",
    "BMXBMI",
    "current_smoker",
]

FACTOR_NAMES = {
    "RIDAGEYR": "Age (years)",
    "SMQ020_ever": "Ever smoked 100+ cigarettes",
    "MCQ010_asthma": "Asthma",
    "BMXBMI": "BMI (kg/m²)",
    "current_smoker": "Currently smoking",
}

DISCLAIMER = (
    "Research prototype. Not a diagnostic tool. "
    "Spirometry is the diagnostic standard."
)

# Describes the questions shown by the frontend.
FIELDS = [
    {
        "key": "RIDAGEYR",
        "label": "Age (years)",
        "type": "number",
        "min": 20,
        "max": 80,
        "step": 1,
    },
    {
        "key": "SMQ020",
        "label": "Have you smoked at least 100 cigarettes in your life?",
        "type": "select",
        "options": [
            {"value": 1, "label": "Yes"},
            {"value": 2, "label": "No"},
        ],
    },
    {
        "key": "SMQ040",
        "label": "If you have smoked 100+ cigarettes, do you smoke now?",
        "type": "select",
        "options": [
            {"value": 1, "label": "Every day"},
            {"value": 2, "label": "Some days"},
            {"value": 3, "label": "Not at all"},
        ],
        "depends_on": "SMQ020",
        "depends_on_value": 1,
    },
    {
        "key": "MCQ010",
        "label": "Has a doctor ever told you that you have asthma?",
        "type": "select",
        "options": [
            {"value": 1, "label": "Yes"},
            {"value": 2, "label": "No"},
        ],
    },
    {
        "key": "BMXBMI",
        "label": "Body mass index (kg/m²)",
        "type": "number",
        "min": 10,
        "max": 80,
        "step": 0.1,
    },
]


class PatientInput(BaseModel):
    RIDAGEYR: int = Field(..., ge=20, le=80)
    SMQ020: Literal[1, 2]
    SMQ040: Literal[1, 2, 3] | None = None
    MCQ010: Literal[1, 2]
    BMXBMI: float = Field(..., ge=10, le=80)


def conformal_labels(prob: float) -> list[str]:
    """Return labels included in the calibrated prediction set."""
    labels = []

    if 1 - prob <= QHAT:
        labels.append("COPD")

    if prob <= QHAT:
        labels.append("No COPD")

    return labels


def set_text(labels: list[str]) -> str:
    if labels == ["No COPD"]:
        return (
            "Consistent with no COPD at the target coverage level. "
            "This estimate does not replace spirometry."
        )

    if labels == ["COPD"]:
        return (
            "COPD is plausible at the target coverage level. "
            "Confirmation requires clinical assessment and spirometry."
        )

    return (
        "The model's prediction is uncertain. "
        "Clinical assessment and spirometry are recommended."
    )


@app.get("/")
async def root():
    return {
        "message": "COPD Screening Estimate API",
        "version": "5.0",
        "status": "online",
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model_loaded": MODEL is not None,
        "feature_count": len(FEATURES),
    }


@app.get("/features")
async def features():
    return {"features": FIELDS}


@app.get("/model-info")
async def model_info():
    return INFO


@app.post("/predict")
async def predict(p: PatientInput):
    # Convert the smoking answers into the same binary features
    # used during model training.
    ever_smoked = 1 if p.SMQ020 == 1 else 0
    has_asthma = 1 if p.MCQ010 == 1 else 0

    # A person who never smoked 100 cigarettes is not a current smoker.
    # For someone who did, current smoking is based on SMQ040:
    # 1 = every day, 2 = some days, 3 = not at all.
    if p.SMQ020 == 2:
        current_smoker = 0
    elif p.SMQ040 in (1, 2):
        current_smoker = 1
    elif p.SMQ040 == 3:
        current_smoker = 0
    else:
        return {
            "error": (
                "Please answer the current-smoking question "
                "if you have smoked at least 100 cigarettes."
            )
        }

    # Use named columns in exactly the training order.
    row = pd.DataFrame(
        [[
            p.RIDAGEYR,
            ever_smoked,
            has_asthma,
            p.BMXBMI,
            current_smoker,
        ]],
        columns=FEATURES,
    )

    prob = float(MODEL.predict_proba(row)[0, 1])

    # Calculate each feature's contribution relative to the
    # standardized feature values used by logistic regression.
    scaler = MODEL.named_steps["standardscaler"]
    logistic = MODEL.named_steps["logisticregression"]

    coefficients = logistic.coef_[0]
    standardized_values = scaler.transform(row)[0]
    contributions = coefficients * standardized_values

    factors = [
        {
            "name": FACTOR_NAMES[feature],
            "effect": (
                "pushes the model estimate above the study average"
                if contribution > 0
                else "pushes the model estimate below the study average"
            ),
        }
        for feature, contribution in zip(FEATURES, contributions)
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
