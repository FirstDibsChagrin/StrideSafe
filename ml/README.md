# StrideSafe — ML Training Pipeline

Trains an XGBoost injury prediction model on the
[Kaggle "Injury Prediction for Competitive Runners"](https://www.kaggle.com/datasets/shashwatwork/injury-prediction-for-competitive-runners)
dataset and saves the artefacts used by the FastAPI backend.

## Prerequisites

**1. Kaggle API credentials**

Create an API token at https://www.kaggle.com/settings → API → Create New Token.
This downloads `kaggle.json`. Place it at:

- **macOS / Linux**: `~/.kaggle/kaggle.json`
- **Windows**: `C:\Users\<you>\.kaggle\kaggle.json`

Set permissions: `chmod 600 ~/.kaggle/kaggle.json`

**2. Python 3.10+**

## Setup & run

```bash
# From the repo root
pip install -r ml/requirements.txt

python ml/train.py
```

The script will:

1. Download the dataset from Kaggle into `ml/data/raw/`
2. Normalise and inspect the CSV columns
3. Engineer rolling features per athlete: ACWR, training monotony, training
   strain, weekly mileage, 7-day mileage change %, average pace, average HR,
   days since last rest day
4. Build a binary target: *injury within the next 14 days*
5. Split 80 / 20 (stratified) and train an `XGBClassifier` with
   `scale_pos_weight` set to handle class imbalance
6. Print accuracy, precision, recall, F1, and AUC-ROC to the console
7. Save **`ml/model.pkl`** (joblib) and **`ml/feature_columns.json`**

## Output artefacts

| File | Purpose |
|---|---|
| `ml/model.pkl` | Trained XGBoost model — loaded by the FastAPI backend at runtime |
| `ml/feature_columns.json` | Ordered list of feature names the model expects |
| `ml/data/raw/` | Downloaded dataset (gitignored) |

## Backend integration

Once `ml/model.pkl` exists, `backend/services/risk.py` automatically switches
from the rule-based scorer to the ML model.  
Set `model_version = "xgboost-v1"` is recorded in `risk_scores`.  
If the model file is absent the backend falls back to `"rule-based-v1"` with no
code changes required.

## Re-training

Just re-run `python ml/train.py`. It overwrites `model.pkl` and
`feature_columns.json` in place. The dataset is cached in `ml/data/raw/` so
subsequent runs skip the download step.
