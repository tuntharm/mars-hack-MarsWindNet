import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from pathlib import Path

from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping


# ============================================================
# LSTM PREDICTION OF CITY WIND + DUST
# ============================================================
#
# Input:
#
#     mars_city_wind_dust_training.csv
#
# The CSV contains measurements from:
#
#     W, N, E, S sensor nodes
#     City
#
# The LSTM uses the four surrounding sensors to predict:
#
#     city_u
#     city_v
#     city_dust
#
# The first 80% of the time series is used for training.
# The final 20% is held out for testing.
#
# Outputs:
#
#     mars_city_wind_dust_with_lstm_predictions.csv
#
#     mars_lstm_predictions/
#         city_u_prediction.png
#         city_v_prediction.png
#         city_dust_prediction.png
#         city_lstm_predictions.png
#
# ============================================================


# ------------------------------------------------------------
# 1. CONFIGURATION
# ------------------------------------------------------------

INPUT_FILE = "mars_city_wind_dust_training.csv"

OUTPUT_FILE = (
    "mars_city_wind_dust_with_lstm_predictions.csv"
)

PLOT_DIRECTORY = Path(
    "mars_lstm_predictions"
)

# Fraction of the time series used for training
TRAIN_FRACTION = 0.80

# Number of previous time steps presented to the LSTM
#
# The CSV is sampled every 1 second, so:
#
#     60 -> previous 60 seconds
#
SEQUENCE_LENGTH = 60

# LSTM settings
LSTM_UNITS = 64
DROPOUT = 0.2

EPOCHS = 50
BATCH_SIZE = 64

RANDOM_SEED = 42


# ------------------------------------------------------------
# 2. RANDOM SEEDS
# ------------------------------------------------------------

np.random.seed(
    RANDOM_SEED
)

import tensorflow as tf

tf.random.set_seed(
    RANDOM_SEED
)


# ------------------------------------------------------------
# 3. CREATE OUTPUT DIRECTORY
# ------------------------------------------------------------

PLOT_DIRECTORY.mkdir(
    parents=True,
    exist_ok=True
)


# ------------------------------------------------------------
# 4. LOAD CSV
# ------------------------------------------------------------

df = pd.read_csv(
    INPUT_FILE
)

print()
print("=" * 70)
print("LSTM CITY WIND + DUST PREDICTION")
print("=" * 70)

print()
print(
    f"Input file       : {INPUT_FILE}"
)

print(
    f"Rows             : {len(df):,}"
)

print(
    f"Columns          : {len(df.columns)}"
)


# ------------------------------------------------------------
# 5. DEFINE INPUT FEATURES
# ------------------------------------------------------------
#
# IMPORTANT:
#
# We intentionally do NOT use:
#
#     city_u
#     city_v
#     city_dust
#
# as input features.
#
# Those are the quantities we are trying to predict.
#
# This avoids target leakage.
# ------------------------------------------------------------

input_columns = [

    # West sensor
    "node_W_u",
    "node_W_v",
    "node_W_dust",

    # North sensor
    "node_N_u",
    "node_N_v",
    "node_N_dust",

    # East sensor
    "node_E_u",
    "node_E_v",
    "node_E_dust",

    # South sensor
    "node_S_u",
    "node_S_v",
    "node_S_dust",
]


# ------------------------------------------------------------
# 6. DEFINE TARGETS
# ------------------------------------------------------------

target_columns = [
    "city_u",
    "city_v",
    "city_dust"
]


# ------------------------------------------------------------
# 7. CHECK REQUIRED COLUMNS
# ------------------------------------------------------------

required_columns = (
    ["time"]
    + input_columns
    + target_columns
)

missing_columns = [
    column
    for column in required_columns
    if column not in df.columns
]

if missing_columns:

    raise ValueError(
        "The following required columns are missing:\n"
        + "\n".join(missing_columns)
    )


# ------------------------------------------------------------
# 8. EXTRACT NUMPY ARRAYS
# ------------------------------------------------------------

X_raw = df[
    input_columns
].values.astype(
    np.float32
)

y_raw = df[
    target_columns
].values.astype(
    np.float32
)


# ------------------------------------------------------------
# 9. CHRONOLOGICAL TRAIN / TEST SPLIT
# ------------------------------------------------------------
#
# IMPORTANT:
#
# No random train/test split is used.
#
# The first 80% of time is training data.
# The last 20% is unseen test data.
# ------------------------------------------------------------

n_samples = len(df)

train_end = int(
    n_samples * TRAIN_FRACTION
)

