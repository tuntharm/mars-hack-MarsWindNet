# Dense-field model handoff

This service connects a trusted, separately supplied **full-field** model to MarsWindNet. No trained artifact is bundled, and no fake or centre-only fallback is connected. Existing `ML/` work remains independent. By default `/model-info` reports `not-connected` and `/predict` returns 503.

## Contract Debdut must satisfy

- Geometry is `marswindnet-500-v3`: 500 × 500 m, southwest origin, x east, y north. Use `../CFD/geometry/` as the geometry source.
- Four input observations: S1 `(0,500)`, S2 `(0,0)`, S4 `(500,500)`, S5 `(500,0)`. S3 and the 24 regional stations are excluded. The adapter controls feature ordering explicitly by sensor ID; do not rely on incoming list order.
- Output is a **steady** horizontal vector field: 128 × 128 cell centres, `dx=dy=3.90625 m`; first centre `(1.953125,1.953125)`.
- Array index `j*128+i`: west-to-east within a row, south-to-north between rows. `u_mps` is eastward, `v_mps` northward. Each array has exactly 16,384 values; no vertical component.
- Return an explicit boolean `is_fluid` mask. Numeric values must be finite; `null` is accepted only in false-mask cells. The frontend additionally applies the canonical obstacle mask, so supplied true cells cannot paint through buildings. The model must still supply a physically appropriate mask; the service does not solve wall conditions.
- Wind bearings are **towards**, clockwise from north: `u=speed*sin(bearing)`, `v=speed*cos(bearing)`. For 8 m/s west → east, all simulated corner readings are `(8,0)`, not zero at downstream corners. Real observations may differ between corners.
- Supply supported speed bounds and either explicit supported towards bearings or `null` for all directions. Every inlet and corner vector is checked. Zero speed has no meaningful direction and bypasses direction checks.

Send model artifacts, a trusted loader, inference-only requirements, feature ordering/preprocessing, the training geometry and supported input conditions, and one known input/output case. A city-centre scalar cannot be repeated into a field to meet this contract.

Request IDs, scenario IDs, model IDs and model versions are 1–128 ASCII letters, digits, underscores, periods or hyphens (`[A-Za-z0-9_.-]`). Spaces, colons and Unicode identifiers are rejected consistently with the gateway. Speed bounds allow a 1e-9 m/s numerical tolerance for directional floating-point conversion.

## Trusted adapter interface

Deploy a Python module named by `MODEL_ADAPTER_MODULE`. It exports:

```python
def load_model(artifact_dir: pathlib.Path):
    # Load trusted artifacts ONCE here; return an adapter object.
    # Do not train, download, or accept code/artifact paths from requests.
    return adapter
```

The adapter has two synchronous methods:

```python
adapter.model_info() -> {
  "status": "ready",
  "model": {"id": "your-field-model", "version": "your-artifact-version"},
  "layout_id": "marswindnet-500-v3",
  "grid": {"nx": 128, "ny": 128, "dx_m": 3.90625, "dy_m": 3.90625},
  "sensor_ids": ["S1", "S2", "S4", "S5"],
  "prediction_kind": "steady-field",
  "limits": {"speed_min_mps": 0, "speed_max_mps": 20, "directions_deg": None}
}

adapter.predict(request_dict) -> {
  "u_mps": [...], "v_mps": [...], "is_fluid": [...],
  "provenance": "Model/artifact and preprocessing description"
}
```

The values in this metadata example are illustrative; publish the model's actual supported range. Return ordinary Python lists, floats and bools (`array.tolist()` if needed). Preprocess and order input features inside the adapter. Never infer through masked centre samples. The service adds matching request/layout/scenario/grid/wind identities, model identity and measured `inference_ms` to the response. It validates dense output and caps the serialized response at 4,000,000 bytes. Inference is serialized per worker for adapters that are not thread safe. Each worker loads its own instance at startup. Restart after changing adapters or artifacts; a failed load remains disconnected until restart.

## Run locally

From this directory:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
ALLOW_INSECURE_LOCAL=1 .venv/bin/uvicorn service:app --host 127.0.0.1 --port 8080
```

This explicit loopback-only development mode starts disconnected. For an actual model, configure `MODEL_ADAPTER_MODULE`, `MODEL_ARTIFACT_DIR` and Python's module path. Add only the model's inference dependencies to the image/environment. No training libraries are installed here.

The website calls its Vercel `/api/model-info` and `/api/predict` functions. Configure Vercel's **server-only** `MODEL_API_URL` to this service's base HTTPS URL and `MODEL_API_TOKEN` to the service's token. The gateway forwards `Authorization: Bearer <token>`. Never use `VITE_` for these secrets. No cross-origin browser access is needed.

## Container / hosting

```sh
docker build -t marswindnet-inference .
```

The image includes only service code and runtime dependencies, runs as UID 10001, and listens on 8080. Mount trusted adapter code read-only at `/adapter` and artifacts read-only at `/models`; set `MODEL_ADAPTER_MODULE`, `MODEL_ARTIFACT_DIR=/models`, and a nonempty `MODEL_API_TOKEN` using the host's secret configuration. Keep `ALLOW_INSECURE_LOCAL` unset in deployment. Both endpoints require the token; missing auth configuration fails closed. Put HTTPS termination and platform request/rate limits in front of the service. A Vercel timeout stops waiting but cannot interrupt arbitrary synchronous inference already executing; choose model size/hardware that responds inside the gateway's 45-second deadline. The backend does not start training or retry inference silently.

## Examples and offline contract checker

`examples/request.json` is a complete west → east request. Generate full **test-only** transport response/reference files into a temporary directory:

```sh
.venv/bin/python examples/generate_example.py --output-dir /tmp/marswindnet-contract-example
.venv/bin/python check_contract.py /tmp/marswindnet-contract-example/request.json /tmp/marswindnet-contract-example/response.TEST-ONLY.json
.venv/bin/python check_contract.py /tmp/marswindnet-contract-example/request.json /tmp/marswindnet-contract-example/reference.TEST-ONLY.json --reference
```

The generator refuses to overwrite files. Its uniform all-fluid arrays only demonstrate serialization, not geometry, CFD or model performance; neither the production service nor the website imports them. Replace them with actual numerical results for model validation.

A CFD reference contains `kind: "cfd-reference"`, matching `layout_id`, `scenario_id`, `grid` and `wind`, and the same three arrays plus truthful `provenance`. It has no model identity or inference time. Keep `scenario_id: "custom-wind"` for website custom cases. A plot screenshot cannot enable numerical error calculation. The checker verifies transport compatibility and exact case identities/wind, not scientific accuracy. Run it against each genuine known input/output case before handing the model to the frontend team.

## Verification

```sh
.venv/bin/python -m unittest discover -s tests -v
```

Tests use an explicit in-memory fixture adapter and exercise ASGI requests, auth, metadata, malformed outputs, unsupported inputs, disconnected behavior and cached model loading. No network model or genuine engineering result is required or claimed. Hosted/Vercel acceptance remains dependent on supplied artifacts and endpoint credentials.
