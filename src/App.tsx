import { useMemo, useState } from 'react'
import { continents, countries, world, years } from './data'

const palette = ['#526B57', '#C47B58', '#D2A43B', '#738A9C', '#9A745F', '#718065']
const format = new Intl.NumberFormat('ko-KR')

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

export default function App() {
  const [yearIndex, setYearIndex] = useState(4)
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('전체')
  const [selected, setSelected] = useState('인도')

  const enriched = useMemo(
    () =>
      countries.map((country) => ({
        ...country,
        value: country.values[yearIndex],
        change: ((country.values[4] - country.values[0]) / country.values[0]) * 100,
      })),
    [yearIndex],
  )

  const filtered = enriched
    .filter((item) => (region === '전체' ? true : item.continent === region))
    .filter((item) => item.name.includes(query))
    .sort((a, b) => b.value - a.value)

  const selectedCountry = enriched.find((item) => item.name === selected) ?? enriched[0]
  const aggregates = continents.map((continent, index) => ({
    name: continent,
    color: palette[index],
    value: enriched.filter((item) => item.continent === continent).reduce((sum, item) => sum + item.value, 0),
  }))
  const maxAggregate = Math.max(...aggregates.map((item) => item.value))
  const maxRank = filtered[0]?.value ?? 1
  const worldChange = ((world[4] - world[0]) / world[0]) * 100

  const linePoints = world.map((value, index) => {
    const min = Math.min(...world)
    const max = Math.max(...world)
    return `${28 + index * 104},${20 + ((max - value) / (max - min)) * 118}`
  })

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">D</span>
          <span>DATA NOTE</span>
        </div>
        <div className="source-pill"><span /> KOSIS 국가통계포털</div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">GLOBAL POPULATION OUTLOOK · 2096—2100</p>
          <h1>숫자 너머의<br /><em>인구 변화</em>를 읽다.</h1>
          <p className="hero-copy">통계청 국가별 장래인구 데이터를 바탕으로<br />다가올 세기의 흐름을 한눈에 살펴보세요.</p>
        </div>
        <div className="hero-stat">
          <span>2100년 세계 인구</span>
          <strong>{compact(world[4])}<small>명</small></strong>
          <p className={worldChange < 0 ? 'down' : 'up'}>{worldChange.toFixed(2)}% <b>vs. 2096</b></p>
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
              <button key={year} className={yearIndex === index ? 'active' : ''} onClick={() => setYearIndex(index)}>
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="insight-grid">
          <article className="trend-card dark-card">
            <div className="card-label"><span>01</span> 세계 인구 추이</div>
            <div className="trend-value">{compact(world[yearIndex])}<small>명</small></div>
            <svg className="line-chart" viewBox="0 0 472 170" role="img" aria-label="2096년부터 2100년까지 세계 인구 추이">
              {[20, 59, 98, 137].map((y) => <line key={y} x1="28" x2="444" y1={y} y2={y} className="grid-line" />)}
              <polyline points={linePoints.join(' ')} />
              {linePoints.map((point, index) => {
                const [cx, cy] = point.split(',')
                return <circle key={point} cx={cx} cy={cy} r={yearIndex === index ? 6 : 3} className={yearIndex === index ? 'current-dot' : ''} />
              })}
              {years.map((year, index) => <text key={year} x={28 + index * 104} y="164" textAnchor="middle">{year}</text>)}
            </svg>
          </article>

          <article className="region-card">
            <div className="card-label"><span>02</span> 권역별 인구 규모</div>
            <div className="bars">
              {aggregates.map((item) => (
                <button key={item.name} className="bar-row" onClick={() => setRegion(item.name)}>
                  <span className="bar-name">{item.name}</span>
                  <span className="bar-track">
                    <i style={{ width: `${(item.value / maxAggregate) * 100}%`, background: item.color }} />
                  </span>
                  <strong>{compact(item.value)}</strong>
                </button>
              ))}
            </div>
            <p className="note">단위: 명 · 원자료 단위(천 명)를 환산하여 표기</p>
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
              <button className="search-clear" type="button" onClick={() => setQuery('')} aria-label="검색어 지우기">
                <CloseIcon />
              </button>
            )}
          </label>
        </div>

        <div className="filter-line">
          <div className="filter-row">
            {['전체', ...continents].map((item) => (
              <button key={item} className={region === item ? 'active' : ''} onClick={() => setRegion(item)}>{item}</button>
            ))}
          </div>
          <p className="result-count"><strong>{filtered.length}</strong>개 국가</p>
        </div>

        <div className="country-layout">
          <div className="rank-list">
            {filtered.slice(0, 8).map((item, index) => (
              <button key={item.name} className={`rank-row ${selectedCountry?.name === item.name ? 'selected' : ''}`} onClick={() => setSelected(item.name)}>
                <span className="rank-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="flag-dot" style={{ background: palette[continents.indexOf(item.continent)] }} />
                <span className="country-name"><strong>{item.name}</strong><small>{item.continent}</small></span>
                <span className="rank-bar"><i style={{ width: `${(item.value / maxRank) * 100}%` }} /></span>
                <span className="country-value">{format.format(item.value * 1000)}<small>명</small></span>
                <span className={item.change < 0 ? 'change down' : 'change up'}>{item.change > 0 ? '+' : ''}{item.change.toFixed(1)}%</span>
                <ArrowIcon />
              </button>
            ))}
            {!filtered.length && <div className="empty">검색 결과가 없습니다.</div>}
          </div>

          {selectedCountry && (
            <aside className="spotlight">
              <p className="eyebrow">SELECTED COUNTRY</p>
              <div className="spotlight-title">
                <div><h3>{selectedCountry.name}</h3><span>{selectedCountry.continent}</span></div>
                <b>{continents.indexOf(selectedCountry.continent) + 1}</b>
              </div>
              <div className="spotlight-value">
                <span>{years[yearIndex]}</span>
                <strong>{format.format(selectedCountry.values[yearIndex] * 1000)}<small>명</small></strong>
              </div>
              <div className="mini-bars">
                {selectedCountry.values.map((value, index) => (
                  <div key={years[index]}>
                    <i style={{ height: `${35 + (value / Math.max(...selectedCountry.values)) * 65}%` }} />
                    <span>{years[index]}</span>
                  </div>
                ))}
              </div>
              <p className="spotlight-summary">
                2096년 대비 2100년 인구가 <strong>{Math.abs(selectedCountry.change).toFixed(1)}%</strong> {selectedCountry.change < 0 ? '감소할' : '증가할'} 전망입니다.
              </p>
            </aside>
          )}
        </div>
      </section>

      <footer>
        <span>DATA NOTE · POPULATION SERIES 01</span>
        <p>자료: 통계청 KOSIS · 국가별 장래인구 (2096—2100)</p>
      </footer>
    </main>
  )
}
