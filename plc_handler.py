#!/usr/bin/env python3
"""
Machine Control Handler with Authorization & Heartbeat Safety

Production-ready PLC communication handler with:
- Authorization gatekeeper pattern
- Continuous heartbeat verification
- PLC registers for safety control
- Thread-safe operation
- Comprehensive logging
"""

import json
import socket
import struct
import time
import threading
import logging
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

# Authorization Client
from auth.auth_client import auth_client
from auth.logger import auth_logger

# ────────────────────────────────────────────────────────────────
# Configuration
# ────────────────────────────────────────────────────────────────

PLC_HOST = '192.168.1.5'
PLC_PORT = 502
API_HOST = '127.0.0.1'
API_PORT = 8000
UNIT_ID = 1
TIMEOUT_SECONDS = 1.0

# ────────────────────────────────────────────────────────────────
# PLC Register Mapping for Safety
# ────────────────────────────────────────────────────────────────

# Safety registers - MUST match PLC ladder logic
ADDR_AUTH_FLAG = 100         # D100: Authorization status (1=authorized, 0=safe state)
ADDR_HEARTBEAT_COUNTER = 101 # D101: Heartbeat toggle (cycles 0→1→0→1)

# Machine data registers
ADDR_GAP = 500          # D500: Width setting
ADDR_OFFSET = 501       # D501: Offset setting
ADDR_ROLLER_SPEED = 2   # D2-D5: Roller speeds
ADDR_ROLLER_LOAD = 6    # D6-D9: Roller loads
ADDR_ROLLER_STATUS = 10 # D10-D13: Roller status codes
ADDR_SENSOR_BASE = 1200 # D1200-D1203: Sensor readings
ADDR_DIAGNOSTIC_BASE = 1300 # D1300-D1302: Diagnostics

# ────────────────────────────────────────────────────────────────
# Logging Setup
# ────────────────────────────────────────────────────────────────

logger = logging.getLogger("PLCHandler")
logger.setLevel(logging.INFO)

if not logger.handlers:
    # Console handler
    ch = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    ch.setFormatter(formatter)
    logger.addHandler(ch)

# ────────────────────────────────────────────────────────────────
# Modbus TCP Client
# ────────────────────────────────────────────────────────────────

class ModbusTcpClient:
    """Production-ready Modbus TCP client"""
    
    def __init__(self, host: str, port: int, timeout: float = TIMEOUT_SECONDS):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.transaction_id = 0

    def _recv_all(self, sock: socket.socket, length: int) -> bytes:
        """Receive exactly 'length' bytes from socket"""
        data = b''
        while len(data) < length:
            packet = sock.recv(length - len(data))
            if not packet:
                raise ConnectionError('Incomplete response from PLC')
            data += packet
        return data

    def _build_request(self, unit_id: int, function_code: int, data: bytes) -> bytes:
        """Build Modbus TCP request frame"""
        self.transaction_id = (self.transaction_id + 1) & 0xFFFF
        header = struct.pack('>HHH', self.transaction_id, 0, len(data) + 2)
        return header + struct.pack('>B', unit_id) + struct.pack('>B', function_code) + data

    def _send_request(self, request: bytes) -> bytes:
        """Send Modbus request and receive response"""
        with socket.create_connection((self.host, self.port), timeout=self.timeout) as sock:
            sock.sendall(request)
            header = self._recv_all(sock, 7)
            transaction_id, protocol_id, length = struct.unpack('>HHH', header[:6])
            unit_id = header[6]
            body = self._recv_all(sock, length - 1)
            return body

    def is_connected(self) -> bool:
        """Test PLC connection by reading a register"""
        try:
            registers = self.read_holding_registers(ADDR_GAP, 1)
            return len(registers) == 1
        except (OSError, socket.timeout, ConnectionError, ValueError):
            return False

    def read_holding_registers(self, address: int, count: int) -> list[int]:
        """Read holding registers from PLC"""
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
        """Write single register to PLC"""
        if value < 0 or value > 0xFFFF:
            raise ValueError('Register value must be 0-65535')
        payload = struct.pack('>HH', address, value)
        request = self._build_request(UNIT_ID, 6, payload)
        response = self._send_request(request)
        return len(response) >= 5 and response[0] == 6 and response[1:5] == payload

# ────────────────────────────────────────────────────────────────
# HTTP Request Handler
# ────────────────────────────────────────────────────────────────

class PlcRequestHandler(BaseHTTPRequestHandler):
    """HTTP API handler for PLC communication"""
    
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

    def _check_auth(self) -> bool:
        """Check authorization before allowing PLC access"""
        state = auth_client.get_state()
        if state != "AUTHORIZED":
            self._send_json({
                'error': 'Machine Authorization Failed.',
                'state': state,
                'authorized': False
            }, status=403)
            return False
        return True

    def do_GET(self) -> None:
        """Handle GET requests"""
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        
        # Authorization status endpoint (no auth check needed)
        if path == '/api/auth/status':
            self._send_json({'state': auth_client.get_state()})
            return

        # All other endpoints require authorization
        if not self._check_auth():
            return

        # Create PLC client for data access
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
        """Handle POST requests"""
        if not self._check_auth():
            return

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
        """Measure PLC communication latency"""
        start = time.time()
        try:
            client.read_holding_registers(ADDR_GAP, 1)
        except Exception:
            return 0.0
        return time.time() - start

    def _handle_sensors(self, client: ModbusTcpClient) -> None:
        """Read sensor data from PLC"""
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
        """Read roller status from PLC"""
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
        """Read width configuration from PLC"""
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
        """Read diagnostic data from PLC"""
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
        """Suppress default HTTP logging"""
        return

