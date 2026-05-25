const API_BASE = 'http://127.0.0.1:8000/api/plc'

export type PLCStatus = {
  connected: boolean
  host: string
  port: number
  latency_ms: number | null
}

export type PLCSensorReading = {
  label: string
  value: string
  unit: string
  trend: 'stable' | 'rising' | 'falling'
}

export type PLCRollerState = {
  id: string
  name: string
  speed: number
  load: number
  status: 'ok' | 'warning' | 'error'
}

export type PLCWidthState = {
  connected: boolean
  gap: number
  offset: number
}

async function fetchJson<T>(path: string, init?: RequestInit, timeoutMs = 500): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`PLC fetch failed: ${response.status} ${response.statusText} ${errorBody}`)
    }
    return response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

export async function getPlcStatus(): Promise<PLCStatus> {
  try {
    return await fetchJson<PLCStatus>(`${API_BASE}/status`)
  } catch (error) {
    return {
      connected: false,
      host: '192.168.1.5',
      port: 502,
      latency_ms: null,
    }
  }
}

export async function getPlcSensors(): Promise<PLCSensorReading[]> {
  try {
    const result = await fetchJson<{ connected: boolean; sensors: PLCSensorReading[] }>(`${API_BASE}/sensors`)
    return result.connected ? result.sensors : []
  } catch {
    return []
  }
}

export async function getPlcDiagnostics(): Promise<{ title: string; value: string; detail: string; variant: 'ok' | 'warning' | 'error' }[]> {
  try {
    const result = await fetchJson<{ connected: boolean; diagnostics: Array<{ title: string; value: string; detail: string; variant: 'ok' | 'warning' | 'error' }> }>(`${API_BASE}/diagnostics`)
    return result.connected ? result.diagnostics : []
  } catch {
    return []
  }
}

export async function getPlcRollers(): Promise<PLCRollerState[]> {
  try {
    const result = await fetchJson<{ connected: boolean; rollers: PLCRollerState[] }>(`${API_BASE}/rollers`)
    return result.connected ? result.rollers : []
  } catch {
    return []
  }
}

export async function getPlcWidth(): Promise<PLCWidthState> {
  try {
    return await fetchJson<PLCWidthState>(`${API_BASE}/width`)
  } catch {
    return { connected: false, gap: 0, offset: 0 }
  }
}

export async function writePlcRegister(address: number, value: number): Promise<boolean> {
  try {
    const result = await fetchJson<{ written: boolean }>(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, value }),
    })
    return result.written === true
  } catch {
    return false
  }
}