print()
print(
    f"Training samples  : {train_end:,}"
)

print(
    f"Testing samples   : {n_samples - train_end:,}"
)

print(
    f"Training fraction : {TRAIN_FRACTION:.0%}"
)


# ------------------------------------------------------------
# 10. SCALE FEATURES
# ------------------------------------------------------------
#
# The scalers are fitted ONLY on the training section.
#
# This prevents information from the future test period from
# leaking into the training process.
# ------------------------------------------------------------

x_scaler = StandardScaler()

y_scaler = StandardScaler()


x_scaler.fit(
    X_raw[:train_end]
)

y_scaler.fit(
    y_raw[:train_end]
)


X_scaled = x_scaler.transform(
    X_raw
).astype(
    np.float32
)

y_scaled = y_scaler.transform(
    y_raw
).astype(
    np.float32
)


# ------------------------------------------------------------
# 11. CREATE LSTM SEQUENCES
# ------------------------------------------------------------
#
# Each sample looks like:
#
#     previous 60 seconds of W/N/E/S measurements
#
# and predicts:
#
#     city state at the current timestep.
#
# Shape:
#
#     X = [samples, sequence_length, features]
#
#     y = [samples, 3]
#
# ------------------------------------------------------------

def create_sequences(
    X,
    y,
    sequence_length
):

    X_sequences = []
    y_targets = []
    indices = []

    for i in range(
        sequence_length,
        len(X)
    ):

        X_sequences.append(
            X[
                i - sequence_length:i
            ]
        )

        y_targets.append(
            y[i]
        )

        indices.append(
            i
        )

    return (
        np.asarray(
            X_sequences,
            dtype=np.float32
        ),
        np.asarray(
            y_targets,
            dtype=np.float32
        ),
        np.asarray(
            indices
        )
    )


X_sequences, y_sequences, sequence_indices = (
    create_sequences(
        X_scaled,
        y_scaled,
        SEQUENCE_LENGTH
    )
)


# ------------------------------------------------------------
# 12. SPLIT SEQUENCES CHRONOLOGICALLY
# ------------------------------------------------------------

train_mask = (
    sequence_indices < train_end
)

test_mask = (
    sequence_indices >= train_end
)


X_train = X_sequences[
    train_mask
]

y_train = y_sequences[
    train_mask
]

X_test = X_sequences[
    test_mask
]

y_test = y_sequences[
    test_mask
]

test_indices = sequence_indices[
    test_mask
]


print()
print(
    f"LSTM sequence length : "
    f"{SEQUENCE_LENGTH}"
)

print(
    f"Training sequences   : "
    f"{len(X_train):,}"
)

print(
    f"Testing sequences    : "
    f"{len(X_test):,}"
)

print(
    f"Input features       : "
    f"{X_train.shape[-1]}"
)


# ------------------------------------------------------------
# 13. BUILD LSTM
# ------------------------------------------------------------

model = Sequential([

    LSTM(
        LSTM_UNITS,
        input_shape=(
            SEQUENCE_LENGTH,
            len(input_columns)
        ),
        return_sequences=False
    ),

    Dropout(
        DROPOUT
    ),

    Dense(
        4,
        activation="relu"
    ),

    Dense(
        3
    )
])


# ------------------------------------------------------------
# 14. COMPILE MODEL
# ------------------------------------------------------------

model.compile(
    optimizer="adam",
    loss="mse",
    metrics=["mae"]
)


print()
print("=" * 70)
print("MODEL")
print("=" * 70)

model.summary()


# ------------------------------------------------------------
# 15. EARLY STOPPING
# ------------------------------------------------------------
#
# The validation set is taken from the END of the training
# period, preserving chronological ordering.
#
# validation_split does not shuffle here.
# ------------------------------------------------------------

early_stopping = EarlyStopping(
    monitor="val_loss",
    patience=7,
    restore_best_weights=True
)


# ------------------------------------------------------------
# 16. TRAIN LSTM
# ------------------------------------------------------------

print()
print("=" * 70)
print("TRAINING")
print("=" * 70)

history = model.fit(
    X_train,
    y_train,

    epochs=EPOCHS,

    batch_size=BATCH_SIZE,

    validation_split=0.15,

    shuffle=False,

    callbacks=[
        early_stopping
    ],

    verbose=1
)


# ------------------------------------------------------------
# 17. PREDICT TEST PERIOD
# ------------------------------------------------------------

y_pred_scaled = model.predict(
    X_test,
    verbose=0
)


