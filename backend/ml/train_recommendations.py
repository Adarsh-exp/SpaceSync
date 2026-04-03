"""
Train the content-based recommendation model.
Run: python -m backend.ml.train_recommendations
"""
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
import joblib
import os

np.random.seed(42)

spaces = pd.DataFrame({
    "space_id": range(1, 21),
    "type_encoded": np.random.randint(0, 3, 20),      # 0=cricket, 1=party_hall, 2=parking
    "city_encoded": np.random.randint(0, 5, 20),
    "base_price": np.random.randint(200, 2000, 20),
    "rating": np.random.uniform(3.0, 5.0, 20),
    "amenities_count": np.random.randint(1, 10, 20),
})

scaler = MinMaxScaler()
feature_matrix = scaler.fit_transform(spaces.drop("space_id", axis=1))

output_dir = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, "recommender.joblib")

joblib.dump(
    {
        "matrix": feature_matrix,
        "scaler": scaler,
        "space_ids": spaces["space_id"].tolist(),
    },
    output_path,
)

print(f"✅ Recommender model saved to {output_path}")
print(f"   Feature matrix shape: {feature_matrix.shape}")
