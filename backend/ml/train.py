"""
StrideSafe ML Training Pipeline
================================
Trains an XGBoost injury-risk classifier.

Priority order for training data:
  1. Kaggle dataset (shashwatwork/injury-prediction-for-competitive-runners)
     via kagglehub — requires KAGGLE_USERNAME + KAGGLE_KEY env vars
  2. backend/ml/data/training_data.csv  — drop your own CSV here
  3. Synthetic data                     — generated automatically as last resort

Usage:
    cd backend/
    pip install -r requirements.txt
    python ml/train.py

Outputs:
    backend/ml/model.pkl          — trained XGBClassifier (joblib)
    backend/ml/feature_names.json — ordered feature list used at inference time
"""

import json
import os
import glob

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

# ── Paths ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
DATA_PATH     = os.path.join(SCRIPT_DIR, "data", "training_data.csv")
MODEL_PATH    = os.path.join(SCRIPT_DIR, "model.pkl")
FEATURES_PATH = os.path.join(SCRIPT_DIR, "feature_names.json")

# ── Desired features (in preference order) ────────────────────────────────────
# Each entry maps our internal name → list of possible source column names.
# Columns are tried in order; first match wins.  If none match, the feature
# is dropped and feature_names.json will reflect the smaller set.

FEATURE_CANDIDATES: dict[str, list[str]] = {
    "acwr":               ["acwr", "acute_chronic_ratio", "acute_chronic",
                           "ac_ratio", "atl_ctl_ratio"],
    "weekly_mileage_km":  ["weekly_mileage_km", "km_run_of_running", "km_running",
                           "km_per_week", "weekly_km", "total_km", "km4weeks",
                           "mileage_km", "distance_km"],
    "days_since_rest":    ["days_since_rest", "nr_runs_running",
                           "consecutive_training_days", "training_days"],
    "avg_pace_sec_per_km":["avg_pace_sec_per_km", "slope_running", "pace_sec_km",
                           "avg_pace", "pace"],
    "fatigue_level":      ["fatigue_level", "fatigue", "perceived_exertion", "rpe"],
    "pain_level":         ["pain_level", "pain", "pain_score", "soreness"],
    "stress_level":       ["stress_level", "stress", "psychological_stress"],
    "age":                ["age", "athlete_age", "runner_age"],
    "gender_encoded":     ["gender_encoded", "gender", "sex"],
}

TARGET_CANDIDATES = ["injury_occurred", "injury", "injured", "label", "target"]


# ── Kaggle download ───────────────────────────────────────────────────────────

def try_kaggle_download() -> pd.DataFrame | None:
    """
    Attempt to download the Kaggle dataset via kagglehub.
    Returns a DataFrame on success, None on any failure.
    Requires KAGGLE_USERNAME and KAGGLE_KEY environment variables.
    """
    try:
        import kagglehub  # noqa: PLC0415
    except ImportError:
        print("kagglehub not installed — skipping Kaggle download.")
        return None

    if not os.environ.get("KAGGLE_USERNAME") or not os.environ.get("KAGGLE_KEY"):
        print("KAGGLE_USERNAME / KAGGLE_KEY not set — skipping Kaggle download.")
        return None

    try:
        print("Downloading Kaggle dataset: shashwatwork/injury-prediction-for-competitive-runners")
        path = kagglehub.dataset_download(
            "shashwatwork/injury-prediction-for-competitive-runners"
        )
        print(f"Dataset downloaded to: {path}")
    except Exception as exc:
        print(f"Kaggle download failed: {exc}")
        return None

    # Find all CSVs in the downloaded directory
    csv_files = glob.glob(os.path.join(path, "**", "*.csv"), recursive=True)
    if not csv_files:
        print("No CSV files found in downloaded dataset.")
        return None

    print(f"Found CSV files: {csv_files}")

    # Load all CSVs and concatenate (some datasets ship multiple files)
    frames = []
    for csv_path in csv_files:
        try:
            df = pd.read_csv(csv_path)
            print(f"\n  {os.path.basename(csv_path)}  —  {len(df)} rows")
            print(f"  Columns ({len(df.columns)}): {list(df.columns)}")
            frames.append(df)
        except Exception as exc:
            print(f"  Could not read {csv_path}: {exc}")

    if not frames:
        return None

    combined = pd.concat(frames, ignore_index=True)
    print(f"\nCombined dataset: {len(combined)} rows, {len(combined.columns)} columns")
    return combined


# ── Column mapping ────────────────────────────────────────────────────────────

def map_columns(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str], str]:
    """
    Map raw dataset columns to our internal feature names.
    Returns (processed_df, feature_list, target_column).
    Drops features whose candidate columns are all absent.
    """
    cols_lower = {c.lower().strip(): c for c in df.columns}

    # Detect target
    target_col = None
    for cand in TARGET_CANDIDATES:
        if cand in cols_lower:
            target_col = cols_lower[cand]
            break
    if target_col is None:
        raise ValueError(
            f"Could not find a target column. Tried: {TARGET_CANDIDATES}\n"
            f"Available columns: {list(df.columns)}"
        )
    print(f"Target column: '{target_col}'")

    # Map features
    rename_map: dict[str, str] = {}
    found_features: list[str] = []

    for feature_name, candidates in FEATURE_CANDIDATES.items():
        matched = None
        for cand in candidates:
            if cand.lower() in cols_lower:
                matched = cols_lower[cand.lower()]
                break
        if matched:
            rename_map[matched] = feature_name
            found_features.append(feature_name)
            print(f"  {feature_name:25s} ← '{matched}'")
        else:
            print(f"  {feature_name:25s}    (not found — excluded)")

    if not found_features:
        raise ValueError("No feature columns could be mapped from the dataset.")

    # Handle gender encoding if the source is text
    result = df.copy()
    if "gender_encoded" in found_features:
        src = rename_map[[k for k, v in rename_map.items() if v == "gender_encoded"][0]]
        if result[src].dtype == object:
            gender_map = {"male": 1, "man": 1, "m": 1,
                          "female": 2, "woman": 2, "f": 2}
            result[src] = result[src].str.lower().str.strip().map(gender_map).fillna(0)

    result = result.rename(columns=rename_map)

    # Ensure binary target
    result[target_col] = (pd.to_numeric(result[target_col], errors="coerce")
                          .fillna(0).clip(0, 1).astype(int))
    result = result.rename(columns={target_col: "injury_occurred"})

    keep = found_features + ["injury_occurred"]
    result = result[keep].dropna(subset=found_features)
    result[found_features] = result[found_features].apply(
        pd.to_numeric, errors="coerce"
    ).fillna(0)

    pos_rate = result["injury_occurred"].mean()
    print(f"\nMapped dataset: {len(result)} rows  |  "
          f"features: {len(found_features)}  |  injury rate: {pos_rate:.1%}")

    return result, found_features, "injury_occurred"


