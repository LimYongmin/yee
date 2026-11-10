import { useState } from "react"

type PowerToggleProps = {
  power: boolean
  onChange: (power: boolean) => Promise<boolean>
}

export default function PowerToggle({ power, onChange }: PowerToggleProps) {
  const [failed, setFailed] = useState(false)

  const togglePower = async () => {
    setFailed(false)
    const succeeded = await onChange(!power)
    setFailed(!succeeded)
  }

  return (
    <div>
      <div className="control-row">
        <div>
          <p className="t-label control-name">LED 전원</p>
          <p className="t-caption power-copy">{power ? "켜짐" : "꺼짐"}</p>
        </div>
        <button
          className="power-toggle"
          type="button"
          role="switch"
          aria-checked={power}
          aria-label="LED 전원"
          onClick={() => void togglePower()}
        >
          <span />
        </button>
      </div>
      {failed && (
        <p className="t-caption power-error" role="alert">
          전원 변경 실패, 다시 시도
        </p>
      )}
    </div>
  )
}
