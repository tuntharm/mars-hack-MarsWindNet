# MarsWindNet

**See the wind. Protect the city.**

MarsWindNet is a React + Vite prototype for exploring wind around a 500 × 500 m Martian settlement. The app combines a procedural 3D city, animated horizontal flow, a matching 2D map and a 29-station monitoring network: five local sensors and 24 regional sensors across three rings.

The current repository is aligned to the `marswindnet-500-v3` layout and the latest workflow: imported CFD references, saved fixture comparisons, predictive runs against the local `/predict` endpoint, and illustrative Structure overlays that are explicitly not structural engineering results.

## Status

**Ready now:**
- portable geometry for the 500 m city and regional network
- interactive Mars / CFD / Structure presentation views
- reproducible analytic fixture datasets and saved comparison scenarios
- CFD result importer and geometry validation tooling
- optional Python IDW prediction stub

**Still needed:**
- genuine CFD solver output for the app’s reference field
- a trained or validated prediction model for operational forecasting
- engineering-grade structural analysis or warning logic

## Start the demo

Use Node.js **22.18 or newer** and npm. From a fresh checkout:

```bash
git clone https://github.com/tuntharm/mars-hack-MarsWindNet.git
cd mars-hack-MarsWindNet
npm ci
npm run dev -- --host 127.0.0.1
```

