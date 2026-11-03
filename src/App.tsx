import { useMemo, useState } from "react"
import { continents, countries, world, years } from "./data"

const palette = [
  "#526B57",
  "#C47B58",
  "#D2A43B",
  "#738A9C",
  "#9A745F",
  "#718065",
]
const format = new Intl.NumberFormat("ko-KR")
const sensorSeries = {
  "24시간": {
    labels: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "현재"],
    values: [58.2, 60.8, 64.1, 68.9, 66.7, 70.1, 72.4],
  },
  "7일": {
    labels: ["월", "화", "수", "목", "금", "토", "오늘"],
    values: [61.5, 63.2, 60.8, 65.4, 68.1, 69.6, 72.4],
  },
  "30일": {
    labels: ["1일", "5일", "10일", "15일", "20일", "25일", "오늘"],
    values: [55.9, 59.7, 62.1, 60.4, 66.8, 69.2, 72.4],
  },
} as const

type SensorPeriod = keyof typeof sensorSeries

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
  const [sensorPeriod, setSensorPeriod] = useState<SensorPeriod>("24시간")
  const [yearIndex, setYearIndex] = useState(4)
  const [query, setQuery] = useState("")
  const [region, setRegion] = useState("전체")
  const [selected, setSelected] = useState("인도")

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

  const sensorData = sensorSeries[sensorPeriod]
  const sensorMin = Math.min(...sensorData.values)
  const sensorMax = Math.max(...sensorData.values)
  const sensorAverage =
    sensorData.values.reduce((sum, value) => sum + value, 0) /
    sensorData.values.length
  const sensorPoints = sensorData.values.map((value, index) => {
    const x = 62 + index * (628 / (sensorData.values.length - 1))
    const y = 30 + ((80 - value) / 30) * 190
    return { x, y, value, label: sensorData.labels[index] }
  })
  const sensorArea = `M ${sensorPoints[0].x} 232 L ${sensorPoints.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${sensorPoints.at(-1)?.x} 232 Z`

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
        <div className="source-pill">
          <span />{" "}
          {view === "sensor" ? "샘플 데이터 · 연결 대기" : "KOSIS 국가통계포털"}
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
              <p>
                마지막 업데이트 <strong>오늘 14:32</strong>
              </p>
            </div>

            <div className="sensor-grid">
              <article className="current-sensor-card">
                <div className="sensor-card-top">
                  <span className="sensor-icon">
                    <SensorIcon />
                  </span>
                  <span className="sensor-status">정상 범위</span>
                </div>
                <p>현재 센서값</p>
                <strong>
                  72.4<small>INDEX</small>
                </strong>
                <div className="sensor-delta">
                  <b>+2.3</b>
                  <span>1시간 전 대비</span>
                </div>
                <div className="sensor-scale">
                  <div>
                    <i style={{ width: "72.4%" }} />
                  </div>
                  <span>0</span>
                  <span>권장 범위 40—80</span>
                  <span>100</span>
                </div>
              </article>

              <article className="sensor-chart-card">
                <div className="chart-card-head">
                  <div>
                    <p className="eyebrow">SENSOR TREND</p>
                    <h3>시간에 따른 변화</h3>
                  </div>
                  <div className="period-control" aria-label="조회 기간">
                    {(Object.keys(sensorSeries) as SensorPeriod[]).map(
                      (period) => (
                        <button
                          key={period}
                          className={sensorPeriod === period ? "active" : ""}
                          onClick={() => setSensorPeriod(period)}
                        >
                          {period}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                <svg
                  className="sensor-chart"
                  viewBox="0 0 730 278"
                  role="img"
                  aria-label={`${sensorPeriod} B10k 센서값 변화`}
                >
                  <defs>
                    <linearGradient id="sensorArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d2a43b" stopOpacity=".28" />
                      <stop offset="100%" stopColor="#d2a43b" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[30, 93.3, 156.6, 220].map((y, index) => (
                    <g key={y}>
                      <line
                        x1="62"
                        x2="690"
                        y1={y}
                        y2={y}
                        className="sensor-grid-line"
                      />
                      <text x="42" y={y + 4} textAnchor="end">
                        {80 - index * 10}
                      </text>
                    </g>
                  ))}
                  <path d={sensorArea} className="sensor-area" />
                  <polyline
                    points={sensorPoints
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ")}
                    className="sensor-line"
                  />
                  {sensorPoints.map((point, index) => (
                    <g key={point.label}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={index === sensorPoints.length - 1 ? 6 : 3}
                        className={
                          index === sensorPoints.length - 1
                            ? "sensor-current-dot"
                            : ""
                        }
                      />
                      <text x={point.x} y="260" textAnchor="middle">
                        {point.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </article>
            </div>

            <div className="sensor-summary">
              <div>
                <span>평균값</span>
                <strong>{sensorAverage.toFixed(1)}</strong>
                <small>{sensorPeriod} 기준</small>
              </div>
              <div>
                <span>최저값</span>
                <strong>{sensorMin.toFixed(1)}</strong>
                <small>
                  {sensorData.labels[sensorData.values.indexOf(sensorMin)]}
                </small>
              </div>
              <div>
                <span>최고값</span>
                <strong>{sensorMax.toFixed(1)}</strong>
                <small>
                  {sensorData.labels[sensorData.values.indexOf(sensorMax)]}
                </small>
              </div>
              <div className="connection-note">
                <span>DATA CONNECTION</span>
                <p>
                  현재 예시 데이터로 표시 중입니다.
                  <br />
                  실제 센서 연동 후 자동으로 업데이트됩니다.
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
            ? "본 화면은 예시 데이터를 사용합니다."
            : "자료: 통계청 KOSIS · 국가별 장래인구 (2096—2100)"}
        </p>
      </footer>
    </main>
  )
}
