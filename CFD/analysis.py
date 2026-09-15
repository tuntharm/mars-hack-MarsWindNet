import numpy as np
import pandas as pd

# ============================================================
# FAST 2-D REDUCED-ORDER MARTIAN WIND + DUST SIMULATOR
# ============================================================
#
# Four sensor nodes surround a central "city":
#
#                 N
#                 |
#            (0,R)
#
#       W ------- CITY ------- E
#
#       (-R,0)    (0,0)     (R,0)
#
#                 |
#                 S
#
# The model solves simplified 2-D advection/diffusion equations
# on a regular grid.
#
# Outputs:
#   - time
#   - u, v and speed at each of four nodes
#   - dust at each node
#   - u, v, speed and dust at the city
#
# The boundary conditions vary continuously in time and contain
# both deterministic and stochastic components.
#
# This is intended as a fast synthetic-data generator for ML,
# NOT as a validated Martian CFD model.
# ============================================================


# ------------------------------------------------------------
# 1. RANDOM NUMBER GENERATOR
# ------------------------------------------------------------

rng = np.random.default_rng(42)

# Change the seed to obtain a different realization.
# For example:
#
# rng = np.random.default_rng(12345)


# ------------------------------------------------------------
# 2. SIMULATION PARAMETERS
# ------------------------------------------------------------

# Spatial grid
N = 25                  # N x N grid
L = 2000.0              # domain width/height [m]
dx = L / (N - 1)

# Time
dt = 0.20               # internal timestep [s]
n_steps = 15000         # number of timesteps
output_every = 5        # save every 5 timesteps

# Therefore:
#
# simulated time = n_steps * dt
#                 = 3000 seconds
#
# output interval = output_every * dt
#                  = 1 second


# ------------------------------------------------------------
# 3. EFFECTIVE MARTIAN PARAMETERS
# ------------------------------------------------------------

# These are reduced-order / effective parameters rather than
# a complete physical description of the Martian atmosphere.

rho = 0.020             # near-surface atmospheric density [kg/m^3]
g = 3.71                # Mars gravitational acceleration [m/s^2]

# Effective momentum diffusivity
nu = 25.0               # [m^2/s]

# Linear drag term
k_drag = 0.004          # [1/s]

# Effective dust diffusivity
dust_diff = 18.0        # [m^2/s]

# Dust removal/deposition rate
dust_decay = 2.0e-5     # [1/s]

# Wind-driven dust resuspension coefficient
dust_source_strength = 2.0e-6


# ------------------------------------------------------------
# 4. GRID AND SENSOR LOCATIONS
# ------------------------------------------------------------

# Array indices:
#
#       row = 0
#          |
#          v
#
#       +-----------+
#       |           |
#       |     N     |
#       |     |     |
#       | W - C - E |
#       |     |     |
#       |     S     |
#       |           |
#       +-----------+

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

# u = east-west wind component
# v = north-south wind component
# dust = normalized dust concentration

u = np.zeros((N, N))
v = np.zeros((N, N))
dust = np.zeros((N, N))


# ------------------------------------------------------------
# 6. TRANSIENT BOUNDARY CONDITION PARAMETERS
# ------------------------------------------------------------

# Ornstein-Uhlenbeck correlation times.
# These make the random component vary smoothly rather than
# jumping randomly at every timestep.

tau_wind = 180.0        # wind correlation time [s]
tau_dust = 240.0        # dust correlation time [s]

# Initial large-scale wind state
wind_state = np.array([
    4.0,                 # east-west component [m/s]
    0.0                  # north-south component [m/s]
])

# Initial dust concentration
dust_state = 0.45


# ------------------------------------------------------------
# 7. ORNSTEIN-UHLENBECK PROCESS
# ------------------------------------------------------------

def ou_step(x, target, tau, sigma, dt):
    """
    Update a stochastic state using a simple
    Ornstein-Uhlenbeck process.

    x      : current state
    target : slowly varying target state
    tau    : relaxation/correlation time
    sigma  : stochastic amplitude
    dt     : timestep
    """

    return (
        x
        + (target - x) * dt / tau
        + sigma * np.sqrt(dt) * rng.normal()
    )


# ------------------------------------------------------------
# 8. FINITE-DIFFERENCE LAPLACIAN
# ------------------------------------------------------------

def laplacian(a):
    """
    Calculate the 2-D Laplacian using a five-point stencil:

        d2a/dx2 + d2a/dy2

    Interior cells use centered differences.
    """

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
    """
    Return:
        ax = da/dx
        ay = da/dy

    Centered differences in the interior and one-sided
    differences at the boundaries.
    """

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
    """
    Set the velocity and dust boundary conditions.

    The large-scale wind comes from the transient wind state,
    with small spatial variations around the perimeter.

    Dust has a spatially varying boundary concentration.
    """

    wx, wy = wind

    phase = np.linspace(
        0,
        2 * np.pi,
        N
    )

    # --------------------------------------------------------
    # WEST / EAST VELOCITY
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # NORTH / SOUTH VELOCITY
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # DUST BOUNDARY CONDITIONS
    # --------------------------------------------------------

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

    # Four sensor nodes
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

    # City
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
# 13. MAIN SIMULATION LOOP
# ------------------------------------------------------------

for step in range(n_steps):

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

    # Dust cannot become negative
    dust_state = max(
        0.02,
        dust_state
    )

    # Apply current boundary conditions
    set_boundary(
        u,
        v,
        dust,
        wind_state,
        dust_state
    )

    # --------------------------------------------------------
    # Calculate velocity gradients
    # --------------------------------------------------------

    ux, uy = gradients(u)
    vx, vy = gradients(v)

    # --------------------------------------------------------
    # Calculate dust gradients
    # --------------------------------------------------------

    cx, cy = gradients(dust)

    # --------------------------------------------------------
    # Calculate diffusion terms
    # --------------------------------------------------------

    Lu = laplacian(u)
    Lv = laplacian(v)
    Lc = laplacian(dust)

    # --------------------------------------------------------
    # WIND ADVECTION
    # --------------------------------------------------------
    #
    # du/dt + u du/dx + v du/dy =
    #       nu Laplacian(u) - drag*u
    #
    # dv/dt + u dv/dx + v dv/dy =
    #       nu Laplacian(v) - drag*v
    #

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
    #
    # dC/dt + u dC/dx + v dC/dy =
    #
    #       D Laplacian(C)
    #       - lambda*C
    #       + resuspension
    #

    adv_c = (
        u * cx
        + v * cy
    )

    wind_speed = np.hypot(
        u,
        v
    )

    # Wind-driven resuspension.
    # Dust production starts increasing above ~4 m/s.
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

    # Dust concentration must remain non-negative.
    dust = np.maximum(
        c_new,
        0.0
    )

    u = u_new
    v = v_new

    # Reapply boundary conditions after updating the field.
    set_boundary(
        u,
        v,
        dust,
        wind_state,
        dust_state
    )

    # --------------------------------------------------------
    # SAVE DATA
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


# ------------------------------------------------------------
# 14. CREATE DATAFRAME
# ------------------------------------------------------------

df = pd.DataFrame(
    records
)


# ------------------------------------------------------------
# 15. SAVE CSV
# ------------------------------------------------------------

output_file = "mars_city_wind_dust_training.csv"

df.to_csv(
    output_file,
    index=False
)


# ------------------------------------------------------------
# 16. REPORT
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