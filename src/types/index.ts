export interface RollerState {
  id: string;
  label: string;
  servoStatus: 'ok' | 'warning' | 'error';
  sensorValue: number;
  speed: number;
}

export interface MachineState {
  status: 'running' | 'idle' | 'error';
  width: number;
  targetWidth: number;
  alarms: string[];
}
