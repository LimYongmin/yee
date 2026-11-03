import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { continents, countries, world, years } from "./data"

interface SensorReading {
  id: string
  value: number
  created_at: string
}

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<Uint8Array> | null
}

interface WebSerialApi {
  requestPort(): Promise<SerialPortLike>
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

function parseReading(row: unknown): SensorReading | null {
  if (!row || typeof row !== "object") return null
  const record = row as Record<string, unknown>
  const value = Number(record.value)
  if (
    (typeof record.id !== "number" && typeof record.id !== "string") ||
    !Number.isFinite(value) ||
    typeof record.created_at !== "string"
  ) {
    return null
  }
  return { id: String(record.id), value, created_at: record.created_at }
}

function mergeReadings(
  current: SensorReading[],
  incoming: SensorReading[],
): SensorReading[] {
  const byId = new Map(current.map((reading) => [reading.id, reading]))
  for (const reading of incoming) byId.set(reading.id, reading)
  return [...byId.values()]
    .sort(
      (a, b) =>
        Date.parse(a.created_at) - Date.parse(b.created_at) ||
        a.id.localeCompare(b.id, undefined, { numeric: true }),
    )
    .slice(-100)
}

function parseSerialValue(line: string) {
  const trimmed = line.trim()
  const rawMatch = trimmed.match(/\bRaw:\s*(-?(?:\d+(?:\.\d*)?|\.\d+))/i)
  const value = Number(rawMatch?.[1] ?? trimmed)
  return trimmed && Number.isFinite(value) ? value : null
}

const palette = [
  "#526B57",
  "#C47B58",
  "#D2A43B",
  "#738A9C",
  "#9A745F",
  "#718065",
]
const format = new Intl.NumberFormat("ko-KR")
function compact(value: number) {
  if (value >= 100_000) return `${(value / 100_000).toFixed(2)}억`
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}천만`
  return `${format.format(value)}천`
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

function SensorIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v7M8.5 7.5a5 5 0 1 0 7 0M12 17.5v2M7.2 17.3l-1.4 1.4M16.8 17.3l1.4 1.4" />
    </svg>
  )
}

export default function App() {
  const [view, setView] = useState<"sensor" | "population">("sensor")
  const [yearIndex, setYearIndex] = useState(4)
  const [query, setQuery] = useState("")
  const [region, setRegion] = useState("전체")
  const [selected, setSelected] = useState("인도")
  const [liveValues, setLiveValues] = useState<number[]>([])
  const [readings, setReadings] = useState<SensorReading[]>([])
  const [readingsStatus, setReadingsStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting")
  const [readingsError, setReadingsError] = useState("")
  const [isSerialConnected, setIsSerialConnected] = useState(false)
  const [serialError, setSerialError] = useState("")
  const serialPortRef = useRef<SerialPortLike | null>(null)
  const serialReaderRef =
    useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  useEffect(() => {
    if (!supabase) {
      setReadingsStatus("error")
      setReadingsError(
        "VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 설정되지 않았습니다.",
      )
      return
    }

    let active = true
    const channel = supabase
      .channel("readings-dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "readings" },
        (payload) => {
          const reading = parseReading(payload.new)
          if (!reading) return
          setReadings((current) => mergeReadings(current, [reading]))
        },
      )
      .subscribe((status, error) => {
        if (!active) return
        if (status === "SUBSCRIBED") {
          setReadingsStatus("connected")
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setReadingsStatus("error")
          setReadingsError(
            error?.message ??
              "Realtime 구독에 실패했습니다. Supabase에서 readings 테이블의 Realtime을 활성화해 주세요.",
          )
        }
      })

    const loadLatestReadings = async () => {
      const { data, error } = await supabase
        .from("readings")
        .select("id, value, created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(100)

      if (!active) return
      if (error) {
        setReadingsStatus("error")
        setReadingsError(`readings 조회 실패: ${error.message}`)
        return
      }

      const latestReadings = data
        .map(parseReading)
        .filter((reading): reading is SensorReading => reading !== null)
      setReadings((current) =>
        mergeReadings(current, latestReadings),
      )
      setReadingsError("")
    }

    void loadLatestReadings()
    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [])

  const enriched = useMemo(
    () =>
      countries.map((country) => ({
        ...country,
        value: country.values[yearIndex],
        change:
          ((country.values[4] - country.values[0]) / country.values[0]) * 100,
      })),
    [yearIndex],
  )

  const filtered = enriched
    .filter((item) => (region === "전체" ? true : item.continent === region))
    .filter((item) => item.name.includes(query))
    .sort((a, b) => b.value - a.value)

  const selectedCountry =
    enriched.find((item) => item.name === selected) ?? enriched[0]
  const aggregates = continents.map((continent, index) => ({
    name: continent,
    color: palette[index],
    value: enriched
      .filter((item) => item.continent === continent)
      .reduce((sum, item) => sum + item.value, 0),
  }))
  const maxAggregate = Math.max(...aggregates.map((item) => item.value))
  const maxRank = filtered[0]?.value ?? 1
  const worldChange = ((world[4] - world[0]) / world[0]) * 100

  const linePoints = world.map((value, index) => {
    const min = Math.min(...world)
    const max = Math.max(...world)
    return `${28 + index * 104},${20 + ((max - value) / (max - min)) * 118}`
  })

  const hasDatabaseData = readings.length > 0
  const useSerialData = isSerialConnected
  const displayedValues: number[] = useSerialData
    ? liveValues
    : readings.map((reading) => reading.value)
  const currentSensorValue = displayedValues.at(-1) ?? null
  const previousSensorValue =
    displayedValues.length > 1
      ? displayedValues[displayedValues.length - 2]
      : undefined
  const hasCurrentValue = currentSensorValue !== null
  const sensorDelta =
    previousSensorValue === undefined || currentSensorValue === null
      ? null
      : currentSensorValue - previousSensorValue
  const sensorMin = displayedValues.length ? Math.min(...displayedValues) : null
  const sensorMax = displayedValues.length ? Math.max(...displayedValues) : null
  const sensorScaleMax =
    sensorMax === null
      ? 1023
      : Math.max(1023, Math.ceil(sensorMax / 100) * 100)
  const sensorAverage = hasCurrentValue
    ? displayedValues.reduce((sum, value) => sum + value, 0) /
      displayedValues.length
    : undefined
  const latestReading = readings.at(-1)
  const lastUpdate = useSerialData
    ? "실시간 수신 중"
    : latestReading
      ? new Intl.DateTimeFormat("ko-KR", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(latestReading.created_at))
      : "데이터 없음"
  const sensorPoints = displayedValues.map((value, index) => {
    const x =
      displayedValues.length === 1
        ? 690
        : 62 + index * (628 / (displayedValues.length - 1))
    const y = 30 + ((sensorScaleMax - value) / sensorScaleMax) * 190
    return { x, y, value }
  })
  const sensorArea =
    sensorPoints.length > 1
      ? `M ${sensorPoints[0].x} 220 L ${sensorPoints.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${sensorPoints.at(-1)?.x} 220 Z`
      : ""
  const liveChartTicks = [0, 0.25, 0.5, 0.75, 1]
    .map((fraction) => {
      const index = Math.round((displayedValues.length - 1) * fraction)
      return {
        index,
        label: String(index + 1),
        x:
          displayedValues.length === 1
            ? 690
            : 62 + index * (628 / (displayedValues.length - 1)),
      }
    })
    .filter(
      (tick, index, ticks) =>
        displayedValues.length > 0 &&
        ticks.findIndex((candidate) => candidate.index === tick.index) ===
          index,
    )

  const disconnectSerial = async () => {
    const reader = serialReaderRef.current
    const port = serialPortRef.current
    serialReaderRef.current = null
    serialPortRef.current = null
    setIsSerialConnected(false)

    if (reader) {
      try {
        await reader.cancel()
      } catch (error) {
        setSerialError(`읽기 종료 오류: ${String(error)}`)
      } finally {
        reader.releaseLock()
      }
    }

    if (port) {
      try {
        await port.close()
      } catch (error) {
        setSerialError(`포트 종료 오류: ${String(error)}`)
      }
    }
  }

  const connectSerial = async () => {
    setSerialError("")
    const serial = (navigator as Navigator & { serial?: WebSerialApi }).serial
    if (!serial) {
      setSerialError(
        "이 브라우저는 Web Serial API를 지원하지 않습니다. Chrome 또는 Edge에서 열어주세요.",
      )
      return
    }

    let port: SerialPortLike | null = null
    try {
      port = await serial.requestPort()
      await port.open({ baudRate: 9600 })
      if (!port.readable) {
        throw new Error("선택한 시리얼 포트에서 데이터를 읽을 수 없습니다.")
      }

      const reader = port.readable.getReader()
      serialPortRef.current = port
      serialReaderRef.current = reader
      setLiveValues([])
      setIsSerialConnected(true)

      let buffer = ""
      const decoder = new TextDecoder()
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.trim()) continue
            const value = parseSerialValue(line)
            if (value === null) {
              setSerialError(`Raw 숫자를 찾을 수 없는 시리얼 값: ${line.trim()}`)
              continue
            }
            setSerialError("")
            setLiveValues((current) => [...current, value].slice(-100))
          }
        }
      } catch (error) {
        if (serialReaderRef.current === reader) {
          setSerialError(`시리얼 읽기 오류: ${String(error)}`)
        }
      } finally {
        if (serialReaderRef.current === reader) {
          serialReaderRef.current = null
          serialPortRef.current = null
          setIsSerialConnected(false)
          reader.releaseLock()
          try {
            await port.close()
          } catch (error) {
            setSerialError(`포트 종료 오류: ${String(error)}`)
          }
        }
      }
    } catch (error) {
      if (port) {
        try {
          await port.close()
        } catch (closeError) {
          setSerialError(`포트 종료 오류: ${String(closeError)}`)
          return
        }
      }
      if (error instanceof DOMException && error.name === "AbortError") return
      setSerialError(`시리얼 연결 오류: ${String(error)}`)
    }
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">D</span>
          <span>DATA NOTE</span>
        </div>
        <nav className="view-switch" aria-label="대시보드 화면 선택">
          <button
            className={view === "sensor" ? "active" : ""}
            onClick={() => setView("sensor")}
          >
            B10k 센서
          </button>
          <button
            className={view === "population" ? "active" : ""}
            onClick={() => setView("population")}
          >
            인구 데이터
          </button>
        </nav>
        <div
          className={`source-pill ${view === "sensor" && readingsStatus === "connected" ? "serial-online" : ""}`}
        >
          <span />{" "}
          {view === "sensor"
            ? readingsStatus === "connected"
              ? "Supabase · Realtime 연결"
              : readingsStatus === "connecting"
                ? "Supabase 연결 중"
                : "Supabase 연결 오류"
            : "KOSIS 국가통계포털"}
        </div>
      </header>

      {view === "sensor" ? (
        <>
          <section className="sensor-hero">
            <div>
              <p className="eyebrow">B10K SENSOR · LIVE MONITORING</p>
              <h1>
                나의 신호를
                <br />
                <em>한눈에</em> 읽다.
              </h1>
            </div>
            <p className="sensor-intro">
              B10k 센서(본인센서)에서 수집되는 값을 실시간으로 확인하고
              <br />
              시간의 흐름에 따른 작은 변화를 살펴보세요.
            </p>
          </section>

          <section className="sensor-dashboard">
            <div className="sensor-section-head">
              <div>
                <div className="live-status">
                  <i /> LIVE MONITOR
                </div>
                <h2>B10k 센서 현황</h2>
              </div>
              <div className="sensor-actions">
                <p>
                  마지막 업데이트 <strong>{lastUpdate}</strong>
                </p>
                <button
                  className="serial-connect-button"
                  onClick={
                    isSerialConnected ? disconnectSerial : connectSerial
                  }
                >
                  {isSerialConnected ? "연결 끊기" : "시리얼 연결"}
                </button>
              </div>
            </div>

            <div className="sensor-grid">
              <article className="current-sensor-card">
                <div className="sensor-card-top">
                  <span className="sensor-icon">
                    <SensorIcon />
                  </span>
                  <span className="sensor-status">
                    {useSerialData
                      ? "Raw 실시간 수신"
                      : readingsStatus === "connected"
                        ? "Supabase 실시간"
                        : readingsStatus === "connecting"
                          ? "데이터 연결 중"
                          : "연결 확인 필요"}
                  </span>
                </div>
                <p>현재 센서값</p>
                <strong>
                  {currentSensorValue === null
                    ? "—"
                    : currentSensorValue.toFixed(1)}
                  <small>INDEX</small>
                </strong>
                <div className="sensor-delta">
                  <b>
                    {sensorDelta === null
                      ? "—"
                      : `${sensorDelta >= 0 ? "+" : ""}${sensorDelta.toFixed(1)}`}
                  </b>
                  <span>
                    {previousSensorValue === undefined
                      ? "비교 데이터 대기 중"
                      : "이전 기록 대비"}
                  </span>
                </div>
                <div className="sensor-scale">
                  <div>
                    <i
                      style={{
                        width: `${Math.min(100, Math.max(0, ((currentSensorValue ?? 0) / sensorScaleMax) * 100))}%`,
                      }}
                    />
                  </div>
                  <span>0</span>
                  <span>
                    {useSerialData
                      ? `Raw 범위 0—${sensorScaleMax}`
                      : `센서 범위 0—${sensorScaleMax}`}
                  </span>
                  <span>{sensorScaleMax}</span>
                </div>
              </article>

              <article className="sensor-chart-card">
                <div className="chart-card-head">
                  <div>
                    <p className="eyebrow">SENSOR TREND</p>
                    <h3>최근 센서값</h3>
                  </div>
                  <span className="live-count">
                    최근 {displayedValues.length} / 100개
                  </span>
                </div>
                <svg
                  className="sensor-chart"
                  viewBox="0 0 730 278"
                  role="img"
                  aria-label={`Supabase readings 최근 ${displayedValues.length}개 값 변화`}
                >
                  <defs>
                    <linearGradient id="sensorArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d2a43b" stopOpacity=".28" />
                      <stop offset="100%" stopColor="#d2a43b" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[30, 77.5, 125, 172.5, 220].map((y, index) => (
                    <g key={y}>
                      <line
                        x1="62"
                        x2="690"
                        y1={y}
                        y2={y}
                        className="sensor-grid-line"
                      />
                      <text x="42" y={y + 4} textAnchor="end">
                        {Math.round(sensorScaleMax * (1 - index / 4))}
                      </text>
                    </g>
                  ))}
                  {sensorArea && (
                    <path d={sensorArea} className="sensor-area" />
                  )}
                  <polyline
                    points={sensorPoints
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ")}
                    className="sensor-line"
                  />
                  {sensorPoints.map((point, index) => (
                    <g key={`${index}-${point.value}`}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={index === sensorPoints.length - 1 ? 6 : 0}
                        className={
                          index === sensorPoints.length - 1
                            ? "sensor-current-dot"
                            : ""
                        }
                      />
                    </g>
                  ))}
                  {liveChartTicks.map((tick) => (
                      <text
                        key={tick.index}
                        x={tick.x}
                        y="260"
                        textAnchor="middle"
                      >
                        {tick.label}
                      </text>
                  ))}
                  {!displayedValues.length && (
                    <text
                      x="376"
                      y="130"
                      textAnchor="middle"
                      className="sensor-empty-label"
                    >
                      {readingsStatus === "connecting"
                        ? "데이터 불러오는 중..."
                        : readingsError
                          ? "데이터를 불러오지 못했습니다"
                          : "저장된 센서값이 없습니다"}
                    </text>
                  )}
                </svg>
                <p className="chart-caption">
                  {useSerialData
                    ? "브라우저 시리얼 · 최근 100개"
                    : "Supabase readings · Realtime 구독"}
                </p>
              </article>
            </div>

            <div className="sensor-summary">
              <div>
                <span>평균값</span>
                <strong>{sensorAverage?.toFixed(1) ?? "—"}</strong>
                <small>
                  {hasCurrentValue
                    ? `최근 ${displayedValues.length}개 기준`
                    : "데이터 없음"}
                </small>
              </div>
              <div>
                <span>최저값</span>
                <strong>{sensorMin?.toFixed(1) ?? "—"}</strong>
                <small>
                  {sensorMin === null
                    ? "데이터 없음"
                    : `#${displayedValues.indexOf(sensorMin) + 1}`}
                </small>
              </div>
              <div>
                <span>최고값</span>
                <strong>{sensorMax?.toFixed(1) ?? "—"}</strong>
                <small>
                  {sensorMax === null
                    ? "데이터 없음"
                    : `#${displayedValues.indexOf(sensorMax) + 1}`}
                </small>
              </div>
              <div className="connection-note">
                <span>DATA CONNECTION</span>
                <p className={serialError ? "serial-error" : ""}>
                  {serialError ||
                    (useSerialData
                      ? "9600 baud 시리얼 값을 표시 중입니다."
                      : readingsError ||
                        (readingsStatus === "connecting"
                          ? "Supabase readings 데이터를 조회 중입니다."
                          : readingsStatus === "connected"
                            ? hasDatabaseData
                              ? "최신 readings를 Realtime으로 구독 중입니다."
                              : "Realtime 연결됨 · 새 readings 대기 중입니다."
                            : "Supabase 연결 상태를 확인해 주세요."))}
                  <br />
                  {serialError
                    ? "포트와 아두이노의 줄바꿈 설정을 확인해주세요."
                    : readingsStatus === "error" && !useSerialData
                      ? "Supabase 설정과 Realtime publication을 확인해 주세요."
                      : "새 행은 자동으로 반영됩니다."}
                </p>
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="hero">
            <div>
              <p className="eyebrow">GLOBAL POPULATION OUTLOOK · 2096—2100</p>
              <h1>
                숫자 너머의
                <br />
                <em>인구 변화</em>를 읽다.
              </h1>
              <p className="hero-copy">
                통계청 국가별 장래인구 데이터를 바탕으로
                <br />
                다가올 세기의 흐름을 한눈에 살펴보세요.
              </p>
            </div>
            <div className="hero-stat">
              <span>2100년 세계 인구</span>
              <strong>
                {compact(world[4])}
                <small>명</small>
              </strong>
              <p className={worldChange < 0 ? "down" : "up"}>
                {worldChange.toFixed(2)}% <b>vs. 2096</b>
              </p>
            </div>
          </section>

          <section className="dashboard">
            <div className="section-heading">
              <div>
                <p className="eyebrow">WORLD AT A GLANCE</p>
                <h2>세계 인구는 정점을 지나고 있습니다</h2>
              </div>
              <div className="year-control" aria-label="연도 선택">
                {years.map((year, index) => (
                  <button
                    key={year}
                    className={yearIndex === index ? "active" : ""}
                    onClick={() => setYearIndex(index)}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>

            <div className="insight-grid">
              <article className="trend-card dark-card">
                <div className="card-label">
                  <span>01</span> 세계 인구 추이
                </div>
                <div className="trend-value">
                  {compact(world[yearIndex])}
                  <small>명</small>
                </div>
                <svg
                  className="line-chart"
                  viewBox="0 0 472 170"
                  role="img"
                  aria-label="2096년부터 2100년까지 세계 인구 추이"
                >
                  {[20, 59, 98, 137].map((y) => (
                    <line
                      key={y}
                      x1="28"
                      x2="444"
                      y1={y}
                      y2={y}
                      className="grid-line"
                    />
                  ))}
                  <polyline points={linePoints.join(" ")} />
                  {linePoints.map((point, index) => {
                    const [cx, cy] = point.split(",")
                    return (
                      <circle
                        key={point}
                        cx={cx}
                        cy={cy}
                        r={yearIndex === index ? 6 : 3}
                        className={yearIndex === index ? "current-dot" : ""}
                      />
                    )
                  })}
                  {years.map((year, index) => (
                    <text
                      key={year}
                      x={28 + index * 104}
                      y="164"
                      textAnchor="middle"
                    >
                      {year}
                    </text>
                  ))}
                </svg>
              </article>

              <article className="region-card">
                <div className="card-label">
                  <span>02</span> 권역별 인구 규모
                </div>
                <div className="bars">
                  {aggregates.map((item) => (
                    <button
                      key={item.name}
                      className="bar-row"
                      onClick={() => setRegion(item.name)}
                    >
                      <span className="bar-name">{item.name}</span>
                      <span className="bar-track">
                        <i
                          style={{
                            width: `${(item.value / maxAggregate) * 100}%`,
                            background: item.color,
                          }}
                        />
                      </span>
                      <strong>{compact(item.value)}</strong>
                    </button>
                  ))}
                </div>
                <p className="note">
                  단위: 명 · 원자료 단위(천 명)를 환산하여 표기
                </p>
              </article>
            </div>

            <div className="ranking-head">
              <div>
                <p className="eyebrow">COUNTRY EXPLORER</p>
                <h2>{years[yearIndex]}년 국가별 인구 순위</h2>
              </div>
              <label className="search">
                <SearchIcon />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="국가명 검색 (예: 인도, 미국)"
                  aria-label="국가명 검색"
                />
                {query && (
                  <button
                    className="search-clear"
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="검색어 지우기"
                  >
                    <CloseIcon />
                  </button>
                )}
              </label>
            </div>

            <div className="filter-line">
              <div className="filter-row">
                {["전체", ...continents].map((item) => (
                  <button
                    key={item}
                    className={region === item ? "active" : ""}
                    onClick={() => setRegion(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <p className="result-count">
                <strong>{filtered.length}</strong>개 국가
              </p>
            </div>

            <div className="country-layout">
              <div className="rank-list">
                {filtered.slice(0, 8).map((item, index) => (
                  <button
                    key={item.name}
                    className={`rank-row ${
                      selectedCountry?.name === item.name ? "selected" : ""
                    }`}
                    onClick={() => setSelected(item.name)}
                  >
                    <span className="rank-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className="flag-dot"
                      style={{
                        background: palette[continents.indexOf(item.continent)],
                      }}
                    />
                    <span className="country-name">
                      <strong>{item.name}</strong>
                      <small>{item.continent}</small>
                    </span>
                    <span className="rank-bar">
                      <i
                        style={{ width: `${(item.value / maxRank) * 100}%` }}
                      />
                    </span>
                    <span className="country-value">
                      {format.format(item.value * 1000)}
                      <small>명</small>
                    </span>
                    <span
                      className={item.change < 0 ? "change down" : "change up"}
                    >
                      {item.change > 0 ? "+" : ""}
                      {item.change.toFixed(1)}%
                    </span>
                    <ArrowIcon />
                  </button>
                ))}
                {!filtered.length && (
                  <div className="empty">검색 결과가 없습니다.</div>
                )}
              </div>

              {selectedCountry && (
                <aside className="spotlight">
                  <p className="eyebrow">SELECTED COUNTRY</p>
                  <div className="spotlight-title">
                    <div>
                      <h3>{selectedCountry.name}</h3>
                      <span>{selectedCountry.continent}</span>
                    </div>
                    <b>{continents.indexOf(selectedCountry.continent) + 1}</b>
                  </div>
                  <div className="spotlight-value">
                    <span>{years[yearIndex]}</span>
                    <strong>
                      {format.format(selectedCountry.values[yearIndex] * 1000)}
                      <small>명</small>
                    </strong>
                  </div>
                  <div className="mini-bars">
                    {selectedCountry.values.map((value, index) => (
                      <div key={years[index]}>
                        <i
                          style={{
                            height: `${35 + (value / Math.max(...selectedCountry.values)) * 65}%`,
                          }}
                        />
                        <span>{years[index]}</span>
                      </div>
                    ))}
                  </div>
                  <p className="spotlight-summary">
                    2096년 대비 2100년 인구가{" "}
                    <strong>
                      {Math.abs(selectedCountry.change).toFixed(1)}%
                    </strong>{" "}
                    {selectedCountry.change < 0 ? "감소할" : "증가할"}{" "}
                    전망입니다.
                  </p>
                </aside>
              )}
            </div>
          </section>
        </>
      )}

      <footer>
        <span>
          DATA NOTE ·{" "}
          {view === "sensor" ? "B10K SENSOR 01" : "POPULATION SERIES 01"}
        </span>
        <p>
          {view === "sensor"
            ? useSerialData
              ? "아두이노 Raw 실시간 데이터"
              : "Supabase readings · Realtime 구독"
            : "자료: 통계청 KOSIS · 국가별 장래인구 (2096—2100)"}
        </p>
      </footer>
    </main>
  )
}
