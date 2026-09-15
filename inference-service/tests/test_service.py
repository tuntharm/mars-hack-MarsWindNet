import asyncio
import importlib
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def request():
    return {
        'request_id': 'test-request-1', 'layout_id': 'marswindnet-500-v3',
        'scenario_id': 'custom-wind',
        'grid': {'nx': 128, 'ny': 128, 'dx_m': 3.90625, 'dy_m': 3.90625},
        'wind': {'inlet_u_mps': 8.0, 'inlet_v_mps': 0.0},
        'sensors': [{'sensor_id': key, 'x_m': x, 'y_m': y, 'u_mps': 8.0, 'v_mps': 0.0}
                    for key, x, y in [('S1', 0, 500), ('S2', 0, 0), ('S4', 500, 500), ('S5', 500, 0)]],
    }


class FixtureAdapter:
    """Test-only numerical fixture. Never loaded by the default server."""
    def model_info(self):
        return {'status': 'ready', 'model': {'id': 'test-only', 'version': '1'},
                'layout_id': 'marswindnet-500-v3', 'grid': request()['grid'],
                'sensor_ids': ['S1', 'S2', 'S4', 'S5'], 'prediction_kind': 'steady-field',
                'limits': {'speed_min_mps': 0.0, 'speed_max_mps': 20.0, 'directions_deg': None}}

    def predict(self, payload):
        return {'u_mps': [8.0] * 16384, 'v_mps': [0.0] * 16384,
                'is_fluid': [True] * 16384, 'provenance': 'TEST ONLY: uniform adapter fixture, not CFD or ML'}


