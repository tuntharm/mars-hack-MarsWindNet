import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path

# ============================================================
# FAST 2-D REDUCED-ORDER MARTIAN WIND + DUST SIMULATOR
# WITH 2-D FIELD PLOTS
# ============================================================
#
# Four sensor nodes surround a central "city":
#
#                 N
#                 |
#
#       W ------- CITY ------- E
#
#                 |
#                 S
#
# The model solves simplified 2-D advection/diffusion equations
# on a regular grid.
#
# Outputs:
#   1. CSV containing sensor/city measurements
#   2. PNG showing velocity + dust fields at 0 s
#   3. PNG showing velocity + dust fields at 1500 s
#   4. PNG showing velocity + dust fields at 3000 s
#
# The PNG files are saved in:
#
#     mars_simulation_plots/
#
# ============================================================


# ------------------------------------------------------------
# 1. RANDOM NUMBER GENERATOR
# ------------------------------------------------------------

rng = np.random.default_rng(42)


# ------------------------------------------------------------
# 2. SIMULATION PARAMETERS
# ------------------------------------------------------------

# Spatial grid
N = 25
L = 2000.0
dx = L / (N - 1)

# Time
dt = 0.20

# Use 15000 intervals of 0.2 s = 3000 s
n_steps = 15000

# Save CSV data every 5 internal steps = every 1 second
output_every = 5


# ------------------------------------------------------------
# 3. EFFECTIVE MARTIAN PARAMETERS
# ------------------------------------------------------------

rho = 0.020
g = 3.71

# Effective momentum diffusivity
nu = 25.0

# Linear drag
k_drag = 0.004

# Effective dust diffusivity
dust_diff = 18.0

# Dust removal/deposition rate
dust_decay = 2.0e-5

# Wind-driven dust resuspension coefficient
dust_source_strength = 2.0e-6


# ------------------------------------------------------------
# 4. GRID AND SENSOR LOCATIONS
# ------------------------------------------------------------

c = (N - 1) // 2

nodes = {
    "node_W": (c, 0),
    "node_N": (0, c),
    "node_E": (c, N - 1),
    "node_S": (N - 1, c),
}

city = (c, c)


# ------------------------------------------------------------
# 5. INITIALIZE FIELDS
# ------------------------------------------------------------

u = np.zeros((N, N))
v = np.zeros((N, N))
dust = np.zeros((N, N))


# ------------------------------------------------------------
# 6. TRANSIENT BOUNDARY CONDITION PARAMETERS
# ------------------------------------------------------------

tau_wind = 180.0
tau_dust = 240.0

wind_state = np.array([
    4.0,
    0.0
])

dust_state = 0.45


# ------------------------------------------------------------
# 7. ORNSTEIN-UHLENBECK PROCESS
# ------------------------------------------------------------

def ou_step(x, target, tau, sigma, dt):

    return (
        x
        + (target - x) * dt / tau
        + sigma * np.sqrt(dt) * rng.normal()
    )


# ------------------------------------------------------------
# 8. FINITE-DIFFERENCE LAPLACIAN
# ------------------------------------------------------------

def laplacian(a):

    out = np.empty_like(a)

    out[1:-1, 1:-1] = (
        a[:-2, 1:-1]
        + a[2:, 1:-1]
        + a[1:-1, :-2]
        + a[1:-1, 2:]
        - 4.0 * a[1:-1, 1:-1]
    ) / dx**2

    return out


# ------------------------------------------------------------
# 9. FINITE-DIFFERENCE GRADIENT
# ------------------------------------------------------------

def gradients(a):

    ax = np.empty_like(a)
    ay = np.empty_like(a)

    # Interior
    ax[:, 1:-1] = (
        a[:, 2:] - a[:, :-2]
    ) / (2 * dx)

    ay[1:-1, :] = (
        a[2:, :] - a[:-2, :]
    ) / (2 * dx)

    # x boundaries
    ax[:, 0] = (
        a[:, 1] - a[:, 0]
    ) / dx

    ax[:, -1] = (
        a[:, -1] - a[:, -2]
    ) / dx

    # y boundaries
    ay[0, :] = (
        a[1, :] - a[0, :]
    ) / dx

    ay[-1, :] = (
        a[-1, :] - a[-2, :]
    ) / dx

    return ax, ay


