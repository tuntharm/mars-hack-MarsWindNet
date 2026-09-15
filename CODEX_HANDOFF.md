# MarsWindNet implementation handoff

The procedural 3D scene and flow renderer are implemented in Cursor's React application. Genuine CFD and trained ML remain Debdut's work. The app has no claim of operational safety validation.

## Shared geometry

The runtime source is `public/data/city/marswindnet-layout-v2.json`. Its filename is retained for compatibility; **its layout_id is `marswindnet-400-v2`**. The portable authoritative handoff is `CFD/geometry/city.json`. Run `npm run check:geometry` to verify both representations agree.

All 20 authored objects retain their IDs, centre coordinates, dimensions and categories. Fourteen projected footprints are CFD obstacles. Pads and flat solar beds are visual-only; null solar heights remain unspecified. Sensor symbols are interface markers, not specified physical masts.

| Sensor | Exact position, metres | Role |
| --- | --- | --- |
| S1 | (0,400) | Northwest input |
| S2 | (0,0) | Southwest input |
| S3 | (108,100) | Interior checkpoint, withheld |
| S4 | (400,400) | Northeast input |
| S5 | (400,0) | Southeast input |

Domain: 0–400 m, southwest origin, x east, y north, z up. Display grid 128 × 128, cell-centred, dx=dy=3.125 m. Cell centre `(x,y)=((i+.5)*dx,(j+.5)*dy)`; flattened index `j*nx+i`. First/last centres 1.5625/398.4375 m. The CFD mesh, boundary conditions and padding remain the solver owner's decision.

`npm run check:geometry` validates runtime geometry against the portable handoff. `npm run export-city` regenerates CSV/SVG exports and explicitly illustrative datasets. It skips non-fixture scenarios and does not manufacture their measurements.

## Renderer ownership and interface

- `src/components/CityScene.tsx`: lazy loading, accessibility, capability fallback, visibility/motion gating, local camera UI.
- `src/scene3d/SceneCanvas.tsx`: R3F canvas, fitted camera and orbit controls, lighting, context loss.
- `src/scene3d/Settlement.tsx`: shared-coordinate architecture and linked sensor markers.
- `src/scene3d/WindField.tsx`: masked scalar texture, exact footprint cut-outs, batched tracers and paused arrows.
- `src/scene3d/flowMath.ts`: coordinate transform, sampling and collision/integration helpers.

The existing exported `CitySceneProps` retains: `city`, `field`, `colour:{values,min,max,kind}`, `selectedSensorId`, `onSensorSelect`, `paused`. It additionally accepts optional `presentation: 'mars' | 'cfd' | 'structure'` (default Mars) and `surfaceOverlay: SurfaceOverlayResult | null`. The parent owns fetching, scenarios, prediction, errors, shared colour scales and surface-contour generation. The scene renders any supplied compatible field without creating its own flow or data source.

Physical-to-Three coordinates: `(X,Y,Z)=(x,z,-y)`; velocities `(u,0,-v)`. This is a horizontal **2D field displayed in 3D**. Architectural roofs and distant decorative ridges do not imply 3D CFD or terrain effects. The domain is flat.

Tracers use valid-stencil bilinear sampling and midpoint/RK2 integration. Every travelled segment is checked against closed circular/rectangular solids, with substeps below half a cell. Invalid data, collisions and exits terminate and reseed paths. No interpolation/extrapolation beyond the first/last cell centres. Animation runs at 2.5× display time, independent of forecast time; there is no vertical velocity. Paused/reduced-motion CFD and Structure views show static direction arrows; Mars keeps its atmosphere still without analysis arrows. Idle/offscreen scenes stop the animation loop. Reusable GPU buffers hold approximately 900 desktop / 350 mobile particles, with count/DPR reduction if sustained frame rate falls below 30.

Scalar texture rows run south to north with explicit UVs, sRGB upload and an unlit material. Missing/solid cells remain uncoloured. Reference/prediction share the parent's scale; error colour is `hypot(u_p-u_r,v_p-v_r)`, while motion uses prediction u/v.

## Data and API integration

For genuine offline CFD, follow `CFD/README.md` and run `npm run cfd:import -- CFD/results/result.json [CFD/results/observations.json]`. The registered `cfd-eastward-8` case loads `.reference.json` separately from exact point observations. It stays empty until supplied; it never falls back to a fixture. These data have `source: 'cfd'` and show the supplied solver provenance. The import checks the data format, not CFD accuracy. `/predict` remains the separate inference/baseline service.

Default `illustrative-obstacle-flow`: deterministic softened-doublet streamfunction, background u=8,v=2 m/s. The saved counterpart adds the approved smooth sinusoidal perturbation. These are visual fixtures; superposition and rectangular proxy radii do not enforce realistic wall conditions.

Uniform eastward/northward scenarios remain available for orientation checks. The `-fail` scenario intentionally exercises a service failure. **Load illustrative comparison** loads the saved pair; **Run prediction** always POSTs to the Python endpoint. Failure does not silently substitute a fixture.

Point observations are separate from display-grid values:

```ts
type ScenarioSensorObservations = {
  layout_id: string
  scenario_id: string
  source: 'analytic-fixture' | 'provided'
  provenance: string
  readings: SensorReading[] // sensor_id, x_m, y_m, u_mps, v_mps
}
```

