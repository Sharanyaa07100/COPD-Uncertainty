import os
import json
import pickle
from typing import Literal, Optional
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

HERE = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="COPD Screening Estimate API", version="5.0")
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "feature_count": len(FEATURES),
    }
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
BOOT_MODELS = pickle.load(open(os.path.join(HERE, 'bootstrap_models.pkl'), 'rb'))
MODEL = pickle.load(open(os.path.join(HERE, 'final_model.pkl'), 'rb'))
INFO = json.load(open(os.path.join(HERE, 'model_info.json')))
CONFORMAL = json.load(open(os.path.join(HERE, 'conformal.json')))
SCREENING = json.load(open(os.path.join(HERE, 'screening.json')))
QHAT = CONFORMAL['qhat']
REFER_CUTOFF = SCREENING['refer_cutoff']

# Must match the order in train_final.py
FEATURES = ['RIDAGEYR', 'SMQ020_ever', 'MCQ010_asthma', 'BMXBMI', 'current_smoker']
FACTOR_NAMES = {
    'RIDAGEYR': 'Age (years)',
    'SMQ020_ever': 'Ever smoked 100+ cigarettes',
    'MCQ010_asthma': 'Asthma',
    'BMXBMI': 'BMI (kg/m²)',
    'current_smoker': 'Currently smoking',
}
DISCLAIMER = ("Research prototype. Not a diagnostic tool. "
              "Spirometry is the diagnostic standard.")

FIELDS = [
    {"key": "RIDAGEYR", "label": "Age (years)", "type": "number",
     "min": 20, "max": 120, "step": 1},
    {"key": "SMQ020", "label": "Have you smoked at least 100 cigarettes in your life?",
     "type": "select", "options": [{"value": 1, "label": "Yes"}, {"value": 2, "label": "No"}]},
    {"key": "SMQ040", "label": "Do you now smoke cigarettes? (asked if you answered Yes above)",
     "type": "select", "options": [{"value": 1, "label": "Every day"},
                                   {"value": 2, "label": "Some days"},
                                   {"value": 3, "label": "Not at all"}],
     "required_if": {"key": "SMQ020", "value": 1}},
    {"key": "MCQ010", "label": "Has a doctor ever told you that you have asthma?",
     "type": "select", "options": [{"value": 1, "label": "Yes"}, {"value": 2, "label": "No"}]},
    {"key": "BMXBMI", "label": "Body mass index (kg/m²)", "type": "number",
     "min": 10, "max": 80, "step": 0.1},
]


class PatientInput(BaseModel):
    RIDAGEYR: int = Field(..., ge=20, le=120)
    SMQ020: Literal[1, 2]
    SMQ040: Optional[Literal[1, 2, 3]] = None
    MCQ010: Literal[1, 2]
    BMXBMI: float = Field(..., ge=15, le=70)


def conformal_labels(prob: float) -> list[str]:
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


def referral_text(refer: bool, uncertain: bool) -> str:
    npv = SCREENING["test_npv_percent"]
    if refer:
        return "Refer for spirometry. The estimate is at or above the screening cutoff."
    if uncertain:
        return ("The estimate is below the cutoff, but its 95% range includes the cutoff. "
                "The referral decision is uncertain. Consider referral based on clinical judgment.")
    return (f"Below the screening cutoff. Not referred on this estimate alone. "
            f"Negative predictions at this cutoff were correct for {npv}% of test patients.")

@app.get("/")
async def root():
    return {"message": "COPD Screening Estimate API", "version": "5.0", "status": "online"}


@app.get("/features")
async def features():
    return {"features": FIELDS}


@app.get("/model-info")
async def model_info():
    return INFO


@app.get("/screening")
async def screening():
    return SCREENING

def probability_interval(row):
    probs = np.array([m.predict_proba(row)[0, 1] for m in BOOT_MODELS])
    lo, hi = np.percentile(probs, [2.5, 97.5])
    return float(lo), float(hi)



@app.post("/predict")
async def predict(p: PatientInput):
    if p.SMQ020 == 1 and p.SMQ040 is None:
        return {
            "error": "SMQ040 is required when SMQ020 is Yes."
    }

    current_smoker = (
        1 if (p.SMQ020 == 1 and p.SMQ040 in (1, 2)) else 0
    )

    row = pd.DataFrame([[
        p.RIDAGEYR,
        1 if p.SMQ020 == 1 else 0,
        1 if p.MCQ010 == 1 else 0,
        p.BMXBMI,
        current_smoker,
    ]], columns=FEATURES)

    prob = float(MODEL.predict_proba(row)[0, 1])
    lo, hi = probability_interval(row)
    referral_uncertain = lo < REFER_CUTOFF <= hi

    scaler = MODEL.named_steps["standardscaler"]
    coefs = MODEL.named_steps["logisticregression"].coef_[0]
    z = scaler.transform(row)[0]
    contributions = coefs * z

    factors = [
        {
            "name": FACTOR_NAMES[f],
            "effect": (
                "pushes estimate above the study average"
                if c > 0
                else "pushes estimate below the study average"
            ),
        }
        for f, c in zip(FEATURES, contributions)
    ]

    labels = conformal_labels(prob)
    refer = prob >= REFER_CUTOFF

    return {
        "probability": round(prob, 4),
        "percent": round(prob * 100, 1),
        "population_percent": INFO["sample"]["copd_percent"],
        "refer_to_spirometry": refer,
        "referral_text": referral_text(refer, referral_uncertain),
        "prediction_set": labels,
        "prediction_set_text": set_text(labels),
        "coverage_target_percent": CONFORMAL["target_coverage_percent"],
        "factors": factors,
        "disclaimer": DISCLAIMER,
        "referral_cutoff_percent": round(REFER_CUTOFF * 100, 1),
        "probability_interval_percent": [round(lo * 100, 2), round(hi * 100, 2)],
        "referral_uncertain": referral_uncertain,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