# ------------------------------------------------------------
# 10. APPLY TRANSIENT BOUNDARY CONDITIONS
# ------------------------------------------------------------

def set_boundary(uu, vv, dd, wind, dlevel):

    wx, wy = wind

    phase = np.linspace(
        0,
        2 * np.pi,
        N
    )

    # WEST / EAST VELOCITY

    uu[:, 0] = (
        wx
        + 0.25 * np.sin(phase)
    )

    uu[:, -1] = (
        wx
        + 0.25 * np.sin(phase + 0.7)
    )

    vv[:, 0] = (
        wy
        + 0.20 * np.cos(phase)
    )

    vv[:, -1] = (
        wy
        + 0.20 * np.cos(phase + 0.7)
    )

    # NORTH / SOUTH VELOCITY

    uu[0, :] = (
        wx
        + 0.25 * np.sin(phase + 1.2)
    )

    uu[-1, :] = (
        wx
        + 0.25 * np.sin(phase + 1.9)
    )

    vv[0, :] = (
        wy
        + 0.20 * np.cos(phase + 1.2)
    )

    vv[-1, :] = (
        wy
        + 0.20 * np.cos(phase + 1.9)
    )

    # DUST BOUNDARY CONDITIONS

    dd[:, 0] = np.maximum(
        0,
        dlevel * (
            1.0
            + 0.12 * np.sin(phase)
        )
    )

    dd[:, -1] = np.maximum(
        0,
        dlevel * (
            1.0
            + 0.12 * np.sin(phase + 0.8)
        )
    )

    dd[0, :] = np.maximum(
        0,
        dlevel * (
            1.0
            + 0.12 * np.cos(phase)
        )
    )

    dd[-1, :] = np.maximum(
        0,
        dlevel * (
            1.0
            + 0.12 * np.cos(phase + 0.8)
        )
    )


# ------------------------------------------------------------
# 11. EXTRACT SENSOR/CITY DATA
# ------------------------------------------------------------

def sample_outputs(t, uu, vv, dd):

    values = {
        "time": t
    }

    for name, (i, j) in nodes.items():

        node_u = uu[i, j]
        node_v = vv[i, j]

        values[f"{name}_u"] = node_u
        values[f"{name}_v"] = node_v

        values[f"{name}_speed"] = np.hypot(
            node_u,
            node_v
        )

        values[f"{name}_dust"] = dd[i, j]

    ci, cj = city

    city_u = uu[ci, cj]
    city_v = vv[ci, cj]

    values["city_u"] = city_u
    values["city_v"] = city_v

    values["city_speed"] = np.hypot(
        city_u,
        city_v
    )

    values["city_dust"] = dd[ci, cj]

    return values


# ------------------------------------------------------------
# 12. STORAGE FOR OUTPUT
# ------------------------------------------------------------

records = []


# ------------------------------------------------------------
# 13. STORAGE FOR FULL 2-D SNAPSHOTS
# ------------------------------------------------------------
#
# We store the full fields at:
#
#     0 s
#     1500 s
#     3000 s
#
# Each entry contains:
#
#     u
#     v
#     dust
#
# These are later used to generate the PNG plots.

snapshots = {}


# ------------------------------------------------------------
# 14. INITIAL CONDITION
# ------------------------------------------------------------

# Apply an initial boundary condition so that the 0 s snapshot
# represents an actual initialized field.

set_boundary(
    u,
    v,
    dust,
    wind_state,
    dust_state
)

snapshots[0.0] = {
    "u": u.copy(),
    "v": v.copy(),
    "dust": dust.copy()
}


# ------------------------------------------------------------
# 15. MAIN SIMULATION LOOP
# ------------------------------------------------------------

