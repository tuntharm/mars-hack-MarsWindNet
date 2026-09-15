# Dataset catalogue

The repository includes reproducible visual test data. No genuine CFD result, measured Mars sensor series, trained ML weights or validated structural solution is bundled.

## Included datasets

Paths below are relative to `public/data/scenarios/`.

| Scenario | Available data | Meaning |
| --- | --- | --- |
| `illustrative-obstacle-flow` | `.paired.csv`, `.metadata.json`, `.observations.json` | Analytic streamfunction with background `(u,v)=(8,2)` m/s; comparison adds a smooth deterministic perturbation. |
| `eastward-inflow` | `.paired.csv`, `.metadata.json`, `.observations.json` | Uniform `(8,0)` m/s reference and synthetic comparison. Includes an intentionally missing comparison at point 0 and zero velocity at point 1 to check display behaviour. |
| `northward-inflow` | `.observations.json`; reference generated in the app | Uniform `(0,8)` m/s orientation fixture. No bundled saved comparison. |
| `eastward-inflow-fail` | `.observations.json`; reference generated in the app | Uniform `(8,0)` m/s fixture. The Python stub deliberately rejects this scenario to exercise error handling. |
| `cfd-eastward-8` | No solver field or observations bundled | Reserved for genuine offline CFD import. Missing data remains visibly unavailable. |

Each paired CSV has one header and **16,384 data rows**. The legacy header is:

```text
point_id,x_m,y_m,is_fluid,u_cfd_mps,v_cfd_mps,u_ml_mps,v_ml_mps
```

The `cfd` and `ml` column names are retained for compatibility; they do **not** make the bundled values CFD or ML results. Consult the scenario metadata and displayed provenance. Empty vector cells represent missing values; a numeric zero represents a real zero within the fixture.

Fixture generation lives in [src/field/fixtures.ts](../src/field/fixtures.ts). Run `npm run export-city` to regenerate the bundled pairs, point observations and derived geometry exports. Non-fixture scenarios are excluded from generation.

The obstacle-flow fixture superposes softened analytic deflections around footprint centres. Its rectangle proxies and superposition do not enforce the actual walls' boundary conditions. Use it to develop animation, masking and comparisons, not to assess a solver's physical accuracy.

## Shared coordinates and grid

All data uses layout **`marswindnet-500-v3`**. The display domain is 0–500 m east and 0–500 m north, with its origin at the southwest corner. See [the geometry handoff](../CFD/geometry/README.md).

```text
nx = ny = 128
dx = dy = 3.90625 m
index = j * 128 + i
x = (i + 0.5) * 3.90625
y = (j + 0.5) * 3.90625
```

Values run west to east within a row, then south to north between rows. The first and last cell centres are 1.953125 and 498.046875 m. The `u` component points east, and `v` points north. Obstacle boundaries are solid.

## Genuine CFD reference import

Follow [CFD/README.md](../CFD/README.md) for the solver/export contract. Keep raw exports under `CFD/results/`, then run:

```bash
npm run cfd:import -- CFD/results/result.json CFD/results/observations.json
```

The optional observation file can be omitted. The importer validates the reference and writes `public/data/scenarios/cfd-eastward-8.reference.json`; supplied observations go to the matching `.observations.json` path. A reference must identify `kind: "cfd-reference"`, the layout and scenario, its grid, `u_mps`, `v_mps`, a boolean `is_fluid` mask and solver provenance. Structural validity checks on the file do not validate the underlying CFD.

Keep solver name/version, mesh, physical assumptions, boundary conditions and convergence evidence alongside the result. Debdut chooses the computational mesh and any padding; the 128 × 128 grid is the app's output format.

## Sensor observations and live prediction

Observations are separate point samples, not display-grid cells. Files contain matching `layout_id` and `scenario_id`, `source`, `provenance` and a `readings` array with `sensor_id`, `x_m`, `y_m`, `u_mps`, `v_mps`.

| Sensor | Position (m) | Use |
| --- | --- | --- |
| S1 | `(0,500)` | Prediction input |
| S2 | `(0,0)` | Prediction input |
| S3 | `(158,150)` | Independent local checkpoint, excluded from requests |
| S4 | `(500,500)` | Prediction input |
| S5 | `(500,0)` | Prediction input |

Bundled observations use `source: "analytic-fixture"` and evaluate the analytic function at the exact point. Supplied measurements or solver point samples use `source: "provided"` with an accurate provenance description. Corner locations fall outside cell-centre support, so they must not be replaced by clamped interior-grid samples.

**Run prediction** sends the four corner observations to `/predict`. The included service interpolates their values using inverse-distance weights and applies the obstacle mask. It has no trained model. Replace the endpoint through `VITE_PREDICT_URL` when a genuine model service is available; see [the API types](../src/contracts/marswindnet.ts).

Reference and prediction colours share a scale. Error colours represent vector error magnitude while animated motion still follows prediction velocity. Structure contours are a separate unitless illustrative surface quantity, not a CFD pressure or FEA stress dataset.

## Regional observation presets

The network adds 24 observation points at radii 1, 5 and 10 km around `(250,250)` m. The eight bearings on each ring are 0,45,...315 degrees clockwise from north. `CFD/geometry/regional-sensors.csv` holds the physical positions; `sensors.csv` intentionally retains only the five local stations.

Each bundled fixture also has `<scenario-id>.regional-observations.json`, containing `layout_id`, `scenario_id`, `scope: "regional"`, `source: "analytic-fixture"`, provenance and 24 point readings. Values are evaluated from the same analytic function or uniform orientation fixture at their exact coordinates, rather than sampled outside the local grid. These are illustrative steady wind inputs, not measured weather, time series, dust data or a regional forecasting dataset. Real scenarios have no fabricated regional readings.

The outer stations are displayed separately and do not enter the four-input `/predict` request. A future regional forecast model must define its own validated contract and how it supplies local boundary observations. Enlarging the network does not enlarge the CFD output grid beyond 500 × 500 m.

Migration to `marswindnet-500-v3` expands the display domain and translates the original object arrangement +50 m east/north. Dimensions stay fixed. Older 400 m solver data and observations must be regenerated or explicitly transformed; changing an identity string alone is insufficient.

## Separate simulation contribution

The team's `initial cfd` commit added `CFD/analysis.py` and `mars_city_wind_dust_training.csv`. The script describes a synthetic, unvalidated wind/dust generator with a 25 × 25 grid over 2 km and four cardinal nodes plus a central city sample. Its CSV contains point time series, not the application's 128 × 128 masked field or the new 29-station layout. These files are preserved unchanged and are not loaded automatically by the website. Debdut needs an explicit geometry/observation/export adapter before that contribution can drive this view; renaming its fields or layout ID alone is insufficient.
