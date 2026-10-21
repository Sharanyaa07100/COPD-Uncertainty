import os
import json
import pickle
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, average_precision_score
from sklearn.calibration import calibration_curve

HERE = os.path.dirname(os.path.abspath(__file__))

FEATURES = ['RIDAGEYR', 'SMQ020_ever', 'MCQ010_asthma', 'BMXBMI']
AUDIT = ['RIAGENDR', 'RIDRETH1']
SEX = {1: 'Male', 2: 'Female'}
RACE = {1: 'Mexican American', 2: 'Other Hispanic', 3: 'Non-Hispanic White',
        4: 'Non-Hispanic Black', 5: 'Other / multiracial'}
ALPHA = 0.10

# 1. Load and restrict to adults 20+ with a Yes/No COPD answer
df = pd.read_csv(os.path.join(HERE, 'NHANES_COPD_v2.csv'))
df = df[df['RIDAGEYR'] >= 20].copy()
df = df[df['MCQ160P'].isin([1, 2])].copy()
df['COPD'] = (df['MCQ160P'] == 1).astype(int)

# 2. Recode: refused / don't know -> missing; Yes -> 1, No -> 0
df['SMQ020_ever'] = df['SMQ020'].replace({7: np.nan, 9: np.nan}).map({1: 1, 2: 0})
df['MCQ010_asthma'] = df['MCQ010'].replace({9: np.nan}).map({1: 1, 2: 0})

d = df.dropna(subset=FEATURES + AUDIT + ['COPD']).reset_index(drop=True)
X, y = d[FEATURES], d['COPD']
print(f"Adults 20+ with Yes/No answer: {len(df)}  complete cases: {len(d)}  "
      f"COPD cases: {y.sum()} ({y.mean()*100:.1f}%)")

# 3. Held-out test split (reporting only)
X_tr, X_te, y_tr, y_te, d_tr, d_te = train_test_split(
    X, y, d, test_size=0.2, stratify=y, random_state=42)
yt = y_te.values

# 4. Evaluation model: fit on training split, score on test split
eval_model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
eval_model.fit(X_tr, y_tr)
p = eval_model.predict_proba(X_te)[:, 1]

auc = roc_auc_score(yt, p)
pr_auc = average_precision_score(yt, p)

# 5. Bootstrap 95% CI for test AUC
rng = np.random.default_rng(42)
boot = []
for _ in range(2000):
    i = rng.integers(0, len(yt), len(yt))
    if yt[i].sum() > 0:
        boot.append(roc_auc_score(yt[i], p[i]))
ci_low, ci_high = np.percentile(boot, [2.5, 97.5])

# 6. Calibration by risk decile
frac, mean_pred = calibration_curve(yt, p, n_bins=10, strategy='quantile')
calibration = [{"predicted": round(float(m), 3), "observed": round(float(f), 3)}
               for m, f in zip(mean_pred, frac)]

# 7. Subgroup audit on the test split (AUC withheld if fewer than 10 cases)
subgroups = []
def audit(col, labels, group_type):
    for code, name in labels.items():
        m = (d_te[col] == code).values
        n, cases = int(m.sum()), int(yt[m].sum())
        if n == 0:
            continue
        scored = cases >= 10
        subgroups.append({
            "group_type": group_type, "group": name, "n": n, "cases": cases,
            "roc_auc": round(float(roc_auc_score(yt[m], p[m])), 3) if scored else None,
            "pr_auc": round(float(average_precision_score(yt[m], p[m])), 3) if scored else None,
        })
audit('RIAGENDR', SEX, 'Sex')
audit('RIDRETH1', RACE, 'Race / ethnicity')

# 8. Conformal calibration: split the TRAINING data into fit and calibration parts
X_fit, X_cal, y_fit, y_cal = train_test_split(
    X_tr, y_tr, test_size=0.25, stratify=y_tr, random_state=42)

cp_model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
cp_model.fit(X_fit, y_fit)

p_cal = cp_model.predict_proba(X_cal)[:, 1]
scores = np.where(y_cal.values == 1, 1 - p_cal, p_cal)  # nonconformity score
n_cal = len(scores)
qhat = float(np.quantile(scores, np.ceil((n_cal + 1) * (1 - ALPHA)) / n_cal, method='higher'))

def conformal_set(p1):
    labels = []
    if 1 - p1 <= qhat:          # label 1 = COPD
        labels.append(1)
    if p1 <= qhat:              # label 0 = No COPD
        labels.append(0)
    return labels

p_te_cp = cp_model.predict_proba(X_te)[:, 1]
sets = [conformal_set(q) for q in p_te_cp]
coverage = float(np.mean([int(t) in s for t, s in zip(yt, sets)]))

conformal = {
    "alpha": ALPHA,
    "target_coverage_percent": round((1 - ALPHA) * 100, 1),
    "test_coverage_percent": round(coverage * 100, 1),
    "set_sizes": {
        "both": int(sum(len(s) == 2 for s in sets)),
        "one": int(sum(len(s) == 1 for s in sets)),
        "empty": int(sum(len(s) == 0 for s in sets)),
    },
    "qhat": round(qhat, 4),
    "calibration_n": int(n_cal),
}

# 9. Deployment model: refit the conformal-fit model is used for predictions
#    so that qhat matches the model being served
pickle.dump(cp_model, open(os.path.join(HERE, 'final_model.pkl'), 'wb'))
json.dump(conformal, open(os.path.join(HERE, 'conformal.json'), 'w'), indent=2)

coefs = cp_model.named_steps['logisticregression'].coef_[0]
info = {
    "sample": {"adults_20plus": int(len(df)), "complete_cases": int(len(d)),
               "copd_cases": int(y.sum()), "copd_percent": round(float(y.mean()) * 100, 1)},
    "test": {"n": int(len(yt)), "cases": int(yt.sum()),
             "roc_auc": round(float(auc), 3),
             "roc_auc_ci_low": round(float(ci_low), 3),
             "roc_auc_ci_high": round(float(ci_high), 3),
             "pr_auc": round(float(pr_auc), 3),
             "chance_pr_auc": round(float(yt.mean()), 3)},
    "calibration": calibration,
    "subgroups": subgroups,
    "coefficients": {f: round(float(c), 3) for f, c in zip(FEATURES, coefs)},
    "conformal": conformal,
}
json.dump(info, open(os.path.join(HERE, 'model_info.json'), 'w'), indent=2)

print(json.dumps(info['test'], indent=2))
print("Coefficients (standardized):", info['coefficients'])
print("Conformal:", json.dumps(conformal, indent=2))
print("Saved final_model.pkl, conformal.json, model_info.json")

# Breakdown of observed COPD by conformal set type
groups = {'{No COPD} only': [], 'empty': [], '{COPD} only': []}
for truth, s in zip(yt, sets):
    key = 'empty' if len(s) == 0 else ('{COPD} only' if s == [1] else ('{No COPD} only' if s == [0] else 'both'))
    groups.setdefault(key, []).append(truth)
for k, v in groups.items():
    if v:
        print(f"{k:16s} n={len(v):4d}  observed COPD={sum(v):3d} ({np.mean(v)*100:.1f}%)")