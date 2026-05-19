export type RollerState = {
  id: string
  status: 'ACTIVE' | 'HOLD' | 'FAULT'
  sensor: 'OK' | 'WARN' | 'FAIL'
  rpm: number
  temperature: number
}

export type SensorReading = {
  label: string
  value: string
  unit: string
  trend: 'stable' | 'rising' | 'falling'
}

export type DiagnosticCard = {
  title: string
  value: string
  detail: string
  variant: 'ok' | 'warning' | 'error'
}

export type StatsItem = {
  label: string
  value: string
  description: string
}
