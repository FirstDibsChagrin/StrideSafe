#!/usr/bin/env python3
"""
StrideSafe — XGBoost Injury Prediction Training Pipeline

Downloads the Kaggle dataset, engineers training-load features,
trains an XGBClassifier, evaluates it, and saves the artefacts.

Usage:
    pip install -r ml/requirements.txt
    python ml/train.py
"""

import json
import os
import subprocess
import sys
import zipfile

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
MODEL_PATH = os.path.join(SCRIPT_DIR, "model.pkl")
FEATURES_PATH = os.path.join(SCRIPT_DIR, "feature_columns.json")

KAGGLE_DATASET = "shashwatwork/injury-prediction-for-competitive-runners"

os.makedirs(DATA_DIR, exist_ok=True)


# ── Step 1: Download ───────────────────────────────────────────────────────────

def download_dataset() -> str:
    """Download and unzip the Kaggle dataset; return the directory path."""
    extract_dir = os.path.join(DATA_DIR, "raw")
    if os.path.isdir(extract_dir) and os.listdir(extract_dir):
        print("[INFO] Dataset already present — skipping download.")
        return extract_dir

    os.makedirs(extract_dir, exist_ok=True)
    print(f"[INFO] Downloading dataset: {KAGGLE_DATASET}")
    subprocess.run(
        [
            sys.executable, "-m", "kaggle",
            "datasets", "download",
            "-d", KAGGLE_DATASET,
            "-p", DATA_DIR,
        ],
        check=True,
    )

    zip_candidates = [
        f for f in os.listdir(DATA_DIR)
        if f.endswith(".zip")
    ]
    if not zip_candidates:
        raise FileNotFoundError("Download succeeded but no zip file found in data/")

    zip_path = os.path.join(DATA_DIR, zip_candidates[0])
    print(f"[INFO] Unzipping {zip_candidates[0]}…")
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(extract_dir)

    return extract_dir


# ── Step 2: Load ───────────────────────────────────────────────────────────────

def load_data(dataset_dir: str) -> pd.DataFrame:
    """Discover and load all CSV files; concatenate if multiple."""
    csv_files = [
        os.path.join(root, fname)
        for root, _, files in os.walk(dataset_dir)
        for fname in files
        if fname.lower().endswith(".csv")
    ]
    if not csv_files:
        raise FileNotFoundError(f"No CSV files found under {dataset_dir}")

    print(f"[INFO] Found {len(csv_files)} CSV file(s):")
    frames = []
    for path in sorted(csv_files):
        df = pd.read_csv(path)
        print(f"       {os.path.basename(path)}: {df.shape}  cols={list(df.columns)}")
        frames.append(df)

    combined = pd.concat(frames, ignore_index=True) if len(frames) > 1 else frames[0]
    print(f"[INFO] Combined shape: {combined.shape}")
    return combined


def normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Lowercase and snake_case all column names."""
    df.columns = (
        df.columns.str.strip().str.lower().str.replace(r"[\s\-/]+", "_", regex=True)
    )
    return df


# ── Step 3: Detect semantic columns ───────────────────────────────────────────

def detect_columns(df: pd.DataFrame) -> dict:
    """Map semantic roles to actual column names present in the DataFrame."""
    cols = set(df.columns)

    def first(*candidates):
        return next((c for c in candidates if c in cols), None)

    mapping = {
        "distance": first("km", "distance", "distance_km", "kilometers", "mileage", "load"),
        "hr":       first("hr", "heart_rate", "average_heartrate", "avg_hr", "average_hr"),
        "date":     first("date", "day", "training_date", "week"),
        "athlete":  first("athlete", "runner_id", "athlete_id", "id", "runner"),
        "target":   first("injury", "injured", "injury_flag", "target", "label"),
        "rest":     first("nr_days_off", "days_off", "rest_days", "nr_rest_days"),
        "pace":     first("pace", "avg_pace", "pace_min_km", "speed"),
    }

    # Drop roles we couldn't find
    mapping = {k: v for k, v in mapping.items() if v is not None}
    print(f"[INFO] Column mapping: {mapping}")

    if "distance" not in mapping:
        raise ValueError(
            f"Cannot find a distance/km column. Available columns: {sorted(cols)}"
        )
    if "target" not in mapping:
        raise ValueError(
            f"Cannot find an injury/target column. Available columns: {sorted(cols)}"
        )

    return mapping


# ── Step 4: Feature engineering ───────────────────────────────────────────────

def _forward_injury_label(series: pd.Series, horizon: int = 14) -> pd.Series:
    """
    For each position i, return 1 if any injury occurs in positions
    [i+1 … i+horizon] (exclusive of the current day).
    Uses prefix sums for O(n) complexity.
    """
    arr = series.fillna(0).values.astype(int)
    n = len(arr)
    prefix = np.zeros(n + 1, dtype=int)
    for i in range(n):
        prefix[i + 1] = prefix[i] + arr[i]

    result = np.zeros(n, dtype=int)
    for i in range(n - 1):
        end = min(i + 1 + horizon, n)
        if prefix[end] - prefix[i + 1] > 0:
            result[i] = 1

    return pd.Series(result, index=series.index, name="injury_next14")


def _days_since_rest(dist_series: pd.Series) -> pd.Series:
    """Number of consecutive days (going back) with non-zero distance."""
    is_active = (dist_series.fillna(0) > 0).astype(int)
    # Cumulative count — resets at each rest day
    result = []
    count = 0
    for v in is_active:
        if v:
            count += 1
        else:
            count = 0
        result.append(count)
    return pd.Series(result, index=dist_series.index)


def engineer_features(grp: pd.DataFrame, col_map: dict) -> pd.DataFrame:
    """Compute all rolling training-load features for one athlete group."""
    dist_col = col_map["distance"]
    d = grp[dist_col].fillna(0).astype(float)

    # Core load metrics
    acute = d.rolling(7, min_periods=1).mean()
    chronic = d.rolling(28, min_periods=1).mean()

    grp["acute_load"]       = acute
    grp["chronic_load"]     = chronic
    grp["acwr"]             = (acute / chronic.replace(0, np.nan)).fillna(0)

    roll7_mean = d.rolling(7, min_periods=1).mean()
    roll7_std  = d.rolling(7, min_periods=1).std().fillna(0)
    grp["training_monotony"] = (roll7_mean / roll7_std.replace(0, np.nan)).fillna(0)
    grp["weekly_mileage_km"] = d.rolling(7, min_periods=1).sum()
    grp["training_strain"]   = grp["weekly_mileage_km"] * grp["training_monotony"]

    # Week-over-week mileage change %
    prev_week = grp["weekly_mileage_km"].shift(7).fillna(0)
    grp["mileage_change_pct"] = (
        (grp["weekly_mileage_km"] - prev_week) / prev_week.replace(0, np.nan)
    ).fillna(0) * 100

    # Average pace (use pace column if available, else use distance as proxy)
    if "pace" in col_map:
        grp["avg_pace_last7"] = grp[col_map["pace"]].fillna(0).rolling(7, min_periods=1).mean()
    else:
        grp["avg_pace_last7"] = d.rolling(7, min_periods=1).mean()

    # Average heart rate
    if "hr" in col_map:
        grp["avg_hr_last7"] = grp[col_map["hr"]].fillna(0).rolling(7, min_periods=1).mean()
    else:
        grp["avg_hr_last7"] = 0.0

    # Days since last rest day
    grp["days_since_rest"] = _days_since_rest(d).values

    return grp


def compute_rolling_features(df: pd.DataFrame, col_map: dict) -> pd.DataFrame:
    """Sort by athlete + date, then apply feature engineering per athlete."""
    sort_cols = []
    if "athlete" in col_map:
        sort_cols.append(col_map["athlete"])
    if "date" in col_map:
        df[col_map["date"]] = pd.to_datetime(df[col_map["date"]], errors="coerce")
        sort_cols.append(col_map["date"])
    if sort_cols:
        df = df.sort_values(sort_cols).reset_index(drop=True)

    if "athlete" in col_map:
        df = (
            df.groupby(col_map["athlete"], group_keys=False)
            .apply(lambda g: engineer_features(g, col_map))
        )
    else:
        df = engineer_features(df, col_map)

    return df


# ── Step 5: Target ─────────────────────────────────────────────────────────────

def build_target(df: pd.DataFrame, col_map: dict, horizon: int = 14) -> pd.DataFrame:
    """Add 'injury_next14' column: 1 if any injury within next `horizon` days."""
    target_col = col_map["target"]
    df[target_col] = pd.to_numeric(df[target_col], errors="coerce").fillna(0).astype(int)

    if "athlete" in col_map:
        parts = []
        for _, grp in df.groupby(col_map["athlete"], sort=False):
            grp = grp.copy()
            grp["injury_next14"] = _forward_injury_label(grp[target_col], horizon)
            parts.append(grp)
        df = pd.concat(parts, ignore_index=True)
    else:
        df["injury_next14"] = _forward_injury_label(df[target_col], horizon)

    return df


# ── Step 6: Train & evaluate ──────────────────────────────────────────────────

FEATURE_COLS = [
    "acwr",
    "training_monotony",
    "training_strain",
    "weekly_mileage_km",
    "acute_load",
    "chronic_load",
    "mileage_change_pct",
    "avg_pace_last7",
    "avg_hr_last7",
    "days_since_rest",
]


def main():
    print("=" * 60)
    print("  StrideSafe — XGBoost Injury Prediction Training")
    print("=" * 60)

    # 1. Download
    dataset_dir = download_dataset()

    # 2. Load & normalise
    df = load_data(dataset_dir)
    df = normalise_columns(df)

    # 3. Detect columns
    col_map = detect_columns(df)

    # 4. Engineer features
    print("\n[INFO] Engineering rolling features…")
    df = compute_rolling_features(df, col_map)

    # 5. Build target
    print("[INFO] Building injury-within-14-days target…")
    df = build_target(df, col_map, horizon=14)

    # 6. Select feature columns that were actually computed
    available = [c for c in FEATURE_COLS if c in df.columns]
    print(f"[INFO] Using {len(available)} features: {available}")

    X = df[available].fillna(0).replace([np.inf, -np.inf], 0).astype(float)
    y = df["injury_next14"].astype(int)

    print(f"\n[INFO] Class distribution  — 0: {(y == 0).sum():,}  1: {(y == 1).sum():,}")
    pos_weight = float((y == 0).sum()) / max(float((y == 1).sum()), 1.0)
    print(f"[INFO] scale_pos_weight    = {pos_weight:.2f}")

    # 7. Train / test split (stratified)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"[INFO] Train rows: {len(X_train):,}   Test rows: {len(X_test):,}")

    # 8. Train
    print("\n[INFO] Training XGBClassifier…")
    model = XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=pos_weight,
        eval_metric="logloss",
        early_stopping_rounds=20,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )
    print(f"[INFO] Best iteration: {model.best_iteration}")

    # 9. Evaluate
    y_pred  = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    print("\n" + "=" * 40)
    print("  EVALUATION RESULTS")
    print("=" * 40)
    print(f"  Accuracy  : {accuracy_score(y_test, y_pred):.4f}")
    print(f"  Precision : {precision_score(y_test, y_pred, zero_division=0):.4f}")
    print(f"  Recall    : {recall_score(y_test, y_pred, zero_division=0):.4f}")
    print(f"  F1 Score  : {f1_score(y_test, y_pred, zero_division=0):.4f}")
    print(f"  AUC-ROC   : {roc_auc_score(y_test, y_proba):.4f}")
    print("=" * 40)

    # 10. Save artefacts
    joblib.dump(model, MODEL_PATH)
    print(f"\n[INFO] Model saved      → {MODEL_PATH}")

    with open(FEATURES_PATH, "w") as f:
        json.dump(available, f, indent=2)
    print(f"[INFO] Feature list saved → {FEATURES_PATH}")

    print("\n[DONE] Training complete.\n")


if __name__ == "__main__":
    main()
