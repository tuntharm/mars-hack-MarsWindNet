"""Check a numerical prediction/reference against its submitted case offline."""
import argparse
import json
from pathlib import Path
from typing import Literal

from pydantic import ValidationError
from contracts import DenseResult, Grid, PredictRequest, Wind, validate_response


class Reference(DenseResult):
    kind: Literal['cfd-reference']
    layout_id: Literal['marswindnet-500-v3']
    scenario_id: str
    grid: Grid
    wind: Wind


def check(request_data, result_data, reference=False):
    request = PredictRequest.model_validate(request_data)
    if not reference:
        return validate_response(result_data, request)
    result = Reference.model_validate(result_data)
    for key in ('layout_id', 'scenario_id', 'grid', 'wind'):
        if getattr(result, key) != getattr(request, key):
            raise ValueError(f'Reference {key} does not match the submitted case')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('request', type=Path)
    parser.add_argument('result', type=Path)
    parser.add_argument('--reference', action='store_true')
    args = parser.parse_args()
    try:
        result = check(json.loads(args.request.read_text()), json.loads(args.result.read_text()), args.reference)
    except (ValidationError, ValueError, OSError) as error:
        # Files may contain private model output. Report error class, not input values.
        parser.exit(1, f'FAIL: {type(error).__name__}; identities, wind, grid, mask or numerical arrays do not match the contract.\n')
    print(f'PASS: {len(result.u_mps)} cells; matching case, grid, mask and finite valid-cell vectors. This does not validate CFD or ML accuracy.')


if __name__ == '__main__':
    main()
