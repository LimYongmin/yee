import type { RealtimeChannel } from "@supabase/supabase-js"
import { DEVICE_ID, MAX_POINTS, SENSOR_MAX, SENSOR_MIN } from "../product"
import { db, IS_SUPABASE_PLACEHOLDER } from "./supabase"

export type Reading = { value: number; created_at: string }
export type Status = "disconnected" | "connecting" | "connected" | "error"

type ConnectOptions = {
  onInit: (rows: Reading[]) => void
  onReading: (row: Reading) => void
  onStatus: (status: Status) => void
}

export const isDemoMode = IS_SUPABASE_PLACEHOLDER

let channel: RealtimeChannel | null = null
let demoTimer: ReturnType<typeof setInterval> | null = null
let demoPower = false

function isReading(value: unknown): value is Reading {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    Number.isFinite(Number(row.value)) && typeof row.created_at === "string"
  )
}

export async function connectSensor({
  onInit,
  onReading,
  onStatus,
}: ConnectOptions): Promise<void> {
  await disconnectSensor()
  onStatus("connecting")

  if (isDemoMode || !db) {
    onStatus("connected")
    let step = 0
    demoTimer = setInterval(() => {
      const center = (SENSOR_MAX + SENSOR_MIN) / 2
      const amplitude = (SENSOR_MAX - SENSOR_MIN) * 0.42
      const value = Math.round(center + Math.sin(step / 6) * amplitude)
      step += 1
      onReading({ value, created_at: new Date().toISOString() })
    }, 500)
    return
  }

  const { data, error } = await db
    .from("sensor_readings")
    .select("value, created_at")
    .eq("device_id", DEVICE_ID)
    .order("created_at", { ascending: false })
    .limit(MAX_POINTS)

  if (error) {
    onStatus("error")
    return
  }

  onInit(data.filter(isReading).reverse())
  channel = db
    .channel(`sensor-${DEVICE_ID}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "sensor_readings",
        filter: `device_id=eq.${DEVICE_ID}`,
      },
      (payload) => {
        if (isReading(payload.new)) onReading(payload.new)
      },
    )
    .subscribe((subscriptionStatus) => {
      if (subscriptionStatus === "SUBSCRIBED") onStatus("connected")
      if (
        subscriptionStatus === "CHANNEL_ERROR" ||
        subscriptionStatus === "TIMED_OUT"
      ) {
        onStatus("error")
      }
    })
}

export async function disconnectSensor(): Promise<void> {
  if (demoTimer) {
    clearInterval(demoTimer)
    demoTimer = null
  }
  if (channel && db) {
    await db.removeChannel(channel)
    channel = null
  }
}

export async function setLedPower(on: boolean): Promise<boolean> {
  if (isDemoMode || !db) {
    demoPower = on
    return true
  }

  const { error } = await db
    .from("device_state")
    .update({ led_on: on, updated_at: new Date().toISOString() })
    .eq("device_id", DEVICE_ID)
  return !error
}

export async function loadPower(): Promise<boolean> {
  if (isDemoMode || !db) return demoPower

  const { data, error } = await db
    .from("device_state")
    .select("led_on")
    .eq("device_id", DEVICE_ID)
    .maybeSingle()
  return error ? false : Boolean(data?.led_on)
}
