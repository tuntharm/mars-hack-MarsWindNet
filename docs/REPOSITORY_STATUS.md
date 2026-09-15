# Repository status

Prepared for team collaboration on 15 September 2026.

## Available

- React/Vite application: shared 2D/3D field display, Mars/CFD/Structure presentations, linked sensor selection, camera controls and monitoring.
- Portable geometry under `CFD/geometry/`; runtime representation checked with `npm run check:geometry`.
- Two deterministic illustrative paired datasets with 16,384 rows each, plus exact-point fixture observations. See [dataset catalogue](DATASETS.md).
- Validated CFD reference file importer and a dedicated non-fixture UI scenario. No genuine CFD file is bundled.
- Separate Python IDW baseline behind `/predict`; no trained ML weights or inference model included.
- GitHub Actions configuration for tests, lint, build and geometry checks. Remote CI status must be checked on GitHub after push.

## Locally verified for this organisation

- 83 tests across 21 files pass, including CFD parser, disk import, missing-data behaviour and separate reference/observation loading.
- Lint and production build pass. The lazy 3D bundle still emits Vite's size advisory (~942 kB raw, ~252 kB gzip).
- Geometry comparison passes for 20 objects, five sensor locations/roles and the 128×128 grid.
- Import integration tests write into temporary directories and explicitly label test inputs. No test fixture is published as genuine CFD.

## Boundaries

The renderer's existing local desktop/mobile inspections belong to the preceding implementation work. Historical screenshots in `docs/evidence/` are labelled through `IMPLEMENTATION.md`; they do not depict every later material change. This repository preparation does not establish cross-device performance, CFD accuracy, ML accuracy or structural validity.

Debdut owns the solver setup, mesh, physical assumptions, boundary conditions, padding and scientific checks. Structure mode uses illustrative unitless contours. The `CFD/` folder provides an input/output handoff and importer; it does not yet contain a solver-specific executable case.
