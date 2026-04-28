from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler


FEATURE_COLUMNS = [
    "glucose_mg_dl",
    "heart_rate_bpm",
    "steps_5min",
    "sleep_score",
    "meal_carbs_g",
    "insulin_units",
    "stress_score",
]


@dataclass
class SequenceDataset:
    X: np.ndarray
    y: np.ndarray
    feature_columns: List[str]


def load_data(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    # Use cyclical encodings so time-of-day discontinuities are smoother for the model.
    df["hour_sin"] = np.sin(2 * np.pi * df["hour_of_day"] / 24.0)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour_of_day"] / 24.0)
    df["dow_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7.0)
    df["dow_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7.0)
    return df


def scale_features(
    df: pd.DataFrame,
    feature_columns: List[str] | None = None,
) -> Tuple[pd.DataFrame, MinMaxScaler]:
    feature_columns = feature_columns or FEATURE_COLUMNS + [
        "hour_sin",
        "hour_cos",
        "dow_sin",
        "dow_cos",
    ]
    scaler = MinMaxScaler()
    scaled = df.copy()
    scaled[feature_columns] = scaler.fit_transform(scaled[feature_columns])
    return scaled, scaler


def make_sequences(
    df: pd.DataFrame,
    lookback: int = 4,
    target_column: str = "future_glucose_30m",
    feature_columns: List[str] | None = None,
) -> SequenceDataset:
    feature_columns = feature_columns or FEATURE_COLUMNS + [
        "hour_sin",
        "hour_cos",
        "dow_sin",
        "dow_cos",
    ]
    X, y = [], []
    values = df[feature_columns].to_numpy(dtype=np.float32)
    targets = df[target_column].to_numpy(dtype=np.float32)

    for end_idx in range(lookback, len(df)):
        X.append(values[end_idx - lookback : end_idx])
        y.append(targets[end_idx])

    return SequenceDataset(
        X=np.asarray(X, dtype=np.float32),
        y=np.asarray(y, dtype=np.float32),
        feature_columns=feature_columns,
    )


def train_test_split_time_series(
    dataset: SequenceDataset,
    test_ratio: float = 0.25,
) -> Tuple[SequenceDataset, SequenceDataset]:
    split_idx = int(len(dataset.X) * (1 - test_ratio))
    train = SequenceDataset(
        X=dataset.X[:split_idx],
        y=dataset.y[:split_idx],
        feature_columns=dataset.feature_columns,
    )
    test = SequenceDataset(
        X=dataset.X[split_idx:],
        y=dataset.y[split_idx:],
        feature_columns=dataset.feature_columns,
    )
    return train, test
