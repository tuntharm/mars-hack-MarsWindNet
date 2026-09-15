"""Write TEST-ONLY full response/reference examples to an explicit output folder.

No production service imports this module. These constant fields demonstrate only
file transport; they are not a simulation, trained inference or valid wall flow.
"""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    request = json.loads(Path(__file__).with_name('request.json').read_text())
    dense = {
        'layout_id': request['layout_id'], 'scenario_id': request['scenario_id'],
        'grid': request['grid'], 'wind': request['wind'],
        'u_mps': [8.0] * 16384, 'v_mps': [0.0] * 16384, 'is_fluid': [True] * 16384,
        'provenance': 'TEST ONLY: constant numerical transport example; not CFD, trained ML or wall-resolved flow',
    }
    examples = {
        'request.json': request,
        'response.TEST-ONLY.json': {**dense, 'request_id': request['request_id'],
            'model': {'id': 'test-transport-example', 'version': '0'}, 'inference_ms': 0.0},
        'reference.TEST-ONLY.json': {**dense, 'kind': 'cfd-reference'},
    }
    for name, data in examples.items():
        path = args.output_dir / name
        with path.open('x') as target:
            json.dump(data, target, separators=(',', ':'), allow_nan=False)
        print(path)


if __name__ == '__main__':
    main()
