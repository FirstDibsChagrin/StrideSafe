# StrideSafe ML Pipeline

XGBoost injury-risk classifier for high school cross-country runners.

## Setup

```bash
cd backend/
pip install -r requirements.txt
```

## Training

```bash
python ml/train.py
```

Training data priority:
1. **Kaggle** — set `KAGGLE_USERNAME` + `KAGGLE_KEY` env vars; downloads `shashwatwork/injury-prediction-for-competitive-runners` automatically
2. **Local CSV** — place a CSV at `backend/ml/data/training_data.csv`
3. **Synthetic** — generated automatically if neither of the above are available

After training, two files are written:

| File | Description |
|---|---|
| `backend/ml/model.pkl` | Trained `XGBClassifier` (joblib format) |
| `backend/ml/feature_names.json` | Ordered list of feature names expected at inference |

## Bringing real data

Place a CSV at `backend/ml/data/training_data.csv` with these columns:

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

## Railway deployment

Set these in Railway → Variables for Kaggle dataset download during build:
- `KAGGLE_USERNAME` — your Kaggle account username
- `KAGGLE_KEY` — your Kaggle API key

Without them, `train.py` falls back to synthetic data automatically.
