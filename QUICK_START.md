# Quick Start Guide - Authorization & Heartbeat System

## 5-Minute Setup

### Step 1: Identify Your Hardware

**Control PC (Desktop/Workstation)**
- Gets the MAC address and Device UUID
- Runs plc_handler.py (authorization client)
- Runs React UI
- Communicates with Raspberry Pi

**Raspberry Pi 5**
- Runs auth_server.py (authorization server)
- Connected to network (Ethernet or Wi-Fi)
- Keeps whitelist of authorized devices

**PLC (FX-9000)**
- Mitsubishi FX3U or similar
- IP: 192.168.1.5
- Modbus TCP Port: 502

### Step 2: Get Your Device Identifiers

**On Control PC**, open terminal:

```bash
# Get MAC address
cat /sys/class/net/eth0/address
# Or for WiFi:
cat /sys/class/net/wlan0/address

# Get Device UUID
sudo cat /sys/class/dmi/id/product_uuid
# Or without sudo (may fail on some systems):
cat /sys/class/dmi/id/product_uuid
```

**Save these values:**
```
MAC:  XX:XX:XX:XX:XX:XX
UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Step 3: Update Authorized Devices

**On Raspberry Pi**, edit `authorized_devices.json`:

```json
{
  "version": "1.0",
  "devices": [
    {
      "mac": "YOUR_MAC_FROM_STEP_2",
      "uuid": "YOUR_UUID_FROM_STEP_2",
      "description": "Main Control PC"
    }
  ]
}
```

### Step 4: Start the System

**Terminal 1 - On Raspberry Pi:**
```bash
cd ~/feeder_machine_hmi
python3 -m uvicorn auth.auth_server:app --host 0.0.0.0 --port 5000
# Output: Uvicorn running on http://0.0.0.0:5000
```

**Terminal 2 - On Control PC:**
```bash
cd ~/Documents/vite-project
python3 plc_handler.py
# Output: 
# HEARTBEAT SAFETY WORKER STARTED
# PLC API listening at http://127.0.0.1:8000/api
```

**Terminal 3 - On Control PC:**
```bash
cd ~/Documents/vite-project
npm run dev
# Output: 
# Local:   http://localhost:5173/
```

### Step 5: Verify System

1. **Open browser**: http://localhost:5173
2. **React UI should show**: "System Running" (not locked)
3. **Check logs**:
   ```bash
   tail -f logs/auth.log
   # Should show: "Device AUTHORIZED ✓"
   ```

### Step 6: Test Authorization

**Block a device (simulate unauthorized):**

1. Edit `authorized_devices.json` on Raspberry Pi
2. Remove or change your MAC address
3. Refresh browser or restart plc_handler
4. React UI should show: "Machine Authorization Failed"

**Restore access:**

1. Correct the MAC address in `authorized_devices.json`
2. Restart plc_handler
3. React UI should show: "System Running" again

---

## Production Deployment

### Raspberry Pi Systemd Service

**Setup (one-time):**

```bash
# Copy service file
sudo cp /home/pi/feeder_machine_hmi/raspberry_pi/machine-auth.service \
        /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable autostart
sudo systemctl enable machine-auth.service

# Start service
sudo systemctl start machine-auth.service
```

**Check status:**
```bash
sudo systemctl status machine-auth.service

# View logs:
sudo journalctl -u machine-auth.service -f

# Stop service:
sudo systemctl stop machine-auth.service
```

### Control PC Autostart

**Option A: Desktop shortcut**

Create file: `~/.local/share/applications/feeder-machine.desktop`

```ini
[Desktop Entry]
Type=Application
Name=Feeder Machine Control
Exec=/home/user/start-feeder.sh
Terminal=true
```

Create: `~/start-feeder.sh`

```bash
#!/bin/bash
cd ~/Documents/vite-project
python3 plc_handler.py &
sleep 2
npm run dev
```

Make executable:
```bash
chmod +x ~/start-feeder.sh
```

**Option B: systemd user service**

Create: `~/.config/systemd/user/feeder-machine.service`

```ini
[Unit]
Description=Feeder Machine Control
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/Documents/vite-project
ExecStart=/usr/bin/python3 plc_handler.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

Enable and start:
```bash
systemctl --user enable feeder-machine.service
systemctl --user start feeder-machine.service
```

---

## Dependencies

### Python Packages

**Control PC:**
- FastAPI (built-in urllib - no extra packages needed!)
- Built-in: json, socket, struct, time, threading, logging, http

**Raspberry Pi:**
- FastAPI
- Uvicorn

Install on Raspberry Pi:
```bash
pip install fastapi uvicorn
```

### System Requirements

**Control PC:**
- Python 3.8+
- Network connectivity to Raspberry Pi
- Node.js 16+ (for React dev)

**Raspberry Pi:**
- Python 3.8+
- Network connectivity to Control PC and PLC
- ~100 MB storage for service
- ~50 MB RAM for Python process

**PLC:**
- Supports Modbus TCP
- 2 registers available (D100, D101)
- Ladder logic for watchdog

---

