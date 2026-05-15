# StrideSafe ML Pipeline

XGBoost injury-risk classifier for high school cross-country runners.

## Setup

```bash
cd ml/
pip install -r requirements.txt
```

## Training

```bash
python train.py
```

If `ml/data/training_data.csv` does not exist, the script generates 500 synthetic
athlete-week snapshots with realistic distributions and saves them there first.

After training, two files are written:

| File | Description |
|---|---|
| `ml/model.pkl` | Trained `XGBClassifier` (joblib format) |
| `ml/feature_names.json` | Ordered list of feature names expected at inference |

## Bringing real data

Place a CSV at `ml/data/training_data.csv` with these columns:

| Column | Type | Description |
|---|---|---|
| `acwr` | float | Acute:chronic workload ratio |
| `weekly_mileage_km` | float | Kilometres run in the current week |
| `days_since_rest` | int | Days since the last full rest day |
| `avg_pace_sec_per_km` | float | Average pace over recent runs (seconds/km) |
| `fatigue_level` | int | Self-reported fatigue 0–10 |
| `pain_level` | int | Self-reported pain 0–10 |
| `stress_level` | int | Self-reported stress 0–10 |
| `age` | int | Athlete age in years |
| `gender_encoded` | int | 0=unknown, 1=male, 2=female, 3=other |
| `injury_occurred` | int | Target: 1 if injured within the next 14 days, else 0 |

## Inference

The backend (`backend/services/risk.py`) loads `model.pkl` and `feature_names.json`
at startup and uses them to score each athlete. If the files are missing it falls
back to the rule-based scorer automatically.