async def http(app, path, body=None, token='test-token'):
    messages = []
    raw = json.dumps(body).encode() if body is not None else b''
    headers = [(b'content-type', b'application/json')]
    if token is not None:
        headers.append((b'authorization', f'Bearer {token}'.encode()))
    async def receive():
        return {'type': 'http.request', 'body': raw, 'more_body': False}
    async def send(message):
        messages.append(message)
    await app({'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1',
               'method': 'POST' if body is not None else 'GET', 'path': path,
               'raw_path': path.encode(), 'root_path': '', 'query_string': b'',
               'headers': headers, 'server': ('test', 80), 'client': ('127.0.0.1', 0),
               'scheme': 'http'}, receive, send)
    status = next(m['status'] for m in messages if m['type'] == 'http.response.start')
    content = b''.join(m.get('body', b'') for m in messages if m['type'] == 'http.response.body')
    return status, json.loads(content)


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'MODEL_API_TOKEN': 'test-token'}, clear=True)
        self.env.start()
        self.service = importlib.import_module('service')
        self.service.get_runtime.cache_clear()

    def tearDown(self):
        self.service.get_runtime.cache_clear()
        self.env.stop()

    def call(self, path, body=None, token='test-token'):
        return asyncio.run(http(self.service.app, path, body, token))

    def ready(self, adapter=None):
        return patch.object(self.service, 'get_runtime', return_value=self.service.Runtime(adapter or FixtureAdapter()))

    def test_disconnected_does_not_generate_fixture(self):
        self.assertEqual(self.call('/model-info')[1]['status'], 'not-connected')
        self.assertEqual(self.call('/predict', request())[0], 503)

    def test_auth_and_missing_server_token_fail_closed(self):
        self.assertEqual(self.call('/model-info', token=None)[0], 401)
        self.assertEqual(self.call('/model-info', token='wrong')[0], 401)
        del os.environ['MODEL_API_TOKEN']
        self.assertEqual(self.call('/model-info', token=None)[0], 503)
        os.environ['ALLOW_INSECURE_LOCAL'] = '1'
        self.assertEqual(self.call('/model-info', token=None)[0], 200)

    def test_dense_success_and_metadata(self):
        with self.ready():
            status, output = self.call('/predict', request())
        self.assertEqual(status, 200)
        self.assertEqual(output['request_id'], 'test-request-1')
        self.assertEqual(output['model']['id'], 'test-only')
        self.assertEqual(output['wind'], request()['wind'])
        self.assertEqual(len(output['u_mps']), 16384)
        self.assertGreaterEqual(output['inference_ms'], 0)

    def test_sensors_layout_grid_and_identity_are_required(self):
        for mutate in [lambda r: r.pop('request_id'), lambda r: r.update(layout_id='other'),
                       lambda r: r['grid'].update(nx=25), lambda r: r['sensors'].pop(),
                       lambda r: r['sensors'][0].update(sensor_id='S3'),
                       lambda r: r['sensors'][0].update(x_m=1),
                       lambda r: r['sensors'][0].update(u_mps=True)]:
            payload = request(); mutate(payload)
            with self.ready():
                self.assertEqual(self.call('/predict', payload)[0], 422)

    def test_speed_direction_and_sensor_capabilities(self):
        adapter = FixtureAdapter()
        info = adapter.model_info()
        info['limits']['directions_deg'] = [0.0]
        adapter.model_info = lambda: info
        with self.ready(adapter):
            self.assertEqual(self.call('/predict', request())[0], 422)
        payload = request(); payload['sensors'][0]['u_mps'] = 25.0
        with self.ready():
            self.assertEqual(self.call('/predict', payload)[0], 422)

    def test_reject_centre_only_and_malformed_dense_outputs(self):
        for bad in [dict(u_mps=[8.0], v_mps=[0.0], is_fluid=[True], provenance='centre only'),
                    dict(u_mps=[None]*16384, v_mps=[0.0]*16384, is_fluid=[True]*16384, provenance='bad nulls'),
                    dict(u_mps=[8.0]*16384, v_mps=[0.0]*16384, is_fluid=[1]*16384, provenance='bad mask')]:
            adapter = FixtureAdapter(); adapter.predict = lambda payload, result=bad: result
            with self.ready(adapter):
                self.assertEqual(self.call('/predict', request())[0], 502)

    def test_nulls_only_in_solid_cells(self):
        adapter = FixtureAdapter(); output = adapter.predict(request())
        output['is_fluid'][0] = False; output['u_mps'][0] = None; output['v_mps'][0] = None
        adapter.predict = lambda payload: output
        with self.ready(adapter):
            self.assertEqual(self.call('/predict', request())[0], 200)

    def test_loader_is_cached_and_failures_are_redacted(self):
        with patch.dict(os.environ, {'MODEL_ADAPTER_MODULE': 'test_adapter', 'MODEL_ARTIFACT_DIR': '/tmp/model'}):
            module = type('Module', (), {'load_model': lambda artifact_dir: FixtureAdapter()})
            with patch.object(self.service.importlib, 'import_module', return_value=module) as loader:
                self.assertIs(self.service.get_runtime(), self.service.get_runtime())
                loader.assert_called_once()
        self.service.get_runtime.cache_clear()
        with patch.dict(os.environ, {'MODEL_ADAPTER_MODULE': 'test_adapter', 'MODEL_ARTIFACT_DIR': '/tmp/model'}):
            with patch.object(self.service.importlib, 'import_module', side_effect=RuntimeError('secret contents')):
                status, result = self.call('/model-info')
                self.assertEqual(status, 200)
                self.assertNotIn('secret', json.dumps(result))
                self.assertEqual(result['status'], 'not-connected')

    def test_nonfinite_vectors_and_oversized_requests(self):
        payload = request(); payload['wind']['inlet_u_mps'] = float('nan')
        with self.ready():
            self.assertEqual(self.call('/predict', payload)[0], 422)
        payload = request(); payload['scenario_id'] = 'a' * 40000
        self.assertEqual(self.call('/predict', payload)[0], 413)

    def test_model_capabilities_cannot_advertise_wrong_grid(self):
        adapter = FixtureAdapter(); info = adapter.model_info(); info['grid']['nx'] = 25
        adapter.model_info = lambda: info
        with self.assertRaises(ValueError):
            self.service.Runtime(adapter)

    def test_checker_rejects_mismatched_wind_and_request_identity(self):
        from check_contract import check
        with self.ready():
            _, output = self.call('/predict', request())
        self.assertEqual(len(check(request(), output).u_mps), 16384)
        output['request_id'] = 'different'
        with self.assertRaises(ValueError):
            check(request(), output)
        reference = {key: value for key, value in output.items()
                     if key not in ('request_id', 'model', 'inference_ms')}
        reference['kind'] = 'cfd-reference'
        self.assertEqual(len(check(request(), reference, True).u_mps), 16384)
        reference['wind']['inlet_u_mps'] = 9.0
        with self.assertRaises(ValueError):
            check(request(), reference, True)

    def test_identifiers_match_gateway_ascii_contract(self):
        from contracts import ModelIdentity
        for key in ('request_id', 'scenario_id'):
            for bad in ('has:colon', 'has space', 'café'):
                payload = request(); payload[key] = bad
                with self.ready():
                    self.assertEqual(self.call('/predict', payload)[0], 422)
        for key in ('id', 'version'):
            for bad in ('has:colon', 'has space', 'café'):
                data = {'id': 'model-1', 'version': 'v1.0'}; data[key] = bad
                with self.assertRaises(ValueError):
                    ModelIdentity.model_validate(data)

    def test_speed_boundary_allows_numerical_roundoff_only(self):
        payload = request()
        payload['wind']['inlet_u_mps'] = 20.0 + 5e-10
        with self.ready():
            self.assertEqual(self.call('/predict', payload)[0], 200)
        payload['wind']['inlet_u_mps'] = 20.0 + 1e-7
        with self.ready():
            self.assertEqual(self.call('/predict', payload)[0], 422)


if __name__ == '__main__':
    unittest.main()
