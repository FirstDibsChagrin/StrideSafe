"""
StrideSafe ML Training Pipeline
================================
Trains an XGBoost injury-risk classifier for high school cross-country runners.

Usage:
    cd ml/
    python train.py

Outputs:
    ml/model.pkl          — trained XGBClassifier (joblib)
    ml/feature_names.json — ordered feature list expected at inference time
"""

import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

# ── Paths ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(SCRIPT_DIR, "data", "training_data.csv")
MODEL_PATH = os.path.join(SCRIPT_DIR, "model.pkl")
FEATURES_PATH = os.path.join(SCRIPT_DIR, "feature_names.json")

# Ordered feature list — must match the vector built in backend/services/risk.py
FEATURES = [
    "acwr",
    "weekly_mileage_km",
    "days_since_rest",
    "avg_pace_sec_per_km",
    "fatigue_level",
    "pain_level",
    "stress_level",
    "age",
    "gender_encoded",
]

TARGET = "injury_occurred"


# ── Synthetic data generation ─────────────────────────────────────────────────

def generate_synthetic_data(n: int = 500, seed: int = 42) -> pd.DataFrame:
    """
    Generate realistic synthetic training observations for HS XC runners.
    Each row is one athlete-week snapshot.  Injury probability is a deterministic
    function of the features so the model has a genuine signal to learn.
    """
    rng = np.random.default_rng(seed)

    age = rng.integers(14, 19, size=n).astype(float)
    gender_encoded = rng.choice([0, 1, 2], size=n, p=[0.05, 0.47, 0.48]).astype(float)

    # Weekly mileage in km: HS XC range ~25–80 km/week
    weekly_mileage_km = rng.normal(48, 12, size=n).clip(20, 90)

    # ACWR: safe zone 0.8–1.3; skewed toward safe but with tails
    acwr = rng.normal(1.05, 0.22, size=n).clip(0.4, 2.0)

    # Days since last rest day: 0–10
    days_since_rest = rng.integers(0, 11, size=n).astype(float)

    # Average pace sec/km: 270 (4:30/km) – 420 (7:00/km)
    avg_pace_sec_per_km = rng.normal(330, 30, size=n).clip(260, 440)

    # Subjective wellness (0–10 scale)
    fatigue_level = rng.integers(0, 11, size=n).astype(float)
    pain_level = rng.integers(0, 11, size=n).astype(float)
    stress_level = rng.integers(0, 11, size=n).astype(float)

    # ── Injury probability (logistic) ─────────────────────────────────────────
    logit = (
        -4.0                                        # base rate ~1-2%
        + 2.5 * np.maximum(acwr - 1.3, 0)          # spike risk above 1.3
        + 1.5 * np.maximum(0.8 - acwr, 0)          # also risky below 0.8 (undertraining)
        + 0.04 * weekly_mileage_km                  # higher mileage → more risk
        + 0.15 * days_since_rest                    # fatigue accumulation
        + 0.25 * pain_level                         # pain is a strong predictor
        + 0.12 * fatigue_level
        + 0.06 * stress_level
        - 0.03 * (age - 14)                         # older runners adapt better
    )
    prob = 1 / (1 + np.exp(-logit))
    injury_occurred = rng.binomial(1, prob).astype(int)

    df = pd.DataFrame(
        {
            "acwr": acwr,
            "weekly_mileage_km": weekly_mileage_km,
            "days_since_rest": days_since_rest,
            "avg_pace_sec_per_km": avg_pace_sec_per_km,
            "fatigue_level": fatigue_level,
            "pain_level": pain_level,
            "stress_level": stress_level,
            "age": age,
            "gender_encoded": gender_encoded,
            TARGET: injury_occurred,
        }
    )
    print(f"Generated {n} synthetic samples  |  injury rate: {df[TARGET].mean():.1%}")
    return df


# ── Training ──────────────────────────────────────────────────────────────────

def load_data() -> pd.DataFrame:
    if os.path.exists(DATA_PATH):
        print(f"Loading real data from {DATA_PATH}")
        df = pd.read_csv(DATA_PATH)
        # Validate required columns
        missing = [c for c in FEATURES + [TARGET] if c not in df.columns]
        if missing:
            raise ValueError(f"CSV is missing columns: {missing}")
    else:
        print(f"{DATA_PATH} not found — generating synthetic data.")
        os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
        df = generate_synthetic_data(n=500)
        df.to_csv(DATA_PATH, index=False)
        print(f"Saved synthetic data to {DATA_PATH}")
    return df


def train(df: pd.DataFrame):
    X = df[FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pos = int(y_train.sum())
    neg = int((y_train == 0).sum())
    scale_pos_weight = neg / pos if pos > 0 else 1.0
    print(f"Train set: {len(X_train)} samples  |  pos={pos}  neg={neg}  "
          f"scale_pos_weight={scale_pos_weight:.2f}")

    model = XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        eval_metric="logloss",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(
        X_train,
        y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    y_pred = model.predict(X_test)
    print("\nTest set evaluation:")
    print(classification_report(y_test, y_pred, target_names=["No Injury", "Injury"]))

    return model


def save_artifacts(model):
    joblib.dump(model, MODEL_PATH)
    print(f"Model saved  → {MODEL_PATH}")

    with open(FEATURES_PATH, "w") as f:
        json.dump(FEATURES, f, indent=2)
    print(f"Features saved → {FEATURES_PATH}")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    df = load_data()
    model = train(df)
    save_artifacts(model)
    print("\nDone.")
