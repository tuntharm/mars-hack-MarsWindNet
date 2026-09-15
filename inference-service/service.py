"""Hosted inference adapter. No model, training code, or fake fallback is bundled."""
from __future__ import annotations

from contextlib import asynccontextmanager
from functools import lru_cache
import hmac
import importlib
import json
import logging
import os
from pathlib import Path
import threading
import time

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from contracts import DenseResult, PredictRequest, ReadyInfo, validate_capability, validate_response

logger = logging.getLogger('marswindnet.inference')
MAX_REQUEST_BYTES = 32_768
MAX_RESPONSE_BYTES = 4_000_000


class Runtime:
    def __init__(self, adapter):
        self.adapter = adapter
        self.info = ReadyInfo.model_validate(adapter.model_info())
        # Adapters need not be thread safe. One model instance per worker.
        self.lock = threading.Lock()


@lru_cache(maxsize=1)
def get_runtime() -> Runtime | None:
    module_name = os.environ.get('MODEL_ADAPTER_MODULE')
    artifact_dir = os.environ.get('MODEL_ARTIFACT_DIR')
    if not module_name or not artifact_dir:
        return None
    try:
        module = importlib.import_module(module_name)
        adapter = module.load_model(Path(artifact_dir))
        return Runtime(adapter)
    except Exception as error:
        # Do not leak exception messages, paths, artifact contents, or credentials.
        logger.error('Model adapter unavailable (%s)', type(error).__name__)
        return None


@asynccontextmanager
async def lifespan(app):
    get_runtime()
    yield


app = FastAPI(title='MarsWindNet dense-field inference', version='1.0.0',
              lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


def authorize(authorization: str | None = Header(default=None)):
    token = os.environ.get('MODEL_API_TOKEN')
    if not token:
        if os.environ.get('ALLOW_INSECURE_LOCAL') == '1':
            return
        raise HTTPException(status_code=503, detail='Model service authentication is not configured')
    expected = f'Bearer {token}'
    if authorization is None or not hmac.compare_digest(authorization.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail='Unauthorized')


@app.middleware('http')
async def bounded_body(request: Request, call_next):
    # Bound before JSON parsing; reject chunked bodies as soon as the limit is exceeded.
    size = 0
    parts = []
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_REQUEST_BYTES:
            return JSONResponse(status_code=413, content={'detail': 'Request exceeds 32 KiB'})
        parts.append(chunk)
    request._body = b''.join(parts)
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.exception_handler(RequestValidationError)
async def request_validation_error(request, error):
    # Pydantic's default error can echo untrusted input. Return only field locations.
    return JSONResponse(status_code=422, content={'detail': 'Invalid prediction request',
        'fields': ['.'.join(map(str, e['loc'])) for e in error.errors()]})


@app.get('/model-info', dependencies=[Depends(authorize)])
def model_info():
    runtime = get_runtime()
    if runtime is None:
        return {'status': 'not-connected', 'message': 'No compatible full-field model is connected'}
    return runtime.info.model_dump()


@app.post('/predict', dependencies=[Depends(authorize)])
def predict(request: PredictRequest):
    runtime = get_runtime()
    if runtime is None:
        raise HTTPException(status_code=503, detail='No compatible full-field model is connected')
    try:
        validate_capability(request, runtime.info)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    started = time.perf_counter()
    try:
        with runtime.lock:
            result = DenseResult.model_validate(runtime.adapter.predict(request.model_dump()))
        response = validate_response({**result.model_dump(),
            'request_id': request.request_id, 'layout_id': request.layout_id,
            'scenario_id': request.scenario_id, 'grid': request.grid.model_dump(),
            'wind': request.wind.model_dump(), 'model': runtime.info.model.model_dump(),
            'inference_ms': (time.perf_counter()-started)*1000}, request)
        payload = response.model_dump()
        if len(json.dumps(payload, separators=(',', ':'), allow_nan=False).encode()) > MAX_RESPONSE_BYTES:
            raise ValueError('Response too large')
        return JSONResponse(content=payload)
    except (ValidationError, ValueError, TypeError):
        raise HTTPException(status_code=502, detail='Model returned an invalid dense field') from None
    except Exception as error:
        logger.error('Model inference failed (%s)', type(error).__name__)
        raise HTTPException(status_code=502, detail='Model inference failed') from None
