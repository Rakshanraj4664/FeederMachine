# FX-9000 Feeder Machine - Industrial Authorization & Heartbeat Safety System

## System Architecture Overview

This document describes the production-ready authorization and heartbeat safety architecture for the FX-9000 Feeder Machine control system.

### Core Principles

1. **Defense in Depth**: Multiple layers of security and safety checks
2. **PLC as Final Authority**: The PLC hardware is the ultimate safety controller
3. **Fail-Safe on Disconnect**: Loss of any component immediately enters SAFE STATE
4. **Non-Blocking Operations**: Network timeouts never freeze the machine
5. **Continuous Verification**: Authorization is re-verified every second

### System Components

```
┌─────────────────────────────────────────────────────────┐
│  React UI (Browser)                                     │
│  - Shows machine lock screen if unauthorized            │
│  - Polls /api/auth/status for current state             │
│  - Dispatches machine-unauthorized event on 403         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│  plc_handler.py (Main Server - http://127.0.0.1:8000)   │
│  - Authorization Gatekeeper                             │
│  - Heartbeat Safety Thread (every 1 second)             │
│  - PLC Communication Handler                            │
│  - HTTP API (GET/POST endpoints)                        │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ↓                       ↓
    ┌─────────────┐      ┌──────────────┐
    │ auth_client │      │  PLC Client  │
    │ (polls each │      │ (Modbus TCP) │
    │   second)   │      │ 192.168.1.5  │
    └──────┬──────┘      └──────┬───────┘
           │                    │
           ↓                    ↓
    ┌──────────────────┐  ┌────────────┐
    │ Raspberry Pi     │  │ FX-9000    │
    │ Auth Server      │  │ PLC        │
    │ :5000/verify     │  │ Modbus:502 │
    └──────────────────┘  └────────────┘
```

---

## Device Identification & Authentication

### MAC Address Detection

The system identifies devices by their MAC (Media Access Control) address:

**Preference Order:**
1. Ethernet (eth0) - Primary
2. Wi-Fi (wlan0) - Secondary
3. Any other active network interface - Fallback

**Location**: `auth/mac_reader.py`

**Example output**: `D8:F8:83:A6:4F:DC`

### Device UUID Detection

The system reads the unique device UUID from Linux system:

**Source**: `/sys/class/dmi/id/product_uuid`

**Location**: `auth/device_uuid.py`

**Fallback**: `UNKNOWN_UUID` if unreadable (permission issues on some systems)

### Cryptographic Token Generation

**Method**: SHA256 hash of concatenated values

```
Token = SHA256(MAC + UUID + SECRET_KEY)
Example:
  MAC:        D8:F8:83:A6:4F:DC
  UUID:       12345678-1234-1234-1234-123456789012
  SECRET_KEY: prod_super_secret_key_2026
  
  Raw String: D8:F8:83:A6:4F:DC12345678-1234-1234-1234-123456789012prod_super_secret_key_2026
  Token:      a7f3c9e2d5b1f8e0a2c4d6f9e1a3b5c7d9e0f1a3b5c7d9e0f1a2b4d6f8a0c
```

**Location**: `auth/hash_security.py`

---

## Authorization Flow

### Step 1: Startup Initialization

```
Application Starts
    ↓
Load auth_client (Singleton)
    ├─ Read MAC address
    ├─ Read Device UUID
    └─ Initialize state = CHECKING
    ↓
Start heartbeat_worker() thread
    ├─ Initialize PLC to SAFE STATE (D100 = 0)
    └─ Begin 1-second verification loop
    ↓
Start HTTP server (listen on :8000)
    └─ Ready to serve API requests
```

### Step 2: Every 1-Second Heartbeat Cycle

```
Loop Iteration:
    ↓
Generate SHA256 token (MAC + UUID + SECRET_KEY)
    ↓
Send POST /verify to Raspberry Pi:5000
{
  "mac": "D8:F8:83:A6:4F:DC",
  "device_uuid": "...",
  "token": "..."
}
    ↓
    ├─ Response timeout (2 seconds)
    │  └─ STATE = SERVER_UNAVAILABLE
    │     └─ Write D100 = 0 (SAFE STATE)
    │
    ├─ HTTP 403 Forbidden
    │  └─ TOKEN INVALID or NOT IN WHITELIST
    │     └─ STATE = UNAUTHORIZED
    │        └─ Write D100 = 0 (SAFE STATE)
    │
    ├─ HTTP 200 OK
    │  ├─ authorized = true
    │  │  └─ STATE = AUTHORIZED
    │  │     ├─ Write D100 = 1
    │  │     └─ Toggle D101 (0 → 1 or 1 → 0)
    │  │
    │  └─ authorized = false
    │     └─ STATE = UNAUTHORIZED
    │        └─ Write D100 = 0 (SAFE STATE)
    │
    └─ Connection error
       └─ STATE = SERVER_UNAVAILABLE
          └─ Write D100 = 0 (SAFE STATE)

Sleep 1 second
```

