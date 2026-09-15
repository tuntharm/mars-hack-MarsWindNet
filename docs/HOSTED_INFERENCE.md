> Deferred: the current demo links to `/ml-gallery/index.html`; custom input and live generation controls are not exposed. The integration below is retained for later use.

# Hosted full-field prediction

The website calls its own `/api/model-info` and `/api/predict` routes. These Vercel Node functions forward to one separately hosted Python service. Model artifacts and backend credentials never enter the browser bundle. The existing centre-only `ML/` contribution and IDW stub do not qualify as the dense-field model.

## Configure the model connection

Deploy `inference-service/` on a Python/container host, provide its trusted model artifacts and adapter, then set these **server-only** environment variables in the Vercel project's Preview and Production environments:

| Variable | Value |
| --- | --- |
| `MODEL_API_URL` | HTTPS service base URL, without `/predict` or `/model-info` suffixes |
| `MODEL_API_TOKEN` | Backend bearer credential, matching the Python service |

Do not use `VITE_` prefixes for these variables. Do not put credentials in URLs. The gateway appends fixed endpoint paths, disallows redirects, strips unknown request fields and does not expose upstream exception text. A base path such as `https://host.example/inference` is supported.

An absent URL is an intentional disconnected state: `/api/model-info` returns HTTP 200 with `status: "not-connected"`; `/api/predict` returns HTTP 503. Invalid or unreachable services report unavailable. There is no synthetic fallback.

The public demo gateway permits visitors to submit valid model inputs; the server token authenticates the gateway to the model host, not visitors to the website. Apply project access or platform traffic limits when restricting model usage is necessary.

## Local execution with the same Vercel routes

Use Node 22.18 or newer. Run the Python adapter separately (see its README), then run Vercel's local development runtime from the repository root:

```sh
npm install
npx vercel login
npx vercel link
MODEL_API_URL=http://127.0.0.1:8001 npx vercel dev --listen 3000
```

Choose the dedicated `marswindnet` project when linking. The first two Vercel commands require your account/project access; do not substitute another project silently. Store any local backend token in an ignored environment file or inject it through your shell's secret-management workflow. Never commit it. For the disconnected UI, omit the environment assignment.

Open `http://localhost:3000` so frontend and API use the same origin. Plain `npm run dev` starts Vite only and does not itself run the `/api` functions. Local HTTP is allowed only for loopback service hosts in development; hosted Preview and Production require HTTPS and reject localhost.

The optional legacy stub is explicitly development-only: `VITE_PREDICTION_MODE=stub` and `VITE_PREDICT_URL=http://127.0.0.1:8000/predict`. This is for legacy presets, never the Custom wind model workflow. No deployed website should use that localhost endpoint.

## Model contract

The browser sends a unique `request_id`, `scenario_id`, `layout_id: "marswindnet-500-v3"`, the canonical grid, inlet `u/v`, and exactly four corner readings:

| Sensor | x (m) | y (m) |
| --- | ---: | ---: |
| S1 | 0 | 500 |
| S2 | 0 | 0 |
| S4 | 500 | 500 |
| S5 | 500 | 0 |

S3 is the independent interior checkpoint; regional stations are contextual observations. Neither enters the request. The browser's uniform demo input uses `u = speed sin(bearing)`, `v = speed cos(bearing)` with **towards** bearings clockwise from north.

The model must advertise `status: "ready"`, model `id/version`, the exact layout/grid, `sensor_ids`, `prediction_kind: "steady-field"` and limits (`speed_min_mps`, `speed_max_mps`, `directions_deg`, where null permits all bearings).

Successful prediction responses echo request/layout/scenario identity and wind, with model metadata, `inference_ms`, provenance, and `u_mps`, `v_mps`, `is_fluid` arrays of exactly 16,384 entries. Grid dimensions are 128 × 128 with `dx_m = dy_m = 3.90625`; cell centres start at 1.953125 m. `index = j*128+i`, west-to-east within each row, south-to-north between rows. Null velocity values require false mask entries. The shared response validator rejects invalid cells and inconsistent identity/grid data; the application combines validity with its canonical obstacle mask.

Requests must be below 64 KiB and responses below 4,000,000 bytes; streaming reads enforce both limits. The proxy aborts after 45 seconds and each Vercel function is configured for 60 seconds with cancellation enabled. Errors identify unsupported conditions, cancellation, timeout or invalid response without exposing backend credentials.

## Verification and deployment

```sh
npx vitest run api/_tests/gateway.test.ts
npm run lint
npm run build
```

Gateway tests cover fixed destinations, credentials, body limits, canonical inputs, readiness, malformed/stale fields, methods, timeouts and cancellation. They use mocked transport and **do not establish trained-model correctness or hosted availability**.

For a Vercel Preview, configure server variables, deploy the intended project and verify `/api/model-info` reports the expected ready model. Submit a known wind case in the UI; inspect its request ID/model version and both 2D/3D field views. Confirm browser requests use only the deployment's `/api` routes and that no model token appears in JavaScript assets. Compare the output against Debdut's known case before calling trained-model integration verified. With no compatible artifacts or hosted endpoint, deployment can demonstrate the disconnected state only.

Vercel references: [Node.js functions](https://vercel.com/docs/functions/runtimes/node-js), [Web handlers and cancellation](https://vercel.com/docs/functions/functions-api-reference), [duration configuration](https://vercel.com/docs/functions/configuring-functions/duration), [payload limits](https://vercel.com/docs/functions/limitations).
