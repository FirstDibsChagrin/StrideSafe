#!/usr/bin/env python3
"""
StrideSafe — XGBoost Injury Prediction Training Pipeline

Downloads multiple Kaggle datasets, engineers training-load features,
merges them into a single training set, trains an XGBClassifier, and
saves the artefacts used by the FastAPI backend.

If a dataset fails to download or has incompatible columns it is skipped
with a warning — the script always produces a model from whatever loaded
successfully.

Usage:
    pip install -r ml/requirements.txt
    python ml/train.py
"""

import json
import os
import subprocess
import sys
import traceback
import zipfile
from typing import Optional

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
FEATURES_PATH = os.path.join(SCRIPT_DIR, "feature_names.json")

os.makedirs(DATA_DIR, exist_ok=True)

# ── Dataset registry ───────────────────────────────────────────────────────────
# Add or remove entries here to change which datasets are merged.
# Each entry:
#   slug  — Kaggle dataset identifier (owner/dataset-name)
#   name  — short label used for subdirectory and the source_dataset column
DATASETS = [
    {
        "slug": "shashwatwork/injury-prediction-for-competitive-runners",
        "name": "shashwatwork",
    },
    {
        "slug": "narsinghpatel/running-injury-prediction",
        "name": "narsinghpatel",
    },
]

# Feature columns in priority order.
# Columns absent from a dataset are filled with 0 after the merge.
FEATURE_COLS = [
    # ── Core load metrics (always computed from daily distance) ──
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
    # ── Optional extras — included only if present in source data ──
    # Directly from the shashwatwork dataset (pre-computed 4-week load)
    "km4weeks_direct",
    # Trend slope of the 4-week rolling load
    "mileage_slope",
    # Session count proxy
    "weekly_runs_count",
]


# ── Download ───────────────────────────────────────────────────────────────────

def download_one_dataset(slug: str, extract_dir: str) -> str:
    """
    Download and unzip one Kaggle dataset into `extract_dir`.
    Skips the download if the directory already exists and is non-empty.
    Raises on any failure so the caller can decide whether to skip.
    """
    if os.path.isdir(extract_dir) and os.listdir(extract_dir):
        print(f"  [cache] {slug} — already present, skipping download.")
        return extract_dir

    os.makedirs(extract_dir, exist_ok=True)
    print(f"  [download] {slug}")
    subprocess.run(
        [
            sys.executable, "-m", "kaggle",
            "datasets", "download",
            "-d", slug,
            "-p", extract_dir,
        ],
        check=True,
    )

    zips = [f for f in os.listdir(extract_dir) if f.endswith(".zip")]
    if not zips:
        raise FileNotFoundError(
            f"Download of {slug} succeeded but no zip found in {extract_dir}"
        )

    for z in sorted(zips):
        zip_path = os.path.join(extract_dir, z)
        print(f"  [unzip]  {z}")
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(extract_dir)

    return extract_dir


# ── Load ───────────────────────────────────────────────────────────────────────

def load_csvs(directory: str) -> pd.DataFrame:
    """Walk `directory`, load every CSV, and return a single concatenated frame."""
    csv_files = sorted(
        os.path.join(root, fname)
        for root, _, files in os.walk(directory)
        for fname in files
        if fname.lower().endswith(".csv")
    )
    if not csv_files:
        raise FileNotFoundError(f"No CSV files found under {directory}")

    frames = []
    for path in csv_files:
        df = pd.read_csv(path)
        print(f"  [csv]    {os.path.basename(path)}: {df.shape}  cols={list(df.columns)}")
        frames.append(df)

    return pd.concat(frames, ignore_index=True) if len(frames) > 1 else frames[0]


def normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Lowercase and snake_case all column names in-place."""
    df.columns = (
        df.columns.str.strip()
        .str.lower()
        .str.replace(r"[\s\-/]+", "_", regex=True)
    )
    return df


# ── Column detection ───────────────────────────────────────────────────────────

def detect_columns(df: pd.DataFrame) -> dict:
    """
    Map semantic roles to the actual column names present in this DataFrame.
    Required roles: 'distance', 'target'.
    Optional roles: 'hr', 'date', 'athlete', 'pace', 'km4weeks_col',
                    'slope_col', 'nr_runs_col'.
    Raises ValueError if required roles are missing.
    """
    cols = set(df.columns)

    def first(*candidates):
        return next((c for c in candidates if c in cols), None)

    mapping = {
        # Required
        "distance":    first("km", "distance", "distance_km", "kilometers",
                             "mileage", "load", "km_per_session"),
        "target":      first("injury", "injured", "injury_flag",
                             "target", "label", "injury_label"),
        # Optional
        "hr":          first("hr", "heart_rate", "average_heartrate",
                             "avg_hr", "average_hr", "heartrate"),
        "date":        first("date", "day", "training_date", "week", "session_date"),
        "athlete":     first("athlete", "runner_id", "athlete_id",
                             "id", "runner", "participant_id"),
        "pace":        first("pace", "avg_pace", "pace_min_km",
                             "speed", "avg_speed"),
        # Extras from the shashwatwork dataset
        "km4weeks_col": first("km4weeks", "km_4weeks", "km4_weeks",
                              "km_28days", "4week_km"),
        "slope_col":    first("slope_km4weeks", "slope_km_4weeks",
                              "slope", "km_slope"),
        "nr_runs_col":  first("nr_of_runs", "nr_runs", "number_of_runs",
                              "sessions", "training_sessions"),
    }

    # Remove roles that weren't found
    mapping = {k: v for k, v in mapping.items() if v is not None}

    for required in ("distance", "target"):
        if required not in mapping:
            raise ValueError(
                f"Cannot find a '{required}' column. "
                f"Available columns: {sorted(cols)}"
            )

    print(f"  [cols]   {mapping}")
    return mapping


# ── Feature engineering ────────────────────────────────────────────────────────

def _forward_injury_label(series: pd.Series, horizon: int = 14) -> pd.Series:
    """
    For each position i: 1 if any injury in positions [i+1 … i+horizon].
    O(n) via prefix sums.
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
    """Consecutive active days going back from each position (resets on rest day)."""
    result, count = [], 0
    for v in (dist_series.fillna(0) > 0):
        count = count + 1 if v else 0
        result.append(count)
    return pd.Series(result, index=dist_series.index)


def engineer_features(grp: pd.DataFrame, col_map: dict) -> pd.DataFrame:
    """Compute all rolling features for one athlete's chronological block."""
    d = grp[col_map["distance"]].fillna(0).astype(float)

    # ── Core load ────────────────────────────────────────────────
    acute  = d.rolling(7,  min_periods=1).mean()
    chronic = d.rolling(28, min_periods=1).mean()
    grp["acute_load"]  = acute
    grp["chronic_load"] = chronic
    grp["acwr"] = (acute / chronic.replace(0, np.nan)).fillna(0)

    roll7_mean = d.rolling(7, min_periods=1).mean()
    roll7_std  = d.rolling(7, min_periods=1).std().fillna(0)
    grp["training_monotony"] = (roll7_mean / roll7_std.replace(0, np.nan)).fillna(0)
    grp["weekly_mileage_km"] = d.rolling(7, min_periods=1).sum()
    grp["training_strain"]   = grp["weekly_mileage_km"] * grp["training_monotony"]

    prev_week = grp["weekly_mileage_km"].shift(7).fillna(0)
    grp["mileage_change_pct"] = (
        (grp["weekly_mileage_km"] - prev_week) / prev_week.replace(0, np.nan)
    ).fillna(0) * 100

    # ── Pace and HR ──────────────────────────────────────────────
    if "pace" in col_map:
        grp["avg_pace_last7"] = (
            grp[col_map["pace"]].fillna(0).rolling(7, min_periods=1).mean()
        )
    else:
        # Distance as a pace proxy when no explicit pace column exists
        grp["avg_pace_last7"] = roll7_mean

    if "hr" in col_map:
        grp["avg_hr_last7"] = (
            grp[col_map["hr"]].fillna(0).rolling(7, min_periods=1).mean()
        )
    else:
        grp["avg_hr_last7"] = 0.0

    grp["days_since_rest"] = _days_since_rest(d).values

    # ── Optional extras from shashwatwork dataset ────────────────
    if "km4weeks_col" in col_map:
        grp["km4weeks_direct"] = grp[col_map["km4weeks_col"]].fillna(0)

    if "slope_col" in col_map:
        grp["mileage_slope"] = grp[col_map["slope_col"]].fillna(0)

    if "nr_runs_col" in col_map:
        grp["weekly_runs_count"] = (
            grp[col_map["nr_runs_col"]].fillna(0).rolling(7, min_periods=1).sum()
        )

    return grp