for step in range(n_steps):

    # Current simulation time
    t = step * dt

    # --------------------------------------------------------
    # Slowly varying deterministic wind target
    # --------------------------------------------------------

    target_wind = np.array([
        5.0
        + 2.0 * np.sin(
            2 * np.pi * t / 900.0
        )
        + 0.7 * np.sin(
            2 * np.pi * t / 310.0
        ),

        0.8 * np.sin(
            2 * np.pi * t / 700.0
        )
    ])

    # --------------------------------------------------------
    # Slowly varying deterministic dust target
    # --------------------------------------------------------

    target_dust = (
        0.45
        + 0.22 * np.sin(
            2 * np.pi * t / 1200.0
        )
        + 0.08 * np.sin(
            2 * np.pi * t / 370.0
        )
    )

    # --------------------------------------------------------
    # Add stochastic variation
    # --------------------------------------------------------

    wind_state = ou_step(
        wind_state,
        target_wind,
        tau_wind,
        0.06,
        dt
    )

    dust_state = ou_step(
        dust_state,
        target_dust,
        tau_dust,
        0.025,
        dt
    )

    dust_state = max(
        0.02,
        dust_state
    )

    # --------------------------------------------------------
    # Apply current boundary conditions
    # --------------------------------------------------------

    set_boundary(
        u,
        v,
        dust,
        wind_state,
        dust_state
    )

    # --------------------------------------------------------
    # Velocity gradients
    # --------------------------------------------------------

    ux, uy = gradients(u)
    vx, vy = gradients(v)

    # --------------------------------------------------------
    # Dust gradients
    # --------------------------------------------------------

    cx, cy = gradients(dust)

    # --------------------------------------------------------
    # Diffusion
    # --------------------------------------------------------

    Lu = laplacian(u)
    Lv = laplacian(v)
    Lc = laplacian(dust)

    # --------------------------------------------------------
    # WIND ADVECTION
    # --------------------------------------------------------

    adv_u = (
        u * ux
        + v * uy
    )

    adv_v = (
        u * vx
        + v * vy
    )

    # --------------------------------------------------------
    # UPDATE VELOCITY
    # --------------------------------------------------------

    u_new = (
        u
        + dt * (
            -adv_u
            + nu * Lu
            - k_drag * u
        )
    )

    v_new = (
        v
        + dt * (
            -adv_v
            + nu * Lv
            - k_drag * v
        )
    )

    # --------------------------------------------------------
    # DUST TRANSPORT
    # --------------------------------------------------------

    adv_c = (
        u * cx
        + v * cy
    )

    wind_speed = np.hypot(
        u,
        v
    )

    resuspension = (
        dust_source_strength
        * np.maximum(
            wind_speed - 4.0,
            0.0
        )
    )

    # --------------------------------------------------------
    # UPDATE DUST
    # --------------------------------------------------------

    c_new = (
        dust
        + dt * (
            -adv_c
            + dust_diff * Lc
            - dust_decay * dust
            + resuspension
        )
    )

    dust = np.maximum(
        c_new,
        0.0
    )

    u = u_new
    v = v_new

    # Reapply boundary conditions
    set_boundary(
        u,
        v,
        dust,
        wind_state,
        dust_state
    )

    # --------------------------------------------------------
    # SAVE CSV DATA
    # --------------------------------------------------------

    if step % output_every == 0:

        records.append(
            sample_outputs(
                t,
                u,
                v,
                dust
            )
        )

    # --------------------------------------------------------
    # SAVE FULL FIELD AT 1500 s
    # --------------------------------------------------------

    # The simulation reaches exactly 1500 s at step 7500.
    if step == int(1500.0 / dt):

        snapshots[1500.0] = {
            "u": u.copy(),
            "v": v.copy(),
            "dust": dust.copy()
        }


# ------------------------------------------------------------
# 16. SAVE FINAL 3000 s SNAPSHOT
# ------------------------------------------------------------
#
# The last loop state is at 2999.8 s because step runs from
# 0 through 14999.
#
# Advance the displayed timestamp to the end of the 3000 s
# simulation window for plotting purposes.

snapshots[3000.0] = {
    "u": u.copy(),
    "v": v.copy(),
    "dust": dust.copy()
}


# ------------------------------------------------------------
# 17. CREATE DATAFRAME
# ------------------------------------------------------------

df = pd.DataFrame(
    records
)


# ------------------------------------------------------------
# 18. SAVE CSV
# ------------------------------------------------------------

output_file = "mars_city_wind_dust_training.csv"

df.to_csv(
    output_file,
    index=False
)


# ------------------------------------------------------------
# 19. CREATE OUTPUT DIRECTORY FOR PNG FILES
# ------------------------------------------------------------

