# MarsWindNet — implementation and verification

Historical record of the first renderer delivery on 15 September 2026. Screenshots, initial framing and counts below predate the subsequent realism and repository-organisation updates. See [current repository status](REPOSITORY_STATUS.md). Cursor's application/state/provider structure and installed dependencies were retained. No deployment, CFD solve or ML training was performed.

## Delivered

- Full-width procedural 3D city from the imported `marswindnet-400-v2` geometry, with all 20 objects and 5 sensors.
- Batched moving wind trails, masked scalar colour map, orbit/top/reset/zoom, linked sensor selection and pause/static arrows.
- Responsive presentation, compact toolbar and observation gauges/compass, matching 2D field inspection.
- Explicitly illustrative analytic fixture and saved comparison, separate from the real Python prediction request.
- Four exact-coordinate input observations; S3 withheld for comparison. Validated field identities, grids and masks; stale saved/live requests cancelled.
- Documented adapter for separately provided observations and Debdut's endpoint.

## Fresh automated checks

| Check | Result |
| --- | --- |
| `npm test` | **62 tests passed in 16 files** |
| `npm run lint` | Pass, no warnings |
| `npm run build` | TypeScript and Vite production build pass |
| `npm run export-city` | Pass; regenerated geometry exports and labelled fixture data |
| Geometry comparison | 20 objects and 5 sensors match planning geometry-v2, including IDs, dimensions and roles |
| Python handler checks | 16,384 vectors; rejects S3 leakage and spacing mismatch; forced failure returns 500 |

New regression coverage includes exact corner observations, missing/provided observations, withheld S3, spacing/identity/array/mask/finite-value checks, masked nulls, canonical solid-mask combination, stale saved loads, HTML fallback rejection, shared data semantics, RK2/bilinear sampling, circle/rectangle segment collisions, zero/null/invalid flow, scalar row orientation, and scene accessibility/suspension.

## Actual browser checks

Inspected the running application in Chrome at **1440 × 900** and **390 × 844** CSS viewports. Captures exclude the browser's scrollbar and may have smaller pixel dimensions.

- Both pads, all six domes, the industrial cluster and all five sensors fit the initial scene at both sizes. No horizontal page overflow.
- North-up camera visibly matches the 2D settlement positions. Northward arrows point up; eastward arrows point right.
- Orbit and explicit zoom changed projected sensor positions; reset restored the fitted view. Resize fits again after zoom.
- Reference, saved prediction and Error modes update the scene and source labels. Error shows prediction directions with error magnitudes for colour.
- 3D S3 click selected the matching monitor; 2D northeast-corner click selected S4 across views and the station list.
- Actual **Run prediction** reached the local Python service and showed `stub-idw — not trained ML`; observed domain mean vector error 1.58 m/s in that demonstration. Forced failure displayed HTTP 500 and preserved the reference view.
- Captured running frames differed by 88,986 pixels; two paused frames were pixel-identical. Paused views showed direction arrows.
- Scrolling via the map link put the scene above the viewport (`bottom=-107.8px`), switched its motion state to paused, and left the manual pause checkbox unchecked: automatic offscreen suspension works.
- Mobile interaction toggle enables/disables scene interaction. Ordinary page scrolling remains available outside interaction mode.
- Sampled active rendering approximately 118–120fps on this inspected machine: 900 desktop tracers and 350 mobile tracers. This is a local observation, not a cross-device benchmark.
- Fresh page load had no application errors. An upstream Three.Clock deprecation warning remains.

The failed-prediction check exercised the actual browser/service path. Malformed/stale responses, reduced-motion preference and unavailable/lost WebGL are regression-tested with controlled test inputs; OS settings and physical GPU failures were not induced. Physical touch-device behaviour remains unverified beyond responsive desktop-browser inspection.

## Rendered evidence

- [Desktop first screen](evidence/desktop.jpg)
- [Full desktop illustrative comparison and monitoring](evidence/comparison-full.jpg)
- [Mobile first screen](evidence/mobile.jpg)
- [Full mobile page](evidence/mobile-full.jpg)

## Exact changed application files

Paths are relative to the repository root.

```text
README.md
CODEX_HANDOFF.md
src/App.tsx
src/App.interaction.test.tsx
src/index.css
src/contracts/marswindnet.ts
src/components/CityScene.tsx
src/components/Controls.tsx
src/components/Map2D.tsx
src/components/MonitoringPanel.tsx
src/components/SensorList.tsx
src/components/SourcePill.tsx
src/field/grid.ts
src/field/mask.ts
src/field/mask.test.ts
src/field/fixtures.ts
src/field/csv.ts
src/field/csv.test.ts
src/field/savedCsv.test.ts
src/state/scenarios.ts
src/state/buildRequest.ts
src/state/useMarsWindNet.ts
src/prediction/client.ts
src/prediction/validate.ts
src/prediction/validate.test.ts
scripts/export-city.mjs
predict-stub/main.py
public/data/city/marswindnet-layout-v2.json
public/data/exports/marswindnet-layout-v2.svg
public/data/exports/obstacles.csv
public/data/exports/sensors.csv
public/data/scenarios/eastward-inflow.paired.csv
```

New files:

```text
src/scene3d/SceneCanvas.tsx
src/scene3d/Settlement.tsx
src/scene3d/WindField.tsx
src/scene3d/flowMath.ts
src/scene3d/flowMath.test.ts
src/scene3d/CityScene.test.tsx
src/scene3d/scene.css
src/field/sample.ts
src/field/sample.test.ts
src/field/illustrative.test.ts
src/state/buildRequest.test.ts
src/state/useMarsWindNet.test.ts
src/prediction/client.test.ts
public/data/scenarios/eastward-inflow.metadata.json
public/data/scenarios/eastward-inflow.observations.json
public/data/scenarios/eastward-inflow-fail.observations.json
public/data/scenarios/northward-inflow.observations.json
public/data/scenarios/illustrative-obstacle-flow.metadata.json
public/data/scenarios/illustrative-obstacle-flow.observations.json
public/data/scenarios/illustrative-obstacle-flow.paired.csv
docs/IMPLEMENTATION.md
docs/evidence/desktop.jpg
docs/evidence/comparison-full.jpg
docs/evidence/mobile.jpg
docs/evidence/mobile-full.jpg
```

Build-generated `dist/`, Vite caches and TypeScript incremental metadata were regenerated by standard commands. `package.json` and `package-lock.json` were not changed. No planning-geometry file was edited. This workspace is not a Git repository; original source was preserved under `/private/tmp/marswindnet-before/` for this session.

## Remaining limits

The analytic fixture and sinusoidal comparison are mathematical demonstration data. They do not establish wall boundary conditions, dust transport, forecast accuracy, structural loads or safety. Debdut must supply genuine CFD/ML results and validation.

The 3D chunk is lazy-loaded, approximately 952kB uncompressed / 254kB gzip. Vite emits its advisory size warning; initial app code remains separate. The installed R3F/Three combination emits a non-fatal Three.Clock deprecation warning. No package upgrades were introduced.

2D heatmap/tracer height and architectural roofs are presentation only. The flow has no vertical component. Unknown solar-bed and mast dimensions remain unspecified. Decorative distant geometry is outside the flat simulation domain.