### Step 3: HTTP API Authorization Check

```
React UI requests /api/plc/sensors
    ↓
plc_handler receives GET request
    ↓
Check auth status:
    ├─ STATE == AUTHORIZED
    │  └─ Allow request
    │     └─ Connect to PLC
    │        └─ Read sensor data
    │           └─ Return 200 + data
    │
    └─ STATE != AUTHORIZED
       └─ Reject request
          └─ Return 403
             └─ {"error": "...", "state": "...", "authorized": false}

React UI receives 403:
    ├─ Parse response
    ├─ Dispatch 'machine-unauthorized' event
    └─ App.tsx shows MachineLockScreen
```

---

## Raspberry Pi Authorization Server

### Server Verification Process

```python
# File: auth/auth_server.py
# Port: 5000
# Host: 0.0.0.0 (listens on all interfaces)

POST /verify
├─ Receive: {mac, device_uuid, token}
│
├─ Stage 1: Verify SHA256 Token
│  ├─ Recalculate expected token
│  ├─ Compare with provided token
│  └─ If mismatch: Return 403 (Invalid Token)
│
├─ Stage 2: Check Whitelist
│  ├─ Load authorized_devices.json
│  ├─ Search for MAC + UUID pair
│  └─ If not found: Return 403 (Not Authorized)
│
└─ Return 200: {"authorized": true}
```

### Authorized Devices File

**Location**: `authorized_devices.json`

**Format**:
```json
{
  "version": "1.0",
  "description": "Authorized devices for FX-9000 Feeder Machine",
  "devices": [
    {
      "mac": "D8:F8:83:A6:4F:DC",
      "uuid": "DEVICE_UUID_HERE",
      "description": "Main Control PC"
    },
    {
      "mac": "AA:BB:CC:DD:EE:FF",
      "uuid": "ANOTHER_DEVICE_UUID",
      "description": "Backup Control Station"
    }
  ]
}
```

### Server Endpoints

#### Health Check
```
GET /health
Response: {"status": "ok", "service": "Raspberry Pi Auth Server", "timestamp": "2026-05-25T..."}
```

#### Device Verification (Main Endpoint)
```
POST /verify
Request:  {"mac": "...", "device_uuid": "...", "token": "..."}
Response: {"authorized": true} or 403 Forbidden
```

#### List Authorized Devices (Debug)
```
GET /devices
Response: [{"mac": "...", "uuid": "...", "description": "..."}, ...]
```

---

## PLC Safety Registers

### D100: Authorization Flag

| Value | Meaning | Machine State |
|-------|---------|---------------|
| 1 | Device is authorized | Can operate normally |
| 0 | Device is unauthorized or heartbeat lost | SAFE STATE - all outputs disabled |

**Writing Logic in plc_handler.py**:
- Authorized + Heartbeat OK → Write D100 = 1
- Unauthorized OR Server Unavailable → Write D100 = 0
- Any error → Default to D100 = 0

### D101: Heartbeat Counter

| Sequence | Cycle | Meaning |
|----------|-------|---------|
| 0 → 1 → 0 → 1 | Every 1 second | Heartbeat is active |
| Stuck at 0 or 1 | Stationary | Heartbeat lost or frozen |

**Writing Logic in plc_handler.py**:
- Only written when D100 = 1 (authorized)
- Toggles between 0 and 1 every second
- PLC monitors this for watchdog timeout

### PLC Watchdog Logic (Required in PLC Ladder)

The PLC must implement independent watchdog logic:

```ladder
IF (D100 == 1) AND (D101 changes every 1-3 seconds)
    THEN Machine_Enable = ON
    ELSE Machine_Enable = OFF (SAFE STATE)
```

**Detailed Requirements:**