plot_directory = Path(
    "mars_simulation_plots"
)

plot_directory.mkdir(
    parents=True,
    exist_ok=True
)


# ------------------------------------------------------------
# 20. PREPARE PLOT COORDINATES
# ------------------------------------------------------------

x = np.linspace(
    -L / 2,
    L / 2,
    N
)

y = np.linspace(
    L / 2,
    -L / 2,
    N
)

X, Y = np.meshgrid(
    x,
    y
)


# ------------------------------------------------------------
# 21. FIND COMMON COLOR LIMITS
# ------------------------------------------------------------
#
# Using common limits means the colors have the same meaning
# at 0, 1500 and 3000 seconds.

all_speeds = []
all_dust = []

for snapshot in snapshots.values():

    uu = snapshot["u"]
    vv = snapshot["v"]
    dd = snapshot["dust"]

    speed = np.hypot(
        uu,
        vv
    )

    all_speeds.append(
        speed
    )

    all_dust.append(
        dd
    )

speed_max = max(
    np.max(s)
    for s in all_speeds
)

dust_max = max(
    np.max(d)
    for d in all_dust
)

# Add a small margin
speed_max *= 1.05
dust_max *= 1.05


# ------------------------------------------------------------
# 22. PLOT FUNCTION
# ------------------------------------------------------------

def plot_snapshot(sim_time, snapshot):

    uu = snapshot["u"]
    vv = snapshot["v"]
    dd = snapshot["dust"]

    speed = np.hypot(
        uu,
        vv
    )

    # --------------------------------------------------------
    # Create figure
    # --------------------------------------------------------

    fig, axes = plt.subplots(
        1,
        2,
        figsize=(15, 6)
    )

    # ========================================================
    # LEFT: VELOCITY FIELD
    # ========================================================

    ax = axes[0]

    velocity_image = ax.imshow(
        speed,
        extent=[
            -L / 2,
            L / 2,
            -L / 2,
            L / 2
        ],
        origin="upper",
        cmap="viridis",
        vmin=0,
        vmax=speed_max,
        aspect="equal"
    )

    # --------------------------------------------------------
    # Velocity arrows
    # --------------------------------------------------------
    #
    # Plot every second grid point to avoid making the plot
    # visually overloaded.

    skip = 2

    ax.quiver(
        X[::skip, ::skip],
        Y[::skip, ::skip],
        uu[::skip, ::skip],
        -vv[::skip, ::skip],
        color="white",
        scale=35,
        width=0.003
    )

    # --------------------------------------------------------
    # Sensor and city markers
    # --------------------------------------------------------

    marker_style = dict(
        marker="o",
        markersize=8,
        markeredgecolor="black",
        markerfacecolor="white"
    )

    ax.plot(
        -L / 2,
        0,
        **marker_style
    )

    ax.text(
        -L / 2 + 70,
        0,
        "W",
        color="white",
        fontweight="bold"
    )

    ax.plot(
        0,
        L / 2,
        **marker_style
    )

    ax.text(
        0,
        L / 2 - 100,
        "N",
        color="white",
        fontweight="bold",
        ha="center"
    )

    ax.plot(
        L / 2,
        0,
        **marker_style
    )

    ax.text(
        L / 2 - 70,
        0,
        "E",
        color="white",
        fontweight="bold",
        ha="right"
    )

    ax.plot(
        0,
        -L / 2,
        **marker_style
    )

    ax.text(
        0,
        -L / 2 + 100,
        "S",
        color="white",
        fontweight="bold",
        ha="center"
    )

    ax.plot(
        0,
        0,
        marker="*",
        markersize=14,
        markeredgecolor="black",
        markerfacecolor="red"
    )

    ax.text(
        70,
        70,
        "CITY",
        color="white",
        fontweight="bold"
    )

    # --------------------------------------------------------
    # Formatting
    # --------------------------------------------------------

    ax.set_title(
        f"Velocity Field — t = {sim_time:.0f} s"
    )

    ax.set_xlabel(
        "East-West position [m]"
    )

    ax.set_ylabel(
        "North-South position [m]"
    )

    colorbar = fig.colorbar(
        velocity_image,
        ax=ax
    )

    colorbar.set_label(
        "Wind speed [m/s]"
    )


    # ========================================================
    # RIGHT: DUST FIELD
    # ========================================================

    ax = axes[1]

    dust_image = ax.imshow(
        dd,
        extent=[
            -L / 2,
            L / 2,
            -L / 2,
            L / 2
        ],
        origin="upper",
        cmap="inferno",
        vmin=0,
        vmax=dust_max,
        aspect="equal"
    )

    # --------------------------------------------------------
    # Sensor and city markers
    # --------------------------------------------------------

    ax.plot(
        -L / 2,
        0,
        **marker_style
    )

    ax.text(
        -L / 2 + 70,
        0,
        "W",
        color="white",
        fontweight="bold"
    )

    ax.plot(
        0,
        L / 2,
        **marker_style
    )

    ax.text(
        0,
        L / 2 - 100,
        "N",
        color="white",
        fontweight="bold",
        ha="center"
    )

    ax.plot(
        L / 2,
        0,
        **marker_style
    )

    ax.text(
        L / 2 - 70,
        0,
        "E",
        color="white",
        fontweight="bold",
        ha="right"
    )

    ax.plot(
        0,
        -L / 2,
        **marker_style
    )

    ax.text(
        0,
        -L / 2 + 100,
        "S",
        color="white",
        fontweight="bold",
        ha="center"
    )

    ax.plot(
        0,
        0,
        marker="*",
        markersize=14,
        markeredgecolor="black",
        markerfacecolor="cyan"
    )

    ax.text(
        70,
        70,
        "CITY",
        color="white",
        fontweight="bold"
    )

    # --------------------------------------------------------
    # Formatting
    # --------------------------------------------------------

    ax.set_title(
        f"Dust Field — t = {sim_time:.0f} s"
    )

    ax.set_xlabel(
        "East-West position [m]"
    )

    ax.set_ylabel(
        "North-South position [m]"
    )

    colorbar = fig.colorbar(
        dust_image,
        ax=ax
    )

    colorbar.set_label(
        "Normalized dust concentration"
    )


    # --------------------------------------------------------
    # Overall title
    # --------------------------------------------------------

    fig.suptitle(
        f"Mars Wind + Dust Simulation — {sim_time:.0f} s",
        fontsize=16,
        fontweight="bold"
    )

    plt.tight_layout()


    # --------------------------------------------------------
    # Save PNG
    # --------------------------------------------------------

    if sim_time == 0:
        filename = "mars_simulation_start.png"

    elif sim_time == 1500:
        filename = "mars_simulation_middle.png"

    else:
        filename = "mars_simulation_end.png"

    output_path = (
        plot_directory
        / filename
    )

    fig.savefig(
        output_path,
        dpi=200,
        bbox_inches="tight"
    )

    plt.close(fig)

    print(
        f"PNG saved       : {output_path}"
    )


