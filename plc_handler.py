#!/usr/bin/env python3
import json
import socket
import struct
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

PLC_HOST = '192.168.1.5'
PLC_PORT = 502
API_HOST = '127.0.0.1'
API_PORT = 8000
UNIT_ID = 1
TIMEOUT_SECONDS = 1.0

# ── Register Mapping ─────────────────────────────────────────────
# Adjust these to match your PLC program
ADDR_GAP = 500          # D500
ADDR_OFFSET = 501       # D501
ADDR_ROLLER_SPEED = 2   # D2, D3, D4, D5
ADDR_ROLLER_LOAD = 6    # D6, D7, D8, D9 ← UPDATE WHEN YOU KNOW
ADDR_ROLLER_STATUS = 10 # D10, D11, D12, D13 ← UPDATE WHEN YOU KNOW
ADDR_SENSOR_BASE = 1200 # D1200-D1203
ADDR_DIAGNOSTIC_BASE = 1300 # D1300-D1302

class ModbusTcpClient:
    def __init__(self, host: str, port: int, timeout: float = TIMEOUT_SECONDS):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.transaction_id = 0

    def _recv_all(self, sock: socket.socket, length: int) -> bytes:
        data = b''
        while len(data) < length:
            packet = sock.recv(length - len(data))
            if not packet:
                raise ConnectionError('Incomplete response from PLC')
            data += packet
        return data

    def _build_request(self, unit_id: int, function_code: int, data: bytes) -> bytes:
        self.transaction_id = (self.transaction_id + 1) & 0xFFFF
        header = struct.pack('>HHH', self.transaction_id, 0, len(data) + 2)
        return header + struct.pack('>B', unit_id) + struct.pack('>B', function_code) + data

    def _send_request(self, request: bytes) -> bytes:
        with socket.create_connection((self.host, self.port), timeout=self.timeout) as sock:
            sock.sendall(request)
            header = self._recv_all(sock, 7)
            transaction_id, protocol_id, length = struct.unpack('>HHH', header[:6])
            unit_id = header[6]
            body = self._recv_all(sock, length - 1)
            return body

    def is_connected(self) -> bool:
        try:
            with socket.create_connection((self.host, self.port), timeout=self.timeout):
                return True
        except (OSError, socket.timeout):
            return False

    def read_holding_registers(self, address: int, count: int) -> list[int]:
        if count <= 0 or count > 125:
            raise ValueError('Modbus read count must be between 1 and 125')
        payload = struct.pack('>HH', address, count)
        request = self._build_request(UNIT_ID, 3, payload)
        response = self._send_request(request)
        if response[0] != 3:
            raise ConnectionError(f'Unexpected function code {response[0]}')
        byte_count = response[1]
        if byte_count != count * 2:
            raise ConnectionError('Unexpected byte count from PLC')
        registers = []
        for i in range(count):
            registers.append(struct.unpack('>H', response[2 + i * 2:4 + i * 2])[0])
        return registers

    def write_single_register(self, address: int, value: int) -> bool:
        if value < 0 or value > 0xFFFF:
            raise ValueError('Register value must be 0-65535')
        payload = struct.pack('>HH', address, value)
        request = self._build_request(UNIT_ID, 6, payload)
        response = self._send_request(request)
        return len(response) >= 5 and response[0] == 6 and response[1:5] == payload


class PlcRequestHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status: int = 200) -> None:
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def _send_json(self, payload, status: int = 200) -> None:
        self._set_headers(status)
        self.wfile.write(json.dumps(payload, indent=2).encode('utf-8'))

    def do_OPTIONS(self) -> None:
        self._set_headers(204)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        client = ModbusTcpClient(PLC_HOST, PLC_PORT)

        if path == '/api/status' or path == '/api/plc/status':
            connected = client.is_connected()
            self._send_json({
                'connected': connected,
                'host': PLC_HOST,
                'port': PLC_PORT,
                'latency_ms': 0 if not connected else round(self._measure_latency(client) * 1000, 2),
            })
            return

        if path == '/api/registers':
            try:
                address = int(query.get('address', ['0'])[0])
                count = int(query.get('count', ['1'])[0])
                registers = client.read_holding_registers(address, count)
                self._send_json({'address': address, 'count': count, 'registers': registers})
            except Exception as exc:
                self._send_json({'error': str(exc)}, status=500)
            return

        if path == '/api/plc/sensors':
            self._handle_sensors(client)
            return

        if path == '/api/plc/rollers':
            self._handle_rollers(client)
            return

        if path == '/api/plc/width':
            self._handle_width(client)
            return

        if path == '/api/plc/diagnostics':
            self._handle_diagnostics(client)
            return

        self._send_json({'error': 'Endpoint not found'}, status=404)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get('Content-Length', '0'))
        payload = b''
        if content_length:
            payload = self.rfile.read(content_length)
        try:
            body = json.loads(payload.decode('utf-8') or '{}')
        except json.JSONDecodeError:
            body = {}

        client = ModbusTcpClient(PLC_HOST, PLC_PORT)

        if path == '/api/register' or path == '/api/plc/register':
            try:
                address = int(body.get('address', 0))
                value = int(body.get('value', 0))
                result = client.write_single_register(address, value)
                self._send_json({'address': address, 'value': value, 'written': result})
            except Exception as exc:
                self._send_json({'error': str(exc)}, status=500)
            return

        self._send_json({'error': 'Endpoint not found'}, status=404)

    def _measure_latency(self, client: ModbusTcpClient) -> float:
        start = time.time()
        try:
            client.read_holding_registers(ADDR_GAP, 1)
        except Exception:
            return 0.0
        return time.time() - start

    def _handle_sensors(self, client: ModbusTcpClient) -> None:
        connected = client.is_connected()
        if not connected:
            self._send_json({'connected': False, 'sensors': []})
            return
        try:
            registers = client.read_holding_registers(ADDR_SENSOR_BASE, 4)
            sensors = [
                {'label': 'Fabric Tension', 'value': f'{registers[0] / 10:.1f}', 'unit': 'N', 'trend': 'stable'},
                {'label': 'Edge Alignment', 'value': f'{registers[1] / 100:.2f}', 'unit': 'mm', 'trend': 'stable'},
                {'label': 'Roller Current', 'value': f'{registers[2] / 10:.1f}', 'unit': 'A', 'trend': 'rising'},
                {'label': 'Ambient Temp', 'value': f'{registers[3] / 10:.1f}', 'unit': '°C', 'trend': 'stable'},
            ]
            self._send_json({'connected': True, 'sensors': sensors})
        except Exception as exc:
            self._send_json({'connected': False, 'error': str(exc), 'sensors': []}, status=500)

    def _handle_rollers(self, client: ModbusTcpClient) -> None:
        connected = client.is_connected()
        if not connected:
            self._send_json({'connected': False, 'rollers': []})
            return
        try:
            speeds = client.read_holding_registers(ADDR_ROLLER_SPEED, 4)
            loads = client.read_holding_registers(ADDR_ROLLER_LOAD, 4)
            status_codes = client.read_holding_registers(ADDR_ROLLER_STATUS, 4)
            
            roller_names = [
                'Infeed Roller',
                'Tension Roller',
                'Guide Roller',
                'Outfeed Roller',
            ]
            status_map = {0: 'ok', 1: 'warning', 2: 'error'}

            rollers = []
            for i in range(4):
                rollers.append({
                    'id': f'RL-{i + 1}',
                    'name': roller_names[i],
                    'speed': speeds[i],
                    'load': loads[i],
                    'status': status_map.get(status_codes[i], 'warning'),
                })
            
            self._send_json({'connected': True, 'rollers': rollers})
        except Exception as exc:
            self._send_json({'connected': False, 'error': str(exc), 'rollers': []}, status=500)

    def _handle_width(self, client: ModbusTcpClient) -> None:
        connected = client.is_connected()
        if not connected:
            self._send_json({'connected': False, 'gap': 0, 'offset': 0})
            return
        try:
            registers = client.read_holding_registers(ADDR_GAP, 2)
            offset_signed = struct.unpack('>h', struct.pack('>H', registers[1]))[0]
            self._send_json({'connected': True, 'gap': registers[0], 'offset': offset_signed})
        except Exception as exc:
            self._send_json({'connected': False, 'error': str(exc), 'gap': 0, 'offset': 0}, status=500)

    def _handle_diagnostics(self, client: ModbusTcpClient) -> None:
        connected = client.is_connected()
        if not connected:
            self._send_json({'connected': False, 'diagnostics': []})
            return
        try:
            registers = client.read_holding_registers(ADDR_DIAGNOSTIC_BASE, 3)
            diagnostics = [
                {'title': 'Main Voltage', 'value': f'{registers[0] / 10:.1f} V', 'detail': 'Measured at main bus', 'variant': 'ok'},
                {'title': 'System Temp', 'value': f'{registers[1] / 10:.1f} °C', 'detail': 'Cabinet temperature', 'variant': 'ok'},
                {'title': 'Hydraulic Pressure', 'value': f'{registers[2] / 10:.1f} bar', 'detail': 'Pressure feedback', 'variant': 'warning' if registers[2] < 1100 else 'ok'},
            ]
            self._send_json({'connected': True, 'diagnostics': diagnostics})
        except Exception as exc:
            self._send_json({'connected': False, 'error': str(exc), 'diagnostics': []}, status=500)

    def log_message(self, format: str, *args) -> None:
        return


def run_server() -> None:
    server = HTTPServer((API_HOST, API_PORT), PlcRequestHandler)
    print(f'PLC handler running at http://{API_HOST}:{API_PORT}/api')
    print(f'Target PLC: {PLC_HOST}:{PLC_PORT}')
    server.serve_forever()


if __name__ == '__main__':
    run_server()