# ── Synthetic data fallback ───────────────────────────────────────────────────

def generate_synthetic_data(n: int = 500, seed: int = 42) -> pd.DataFrame:
    """500 synthetic HS XC athlete-week snapshots with realistic injury signal."""
    rng = np.random.default_rng(seed)

    age                 = rng.integers(14, 19, size=n).astype(float)
    gender_encoded      = rng.choice([0, 1, 2], size=n, p=[0.05, 0.47, 0.48]).astype(float)
    weekly_mileage_km   = rng.normal(48, 12, size=n).clip(20, 90)
    acwr                = rng.normal(1.05, 0.22, size=n).clip(0.4, 2.0)
    days_since_rest     = rng.integers(0, 11, size=n).astype(float)
    avg_pace_sec_per_km = rng.normal(330, 30, size=n).clip(260, 440)
    fatigue_level       = rng.integers(0, 11, size=n).astype(float)
    pain_level          = rng.integers(0, 11, size=n).astype(float)
    stress_level        = rng.integers(0, 11, size=n).astype(float)

    logit = (
        -4.0
        + 2.5 * np.maximum(acwr - 1.3, 0)
        + 1.5 * np.maximum(0.8 - acwr, 0)
        + 0.04 * weekly_mileage_km
        + 0.15 * days_since_rest
        + 0.25 * pain_level
        + 0.12 * fatigue_level
        + 0.06 * stress_level
        - 0.03 * (age - 14)
    )
    prob = 1 / (1 + np.exp(-logit))
    injury_occurred = rng.binomial(1, prob).astype(int)

    df = pd.DataFrame({
        "acwr": acwr, "weekly_mileage_km": weekly_mileage_km,
        "days_since_rest": days_since_rest, "avg_pace_sec_per_km": avg_pace_sec_per_km,
        "fatigue_level": fatigue_level, "pain_level": pain_level,
        "stress_level": stress_level, "age": age, "gender_encoded": gender_encoded,
        "injury_occurred": injury_occurred,
    })
    print(f"Generated {n} synthetic samples  |  injury rate: {df['injury_occurred'].mean():.1%}")
    return df


# ── Data loading (priority: Kaggle → local CSV → synthetic) ──────────────────

def load_data() -> tuple[pd.DataFrame, list[str]]:
    # 1. Try Kaggle
    raw = try_kaggle_download()
    if raw is not None:
        try:
            print("\nMapping Kaggle dataset columns:")
            df, features, _ = map_columns(raw)
            os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
            df.to_csv(DATA_PATH, index=False)
            print(f"Saved mapped data → {DATA_PATH}")
            return df, features
        except Exception as exc:
            print(f"Column mapping failed: {exc}\nFalling back.")

    # 2. Local CSV
    if os.path.exists(DATA_PATH):
        print(f"\nLoading local data: {DATA_PATH}")
        df = pd.read_csv(DATA_PATH)
        print(f"Columns: {list(df.columns)}")
        if "injury_occurred" in df.columns:
            available = [f for f in FEATURE_CANDIDATES if f in df.columns]
            if available:
                df = df[available + ["injury_occurred"]].dropna()
                print(f"Using {len(available)} features from local CSV.")
                return df, available
        print("Local CSV missing required columns — falling back to synthetic.")

    # 3. Synthetic
    print("\nGenerating synthetic training data.")
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    df = generate_synthetic_data(n=500)
    df.to_csv(DATA_PATH, index=False)
    all_features = list(FEATURE_CANDIDATES.keys())
    return df, all_features


# ── Training ──────────────────────────────────────────────────────────────────

def train(df: pd.DataFrame, features: list[str]) -> XGBClassifier:
    X = df[features]
    y = df["injury_occurred"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pos = int(y_train.sum())
    neg = int((y_train == 0).sum())
    scale_pos_weight = neg / pos if pos > 0 else 1.0
    print(f"\nTrain: {len(X_train)} rows  pos={pos}  neg={neg}  "
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
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    y_pred = model.predict(X_test)
    print("\nTest set evaluation:")
    print(classification_report(y_test, y_pred, target_names=["No Injury", "Injury"]))
    return model


def save_artifacts(model: XGBClassifier, features: list[str]) -> None:
    joblib.dump(model, MODEL_PATH)
    print(f"Model   → {MODEL_PATH}")
    with open(FEATURES_PATH, "w") as f:
        json.dump(features, f, indent=2)
    print(f"Features → {FEATURES_PATH}  ({features})")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    df, features = load_data()
    model = train(df, features)
    save_artifacts(model, features)
    print("\nDone.")
