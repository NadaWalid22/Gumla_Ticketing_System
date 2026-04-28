from __future__ import annotations

import argparse

import numpy as np
import torch
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from preprocess import load_data, make_sequences, scale_features, train_test_split_time_series


class GlucoseLSTM(nn.Module):
    def __init__(self, input_size: int, hidden_size: int = 32):
        super().__init__()
        self.lstm = nn.LSTM(input_size=input_size, hidden_size=hidden_size, batch_first=True)
        self.head = nn.Sequential(
            nn.Linear(hidden_size, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        output, _ = self.lstm(x)
        last_hidden = output[:, -1, :]
        return self.head(last_hidden).squeeze(-1)


def evaluate(y_true: np.ndarray, y_pred: np.ndarray) -> None:
    mae = mean_absolute_error(y_true, y_pred)
    rmse = mean_squared_error(y_true, y_pred) ** 0.5
    r2 = r2_score(y_true, y_pred)
    print(f"MAE: {mae:.3f}")
    print(f"RMSE: {rmse:.3f}")
    print(f"R2: {r2:.3f}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="Path to CSV data")
    parser.add_argument("--lookback", type=int, default=4)
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--batch-size", type=int, default=4)
    args = parser.parse_args()

    df = load_data(args.data)
    scaled_df, _ = scale_features(df)
    dataset = make_sequences(scaled_df, lookback=args.lookback)
    train_set, test_set = train_test_split_time_series(dataset)

    X_train = torch.tensor(train_set.X)
    y_train = torch.tensor(train_set.y)
    X_test = torch.tensor(test_set.X)
    y_test = torch.tensor(test_set.y)

    train_loader = DataLoader(
        TensorDataset(X_train, y_train),
        batch_size=args.batch_size,
        shuffle=False,
    )

    model = GlucoseLSTM(input_size=X_train.shape[-1])
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.MSELoss()

    model.train()
    for epoch in range(args.epochs):
        epoch_loss = 0.0
        for batch_x, batch_y in train_loader:
            optimizer.zero_grad()
            preds = model(batch_x)
            loss = criterion(preds, batch_y)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()

        if (epoch + 1) % 20 == 0:
            print(f"Epoch {epoch + 1:03d} | loss={epoch_loss / len(train_loader):.4f}")

    model.eval()
    with torch.no_grad():
        preds = model(X_test).cpu().numpy()

    evaluate(y_test.cpu().numpy(), preds)


if __name__ == "__main__":
    main()