# ------------------------------------------------------------
# 23. GENERATE THE THREE PNG FILES
# ------------------------------------------------------------

plot_snapshot(
    0.0,
    snapshots[0.0]
)

plot_snapshot(
    1500.0,
    snapshots[1500.0]
)

plot_snapshot(
    3000.0,
    snapshots[3000.0]
)


# ------------------------------------------------------------
# 24. REPORT
# ------------------------------------------------------------

print()
print("=" * 60)
print("MARS WIND + DUST SIMULATION COMPLETE")
print("=" * 60)

print(
    f"Simulation time : {n_steps * dt:.1f} s"
)

print(
    f"Grid            : {N} x {N}"
)

print(
    f"Grid spacing    : {dx:.2f} m"
)

print(
    f"Internal dt     : {dt:.2f} s"
)

print(
    f"Output interval : {dt * output_every:.2f} s"
)

print(
    f"Training samples : {len(df):,}"
)

print(
    f"CSV file        : {output_file}"
)

print(
    f"Plot directory  : {plot_directory}"
)

print()
print("PNG files:")
print(
    "  mars_simulation_plots/mars_simulation_start.png"
)
print(
    "  mars_simulation_plots/mars_simulation_middle.png"
)
print(
    "  mars_simulation_plots/mars_simulation_end.png"
)

print()
print("Columns:")
print(
    ", ".join(df.columns)
)

print()
print("First five rows:")
print(
    df.head()
)