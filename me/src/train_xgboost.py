from __future__ import annotations

import argparse

import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor

from preprocess import load_data, make_sequences, scale_features, train_test_split_time_series


def flatten_sequences(X: np.ndarray) -> np.ndarray:
    return X.reshape(X.shape[0], X.shape[1] * X.shape[2])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="Path to CSV data")
    parser.add_argument("--lookback", type=int, default=4)
    args = parser.parse_args()

    df = load_data(args.data)
    scaled_df, _ = scale_features(df)
    dataset = make_sequences(scaled_df, lookback=args.lookback)
    train_set, test_set = train_test_split_time_series(dataset)

    X_train = flatten_sequences(train_set.X)
    X_test = flatten_sequences(test_set.X)

    model = XGBRegressor(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.05,
        objective="reg:squarederror",
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
    )
    model.fit(X_train, train_set.y)
    preds = model.predict(X_test)

    mae = mean_absolute_error(test_set.y, preds)
    rmse = mean_squared_error(test_set.y, preds) ** 0.5
    r2 = r2_score(test_set.y, preds)

    print(f"MAE: {mae:.3f}")
    print(f"RMSE: {rmse:.3f}")
    print(f"R2: {r2:.3f}")


if __name__ == "__main__":
    main()
