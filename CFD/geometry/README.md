# Shared city and regional geometry — marswindnet-500-v3

`city.json` is the portable authored prototype specification, not a surveyed Mars site. The runtime representation is `public/data/city/marswindnet-layout-v2.json`; the legacy filename remains for compatibility, while its layout identity is **marswindnet-500-v3**. `npm run check:geometry` checks agreement.

This version supersedes `marswindnet-400-v2`, including its 400 × 400 m domain and sensor coordinates. It adds a 50 m border on each side by translating every existing object and S3 **+50 m east and +50 m north**. Footprint dimensions, heights, IDs and relative arrangement are unchanged. The original planning proposals outside this repository remain unchanged.

## Coordinates and shapes

All dimensions are metres. Origin `(0,0)` is the southwest corner of the **500 × 500 m local display domain**. x points east, y north and z up. The local ground is flat. Objects use footprint-centre coordinates. A circle uses its radius; an axis-aligned rectangle uses width along x and depth along y. Bounds are centre ± radius or half-width/half-depth.

Fourteen buildings/tanks are CFD obstacles. The two pads and four flat solar beds are visual-only. Sensors are virtual point locations, not physical mast designs. Null heights mean unspecified, not zero. Obstacle boundaries are solid. All 20 object footprints and five local stations lie inside the display domain; obstacles do not overlap and sensors do not occupy obstacles.

`obstacles.csv` contains 14 rows with shape, centre, dimensions, height and explicit bounds. `sensors.csv` contains exactly the five local stations:

| ID | x,y m | Role |
|---|---|---|
| S1 | 0,500 | Northwest input |
| S2 | 0,0 | Southwest input |
| S3 | 158,150 | Independent checkpoint |
| S4 | 500,500 | Northeast input |
| S5 | 500,0 | Southeast input |

Only S1/S2/S4/S5 enter `/predict`. Sample these physical corner coordinates explicitly from boundary/solver observations; do not clamp to an interior grid cell. S3 stays withheld for an independent local comparison.

## Display grid

```text
nx = ny = 128
dx = dy = 3.90625 m
index = j*nx+i
x = (i+0.5)*3.90625
y = (j+0.5)*3.90625
i,j = 0..127
```

Rows run west-to-east; successive rows move south-to-north. First/last centres are **1.953125 / 498.046875 m**. Every field array has 16,384 elements. In Three.js, positions map `(x,y,z)` to `(x,z,-y)` and horizontal velocity to `(u,0,-v)`.

2D CFD uses these projected footprints. Architectural dome roofs do not imply full 3D simulation. Debdut chooses the computational mesh, boundary conditions, physical assumptions and surrounding domain padding. The display grid is not a required solver mesh.

## Regional monitoring rings

`regional-sensors.csv` holds **24 additional points**, eight each at radius 1,000, 5,000 and 10,000 m about city centre `(250,250)` m. IDs are `R1-N`, `R1-NE`, ..., `R1-NW`, with `R5-*` and `R10-*` for the other rings. Bearings are degrees clockwise from north:

```text
x = 250 + radius*sin(bearing)
y = 250 + radius*cos(bearing)
```

Negative coordinates are valid outside the local display domain. Regional points have role `regional_observation` and `use_for_prediction: false`. They are separate from the five local sensors and do not enter the current local API. This is a proposed observation network, not established coverage, warning lead time or a regional weather model. A 20 km diameter network does not imply a 20 km CFD simulation.

## Maps and regeneration

- `city-map.svg`: north-up local footprints, IDs, sensors, metre axes, scale and obstacle legend.
- `regional-map.svg`: the three observation rings and the city inset, with axes in kilometres relative to city centre.

Run `npm run export-city` to derive maps/CSVs and labelled illustrative presets from the runtime geometry, followed by `npm run check:geometry`. The command skips real scenarios and never generates CFD results or measured observations. Keep the portable JSON and runtime representation consistent before exporting.