Fixture measurements are evaluated at exact sensor coordinates, including boundaries. No corner clamping, nearest-cell substitute or missing-value inlet fallback is used. S3 is not sent to prediction. Monitoring shows observations; S3 can be compared with a valid interpolated prediction. Corner reconstruction values are unavailable because those points lie outside the cell-centre support.

To connect real observations, add a scenario to `src/state/scenarios.ts` **without a `fixture` property** and supply `/data/scenarios/<scenario-id>.observations.json` with matching identities, `source:'provided'`, provenance and exact-coordinate readings. Four valid corner inputs are required; S3 is optional for local comparison. Missing or invalid observations disable prediction with an explanation. This path can run inference without a reference CFD field. Import a genuine reference through the CFD command to compare it against the API prediction. The paired CSV path below is retained for illustrative comparisons.

`POST /predict` request shape remains:

```json
{
  "layout_id": "marswindnet-400-v2",
  "scenario_id": "your-scenario",
  "grid": {"nx":128,"ny":128,"dx_m":3.125,"dy_m":3.125},
  "wind": {"inlet_u_mps":8,"inlet_v_mps":2},
  "sensors": [
    {"sensor_id":"S1","x_m":0,"y_m":400,"u_mps":8,"v_mps":2},
    {"sensor_id":"S2","x_m":0,"y_m":0,"u_mps":8,"v_mps":2},
    {"sensor_id":"S4","x_m":400,"y_m":400,"u_mps":8,"v_mps":2},
    {"sensor_id":"S5","x_m":400,"y_m":0,"u_mps":8,"v_mps":2}
  ]
}
```

Example values above illustrate the schema, not measured Mars data. Response: matching identities/grid, `u_mps` and `v_mps` arrays of 16384 values, optional boolean `is_fluid`, and provenance text. Valid cells require finite numbers; explicit masked cells may contain null. The client combines returned validity with the canonical geometry mask. Saved/live requests share cancellation protection across scenario changes.

Saved pair header (retained from Cursor for compatibility):

```text
point_id,x_m,y_m,is_fluid,u_cfd_mps,v_cfd_mps,u_ml_mps,v_ml_mps
```

Despite those legacy column names, bundled datasets are illustrative, not CFD/ML. Place the pair at `/data/scenarios/<id>.paired.csv`. The UI labels provenance explicitly. The available-pair check rejects an HTML fallback response. The current bundled file provenance is defined in `src/field/csv.ts`; update that source declaration when importing genuine simulation results rather than presenting them under illustrative labels.

## Verification and limitations

See `docs/REPOSITORY_STATUS.md` for the current organisation and checks. `docs/IMPLEMENTATION.md` and its screenshots record the preceding flow-renderer delivery. The 3D engine is lazy-loaded; the ~942 kB uncompressed scene chunk emits a Vite size advisory (~252 kB gzip). It does not block the initial application/2D bundle. The installed R3F version still emits a Three.Clock deprecation warning; no dependency upgrade was introduced solely to remove that upstream warning.

This is a local demo. Mobile viewport checks are desktop-browser emulation, not proof across physical devices. Reduced-motion/WebGL-failure behaviour has component regression coverage; actual OS preference changes or physical GPU failures were not induced. CFD, ML and safety remain unvalidated.


## Presentation and surface-result integration

One Canvas retains the camera across Mars / CFD / Structure. Mars hides the heatmap; CFD shows numerical field colours; Structure uses neutral surroundings, grey wind and surface colours. The initial camera frames buildings; **Fit city** includes the complete corner network. Portrait framing uses a steeper view to keep the building core legible. Unknown solar heights remain null: small ground-layer offsets are depth-separation for flat visual decals, not physical heights.

`src/geometry/surfaceMesh.ts` supplies canonical ENU surface positions to both detailed architecture and the parent’s illustrative contour generator. `src/scene3d/architectureMaterials.ts` supplies procedural panel, relief, window, roof and tank textures. `MarsEnvironment.tsx` uses the generated regolith with a fallback material, and procedural sky and distant ridges. The panorama is page-only because its edges do not wrap seamlessly. The flat area extends 100 m beyond the simulation boundary; distant relief has no effect on CFD.

`SurfaceOverlayResult` lives in `src/contracts/marswindnet.ts`:

```ts
{
  layout_id: string
  scenario_id: string
  wind_basis: 'reference' | 'prediction'
  source: 'illustrative' | 'solver' | 'ml'
  quantity: string
  unit: string
  provenance: string
  range: [number, number]
  surfaces: Array<{
    object_id: string
    positions_m: number[] // global ENU xyz triples, undeformed
    triangles: number[] // vertex indices in triples
    values: Array<number | null> // one scalar per vertex
  }>
}
```

For future supplied results, validate with `validateSurfaceOverlay(result, city, scenarioId, windBasis)` in the parent before passing the result to `CityScene`. Null values omit their triangles and leave neutral geometry visible. Invalid identities, malformed arrays, invalid indices or geometry outside canonical bounds are rejected. The renderer independently checks the result before GPU upload; it does not fetch a surface result or claim a solver exists. Deformed meshes are outside this initial adapter’s scope.

Current illustrative values average valid exterior samples around each footprint and use the agreed wind-facing normal/height formula with a fixed 20 m/s visual divisor and 0–1 scale. Missing exterior wind gives null values. These are **not stress, displacement, structural dynamics or safety results**. Reference and Prediction share that fixed visual scale. Entering Structure from CFD Error displays prediction velocity and preserves the stored Error choice for returning to CFD.
