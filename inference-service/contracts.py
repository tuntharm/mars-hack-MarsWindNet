"""Dense steady-field boundary shared by the server and offline checker."""
from __future__ import annotations

import math
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

LAYOUT_ID = 'marswindnet-500-v3'
CELL_COUNT = 128 * 128
SENSORS = {'S1': (0, 500), 'S2': (0, 0), 'S4': (500, 500), 'S5': (500, 0)}


class StrictModel(BaseModel):
    model_config = ConfigDict(strict=True, extra='forbid', allow_inf_nan=False)


class Grid(StrictModel):
    nx: int = Field(ge=128, le=128)
    ny: int = Field(ge=128, le=128)
    dx_m: float = Field(ge=3.90625, le=3.90625)
    dy_m: float = Field(ge=3.90625, le=3.90625)


class Wind(StrictModel):
    inlet_u_mps: float
    inlet_v_mps: float


class Sensor(StrictModel):
    sensor_id: str
    x_m: float
    y_m: float
    u_mps: float
    v_mps: float


class PredictRequest(StrictModel):
    request_id: str = Field(min_length=1, max_length=128, pattern=r'^[A-Za-z0-9_.-]+$')
    layout_id: Literal['marswindnet-500-v3']
    scenario_id: str = Field(min_length=1, max_length=128, pattern=r'^[A-Za-z0-9_.-]+$')
    grid: Grid
    wind: Wind
    sensors: list[Sensor] = Field(min_length=4, max_length=4)

    @model_validator(mode='after')
    def corners(self):
        if {s.sensor_id for s in self.sensors} != set(SENSORS):
            raise ValueError('Exactly S1, S2, S4 and S5 are required; S3 is withheld')
        for sensor in self.sensors:
            if (sensor.x_m, sensor.y_m) != SENSORS[sensor.sensor_id]:
                raise ValueError('Sensor coordinates must match the canonical city corners')
        return self


class ModelIdentity(StrictModel):
    id: str = Field(min_length=1, max_length=128, pattern=r'^[A-Za-z0-9_.-]+$')
    version: str = Field(min_length=1, max_length=128, pattern=r'^[A-Za-z0-9_.-]+$')


class Limits(StrictModel):
    speed_min_mps: float = Field(ge=0)
    speed_max_mps: float = Field(ge=0)
    directions_deg: list[float] | None

    @model_validator(mode='after')
    def valid_limits(self):
        if self.speed_max_mps < self.speed_min_mps:
            raise ValueError('Invalid speed range')
        if self.directions_deg is not None and (not self.directions_deg or any(not 0 <= d < 360 for d in self.directions_deg)):
            raise ValueError('Directions must be a nonempty list of towards bearings in [0,360)')
        return self


class ReadyInfo(StrictModel):
    status: Literal['ready']
    model: ModelIdentity
    layout_id: Literal['marswindnet-500-v3']
    grid: Grid
    sensor_ids: list[str]
    prediction_kind: Literal['steady-field']
    limits: Limits

    @model_validator(mode='after')
    def exact_inputs(self):
        if len(self.sensor_ids) != 4 or set(self.sensor_ids) != set(SENSORS):
            raise ValueError('Model must support exactly the four canonical corner inputs')
        return self


class DenseResult(StrictModel):
    u_mps: list[float | None] = Field(min_length=CELL_COUNT, max_length=CELL_COUNT)
    v_mps: list[float | None] = Field(min_length=CELL_COUNT, max_length=CELL_COUNT)
    is_fluid: list[bool] = Field(min_length=CELL_COUNT, max_length=CELL_COUNT)
    provenance: str = Field(min_length=1, max_length=1000)

    @model_validator(mode='after')
    def valid_cells(self):
        if not any(self.is_fluid):
            raise ValueError('A field must contain at least one valid fluid cell')
        for u, v, fluid in zip(self.u_mps, self.v_mps, self.is_fluid):
            if fluid and (u is None or v is None):
                raise ValueError('Valid fluid cells must contain finite u and v')
        return self


class PredictResponse(DenseResult):
    request_id: str = Field(min_length=1, max_length=128, pattern=r'^[A-Za-z0-9_.-]+$')
    layout_id: Literal['marswindnet-500-v3']
    scenario_id: str = Field(min_length=1, max_length=128, pattern=r'^[A-Za-z0-9_.-]+$')
    grid: Grid
    wind: Wind
    model: ModelIdentity
    inference_ms: float = Field(ge=0)


def validate_capability(request: PredictRequest, info: ReadyInfo):
    """Validate each actual input; do not just check the displayed inlet speed."""
    vectors = [(request.wind.inlet_u_mps, request.wind.inlet_v_mps)]
    vectors.extend((s.u_mps, s.v_mps) for s in request.sensors)
    limits = info.limits
    for u, v in vectors:
        speed = math.hypot(u, v)
        if not limits.speed_min_mps - 1e-9 <= speed <= limits.speed_max_mps + 1e-9:
            raise ValueError('Wind is outside the model-supported speed range')
        if speed > 1e-10 and limits.directions_deg is not None:
            bearing = math.degrees(math.atan2(u, v)) % 360
            if not any(abs((bearing-d+180) % 360-180) < 1e-6 for d in limits.directions_deg):
                raise ValueError('Wind direction is not supported by this model')


def validate_response(payload: dict, request: PredictRequest) -> PredictResponse:
    response = PredictResponse.model_validate(payload)
    for key in ['request_id', 'layout_id', 'scenario_id', 'grid', 'wind']:
        if getattr(response, key) != getattr(request, key):
            raise ValueError(f'Response {key} does not match the submitted request')
    return response
