import type {
  CitySceneProps,
  PresentationMode,
  VelocityField,
  ViewMode,
} from '../contracts/marswindnet.ts'
import { finiteMax, speedValues, vectorErrorValues } from '../field/metrics.ts'

/** Structure consumes wind vectors, not the CFD comparison-error scalar. */
export function effectiveViewMode(presentation: PresentationMode, mode: ViewMode): ViewMode {
  return presentation === 'structure' && mode === 'error' ? 'prediction' : mode
}

export function activeField(
  mode: ViewMode,
  reference: VelocityField | null,
  prediction: VelocityField | null,
): VelocityField | null {
  if (mode === 'reference') return reference
  return prediction
}

export function deriveColour(
  mode: ViewMode,
  reference: VelocityField | null,
  prediction: VelocityField | null,
): CitySceneProps['colour'] {
  if (mode === 'error' && reference && prediction) {
    const values = vectorErrorValues(reference.u, reference.v, prediction.u, prediction.v)
    return {
      values,
      min: 0,
      max: Math.max(finiteMax(values), 0.01),
      kind: 'vector-error',
    }
  }

  const refSpeed = reference ? speedValues(reference.u, reference.v) : []
  const predSpeed = prediction ? speedValues(prediction.u, prediction.v) : []
  const sharedMax = Math.max(finiteMax(refSpeed), finiteMax(predSpeed), 0.01)
  const field = mode === 'prediction' ? prediction : reference
  const values = field ? speedValues(field.u, field.v) : []
  return {
    values,
    min: 0,
    max: sharedMax,
    kind: 'speed',
  }
}

export function canShowMode(
  mode: ViewMode,
  reference: VelocityField | null,
  prediction: VelocityField | null,
): boolean {
  if (mode === 'reference') return reference !== null
  if (mode === 'prediction') return prediction !== null
  return reference !== null && prediction !== null
}
