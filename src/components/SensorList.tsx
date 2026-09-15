import type { SensorSpec } from '../contracts/marswindnet.ts'

export function SensorList({
  sensors,
  selectedSensorId,
  onSensorSelect,
}: {
  sensors: SensorSpec[]
  selectedSensorId: string | null
  onSensorSelect: (id: string) => void
}) {
  return (
    <ul className="sensor-list">
      {sensors.map((sensor) => (
        <li key={sensor.id}>
          <button
            type="button"
            className={selectedSensorId === sensor.id ? 'is-selected' : ''}
            onClick={() => onSensorSelect(sensor.id)}
            aria-pressed={selectedSensorId === sensor.id}
          >
            <strong className="sensor-list__id">{sensor.id}</strong>
            <span className="sensor-list__identity"><span>{sensor.name}</span><span className="sensor-list__role">{sensor.model_role === 'independent_checkpoint' ? 'Independent checkpoint' : 'Prediction input'}</span></span>
            <span className="sensor-list__xy">
              {sensor.x_m} m E, {sensor.y_m} m N
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
