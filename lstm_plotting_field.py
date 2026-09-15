"""
Interpolate and plot 2-D Martian velocity and dust fields
from the LSTM prediction CSV.

The LSTM predicts the city-center values:
    predicted_city_u
    predicted_city_v
    predicted_city_dust

The four surrounding sensors provide spatial anchor values:
    W, N, E, S

For each selected time:
    1. Read W/N/E/S sensor measurements.
    2. Read the LSTM-predicted city-center values.
    3. Interpolate u, v, and dust over the full 2-D domain.
    4. Plot velocity magnitude + velocity vectors.
    5. Plot dust concentration.

Three snapshots are produced:
    - Start of LSTM prediction period
    - Middle of LSTM prediction period
    - End of LSTM prediction period

Input:
    mars_city_wind_dust_with_lstm_predictions.csv

Output directory:
    mars_lstm_interpolated_fields/
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from pathlib import Path
from scipy.interpolate import griddata


# ============================================================
# USER SETTINGS
# ============================================================

INPUT_CSV = "mars_city_wind_dust_with_lstm_predictions.csv"

OUTPUT_DIR = Path("mars_lstm_interpolated_fields")

# Physical domain size
L = 2000.0  # metres

# Interpolation grid resolution
N_GRID = 100

# Original sensor/grid locations
# W = west, N = north, E = east, S = south
# Coordinates are (x, y), where:
#   x = east-west
#   y = north-south
#
# W: (-L/2, 0)
# N: (0, +L/2)
# E: (+L/2, 0)
# S: (0, -L/2)
# City: (0, 0)

SENSOR_POINTS = np.array([
    [-L / 2, 0.0],   # W
    [0.0, L / 2],    # N
    [L / 2, 0.0],    # E
    [0.0, -L / 2],   # S
    [0.0, 0.0],      # City
])


# ============================================================
# COLUMN NAMES
# ============================================================

U_COLUMNS = [
    "node_W_u",
    "node_N_u",
    "node_E_u",
    "node_S_u",
]

V_COLUMNS = [
    "node_W_v",
    "node_N_v",
    "node_E_v",
    "node_S_v",
]

DUST_COLUMNS = [
    "node_W_dust",
    "node_N_dust",
    "node_E_dust",
    "node_S_dust",
]

PREDICTED_U = "predicted_city_u"
PREDICTED_V = "predicted_city_v"
PREDICTED_DUST = "predicted_city_dust"

TIME_COLUMN = "time"


# ============================================================
# LOAD DATA
# ============================================================

print("Loading CSV...")

df = pd.read_csv(INPUT_CSV)

required_columns = (
    [TIME_COLUMN]
    + U_COLUMNS
    + V_COLUMNS
    + DUST_COLUMNS
    + [PREDICTED_U, PREDICTED_V, PREDICTED_DUST]
)

missing_columns = [
    col for col in required_columns
    if col not in df.columns
]

if missing_columns:
    raise ValueError(
        "The following required columns are missing from the CSV:\n"
        + "\n".join(missing_columns)
    )


# ============================================================
# FIND LSTM PREDICTION PERIOD
# ============================================================

# The LSTM output is NaN before the test period.
# Keep only rows where all three predictions exist.

prediction_mask = (
    df[PREDICTED_U].notna()
    & df[PREDICTED_V].notna()
    & df[PREDICTED_DUST].notna()
)

prediction_df = df.loc[prediction_mask].copy()

if len(prediction_df) == 0:
    raise ValueError(
        "No valid LSTM predictions were found. "
        "Check that the prediction CSV contains "
        "predicted_city_u, predicted_city_v, and predicted_city_dust."
    )

prediction_df = prediction_df.reset_index(drop=True)

print()
print("LSTM prediction period:")
print(f"  Start time: {prediction_df[TIME_COLUMN].iloc[0]:.2f} s")
print(f"  End time:   {prediction_df[TIME_COLUMN].iloc[-1]:.2f} s")
print(f"  Samples:    {len(prediction_df)}")


# ============================================================
# SELECT THREE TIMES
# ============================================================

start_index = 0
middle_index = len(prediction_df) // 2
end_index = len(prediction_df) - 1

selected_indices = [
    start_index,
    middle_index,
    end_index,
]

selected_labels = [
    "start",
    "middle",
    "end",
]


# ============================================================
# CREATE INTERPOLATION GRID
# ============================================================

x = np.linspace(-L / 2, L / 2, N_GRID)
y = np.linspace(-L / 2, L / 2, N_GRID)

X, Y = np.meshgrid(x, y)


# ============================================================
# CREATE OUTPUT DIRECTORY
# ============================================================

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# INTERPOLATION FUNCTION
# ============================================================

def interpolate_field(values):
    """
    Interpolate five anchor-point values onto the 2-D grid.

    Anchor points:
        W, N, E, S, City

    Linear interpolation is used inside the convex hull.

    Nearest-neighbour interpolation is used outside the convex
    hull so that the entire square domain receives a value.

    Parameters
    ----------
    values : array-like
        Five values corresponding to:
        W, N, E, S, City

    Returns
    -------
    field : 2-D numpy array
    """

    values = np.asarray(values, dtype=float)

    if len(values) != 5:
        raise ValueError(
            "interpolate_field expects exactly 5 values: "
            "W, N, E, S, City."
        )

    # Linear interpolation
    field_linear = griddata(
        SENSOR_POINTS,
        values,
        (X, Y),
        method="linear",
    )

    # Nearest interpolation provides values outside the
    # convex hull of the five anchor points.
    field_nearest = griddata(
        SENSOR_POINTS,
        values,
        (X, Y),
        method="nearest",
    )

    # Fill any linear-interpolation NaNs with nearest values.
    field = np.where(
        np.isnan(field_linear),
        field_nearest,
        field_linear,
    )

    return field


# ============================================================
# CALCULATE GLOBAL COLOR LIMITS
# ============================================================

# Calculate all three fields first so that the plots use
# identical colour scales.

snapshots = []

for index, label in zip(selected_indices, selected_labels):

    row = prediction_df.iloc[index]

    # --------------------------------------------------------
    # Velocity U
    # --------------------------------------------------------

    u_values = [
        row["node_W_u"],
        row["node_N_u"],
        row["node_E_u"],
        row["node_S_u"],
        row[PREDICTED_U],
    ]

    # --------------------------------------------------------
    # Velocity V
    # --------------------------------------------------------

    v_values = [
        row["node_W_v"],
        row["node_N_v"],
        row["node_E_v"],
        row["node_S_v"],
        row[PREDICTED_V],
    ]

    # --------------------------------------------------------
    # Dust
    # --------------------------------------------------------

    dust_values = [
        row["node_W_dust"],
        row["node_N_dust"],
        row["node_E_dust"],
        row["node_S_dust"],
        row[PREDICTED_DUST],
    ]

    # Interpolate fields
    U = interpolate_field(u_values)
    V = interpolate_field(v_values)
    DUST = interpolate_field(dust_values)

    # Velocity magnitude
    SPEED = np.sqrt(U**2 + V**2)

    snapshots.append({
        "label": label,
        "time": row[TIME_COLUMN],
        "U": U,
        "V": V,
        "SPEED": SPEED,
        "DUST": DUST,
    })


# Global colour limits for velocity
speed_min = min(
    np.nanmin(snapshot["SPEED"])
    for snapshot in snapshots
)

speed_max = max(
    np.nanmax(snapshot["SPEED"])
    for snapshot in snapshots
)

# Global colour limits for dust
dust_min = min(
    np.nanmin(snapshot["DUST"])
    for snapshot in snapshots
)

dust_max = max(
    np.nanmax(snapshot["DUST"])
    for snapshot in snapshots
)

# Avoid zero-width colour scales
if np.isclose(speed_min, speed_max):
    speed_max = speed_min + 1e-6

if np.isclose(dust_min, dust_max):
    dust_max = dust_min + 1e-6


# ============================================================
# PLOT SETTINGS
# ============================================================

# Downsample velocity vectors so the plot remains readable.
QUIVER_SKIP = max(1, N_GRID // 20)

# Sensor/city positions for plotting
sensor_x = SENSOR_POINTS[:, 0]
sensor_y = SENSOR_POINTS[:, 1]


# ============================================================
# GENERATE PLOTS
# ============================================================

for snapshot in snapshots:

    label = snapshot["label"]
    time_value = snapshot["time"]

    U = snapshot["U"]
    V = snapshot["V"]
    SPEED = snapshot["SPEED"]
    DUST = snapshot["DUST"]

    # --------------------------------------------------------
    # Create figure
    # --------------------------------------------------------

    fig, axes = plt.subplots(
        1,
        2,
        figsize=(16, 7),
    )

    # ========================================================
    # VELOCITY FIELD
    # ========================================================

    ax = axes[0]

    velocity_plot = ax.contourf(
        X,
        Y,
        SPEED,
        levels=30,
        vmin=speed_min,
        vmax=speed_max,
    )

    # Velocity vectors
    ax.quiver(
        X[::QUIVER_SKIP, ::QUIVER_SKIP],
        Y[::QUIVER_SKIP, ::QUIVER_SKIP],
        U[::QUIVER_SKIP, ::QUIVER_SKIP],
        V[::QUIVER_SKIP, ::QUIVER_SKIP],
        color="black",
        alpha=0.65,
        scale=None,
    )

    # Sensor locations
    ax.scatter(
        sensor_x[:4],
        sensor_y[:4],
        s=90,
        marker="s",
        facecolors="white",
        edgecolors="black",
        linewidths=1.5,
        label="Sensors",
        zorder=5,
    )

    # City centre
    ax.scatter(
        0,
        0,
        s=150,
        marker="*",
        facecolors="red",
        edgecolors="black",
        linewidths=1.2,
        label="LSTM city prediction",
        zorder=6,
    )

    # Sensor labels
    sensor_labels = ["W", "N", "E", "S"]

    for sx, sy, sensor_label in zip(
        sensor_x[:4],
        sensor_y[:4],
        sensor_labels,
    ):
        ax.text(
            sx,
            sy,
            f"  {sensor_label}",
            fontsize=11,
            fontweight="bold",
            ha="left",
            va="center",
            zorder=7,
        )

    ax.set_title(
        f"Predicted Velocity Field — {label}\n"
        f"t = {time_value:.1f} s"
    )

    ax.set_xlabel("East-West position x (m)")
    ax.set_ylabel("North-South position y (m)")

    ax.set_aspect("equal")

    ax.set_xlim(-L / 2, L / 2)
    ax.set_ylim(-L / 2, L / 2)

    ax.grid(
        True,
        alpha=0.2,
    )

    ax.legend(
        loc="upper right",
    )

    cbar_velocity = fig.colorbar(
        velocity_plot,
        ax=ax,
    )

    cbar_velocity.set_label(
        "Velocity magnitude (m/s)"
    )

    # ========================================================
    # DUST FIELD
    # ========================================================

    ax = axes[1]

    dust_plot = ax.contourf(
        X,
        Y,
        DUST,
        levels=30,
        vmin=dust_min,
        vmax=dust_max,
    )

    # Sensor locations
    ax.scatter(
        sensor_x[:4],
        sensor_y[:4],
        s=90,
        marker="s",
        facecolors="white",
        edgecolors="black",
        linewidths=1.5,
        label="Sensors",
        zorder=5,
    )

    # City centre
    ax.scatter(
        0,
        0,
        s=150,
        marker="*",
        facecolors="red",
        edgecolors="black",
        linewidths=1.2,
        label="LSTM city prediction",
        zorder=6,
    )

    # Sensor labels
    for sx, sy, sensor_label in zip(
        sensor_x[:4],
        sensor_y[:4],
        sensor_labels,
    ):
        ax.text(
            sx,
            sy,
            f"  {sensor_label}",
            fontsize=11,
            fontweight="bold",
            ha="left",
            va="center",
            zorder=7,
        )

    ax.set_title(
        f"Predicted Dust Field — {label}\n"
        f"t = {time_value:.1f} s"
    )

    ax.set_xlabel("East-West position x (m)")
    ax.set_ylabel("North-South position y (m)")

    ax.set_aspect("equal")

    ax.set_xlim(-L / 2, L / 2)
    ax.set_ylim(-L / 2, L / 2)

    ax.grid(
        True,
        alpha=0.2,
    )

    ax.legend(
        loc="upper right",
    )

    cbar_dust = fig.colorbar(
        dust_plot,
        ax=ax,
    )

    cbar_dust.set_label(
        "Dust concentration"
    )

    # --------------------------------------------------------
    # Overall title
    # --------------------------------------------------------

    fig.suptitle(
        "Mars City LSTM-Interpolated Environmental Fields",
        fontsize=16,
        fontweight="bold",
    )

    plt.tight_layout()

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    output_file = (
        OUTPUT_DIR
        / f"lstm_interpolated_{label}.png"
    )

    fig.savefig(
        output_file,
        dpi=200,
        bbox_inches="tight",
    )

    plt.close(fig)

    print(f"Saved: {output_file}")


# ============================================================
# SAVE NUMERICAL INTERPOLATED FIELDS
# ============================================================

# Also save the interpolated fields as NumPy arrays.
# This allows the fields to be reused without rerunning
# interpolation.

for snapshot in snapshots:

    label = snapshot["label"]

    output_file = (
        OUTPUT_DIR
        / f"lstm_interpolated_{label}.npz"
    )

    np.savez(
        output_file,
        x=x,
        y=y,
        X=X,
        Y=Y,
        U=snapshot["U"],
        V=snapshot["V"],
        SPEED=snapshot["SPEED"],
        DUST=snapshot["DUST"],
        time=snapshot["time"],
    )

    print(f"Saved: {output_file}")


# ============================================================
# SUMMARY
# ============================================================

print()
print("Interpolation complete.")
print()
print("Generated PNG files:")

for label in selected_labels:
    print(
        f"  {OUTPUT_DIR / f'lstm_interpolated_{label}.png'}"
    )

print()
print("Generated NumPy field files:")

for label in selected_labels:
    print(
        f"  {OUTPUT_DIR / f'lstm_interpolated_{label}.npz'}"
    )

print()
print("The three times used were:")

for snapshot in snapshots:
    print(
        f"  {snapshot['label']:>6}: "
        f"t = {snapshot['time']:.2f} s"
    )