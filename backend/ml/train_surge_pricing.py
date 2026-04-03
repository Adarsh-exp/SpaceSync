"""
Run this script once to train and save the surge pricing model.
Usage: python -m backend.ml.train_surge_pricing
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
import joblib     
import os

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "models/surge_model.joblib")


def train():
    np.random.seed(42)
    n = 1000

    df = pd.DataFrame({
        "is_weekend": np.random.randint(0, 2, n),
        "slot_time": np.random.randint(0, 4, n),
        "bookings_this_week": np.random.randint(0, 50, n),
        "space_type": np.random.randint(0, 3, n),
        "advance_days": np.random.randint(0, 30, n),
    })

    df["surge"] = (
        1.0
        + df["is_weekend"] * 0.5
        + (df["slot_time"] == 2) * 0.4
        + (df["bookings_this_week"] / 100)
        - (df["advance_days"] / 100)
        + np.random.normal(0, 0.05, n)
    ).clip(1.0, 2.5)

    X = df.drop("surge", axis=1)
    y = df["surge"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = LinearRegression()
    model.fit(X_train, y_train)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    joblib.dump(model, OUTPUT_PATH)
    print(f"✅ Surge model saved to {OUTPUT_PATH}")
    print(f"   R² score: {model.score(X_test, y_test):.4f}")


if __name__ == "__main__":
    train()
