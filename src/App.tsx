import { useEffect, useState } from "react"
import ConnectionControl from "./components/ConnectionControl"
import PowerToggle from "./components/PowerToggle"
import ProductHeader from "./components/ProductHeader"
import SensorChart from "./components/SensorChart"
import SensorMoon from "./components/SensorMoon"
import {
  connectSensor,
  disconnectSensor,
  isDemoMode,
  loadPower,
  setLedPower,
  type Reading,
  type Status,
} from "./lib/device"
import { MAX_POINTS } from "./product"

export default function App() {
  const [status, setStatus] = useState<Status>("disconnected")
  const [power, setPower] = useState(false)
  const [readings, setReadings] = useState<Reading[]>([])

  useEffect(() => {
    let active = true

    void loadPower().then((initialPower) => {
      if (active) setPower(initialPower)
    })

    return () => {
      active = false
      void disconnectSensor()
    }
  }, [])

  const handleConnect = async () => {
    if (status === "connected") {
      await disconnectSensor()
      setStatus("disconnected")
      return
    }

    setStatus("connecting")
    await connectSensor({
      onInit: setReadings,
      onReading: (reading) => {
        setReadings((current) => [...current, reading].slice(-MAX_POINTS))
      },
      onStatus: setStatus,
    })
  }

  const handlePowerChange = async (nextPower: boolean) => {
    setPower(nextPower)
    const succeeded = await setLedPower(nextPower)
    if (!succeeded) setPower(!nextPower)
    return succeeded
  }

  return (
    <main className="app-shell">
      <ProductHeader demo={isDemoMode} />
      <SensorMoon value={readings.at(-1)?.value} power={power} />

      <div className="lower-grid">
        <section className="controls" aria-label="기기 제어">
          <ConnectionControl status={status} onToggle={handleConnect} />
          <PowerToggle power={power} onChange={handlePowerChange} />
        </section>
        <SensorChart readings={readings} />
      </div>
    </main>
  )
}