## Troubleshooting Quick Reference

| Problem | Check | Fix |
|---------|-------|-----|
| "Machine Authorization Failed" | MAC in whitelist? | Add MAC to authorized_devices.json |
| "Heartbeat Lost" | PLC connected? | Check PLC IP/port, restart plc_handler |
| "Authorization Server Offline" | Raspberry Pi running? | `sudo systemctl start machine-auth.service` |
| "PLC Not Connected" | Modbus working? | `telnet 192.168.1.5 502` |
| "React UI locked" | Auth state? | Check `/api/auth/status` endpoint |
| Python crashes | Error logs? | `tail -f logs/auth.log` |

---

## Security Checklist

- [ ] Changed `SECRET_KEY` from default `prod_super_secret_key_2026`
- [ ] Saved `authorized_devices.json` securely (backup)
- [ ] Raspberry Pi port 5000 only accessible from internal LAN
- [ ] PLC port 502 only accessible from internal LAN
- [ ] Control PC has restricted network access
- [ ] Auth logs reviewed regularly for unauthorized attempts
- [ ] Systemd service runs with minimal privileges
- [ ] Regular backups of `authorized_devices.json`

---

## Next Steps

1. **Configure PLC Watchdog**: See [PLC_LADDER_LOGIC.md](PLC_LADDER_LOGIC.md)
2. **Customize Logging**: Edit `auth/logger.py` if needed
3. **Add More Devices**: Edit `authorized_devices.json`
4. **Monitor Heartbeat**: Check `logs/auth.log` for patterns
5. **Setup Monitoring**: Periodically check auth server health: `curl http://pi-ip:5000/health`

---

## Support Matrix

| Component | Version | Status |
|-----------|---------|--------|
| Python | 3.8+ | ✅ Supported |
| FastAPI | 0.90+ | ✅ Supported |
| Uvicorn | 0.15+ | ✅ Supported |
| Modbus TCP | Protocol standard | ✅ Compatible |
| React | 19.2+ | ✅ Compatible |
| Tauri | 2.11+ | ✅ Compatible |
| Node.js | 16+ | ✅ Supported |
| Raspberry Pi | Any model | ✅ Supported |
| PLC | Modbus-capable | ✅ Supported |

---

## Common Commands Reference

```bash
# Control PC - Test auth server
curl http://192.168.1.100:5000/health

# Control PC - Check auth status
curl http://127.0.0.1:8000/api/auth/status

# Control PC - Test PLC connection
curl http://127.0.0.1:8000/api/plc/status

# Raspberry Pi - View auth server logs
sudo journalctl -u machine-auth.service -f

# Raspberry Pi - Restart auth server
sudo systemctl restart machine-auth.service

# Control PC - Check Python process
ps aux | grep plc_handler

# Control PC - Kill Python handler
pkill -f plc_handler

# Control PC - View auth logs
tail -f logs/auth.log | head -50

# Both - List authorized devices
cat authorized_devices.json
```

---

## Typical First Run Output

```
═══════════════════════════════════════════════════════════════
HEARTBEAT SAFETY WORKER STARTED
═══════════════════════════════════════════════════════════════
PLC Target: 192.168.1.5:502
Auth Server: http://127.0.0.1:5000/verify
═══════════════════════════════════════════════════════════════
PLC API listening at http://127.0.0.1:8000/api
Machine lock endpoint: http://127.0.0.1:8000/api/auth/status
═══════════════════════════════════════════════════════════════

2026-05-25 14:30:45 - MachineAuth - INFO - Auth client initialized - MAC: D8:F8:83:A6:4F:DC, UUID: abcd1234-5678-90ef-ghij-klmnopqrstuv
2026-05-25 14:30:46 - PLCHandler - INFO - Heartbeat summary: loops=1, transitions=1, state=AUTHORIZED
2026-05-25 14:30:47 - MachineAuth - INFO - State transition: CHECKING → AUTHORIZED
2026-05-25 14:30:47 - MachineAuth - INFO - Device AUTHORIZED ✓ - Heartbeat established
```

System is now **READY** for operation! 🟢

---

## Emergency Procedures

### Immediate Machine Shutdown

```bash
# Method 1: Stop Python (immediate)
pkill -9 python3

# Method 2: Kill heartbeat thread
killall -9 plc_handler.py

# Method 3: Manual PLC emergency stop
(Press E-Stop button on PLC panel)
```

### Restore Access (Device Locked)

```bash
# 1. SSH to Raspberry Pi
ssh pi@192.168.x.x

# 2. Edit whitelist
nano authorized_devices.json

# 3. Add your MAC/UUID back

# 4. Restart auth server
sudo systemctl restart machine-auth.service

# 5. Restart control PC handler
pkill python3
python3 plc_handler.py
```

### Emergency Disable Authorization Check

```bash
# Temporary: Comment out auth check in plc_handler.py
# (NOT RECOMMENDED - only for emergency testing)

# Restore normal operation:
# - Uncomment auth check
# - Restart system
```

---

**System is Production Ready! ✅**

Enjoy automated machine authorization with heartbeat safety!