# ------------------------------------------------------------
# 18. CONVERT PREDICTIONS BACK TO ORIGINAL UNITS
# ------------------------------------------------------------

y_pred = y_scaler.inverse_transform(
    y_pred_scaled
)

y_test_actual = y_scaler.inverse_transform(
    y_test
)


# ------------------------------------------------------------
# 19. CALCULATE METRICS
# ------------------------------------------------------------

print()
print("=" * 70)
print("TEST PERFORMANCE")
print("=" * 70)

for i, target in enumerate(
    target_columns
):

    mae = mean_absolute_error(
        y_test_actual[:, i],
        y_pred[:, i]
    )

    rmse = np.sqrt(
        mean_squared_error(
            y_test_actual[:, i],
            y_pred[:, i]
        )
    )

    r2 = r2_score(
        y_test_actual[:, i],
        y_pred[:, i]
    )

    print()
    print(target)

    print(
        f"  MAE  : {mae:.6f}"
    )

    print(
        f"  RMSE : {rmse:.6f}"
    )

    print(
        f"  R²   : {r2:.6f}"
    )


# ------------------------------------------------------------
# 20. ADD PREDICTIONS TO ORIGINAL DATAFRAME
# ------------------------------------------------------------
#
# The first part of the CSV has no prediction because the LSTM
# requires SEQUENCE_LENGTH previous measurements.
#
# The training-period predictions are also left empty here.
#
# Predictions are populated only for the unseen test period.
# ------------------------------------------------------------

df_output = df.copy()

df_output[
    "predicted_city_u"
] = np.nan

df_output[
    "predicted_city_v"
] = np.nan

df_output[
    "predicted_city_dust"
] = np.nan


df_output.loc[
    test_indices,
    "predicted_city_u"
] = y_pred[:, 0]

df_output.loc[
    test_indices,
    "predicted_city_v"
] = y_pred[:, 1]

df_output.loc[
    test_indices,
    "predicted_city_dust"
] = y_pred[:, 2]


# ------------------------------------------------------------
# 21. SAVE EXTENDED CSV
# ------------------------------------------------------------

df_output.to_csv(
    OUTPUT_FILE,
    index=False
)

print()
print(
    f"Prediction CSV saved: "
    f"{OUTPUT_FILE}"
)


# ------------------------------------------------------------
# 22. GET TEST TIMES
# ------------------------------------------------------------

test_times = df[
    "time"
].values[
    test_indices
]


# ============================================================
# 23. PLOT CITY U
# ============================================================

plt.figure(
    figsize=(12, 5)
)

plt.plot(
    test_times,
    y_test_actual[:, 0],
    label="Measured city u",
    linewidth=1.5
)

plt.plot(
    test_times,
    y_pred[:, 0],
    label="LSTM predicted city u",
    linewidth=1.5
)

plt.xlabel(
    "Time [s]"
)

plt.ylabel(
    "East-West wind velocity [m/s]"
)

plt.title(
    "City East-West Wind Velocity: LSTM vs Measured"
)

plt.legend()

plt.grid(
    alpha=0.3
)

plt.tight_layout()

plt.savefig(
    PLOT_DIRECTORY
    / "city_u_prediction.png",
    dpi=200,
    bbox_inches="tight"
)

plt.close()


# ============================================================
# 24. PLOT CITY V
# ============================================================

plt.figure(
    figsize=(12, 5)
)

plt.plot(
    test_times,
    y_test_actual[:, 1],
    label="Measured city v",
    linewidth=1.5
)

plt.plot(
    test_times,
    y_pred[:, 1],
    label="LSTM predicted city v",
    linewidth=1.5
)

plt.xlabel(
    "Time [s]"
)

plt.ylabel(
    "North-South wind velocity [m/s]"
)

plt.title(
    "City North-South Wind Velocity: LSTM vs Measured"
)

plt.legend()

plt.grid(
    alpha=0.3
)

plt.tight_layout()

plt.savefig(
    PLOT_DIRECTORY
    / "city_v_prediction.png",
    dpi=200,
    bbox_inches="tight"
)

plt.close()


# ============================================================
# 25. PLOT CITY DUST
# ============================================================

plt.figure(
    figsize=(12, 5)
)

plt.plot(
    test_times,
    y_test_actual[:, 2],
    label="Measured city dust",
    linewidth=1.5
)

plt.plot(
    test_times,
    y_pred[:, 2],
    label="LSTM predicted city dust",
    linewidth=1.5
)

plt.xlabel(
    "Time [s]"
)

