# CFD workspace — Debdut's handoff

**Geometry and integration are ready. No genuine CFD solve or trained ML model is included.**

Start with [the north-up map](geometry/city-map.svg), [canonical city](geometry/city.json), [14 obstacles](geometry/obstacles.csv) and [5 sensors](geometry/sensors.csv). Layout identity is `marswindnet-500-v3`. The app imports this geometry into `public/data/city/marswindnet-layout-v2.json`; run `npm run check:geometry` to check agreement. Keep positions, dimensions, IDs and roles consistent.

## Run your simulation

1. Build your solver case in `CFD/work/` using `geometry/obstacles.csv`. This directory is ignored by Git. You choose the solver, mesh, fluid properties, boundary conditions, turbulence/laminar assumptions and outer-domain padding. This repository does not yet contain an OpenFOAM case, CFD executable or solver-specific runner.
2. The initial model is horizontal 2D flow around projected footprints. All 14 buildings/tanks are solid; landing pads, solar beds, sensors and distant decorative ridges are excluded. Architectural dome roofs do not make this a 3D simulation.
3. The provided integration case is `cfd-eastward-8`, an authored test with prescribed eastward inflow `u=8, v=0 m/s`. This velocity is a test parameter, not a measured Mars condition. Choose and document suitable physical conditions separately.
4. Resample the computed velocities and validity onto the agreed display grid. Save the JSON below in `CFD/results/`. Retain your solver logs, mesh/convergence checks and case configuration separately for scientific validation.
5. Import the result and reload the app. Choose **CFD eastward 8 m/s · solver data**. Both 2D and 3D views use this imported reference. If the result is missing or invalid, the app displays an explanation without substituting fixture data.

## Output contract

Domain `[0,500] × [0,500]` metres; southwest origin; x east, y north. The display grid is **not the computational mesh**:

```text
nx = ny = 128; dx = dy = 3.90625 m
i,j = 0..127
index = j*128+i
x = (i+0.5)*3.90625
y = (j+0.5)*3.90625
```

Rows run west-to-east, then south-to-north. First/last centres are 1.953125/498.046875 m. Every array has 16,384 entries. All valid cells require finite u/v in m/s. Masked cells may be null. `is_fluid` must be booleans. The importer combines your mask with the canonical obstacles.

Schema illustration (ellipses must be replaced with complete arrays):

```json
{
  "kind": "cfd-reference",
  "layout_id": "marswindnet-500-v3",
  "scenario_id": "cfd-eastward-8",
  "grid": {"nx":128,"ny":128,"dx_m":3.90625,"dy_m":3.90625},
  "provenance": "Your solver/version, case identifier and sampling description",
  "u_mps": ["... 16384 numeric or masked-null values ..."],
  "v_mps": ["... 16384 numeric or masked-null values ..."],
  "is_fluid": ["... 16384 booleans ..."]
}
```

```bash
npm run cfd:import -- CFD/results/result.json
# Include separately sampled observations when available:
npm run cfd:import -- CFD/results/result.json CFD/results/observations.json
```

The command validates before writing `public/data/scenarios/cfd-eastward-8.reference.json` and, if supplied, its `.observations.json`. It does not create a prediction or an ML comparison. Existing observations are retained when the optional file is omitted; ensure they belong to the same case. To add another case, register a unique scenario in `src/state/scenarios.ts` without a `fixture` property, then import its matching result.

## Exact sensor observations and prediction

| Sensor | x,y (m) | Role |
|---|---|---|
| S1 | 0,500 | Prediction input |
| S2 | 0,0 | Prediction input |
| S3 | 158,150 | Independent checkpoint, withheld from prediction |
| S4 | 500,500 | Prediction input |
| S5 | 500,0 | Prediction input |

Sample these exact points from your solution or explicitly defined boundary data. Corners are outside the cell-centred display support; do not clamp them to interior samples. The upstream subset depends on wind direction. Sensors do not automatically define inlet/outlet boundary conditions.

Observation JSON uses `layout_id`, `scenario_id`, `source: "provided"`, `provenance` and `readings`. Each reading contains `sensor_id`, `x_m`, `y_m`, `u_mps`, `v_mps`. Supply S1/S2/S4/S5 once each. S3 is optional for the independent checkpoint. All values must be finite.

**Run prediction** continues to POST to `VITE_PREDICT_URL` (default `http://127.0.0.1:8000/predict`). It does not launch CFD. The included `predict-stub/` service performs inverse-distance interpolation; replace that endpoint with Debdut's inference service when ready. See [the API and surface-result handoff](../CODEX_HANDOFF.md). Structure mode currently uses a unitless illustrative surface response and requires separate engineering results for real structural analysis.

## Regional observation network — separate from this solver output

Use [regional-sensors.csv](geometry/regional-sensors.csv) and [regional-map.svg](geometry/regional-map.svg) for the 24 additional virtual stations: eight compass bearings each at 1, 5 and 10 km from `(250,250)` m. All coordinates share the city's southwest origin; points outside the city can have negative x/y. These stations do not define the computational boundary and are not obstacles.

The local CFD output remains 500 × 500 m. You choose any computational padding. Only S1/S2/S4/S5 enter the existing prediction endpoint, and S3 remains an independent checkpoint. Regional observations are separate files and are not ingested by `cfd:import`; no regional forecast or validated warning model is included.

This v3 expands the former 400 m domain, translating objects and S3 +50 m east/north without changing dimensions. Do not relabel an old solver result as v3: the coordinates, display sampling and sensor positions changed. Earlier planning proposals remain unchanged.

## Separate simulation contribution

The team's `initial cfd` commit added `CFD/analysis.py` and `mars_city_wind_dust_training.csv`. The script describes a synthetic, unvalidated wind/dust generator with a 25 × 25 grid over 2 km and four cardinal nodes plus a central city sample. Its CSV contains point time series, not the application's 128 × 128 masked field or the new 29-station layout. These files are preserved unchanged and are not loaded automatically by the website. Debdut needs an explicit geometry/observation/export adapter before that contribution can drive this view; renaming its fields or layout ID alone is insufficient.