# ────────────────────────────────────────────────────────────────
# Heartbeat Safety Thread
# ────────────────────────────────────────────────────────────────

class HeartbeatWorker:
    """
    Continuous heartbeat thread for machine authorization safety.
    
    Every 1 second:
    - Verifies device authorization with server
    - Writes D100 (auth flag) = 1 if authorized, 0 if not
    - Toggles D101 (heartbeat counter) between 0 and 1
    
    The PLC monitors these registers and enters SAFE STATE if:
    - D100 becomes 0 (unauthorized)
    - D101 stops toggling for > 3 seconds (heartbeat lost)
    """
    
    def __init__(self):
        self.running = True
        self.last_auth_state = None
        self.plc_disconnect_count = 0
        self.auth_transitions = 0
    
    def run(self):
        """Main heartbeat loop"""
        logger.info("=" * 70)
        logger.info("HEARTBEAT SAFETY WORKER STARTED")
        logger.info("=" * 70)
        logger.info(f"PLC Target: {PLC_HOST}:{PLC_PORT}")
        logger.info(f"Auth Server: {auth_client.auth_client.AUTH_SERVER_URL if hasattr(auth_client, 'AUTH_SERVER_URL') else 'Unknown'}")
        logger.info("=" * 70)
        
        client = ModbusTcpClient(PLC_HOST, PLC_PORT)
        heartbeat_value = 0
        
        # Initialize PLC to SAFE STATE (UNAUTHORIZED) on startup
        try:
            if client.is_connected():
                client.write_single_register(ADDR_AUTH_FLAG, 0)
                logger.info("PLC initialized to SAFE STATE (D100 = 0)")
                self.plc_disconnect_count = 0
            else:
                logger.warning("PLC not responding during initialization")
        except Exception as e:
            logger.error(f"Failed to initialize PLC: {e}")

        loop_count = 0
        
        while self.running:
            try:
                loop_count += 1
                
                # Verify device authorization
                state = auth_client.verify_device()
                
                # Log state transitions only
                if state != self.last_auth_state:
                    self.auth_transitions += 1
                    logger.info(f"[HEARTBEAT] Auth state changed: {self.last_auth_state} → {state}")
                    self.last_auth_state = state
                
                # Write safety registers to PLC based on auth state
                if state == "AUTHORIZED":
                    heartbeat_value = 1 - heartbeat_value  # Toggle 0 ↔ 1
                    try:
                        # Write authorization flag and heartbeat
                        client.write_single_register(ADDR_AUTH_FLAG, 1)
                        client.write_single_register(ADDR_HEARTBEAT_COUNTER, heartbeat_value)
                        self.plc_disconnect_count = 0
                    except Exception as e:
                        self.plc_disconnect_count += 1
                        if self.plc_disconnect_count <= 3:
                            logger.warning(f"PLC write error (attempt {self.plc_disconnect_count}): {e}")
                        elif self.plc_disconnect_count == 4:
                            logger.error(f"PLC unreachable for {self.plc_disconnect_count} seconds - initiating safe shutdown")
                else:
                    # Unauthorized - enter SAFE STATE
                    try:
                        client.write_single_register(ADDR_AUTH_FLAG, 0)
                        self.plc_disconnect_count = 0
                    except Exception as e:
                        logger.warning(f"Failed to write safe state to PLC: {e}")
                
                # Periodic status report
                if loop_count % 60 == 0:
                    auth_logger.info(f"Heartbeat summary: loops={loop_count}, transitions={self.auth_transitions}, state={state}")
                
            except Exception as e:
                logger.error(f"Unexpected error in heartbeat loop: {type(e).__name__}: {e}")
            
            time.sleep(1.0)

    def stop(self):
        """Gracefully stop the heartbeat worker"""
        logger.info("Stopping heartbeat worker...")
        self.running = False

# ────────────────────────────────────────────────────────────────
# Server Initialization
# ────────────────────────────────────────────────────────────────

def run_server() -> None:
    """Start the PLC handler server with heartbeat safety"""
    logger.info("Starting Machine Control Handler with Authorization...")
    
    # Start heartbeat worker
    heartbeat = HeartbeatWorker()
    worker_thread = threading.Thread(target=heartbeat.run, daemon=False)
    worker_thread.start()
    logger.info("Heartbeat worker thread started")
    
    # Start HTTP server
    try:
        server = HTTPServer((API_HOST, API_PORT), PlcRequestHandler)
        logger.info(f'PLC API listening at http://{API_HOST}:{API_PORT}/api')
        logger.info(f'Machine lock endpoint: http://{API_HOST}:{API_PORT}/api/auth/status')
        logger.info("=" * 70)
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        heartbeat.stop()
        server.shutdown()
    except Exception as e:
        logger.error(f"Fatal server error: {e}")
        raise

if __name__ == '__main__':
    run_server()