plt.ylabel(
    "Dust concentration"
)

plt.title(
    "City Dust: LSTM vs Measured"
)

plt.legend()

plt.grid(
    alpha=0.3
)

plt.tight_layout()

plt.savefig(
    PLOT_DIRECTORY
    / "city_dust_prediction.png",
    dpi=200,
    bbox_inches="tight"
)

plt.close()


# ============================================================
# 26. COMBINED FINAL RESULTS PLOT
# ============================================================

fig, axes = plt.subplots(
    3,
    1,
    figsize=(13, 11),
    sharex=True
)


# ------------------------------------------------------------
# City u
# ------------------------------------------------------------

axes[0].plot(
    test_times,
    y_test_actual[:, 0],
    label="Measured",
    linewidth=1.5
)

axes[0].plot(
    test_times,
    y_pred[:, 0],
    label="LSTM prediction",
    linewidth=1.5
)

axes[0].set_ylabel(
    "u [m/s]"
)

axes[0].set_title(
    "City East-West Wind"
)

axes[0].legend()

axes[0].grid(
    alpha=0.3
)


# ------------------------------------------------------------
# City v
# ------------------------------------------------------------

axes[1].plot(
    test_times,
    y_test_actual[:, 1],
    label="Measured",
    linewidth=1.5
)

axes[1].plot(
    test_times,
    y_pred[:, 1],
    label="LSTM prediction",
    linewidth=1.5
)

axes[1].set_ylabel(
    "v [m/s]"
)

axes[1].set_title(
    "City North-South Wind"
)

axes[1].legend()

axes[1].grid(
    alpha=0.3
)


# ------------------------------------------------------------
# City dust
# ------------------------------------------------------------

axes[2].plot(
    test_times,
    y_test_actual[:, 2],
    label="Measured",
    linewidth=1.5
)

axes[2].plot(
    test_times,
    y_pred[:, 2],
    label="LSTM prediction",
    linewidth=1.5
)

axes[2].set_ylabel(
    "Dust"
)

axes[2].set_xlabel(
    "Time [s]"
)

axes[2].set_title(
    "City Dust Concentration"
)

axes[2].legend()

axes[2].grid(
    alpha=0.3
)


fig.suptitle(
    "LSTM Prediction of City Wind and Dust\n"
    "Final 20% of Simulation — Unseen Test Data",
    fontsize=15,
    fontweight="bold"
)

plt.tight_layout()

plt.savefig(
    PLOT_DIRECTORY
    / "city_lstm_predictions.png",
    dpi=200,
    bbox_inches="tight"
)

plt.close()


# ============================================================
# 27. TRAINING HISTORY PLOT
# ============================================================

plt.figure(
    figsize=(10, 5)
)

plt.plot(
    history.history["loss"],
    label="Training loss"
)

plt.plot(
    history.history["val_loss"],
    label="Validation loss"
)

plt.xlabel(
    "Epoch"
)

plt.ylabel(
    "MSE loss"
)

plt.title(
    "LSTM Training History"
)

plt.legend()

plt.grid(
    alpha=0.3
)

plt.tight_layout()

plt.savefig(
    PLOT_DIRECTORY
    / "lstm_training_history.png",
    dpi=200,
    bbox_inches="tight"
)

plt.close()


# ============================================================
# 28. FINAL REPORT
# ============================================================

print()
print("=" * 70)
print("LSTM PREDICTION COMPLETE")
print("=" * 70)

print()
print(
    f"Original CSV      : {INPUT_FILE}"
)

print(
    f"Prediction CSV    : {OUTPUT_FILE}"
)

print()
print(
    f"Training data     : first "
    f"{TRAIN_FRACTION:.0%}"
)

print(
    f"Test data         : final "
    f"{1.0 - TRAIN_FRACTION:.0%}"
)

print(
    f"Sequence length   : "
    f"{SEQUENCE_LENGTH} seconds"
)

print()
print("Prediction columns added:")

print(
    "  predicted_city_u"
)

print(
    "  predicted_city_v"
)

print(
    "  predicted_city_dust"
)

print()
print("PNG files:")

print(
    "  mars_lstm_predictions/city_u_prediction.png"
)

print(
    "  mars_lstm_predictions/city_v_prediction.png"
)

print(
    "  mars_lstm_predictions/city_dust_prediction.png"
)

print(
    "  mars_lstm_predictions/city_lstm_predictions.png"
)

print(
    "  mars_lstm_predictions/lstm_training_history.png"
)

print()
print("Done.")