Raspberry Pi MAC verification server

This is a minimal Flask server that verifies a posted MAC address against an allowlist.

Install:

```
python3 -m venv venv
source venv/bin/activate
pip install flask
```

Configure allowed MAC(s):

- Create `/etc/allowed_macs.txt` with one MAC per line, or
- Set `ALLOWED_MACS` environment variable as a comma-separated list, e.g. `export ALLOWED_MACS=aa:bb:cc:dd:ee:ff`

Run:

```
python verify_mac_server.py --host 0.0.0.0 --port 5000
```

API:

- POST /verify-mac -- JSON body `{ "mac": "aa:bb:cc:dd:ee:ff" }` -> 200 {allowed:true} or 403 {allowed:false}
- POST /verify-mac -- JSON body `{ "mac": "aa:bb:cc:dd:ee:ff" }` -> 200 {allowed:true} or 403 {allowed:false}

HMAC / Shared secret (optional but recommended):

- To require HMAC verification, set environment variable `SHARED_SECRET` on the Pi. When this is set, the server rejects requests that do not include both `ts` and `hmac`.
- The client should compute an HMAC-SHA256 over the string `"<mac>|<ts>"` where `<ts>` is the current Unix timestamp (seconds), and send JSON `{ "mac": "...", "ts": 1680000000, "hmac": "..." }`.
- The server verifies the HMAC using `SHARED_SECRET` and rejects requests where the timestamp differs from the server time by more than 30 seconds.

Security:

This is a simple allowlist check. For production, run behind TLS and additionally harden authentication (API key rotation, HMAC key management, mutual TLS).