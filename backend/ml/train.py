import os, json, pathlib

# Write Kaggle credentials from env vars so kagglehub can find them
_kaggle_user = os.environ.get("KAGGLE_USERNAME")
_kaggle_key  = os.environ.get("KAGGLE_KEY")
if _kaggle_user and _kaggle_key:
    _kaggle_dir = pathlib.Path.home() / ".kaggle"
    _kaggle_dir.mkdir(exist_ok=True)
    _cred_file = _kaggle_dir / "kaggle.json"
    _cred_file.write_text(json.dumps({"username": _kaggle_user, "key": _kaggle_key}))
    _cred_file.chmod(0o600)
    print(f"[train] Kaggle credentials written for user: {_kaggle_user}")

"""
StrideSafe ML Training Script
Trains an XGBoost injury-risk classifier on the Kaggle
"Injury Prediction for Competitive Runners" dataset.

Expected data file (committed to repo):
    backend/ml/data/week_approach_maskedID_timeseries.csv

Falls back to research-calibrated synthetic data if the CSV is missing.
"""

import os
import json
import pathlib
import numpy as np
import pandas as pd
import pickle

SCRIPT_DIR = pathlib.Path(__file__).parent
DATA_PATH  = SCRIPT_DIR / "data" / "week_approach_maskedID_timeseries.csv"
MODEL_OUT  = SCRIPT_DIR / "model.pkl"
FEATS_OUT  = SCRIPT_DIR / "feature_names.json"

KAGGLE_FEATURES = [
    "total kms",
    "total kms.1",
    "total kms.2",
    "acwr",
    "km_pct_change",
    "nr. sessions",
    "nr. rest days",
    "max km one day",
    "total km Z5-T1-T2",
    "nr. tough sessions (effort in Z5, T1 or T2)",
    "avg exertion",
    "avg recovery",
    "avg training success",
    "total hours alternative training",
    "nr. strength trainings",
]

MODEL_FEATURE_NAMES = [
    "weekly_km",
    "weekly_km_w1",
    "weekly_km_w2",
    "acwr",
    "km_pct_change",
    "num_runs",
    "rest_days",
    "max_single_run_km",
    "high_intensity_km",
    "tough_sessions",
    "avg_exertion",
    "avg_recovery",
    "avg_training_success",
    "cross_training_hours",
    "strength_sessions",
]


def load_kaggle_data():
    if not DATA_PATH.exists():
        print("[train] Kaggle CSV not found at", DATA_PATH)
        return None

    print(f"[train] Loading Kaggle dataset from {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)

    chronic = (df["total kms"] + df["total kms.1"] + df["total kms.2"]) / 3
    df["acwr"] = np.where(chronic > 0, df["total kms"] / chronic, 1.0)
    df["km_pct_change"] = np.where(
        df["total kms.1"] > 0,
        (df["total kms"] - df["total kms.1"]) / df["total kms.1"],
        0.0,
    )
    df["acwr"]          = df["acwr"].clip(0, 5)
    df["km_pct_change"] = df["km_pct_change"].clip(-2, 5)

    X = df[KAGGLE_FEATURES].rename(
        columns=dict(zip(KAGGLE_FEATURES, MODEL_FEATURE_NAMES))
    )
    y = df["injury"]

    print(f"[train] Using Kaggle dataset: {len(df):,} rows, "
          f"injury rate {y.mean()*100:.1f}%")
    return X, y


def make_synthetic_data(n=5000, seed=42):
    print("[train] Kaggle data unavailable — generating synthetic training data")
    rng = np.random.default_rng(seed)

    weekly_km    = rng.gamma(shape=4, scale=12, size=n).clip(0, 200)
    weekly_km_w1 = (weekly_km * rng.uniform(0.7, 1.3, n)).clip(0, 200)
    weekly_km_w2 = (weekly_km_w1 * rng.uniform(0.7, 1.3, n)).clip(0, 200)

    chronic = (weekly_km + weekly_km_w1 + weekly_km_w2) / 3
    acwr    = np.where(chronic > 0, weekly_km / chronic, 1.0).clip(0, 5)
    km_pct_change = np.where(
        weekly_km_w1 > 0,
        (weekly_km - weekly_km_w1) / weekly_km_w1,
        0.0,
    ).clip(-2, 5)

    num_runs             = rng.integers(3, 8, n).astype(float)
    rest_days            = (7 - num_runs).clip(0, 7).astype(float)
    max_single_run_km    = (weekly_km / num_runs * rng.uniform(1.0, 2.5, n)).clip(0, 50)
    high_intensity_km    = weekly_km * rng.uniform(0, 0.3, n)
    tough_sessions       = rng.integers(0, 4, n).astype(float)
    avg_exertion         = rng.uniform(0, 1, n)
    avg_recovery         = rng.uniform(0, 1, n)
    avg_training_success = rng.uniform(0, 1, n)
    cross_training_hours = rng.exponential(0.5, n).clip(0, 10)
    strength_sessions    = rng.integers(0, 4, n).astype(float)

    log_odds = (
        -4.0
        + 2.5 * np.maximum(acwr - 1.3, 0)
        + 1.5 * np.maximum(1.0 - acwr, 0)
        + 1.0 * km_pct_change
        + 0.8 * avg_exertion
        - 0.5 * avg_recovery
    )
    prob_injury = 1 / (1 + np.exp(-log_odds))
    injury = rng.binomial(1, prob_injury).astype(int)

    X = pd.DataFrame({
        "weekly_km": weekly_km, "weekly_km_w1": weekly_km_w1,
        "weekly_km_w2": weekly_km_w2, "acwr": acwr,
        "km_pct_change": km_pct_change, "num_runs": num_runs,
        "rest_days": rest_days, "max_single_run_km": max_single_run_km,
        "high_intensity_km": high_intensity_km, "tough_sessions": tough_sessions,
        "avg_exertion": avg_exertion, "avg_recovery": avg_recovery,
        "avg_training_success": avg_training_success,
        "cross_training_hours": cross_training_hours,
        "strength_sessions": strength_sessions,
    })
    y = pd.Series(injury, name="injury")
    print(f"[train] Synthetic data: {n} rows, injury rate {y.mean()*100:.1f}%")
    return X, y


def train():
    try:
        from xgboost import XGBClassifier
    except ImportError:
        print("[train] xgboost not installed — skipping model training")
        return

    result = load_kaggle_data()
    if result is None:
        X, y = make_synthetic_data()
        source = "synthetic-v1"
    else:
        X, y = result
        source = "kaggle-v1"

    neg, pos = (y == 0).sum(), (y == 1).sum()
    scale_pos_weight = neg / max(pos, 1)

    model = XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        use_label_encoder=False,
        eval_metric="logloss",
        random_state=42,
        n_jobs=-1,
    )

    print(f"[train] Training XGBoost (scale_pos_weight={scale_pos_weight:.1f}) ...")
    model.fit(X, y)
    model.set_attr(source=source)

    MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(MODEL_OUT, "wb") as f:
        pickle.dump(model, f)

    feature_meta = {
        "features": list(X.columns),
        "source": source,
        "n_training_rows": len(X),
        "injury_rate": float(y.mean()),
    }
    FEATS_OUT.write_text(json.dumps(feature_meta, indent=2))

    print(f"[train] Model saved  → {MODEL_OUT}")
    print(f"[train] Features saved → {FEATS_OUT}")
    print(f"[train] Source: {source} | rows: {len(X):,} | "
          f"injury rate: {y.mean()*100:.1f}%")


if __name__ == "__main__":
    train()
