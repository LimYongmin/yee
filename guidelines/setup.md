# Setup

## 스택
- React + TypeScript + Tailwind (Make 기본). shadcn 등 UI 라이브러리 컴포넌트는 쓰지 않는다 (기본 라운드, 테두리, 카드가 규칙과 충돌). 아래 컴포넌트 규칙대로 직접 만든다.
- 센서값은 브라우저 내장 **Web Serial API**(`navigator.serial`)로 아두이노에서 직접 받는다. 추가 라이브러리 없음. Supabase는 쓰지 않는다.
- 차트는 라이브러리 없이 SVG로 그린다.

## 파일 구조
```
src/
  product.ts        // PRODUCT 슬롯 + DEVICE_ID + SENSOR_MIN/MAX
  lib/device.ts     // connectSensor, disconnectSensor, setLedPower, loadPower (Web Serial)
  components/       // ProductHeader, ConnectionControl, PowerToggle, SensorMoon, SensorChart
  App.tsx           // AppShell + state
styles/globals.css  // styles.md 내용
```

## product.ts
```ts
export const PRODUCT = { name: '', concept: '', description: '' };
export const DEVICE_ID = 'lamp-01';
// 아두이노 level(0.00~1.00)을 0~100 으로 바꿔서 표시한다.
export const SENSOR_MIN = 0;
export const SENSOR_MAX = 100;
export const MAX_POINTS = 60;
```

## 아두이노 시리얼 (변경 금지 — 아두이노 코드와 공유)
- 보드: Arduino Uno, USB 연결, **9600 baud**
- 아두이노는 50ms마다 한 줄씩 보낸다: `level,raw` + 줄바꿈
  ```
  # sensor FLEX
  # level,raw
  0.42,318.0
  0.43,315.0
  ```
  - `level` 0.00 ~ 1.00 — 화면이 쓰는 값. `SENSOR_MIN + level * (SENSOR_MAX - SENSOR_MIN)`으로 바꿔 반올림
  - `raw` 센서 원래 값 — 사람이 확인하는 용도, 화면에서는 쓰지 않는다
  - `#`으로 시작하는 줄, 빈 줄, 숫자가 아닌 줄은 무시
  - 줄이 잘려 들어올 수 있으므로 버퍼에 모아 `\n` 단위로 자른다
- 웹 → 아두이노: LED 토글 시 `P1\n`(켜짐) / `P0\n`(꺼짐). 아두이노가 읽지 않아도 문제없다
- 시리얼 포트는 한 번에 한 프로그램만 쓸 수 있다. 시리얼 모니터나 유니티가 열려 있으면 연결 실패

## lib/device.ts — 이 시그니처를 유지
```ts
type Reading = { value: number; created_at: string };   // created_at = 받은 시각 ISO 문자열
type Status = 'disconnected' | 'connecting' | 'connected' | 'error';

export const isDemoMode = false;   // 항상 false. 가상 데이터는 만들지 않는다

// navigator.serial.requestPort() → port.open({ baudRate: 9600 })
// 성공: onInit([]) → onStatus('connected') → 읽기 루프에서 한 줄마다 onReading
// navigator.serial 없음, 포트 선택 취소, 포트 열기 실패, 읽기 중 USB 분리 → onStatus('error')
connectSensor(opts: {
  onInit: (rows: Reading[]) => void;
  onReading: (row: Reading) => void;
  onStatus: (s: Status) => void;
}): Promise<void>;

disconnectSensor(): Promise<void>;          // reader.cancel() → port.close()
setLedPower(on: boolean): Promise<boolean>; // 화면 상태 저장 + 연결돼 있으면 P1/P0 전송. 항상 true
loadPower(): Promise<boolean>;              // 저장된 화면 상태 (처음엔 false)
```

## 지원 환경
- 데스크톱 크롬, 엣지만 Web Serial을 지원한다. iOS, 사파리, 파이어폭스는 불가
- HTTPS 또는 localhost에서만 동작
- Figma Make 미리보기(iframe)에서는 포트 접근이 막힐 수 있다. **Publish한 주소를 크롬에서 열어** 테스트한다
- Web Serial을 쓸 수 없으면 가상 데이터로 대신하지 말고 ConnectionControl을 error 상태로 둔다