def compute_rolling_features(df: pd.DataFrame, col_map: dict) -> pd.DataFrame:
    """Sort by athlete + date, then apply engineer_features per athlete."""
    sort_cols = []
    if "athlete" in col_map:
        sort_cols.append(col_map["athlete"])
    if "date" in col_map:
        df[col_map["date"]] = pd.to_datetime(df[col_map["date"]], errors="coerce")
        sort_cols.append(col_map["date"])
    if sort_cols:
        df = df.sort_values(sort_cols).reset_index(drop=True)

    if "athlete" in col_map:
        df = df.groupby(col_map["athlete"], group_keys=False).apply(
            lambda g: engineer_features(g, col_map)
        )
    else:
        df = engineer_features(df, col_map)

    return df.reset_index(drop=True)


def build_target(df: pd.DataFrame, col_map: dict, horizon: int = 14) -> pd.DataFrame:
    """Add 'injury_next14': 1 if any injury in the next `horizon` days."""
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


# ── Synthetic fallback ─────────────────────────────────────────────────────────

def _generate_synthetic(n: int = 500, seed: int = 42) -> pd.DataFrame:
    """500 synthetic HS XC athlete-week snapshots with realistic injury signal."""
    rng = np.random.default_rng(seed)
    acwr               = rng.normal(1.05, 0.22, size=n).clip(0.4, 2.0)
    weekly_mileage_km  = rng.normal(48, 12, size=n).clip(20, 90)
    days_since_rest    = rng.integers(0, 11, size=n).astype(float)
    training_monotony  = rng.normal(1.5, 0.5, size=n).clip(0.5, 3.5)
    training_strain    = rng.normal(3000, 1500, size=n).clip(500, 8000)
    acute_load         = rng.normal(350, 80, size=n).clip(100, 600)
    chronic_load       = rng.normal(340, 70, size=n).clip(100, 600)
    mileage_change_pct = rng.normal(0, 15, size=n).clip(-40, 50)
    avg_pace_last7     = rng.normal(330, 30, size=n).clip(260, 440)

    logit = (
        -4.0
        + 2.5 * np.maximum(acwr - 1.3, 0)
        + 1.5 * np.maximum(0.8 - acwr, 0)
        + 0.04 * weekly_mileage_km
        + 0.15 * days_since_rest
        + 0.5  * np.maximum(training_monotony - 2.0, 0)
    )
    prob = 1 / (1 + np.exp(-logit))
    injury_next14 = rng.binomial(1, prob).astype(int)

    df = pd.DataFrame({
        "acwr": acwr, "weekly_mileage_km": weekly_mileage_km,
        "days_since_rest": days_since_rest, "training_monotony": training_monotony,
        "training_strain": training_strain, "acute_load": acute_load,
        "chronic_load": chronic_load, "mileage_change_pct": mileage_change_pct,
        "avg_pace_last7": avg_pace_last7,
        "injury_next14": injury_next14, "source_dataset": "synthetic",
    })
    print(f"  [synthetic] {n} rows  |  injury rate: {df['injury_next14'].mean():.1%}")
    return df


# ── Per-dataset pipeline ───────────────────────────────────────────────────────

def process_one_dataset(dataset: dict) -> Optional[pd.DataFrame]:
    """
    Run the full pipeline for one dataset entry.
    Returns a processed DataFrame with a 'source_dataset' column,
    or None if anything fails (with a printed warning).
    """
    slug = dataset["slug"]
    name = dataset["name"]
    extract_dir = os.path.join(DATA_DIR, "raw", name)

    print(f"\n{'─' * 56}")
    print(f"  Dataset : {slug}")
    print(f"  Label   : {name}")
    print(f"{'─' * 56}")

    try:
        download_one_dataset(slug, extract_dir)
        df = load_csvs(extract_dir)
        df = normalise_columns(df)
        col_map = detect_columns(df)

        print(f"  [feat]   Engineering rolling features…")
        df = compute_rolling_features(df, col_map)

        print(f"  [target] Building injury_next14 target…")
        df = build_target(df, col_map, horizon=14)

        df["source_dataset"] = name
        pos = int(df["injury_next14"].sum())
        print(f"  [ok]     {len(df):,} rows  |  positives: {pos:,}  ({pos/len(df)*100:.1f}%)")
        return df

    except Exception:
        print(f"\n  [WARN] Skipping '{slug}':")
        for line in traceback.format_exc().splitlines():
            print(f"         {line}")
        return None