Open [localhost:5173](http://127.0.0.1:5173). The bundled app works without Python, but the optional prediction stub and imported solver results require additional setup.

| View | Purpose |
| --- | --- |
| **Mars** | Explore the settlement, terrain and decorative wind motion. |
| **CFD** | Inspect imported reference fields, comparison panels and the selected wind source. The label is not proof of scientific validity; check the provenance text. |
| **Structure** | Inspect illustrative surface contours scaled 0–1. These are not stress, displacement or structural analysis. |

The default **Mars** view includes all five local sensors. Use **Regional view** to zoom out to eight stations each at 1, 5 and 10 km from the city centre, then return to **Fit city** for the local field. Select **Load illustrative comparison** to exercise the saved comparison controls. On mobile, enable **Interact with city** for camera gestures and use **Done** to return to normal scrolling.

## Repository map

```text
CFD/
  geometry/                 Canonical city specification, obstacle/sensor CSVs and maps
  results/                  Place solver exports and observations here
  import-result.mjs         Validate and import a CFD reference into the app
  README.md                 Debdut's solver and output handoff guidance
public/data/
  city/                     Runtime city layout and exported geometry assets
  scenarios/                Saved demo pairs, observations and imported fields
  exports/                  Geometry export outputs derived from the city layout
src/
  contracts/                Shared geometry, field, observation and surface types
  scene3d/                  Procedural city architecture, terrain and wind renderer
  structure/                Illustrative contour generation and validation
  field/                    Fixtures, masks, sampling, colours and metrics
  prediction/               Prediction API client and response validation
  state/                    Scenarios, mode selection and request lifecycle
  components/               Controls, 2D map and monitoring UI
predict-stub/               Optional Python IDW baseline; not a trained ML model
docs/
  DATASETS.md               What data is included, provenance and limitations
  IMPLEMENTATION.md          Project status and implementation notes
  REPOSITORY_STATUS.md      Current verification summary for the 500 m update
```

## Local city and regional network

The application uses a 500 × 500 m local city as the detailed display/CFD output area. The regional network is a separate observation layout centred at `(250,250)` m with eight compass positions for each ring. Open the [regional map](CFD/geometry/regional-map.svg) and [regional coordinates](CFD/geometry/regional-sensors.csv). Negative coordinates are valid outside the southwest city origin.

The canonical city layout is `marswindnet-500-v3`, which supersedes the historic 400 m layout. Existing buildings, pads, solar beds and S3 move +50 m east and north, while their dimensions and arrangement remain unchanged. The older planning files stay preserved as historical material.

Only S1/S2/S4/S5 feed the local `/predict` service. S3 remains an independent checkpoint and is withheld from prediction. The outer 24 regional stations are not silently added to that API. Bundled regional readings are labelled analytic fixtures, without dust transport, warning lead times or a regional forecasting model.

## Debdut: begin here

1. Open the [city map](CFD/geometry/city-map.svg) and [geometry specification](CFD/geometry/README.md). Use layout **`marswindnet-500-v3`** with 14 projected CFD obstacles. The pads, solar beds and sensor markers are visual-only.
2. Follow [CFD/README.md](CFD/README.md) to choose your solver, mesh, boundary conditions and any surrounding padding. Resample the result onto the agreed 128 × 128 cell-centred display grid.
3. Export the solver result as `CFD/results/result.json`, and optionally provide exact sensor observations as `CFD/results/observations.json`.

```bash
npm run cfd:import -- CFD/results/result.json
npm run cfd:import -- CFD/results/result.json CFD/results/observations.json
```

Omit the final argument when observations are unavailable. In the app, select the **CFD eastward 8 m/s · solver data** scenario. Its reference remains unavailable until a solver result is imported; prediction also requires the four corner observations.

This workflow loads an **offline CFD reference**. **Run prediction** separately calls the configured `/predict` service. The prediction inputs are S1/S2/S4/S5 at the domain corners; S3 at `(158,150)` m is intentionally withheld as a local checkpoint comparison.

## Optional prediction service

For the bundled IDW baseline, create a Python environment once (macOS/Linux):

```bash
python3 -m venv predict-stub/.venv
predict-stub/.venv/bin/python -m pip install -r predict-stub/requirements.txt
npm run predict-stub
```

The default endpoint is `http://127.0.0.1:8000/predict`; API documentation is at [localhost:8000/docs](http://127.0.0.1:8000/docs). To point the app at a different service, set `VITE_PREDICT_URL` in `.env.local` and restart Vite. See [.env.example](.env.example) and the API contracts in [src/contracts/marswindnet.ts](src/contracts/marswindnet.ts). S1/S2/S4/S5 supply the input vectors; failed requests are shown explicitly in the UI.

## Data and development

The [dataset catalogue](docs/DATASETS.md) distinguishes analytic fixtures, provided observations, imported CFD and live predictions. Two bundled paired CSVs contain 16,384 grid rows each and are intended for visual comparison, not as a CFD training corpus or ML model weights.

```bash
npm test
npm run lint
npm run build
npm run check:geometry
npm run export-city
```

`export-city` regenerates geometry exports and labelled fixture data; it does not run CFD. Keep geometry aligned between `CFD/geometry/` and `public/data/city/`. Physical coordinates use metres with a southwest origin; x is east and y is north; the renderer maps `(x,y,z)` to `(x,z,-y)`.

This prototype visualises **2D horizontal flow in a 3D city**. Architectural roofs, generated terrain imagery and decorative haze do not establish 3D CFD, dust transport, structural validity or operational safety. Genuine engineering results require their own solver assumptions and validation.

## Separate simulation contribution

The team's historical `initial cfd` contribution added `CFD/analysis.py` and `mars_city_wind_dust_training.csv`. The script describes a synthetic, unvalidated wind/dust generator across a 2 km domain with four cardinal nodes and a central city sample. Its CSV contains point time series, not the application’s 128 × 128 masked field or the new 29-station layout.

Those files are preserved unchanged and are not loaded automatically by the website. Debdut needs an explicit geometry/observation/export adapter before that contribution can drive this view; renaming its fields or layout ID alone is insufficient.

## Verification

The repository status currently reflects the 500 m update:
- geometry checks pass for the 20 objects, 14 CFD obstacles, five local sensors and 24 regional sensors
- the importer and saved-scenario flow are tested and documented
- lint, tests and the Vite production build pass locally
- browser checks cover the local city and regional view for desktop and mobile widths

The project remains a research prototype; it is not a validated engineering or operational tool.
