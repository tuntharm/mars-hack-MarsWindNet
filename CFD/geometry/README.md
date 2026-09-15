# Shared city geometry

This portable folder contains the agreed **marswindnet-400-v2** source and its reference exports. It supersedes the older 160×100 m proposal and the v1 interior sensor arrangement. The reference image supplied the arrangement; dimensions are authored prototype dimensions, not surveyed Mars data.

- `city.json`: canonical 20 objects and five virtual sensors; explicit obstacle/visual-only flags, dimensions and heights.
- `obstacles.csv`: 14 CFD footprints, including rectangle bounds and architectural heights.
- `sensors.csv`: exact point coordinates.
- `city-map.svg`: north-up labelled map derived from the canonical JSON. The displayed 25 m guide grid differs from the 3.125 m sampling grid.

All units are metres. Origin southwest; x east, y north, z up. Rectangles are axis-aligned, centre-based, width along x and depth along y. Bounds are centre ± half-dimension. Circles use centre and radius. Inside or on the closed footprint is solid. Sensor markers have no physical dimensions. Solar heights are unspecified/null; pads are zero-height markings.

Domain: `[0,400] × [0,400]`; flat. Display samples: 128×128 cell centres, spacing 3.125 m, `index=j*128+i`, `x=(i+.5)*3.125`, `y=(j+.5)*3.125`. Index 0 is southwest; rows advance eastward then northward. First/last centres: 1.5625/398.4375 m.

The 2D solver uses projected footprints; dome architecture does not imply full 3D flow. Debdut chooses computational mesh, physical properties, boundary conditions and surrounding padding. See [CFD instructions](../README.md).

The app's single runtime city is `public/data/city/marswindnet-layout-v2.json`, in its existing app schema. `npm run check:geometry` checks its layout, grid, positions, dimensions and sensor roles against this source. Change geometry only through an agreed new version and update both together.
