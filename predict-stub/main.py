"""MarsWindNet prediction stub.

Inverse-distance interpolation from four corner observations onto fluid cells.
Not trained ML. Returns HTTP 500 when scenario_id ends with ``-fail``.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

LAYOUT_ID = "marswindnet-500-v3"
NX = 128
NY = 128
DX = 3.90625
FIRST = 1.953125
LAYOUT_PATH = Path(__file__).resolve().parents[1] / "public" / "data" / "city" / "marswindnet-layout-v2.json"

app = FastAPI(title="MarsWindNet predict stub", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Grid(BaseModel):
    nx: int
    ny: int
    dx_m: float
    dy_m: float


class Wind(BaseModel):
    inlet_u_mps: float
    inlet_v_mps: float


class Sensor(BaseModel):
    sensor_id: str
    x_m: float = Field(allow_inf_nan=False)
    y_m: float = Field(allow_inf_nan=False)
    u_mps: float = Field(allow_inf_nan=False)
    v_mps: float = Field(allow_inf_nan=False)


class PredictRequest(BaseModel):
    layout_id: str
    scenario_id: str
    grid: Grid
    wind: Wind
    sensors: list[Sensor] = Field(min_length=1)


class PredictResponse(BaseModel):
    layout_id: str
    scenario_id: str
    grid: Grid
    u_mps: list[float]
    v_mps: list[float]
    is_fluid: list[bool]
    provenance: str


def load_city() -> dict:
    return json.loads(LAYOUT_PATH.read_text())


def is_solid(city: dict, x: float, y: float) -> bool:
    for obstacle in city["obstacles"]:
        if obstacle.get("role") != "cfd":
            continue
        if obstacle["kind"] == "box":
            hx = obstacle["width_m"] / 2
            hy = obstacle["depth_m"] / 2
            if (
                obstacle["cx_m"] - hx <= x <= obstacle["cx_m"] + hx
                and obstacle["cy_m"] - hy <= y <= obstacle["cy_m"] + hy
            ):
                return True
        else:
            dx = x - obstacle["cx_m"]
            dy = y - obstacle["cy_m"]
            if dx * dx + dy * dy <= obstacle["radius_m"] ** 2:
                return True
    return False


@app.get("/")
def root() -> dict[str, str | bool]:
    return {
        "service": "MarsWindNet prediction stub",
        "ui": False,
        "message": "This is the MarsWindNet prediction stub, not the UI.",
        "vite_app": "http://127.0.0.1:5173",
        "live_inference": "POST /predict",
        "openapi": "/docs",
        "provenance": "stub-idw — not trained ML",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "provenance": "stub-idw — not trained ML"}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    if req.scenario_id.endswith("-fail"):
        raise HTTPException(status_code=500, detail="forced failure for retry testing")
    if req.layout_id != LAYOUT_ID:
        raise HTTPException(status_code=400, detail="layout_id mismatch")
    if req.grid.nx != NX or req.grid.ny != NY or req.grid.dx_m != DX or req.grid.dy_m != DX:
        raise HTTPException(status_code=400, detail="grid mismatch")

    city = load_city()
    expected = {s["id"]: s for s in city["sensors"] if s["use_for_prediction"]}
    if len(req.sensors) != len(expected) or {s.sensor_id for s in req.sensors} != set(expected):
        raise HTTPException(status_code=400, detail="Supply S1/S2/S4/S5 once each; S3 is a withheld checkpoint")
    for sensor in req.sensors:
        location = expected[sensor.sensor_id]
        if sensor.x_m != location["x_m"] or sensor.y_m != location["y_m"]:
            raise HTTPException(status_code=400, detail=f"Coordinates do not match {sensor.sensor_id}")
    u_mps: list[float] = []
    v_mps: list[float] = []
    is_fluid: list[bool] = []

    for j in range(NY):
        for i in range(NX):
            x = FIRST + i * DX
            y = FIRST + j * DX
            solid = is_solid(city, x, y)
            is_fluid.append(not solid)
            if solid:
                u_mps.append(0.0)
                v_mps.append(0.0)
                continue
            num_u = 0.0
            num_v = 0.0
            den = 0.0
            for sensor in req.sensors:
                d2 = (x - sensor.x_m) ** 2 + (y - sensor.y_m) ** 2
                weight = 1.0 / max(d2, 1e-6)
                num_u += weight * sensor.u_mps
                num_v += weight * sensor.v_mps
                den += weight
            u_mps.append(num_u / den)
            v_mps.append(num_v / den)

    return PredictResponse(
        layout_id=req.layout_id,
        scenario_id=req.scenario_id,
        grid=req.grid,
        u_mps=u_mps,
        v_mps=v_mps,
        is_fluid=is_fluid,
        provenance="stub-idw — not trained ML",
    )
