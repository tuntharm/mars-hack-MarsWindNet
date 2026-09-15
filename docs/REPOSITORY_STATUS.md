# Repository status

Updated for the 500 m city and regional network on 15 September 2026.

## Available

- React/Vite application: shared 2D/3D field display, Mars/CFD/Structure presentations, linked sensor selection, camera controls and monitoring.
- Portable geometry under `CFD/geometry/`; runtime representation checked with `npm run check:geometry`.
- Two deterministic illustrative paired datasets with 16,384 rows each, plus exact-point fixture observations. See [dataset catalogue](DATASETS.md).
- Validated CFD reference file importer and a dedicated non-fixture UI scenario. No genuine CFD file is bundled.
- Separate Python IDW baseline behind `/predict`; no trained ML weights or inference model included.
- GitHub Actions configuration for tests, lint, build and geometry checks. Remote CI status must be checked on GitHub after push.

## Locally verified for the 500 m update

- 96 tests across 24 files pass, including CFD parser, disk import, missing-data behaviour and separate reference/observation loading.
- Lint and production build pass. The lazy 3D bundle still emits Vite's size advisory (~944 kB raw, ~252 kB gzip).
- Geometry comparison passes for 20 objects, 14 separated CFD obstacles, five local and 24 regional sensor locations/roles, matching CSV/SVG exports, and the 128×128 grid at 3.90625 m spacing.
- Import integration tests write into temporary directories and explicitly label test inputs. No test fixture is published as genuine CFD.

- Browser checks at 1440×900 and 390×844: all five local stations fit initially; regional extent controls show 8/16/24 stations; station readings follow the selected scenario; no horizontal page overflow. The 1/5/10 km circles are distances, not validated detection coverage.
- Reference/prediction/error and Structure presentation remain connected. Run prediction successfully returned the labelled Python IDW baseline using the new geometry. S3 selection is linked to the local monitor.
- Mobile interaction toggle, page scrolling, parent pause and offscreen animation suspension checked. The renderer reported about 120 fps in sampled active local-view intervals on this machine; this is not a cross-device benchmark. Reduced-motion and WebGL-fallback logic is retained; those browser modes were not re-emulated in this update.
- Current captures: [desktop city](evidence/city-500-desktop.jpg), [mobile city](evidence/city-500-mobile.jpg), [desktop regional view](evidence/regional-desktop.jpg), [mobile regional view](evidence/regional-mobile.jpg).

## Boundaries

Earlier screenshots documented in `IMPLEMENTATION.md` show the previous 400 m layout. The four captures linked above show this update. These inspections do not establish cross-device performance, CFD accuracy, ML accuracy, structural validity or regional warning lead times. Regional station symbols are interface markers above decorative terrain, not prescribed physical sensor heights.

Debdut owns the solver setup, mesh, physical assumptions, boundary conditions, padding and scientific checks. Structure mode uses illustrative unitless contours. The `CFD/` folder provides an input/output handoff and importer; it does not yet contain a validated canonical-geometry solver case connected to the app. The separately contributed `CFD/analysis.py` and root training CSV use a 2 km synthetic four-node setup; they are preserved unchanged, unexecuted in this update and not automatically integrated.
