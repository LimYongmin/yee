import type { CSSProperties } from "react"
import { SENSOR_MAX, SENSOR_MIN } from "../product"

type SensorMoonProps = {
  value?: number
  power: boolean
}

export default function SensorMoon({ value, power }: SensorMoonProps) {
  const level =
    value === undefined
      ? 0
      : Math.min(
          1,
          Math.max(0, (value - SENSOR_MIN) / (SENSOR_MAX - SENSOR_MIN)),
        )
  const brightness = Math.round(level * 100)
  const formattedValue =
    value === undefined ? "—" : new Intl.NumberFormat("ko-KR").format(value)

  return (
    <section className="moon-section" aria-label="태양 상태">
      <svg
        className="sun-scene"
        viewBox="0 0 800 500"
        data-power={power ? "on" : "off"}
        style={{ "--sun-travel": `${(1 - level) * 280}px` } as CSSProperties}
        role="img"
        aria-label={`태양 높이 ${brightness}%, 전원 ${power ? "켜짐" : "꺼짐"}`}
      >
        <circle className="sensor-sun" cx="400" cy="110" r="70" />
        <rect className="sun-horizon" x="0" y="370" width="800" height="130" />
      </svg>
      <p className="t-value sensor-value">{formattedValue}</p>
    </section>
  )
}
