# MarsWindNet

**See the wind. Protect the city.**

A Mars City Hackathon prototype for exploring wind around a 400 × 400 m settlement. The React application combines a procedural 3D city, animated horizontal wind, a matching 2D map and five virtual sensor stations.

**Ready now:** geometry, interactive visualisation and reproducible analytic demo datasets. **Still needed:** genuine CFD results and a trained prediction model. The included Python service is an inverse-distance interpolation (IDW) baseline; the Structure view shows illustrative surface colours.

## Start the demo

Use Node.js **22.18 or newer** and npm. From a fresh checkout:

```bash
git clone https://github.com/tuntharm/mars-hack-MarsWindNet.git
cd mars-hack-MarsWindNet
npm ci
npm run dev -- --host 127.0.0.1
```

Open [localhost:5173](http://127.0.0.1:5173). The bundled demonstration works without Python.

| View | Purpose |
| --- | --- |
| **Mars** | Explore the settlement, terrain and decorative wind motion. |
| **CFD** | Inspect the supplied velocity field, contours and Reference / Prediction / Error comparison. The tab name does not certify the data source; read its provenance label. |
| **Structure** | Inspect illustrative wind-facing surface contours, scaled 0–1. These are not stress, displacement or structural analysis. |

Use **Fit city** to include all five sensors. Select **Load illustrative comparison** to exercise comparison controls. On mobile, enable **Interact with city** for camera gestures and use **Done** to resume normal scrolling.

## Repository map

```text
CFD/
  geometry/                 Agreed city specification, obstacle/sensor CSVs and map
  results/                  Place actual solver exports here; none are bundled
  import-result.mjs         Validate and import a CFD reference into the app
  README.md                 Debdut's simulation and export instructions
public/data/
  city/                     Application's canonical geometry representation
  scenarios/                Demo pairs, observations, metadata and imported fields
  exports/                  Geometry exports derived from the runtime city
src/
  contracts/                Shared geometry, field, observation and surface types
  scene3d/                  City architecture, terrain and wind renderer
  structure/                Illustrative contour generation and validation
  field/                    Fixtures, masks, sampling, colours and metrics
  prediction/               Python API client and response validation
  state/                    Scenarios, mode selection and request lifecycle
  components/               Controls, 2D map and monitoring
predict-stub/               Optional Python IDW baseline, not trained ML
docs/DATASETS.md            What data is included, its provenance and limitations
```

## Debdut: begin here

1. Open the [city map](CFD/geometry/city-map.svg) and [geometry specification](CFD/geometry/README.md). Use layout **`marswindnet-400-v2`**, with 14 projected CFD obstacles. The pads, solar beds and sensor markers are visual-only.
2. Follow [CFD/README.md](CFD/README.md) to choose the solver, computational mesh, boundary conditions and any surrounding padding. Resample the result onto the agreed 128 × 128 cell-centred display grid.
3. Export the genuine reference as `CFD/results/result.json`. Import it with optional exact-coordinate sensor observations:

```bash
npm run cfd:import -- CFD/results/result.json CFD/results/observations.json
```

Omit the final argument when observations are unavailable. Select the **CFD eastward 8 m/s** scenario in the app. Its reference stays unavailable until a solver result is imported; prediction additionally needs the four corner observations.

This workflow loads an **offline CFD reference**. **Run prediction** separately calls the configured `/predict` service. The five stations are S1/S2/S4/S5 at the domain corners and S3 at `(108,100)` m. S3 is withheld from prediction for a local checkpoint comparison.

## Optional prediction service

For the included baseline, create a Python environment once (macOS/Linux):

```bash
python3 -m venv predict-stub/.venv
predict-stub/.venv/bin/python -m pip install -r predict-stub/requirements.txt
npm run predict-stub
```

The default endpoint is `http://127.0.0.1:8000/predict`; API documentation is at [localhost:8000/docs](http://127.0.0.1:8000/docs). To connect a different service, set `VITE_PREDICT_URL` in `.env.local` and restart Vite. See [.env.example](.env.example) and the [shared contracts](src/contracts/marswindnet.ts). S1/S2/S4/S5 supply the input vectors; a failed request is shown explicitly.

## Data and development

The [dataset catalogue](docs/DATASETS.md) distinguishes analytic fixtures, provided observations, imported CFD and live predictions. Two paired CSVs are bundled, each with 16,384 grid rows. They contain synthetic reference/comparison values, not a CFD training corpus or ML model weights.

```bash
npm test
npm run lint
npm run build
npm run check:geometry
npm run export-city
```

`export-city` regenerates geometry exports and labelled fixture data; it does not run CFD. Keep geometry aligned between `CFD/geometry/` and `public/data/city/`. Physical coordinates use metres, southwest origin, x east and y north; the renderer maps `(x,y,z)` to `(x,z,-y)`.

This prototype visualises **2D horizontal flow in a 3D city**. Architectural roofs, generated terrain imagery and decorative haze do not establish 3D CFD, dust transport, structural validity or operational safety. Genuine engineering results need their own solver assumptions and validation.