```
Timer watchdog_timer;

ON EVERY 1 SECOND:
  previous_d101 = current_d101;
  current_d101 = READ_REGISTER(D101);
  
  IF current_d101 != previous_d101:
    watchdog_timer.RESET();
  ELSE:
    watchdog_timer.INCREMENT();

IF (D100 == 1) AND (watchdog_timer < 3 seconds):
  Machine_Enable = TRUE;
  Servo_Power = ON;
  Auto_Mode_Available = TRUE;
ELSE:
  Machine_Enable = FALSE;
  Servo_Power = OFF;
  Auto_Mode_Available = FALSE;
  Emergency_Stop = ACTIVATED;
```

---

## Thread Safety & Concurrency

### auth_client Singleton

**Thread-Safe**: Yes - uses `threading.Lock()`

```python
class MachineAuthClient:
    def __init__(self):
        self._lock = threading.Lock()
        self._state = "CHECKING"
    
    def get_state(self):
        with self._lock:
            return self._state
```

### heartbeat_worker Thread

- Runs as non-daemon thread (survives until explicit shutdown)
- 1-second sleep cycle (reliable timing)
- Exception handling prevents thread death
- Graceful shutdown via `heartbeat.stop()` flag

### HTTP Request Handler

- Stateless (no shared state)
- Each request gets own ModbusTcpClient instance
- Thread pool handled by HTTPServer (built-in)

---

## Logging

### Log Files

- **Auth events**: `logs/auth.log` (via auth_logger)
- **PLC handler**: Console + auth.log
- **Heartbeat**: Periodic summary (every 60 iterations)

### Log Levels

- **INFO**: State changes, authorization events, heartbeat status
- **WARNING**: Connection failures, token mismatches
- **ERROR**: Unexpected exceptions, critical failures
- **DEBUG**: Token details (only when needed)

### Log Suppression

- **Heartbeat success**: Logged every 60 seconds (not every second)
- **HTTP requests**: Suppressed (no spam in logs)
- **Connection retries**: Logged only first 3 attempts

---

## Error States & Recovery

### SERVER_UNAVAILABLE

**Causes**:
- Raspberry Pi auth server offline
- Network connectivity lost
- DNS resolution failure
- Connection timeout (> 2 seconds)

**Behavior**:
- Write D100 = 0 (SAFE STATE)
- Machine disabled
- Retry every 1 second automatically
- Recovery automatic when server comes online

### UNAUTHORIZED

**Causes**:
- Device MAC not in whitelist
- Device UUID mismatch
- SHA256 token verification failed
- Server explicitly denies access

**Behavior**:
- Write D100 = 0 (SAFE STATE)
- Machine disabled
- Admin must add device to whitelist
- No automatic recovery

### HEARTBEAT_LOST

**Causes**:
- Heartbeat thread crashed
- D101 stopped toggling
- PLC disconnected
- Modbus communication broken

**Behavior**:
- PLC watchdog detects D101 not changing
- PLC disables machine independently
- React UI shows "Heartbeat Lost" lock screen

---

## Startup Sequence

### Desktop/Control PC

1. **Start Python PLC Handler**
   ```bash
   python3 plc_handler.py
   ```
   
   Output:
   ```
   ======================================================================
   HEARTBEAT SAFETY WORKER STARTED
   ======================================================================
   PLC Target: 192.168.1.5:502
   Auth Server: http://127.0.0.1:5000/verify
   ======================================================================
   PLC API listening at http://127.0.0.1:8000/api
   Machine lock endpoint: http://127.0.0.1:8000/api/auth/status
   ======================================================================
   ```

2. **Start React Development Server** (separate terminal)
   ```bash
   npm run dev
   ```

3. **Heartbeat Worker**
   - Immediately initializes PLC to SAFE STATE
   - Begins 1-second verification loop
   - Logs first authorization attempt

4. **React Application**
   - Loads at http://localhost:5173
   - Polls /api/auth/status every second
   - Shows lock screen if not authorized
   - Enables UI when authorized

### Raspberry Pi

1. **Install Dependencies**
   ```bash
   pip install fastapi uvicorn
   ```

2. **Start Auth Server** (manual or systemd)
   ```bash
   python3 -m uvicorn auth.auth_server:app --host 0.0.0.0 --port 5000
   ```
   
   Or use systemd service:
   ```bash
   sudo systemctl start machine-auth.service
   ```

3. **Systemd Service Setup**
   ```bash
   sudo cp raspberry_pi/machine-auth.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable machine-auth.service
   sudo systemctl start machine-auth.service
   ```

4. **Verify Service**
   ```bash
   sudo systemctl status machine-auth.service
   curl http://localhost:5000/health
   ```

---

## Configuration

### Environment Variables