# ── Training ───────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  StrideSafe — XGBoost Injury Prediction Training")
    print("=" * 60)

    # ── 1. Process each dataset ────────────────────────────────────
    frames: list[pd.DataFrame] = []
    for ds in DATASETS:
        result = process_one_dataset(ds)
        if result is not None:
            frames.append(result)

    if not frames:
        print("\n[WARN] Every Kaggle dataset failed — falling back to synthetic data.")
        frames.append(_generate_synthetic())

    # ── 2. Merge ───────────────────────────────────────────────────
    print(f"\n{'=' * 60}")
    print(f"  Loaded {len(frames)} dataset(s) — merging…")
    df = pd.concat(frames, ignore_index=True)

    # ── 3. Feature selection ───────────────────────────────────────
    available = [c for c in FEATURE_COLS if c in df.columns]
    missing   = [c for c in FEATURE_COLS if c not in df.columns]
    if missing:
        print(f"  [info]   Columns not found (will use 0): {missing}")
    print(f"  [info]   Training features ({len(available)}): {available}")

    X_all = (
        df[available + ["source_dataset", "injury_next14"]]
        .copy()
        .assign(**{c: 0.0 for c in missing})   # fill any entirely-absent cols
    )
    X_all[available] = (
        X_all[available]
        .fillna(0)
        .replace([np.inf, -np.inf], 0)
        .astype(float)
    )

    X = X_all[available]
    y = X_all["injury_next14"].astype(int)

    # ── 4. Data summary ────────────────────────────────────────────
    source_counts = X_all["source_dataset"].value_counts()
    pos_rate = y.mean() * 100

    print(f"\n{'=' * 56}")
    print("  DATA SUMMARY")
    print(f"{'─' * 56}")
    print(f"  Total rows             : {len(df):>10,}")
    print(f"  Positive class (inj.)  : {pos_rate:>9.1f}%")
    print(f"  Source breakdown:")
    for src, cnt in source_counts.items():
        print(f"    {src:<32} {cnt:>8,}  ({cnt / len(df) * 100:.1f}%)")
    print(f"{'=' * 56}")

    pos_weight = float((y == 0).sum()) / max(float((y == 1).sum()), 1.0)
    print(f"  scale_pos_weight       : {pos_weight:.2f}")

    # ── 5. Train / test split ──────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"  Train rows             : {len(X_train):>10,}")
    print(f"  Test rows              : {len(X_test):>10,}")

    # ── 6. Train ───────────────────────────────────────────────────
    print(f"\n[INFO] Training XGBClassifier…")
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

    # ── 7. Evaluate ────────────────────────────────────────────────
    y_pred  = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    print(f"\n{'=' * 56}")
    print("  EVALUATION RESULTS")
    print(f"{'─' * 56}")
    print(f"  Accuracy  : {accuracy_score(y_test, y_pred):.4f}")
    print(f"  Precision : {precision_score(y_test, y_pred, zero_division=0):.4f}")
    print(f"  Recall    : {recall_score(y_test, y_pred, zero_division=0):.4f}")
    print(f"  F1 Score  : {f1_score(y_test, y_pred, zero_division=0):.4f}")
    print(f"  AUC-ROC   : {roc_auc_score(y_test, y_proba):.4f}")
    print(f"{'─' * 56}")
    print(f"  Training data breakdown:")
    print(f"    Total rows             : {len(X_train) + len(X_test):>8,}")
    print(f"    Positive class         : {y.mean() * 100:>7.1f}%")
    for src, cnt in source_counts.items():
        print(f"    {src:<28} : {cnt:>8,}  ({cnt / len(df) * 100:.1f}%)")
    print(f"{'=' * 56}")

    # ── 8. Save artefacts ──────────────────────────────────────────
    joblib.dump(model, MODEL_PATH)
    print(f"\n[INFO] Model saved        → {MODEL_PATH}")

    with open(FEATURES_PATH, "w") as f:
        json.dump(available, f, indent=2)
    print(f"[INFO] Feature list saved → {FEATURES_PATH}")

    print("\n[DONE] Training complete.\n")


if __name__ == "__main__":
    main()
