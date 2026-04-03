"""
Train the availability prediction model (Logistic Regression).
Run: python -m backend.ml.train_availability
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
import joblib
import os

np.random.seed(42)
n = 1000

df = pd.DataFrame({
    "space_type": np.random.randint(0, 3, n),
    "slot_time": np.random.randint(0, 4, n),
    "is_weekend": np.random.randint(0, 2, n),
    "advance_days": np.random.randint(0, 30, n),
    "avg_rating": np.random.uniform(3.0, 5.0, n),
    "past_bookings": np.random.randint(0, 200, n),
})

prob = (
    0.3
    + df["is_weekend"] * 0.3
    + (df["slot_time"] == 2) * 0.2
    + (df["avg_rating"] - 3) * 0.1
    + (df["past_bookings"] / 500)
)
df["will_book"] = (prob + np.random.normal(0, 0.1, n) > 0.6).astype(int)

X = df.drop("will_book", axis=1)
y = df["will_book"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = LogisticRegression(max_iter=200)
model.fit(X_train, y_train)

output_dir = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, "availability_model.joblib")

joblib.dump(model, output_path)
print(f"✅ Availability model saved to {output_path}")
print(f"   Accuracy: {model.score(X_test, y_test):.4f}")