**On Control PC** (`plc_handler.py`):
- No env vars required (hardcoded defaults work)

**On Raspberry Pi** (`auth_server.py`):
```bash
export AUTH_SERVER_HOST="0.0.0.0"
export AUTH_SERVER_PORT="5000"
export AUTH_SECRET_KEY="prod_super_secret_key_2026"
export AUTHORIZED_DEVICES_FILE="/home/pi/feeder_machine_hmi/authorized_devices.json"
```

### Configuration Files

**Control PC**:
- `auth/config.py` - URLs and paths
- `authorized_devices.json` - Whitelist (shared with Raspberry Pi)

**Raspberry Pi**:
- `authorized_devices.json` - Whitelist (same file)
- `raspberry_pi/machine-auth.service` - Systemd config

---

## Security Best Practices

### Secret Key Management

- **Default**: `prod_super_secret_key_2026` (change this in production!)
- **Storage**: Environment variable, not in code
- **Rotation**: Change requires re-generating all tokens
- **Sharing**: Must be identical on Control PC and Raspberry Pi

### Network Security

- **Raspberry Pi**: Expose only to internal LAN, not internet
- **Port 5000**: Should be behind firewall
- **TLS/SSL**: Add reverse proxy (nginx) for production
- **Authentication**: Current system uses SHA256 + whitelist

### Device Management

- **Whitelist**: Add devices via `authorized_devices.json`
- **Audit**: Monitor `logs/auth.log` for unauthorized attempts
- **Revocation**: Remove MAC+UUID pair from whitelist
- **Emergency**: Restore backup `authorized_devices.json`

---

## Performance Metrics

| Component | Timeout | Interval | Notes |
|-----------|---------|----------|-------|
| Auth verification | 2 seconds | 1 second | Per heartbeat cycle |
| PLC communication | 1 second | On-demand | Per HTTP request |
| Heartbeat loop | N/A | 1 second | Non-blocking |
| D101 toggle rate | N/A | 1 second | 0 ↔ 1 every second |
| HTTP request | 500 ms | On-demand | React UI polling |

---

## Troubleshooting

### Machine shows "Unauthorized Device"

**Check**:
1. Device MAC address: `ip link show` or `ifconfig`
2. Device UUID: `sudo cat /sys/class/dmi/id/product_uuid`
3. Whitelist file: `cat authorized_devices.json`
4. Secret key matches on both systems

**Fix**:
```json
{
  "mac": "YOUR_MAC_HERE",
  "uuid": "YOUR_UUID_HERE",
  "description": "New Device"
}
```

### Machine shows "Heartbeat Lost"

**Check**:
1. PLC connection: `ping 192.168.1.5`
2. Modbus port: `telnet 192.168.1.5 502`
3. Python process running: `ps aux | grep plc_handler`
4. Heartbeat thread logs: Check `logs/auth.log`

**Fix**:
1. Restart Python handler: `pkill python3; python3 plc_handler.py`
2. Check PLC ladder logic - verify D100/D101 watchdog
3. Check network cables and switches

### Machine shows "Authorization Server Offline"

**Check**:
1. Raspberry Pi connectivity: `ping <raspberry-pi-ip>`
2. Auth server running: `curl http://<pi-ip>:5000/health`
3. Firewall rules: Check port 5000 is not blocked
4. Systemd service: `sudo systemctl status machine-auth.service`

**Fix**:
1. Start auth server: `python3 -m uvicorn auth.auth_server:app --host 0.0.0.0 --port 5000`
2. Check systemd logs: `sudo journalctl -u machine-auth.service -f`
3. Verify network: `ip route`, `netstat -tlnp`

---

## Summary

This authorization and heartbeat safety system provides:

✅ **Device Identification**: MAC + UUID combination  
✅ **Cryptographic Verification**: SHA256 token validation  
✅ **Continuous Monitoring**: 1-second heartbeat cycle  
✅ **Fail-Safe Behavior**: PLC is final authority  
✅ **Non-Blocking Design**: 2-second network timeouts  
✅ **Thread-Safe**: Singleton pattern with locks  
✅ **Production-Ready**: Logging, error handling, graceful shutdown  
✅ **Zero UI Breaking Changes**: Integrates cleanly with existing React app  

The machine can **ONLY** operate when:
1. Device is whitelisted (MAC + UUID)
2. Cryptographic token is valid
3. Continuous heartbeat is active (D101 toggling)
4. PLC watchdog confirms both conditions

If any condition fails, the PLC immediately enters **SAFE STATE**.
