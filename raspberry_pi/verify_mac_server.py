#!/usr/bin/env python3
from flask import Flask, request, jsonify
import os
import time

app = Flask(__name__)

ALLOWED_MACS_FILE = '/etc/allowed_macs.txt'
SHARED_SECRET_ENV = 'SHARED_SECRET'

# Acceptable timestamp window (seconds)
MAX_SKEW = 30


def load_allowed_macs():
    # First check environment variable ALLOWED_MACS (comma separated)
    env = os.getenv('ALLOWED_MACS')
    if env:
        return [m.strip().lower() for m in env.split(',') if m.strip()]
    # Fallback to file
    try:
        with open(ALLOWED_MACS_FILE, 'r') as f:
            lines = [l.strip().lower() for l in f if l.strip()]
            return lines
    except Exception:
        return []


def normalize_mac(mac: str) -> str:
    # remove common separators and reformat as xx:xx:xx:xx:xx:xx
    s = mac.lower().replace('-', '').replace(':', '').replace('.', '')
    if len(s) != 12:
        return mac.lower()
    return ':'.join(s[i:i+2] for i in range(0, 12, 2))


@app.route('/')
def index():
    return jsonify({'status': 'ok'})


@app.route('/verify-mac', methods=['POST'])
def verify_mac():
    data = request.get_json(force=True, silent=True)
    if not data or 'mac' not in data:
        return jsonify({'error': 'missing mac'}), 400
    mac = normalize_mac(str(data['mac']))
    # If the Pi is configured with a shared secret, require HMAC verification.
    hmac_received = data.get('hmac')
    ts = data.get('ts')
    shared_secret = os.getenv(SHARED_SECRET_ENV)

    if shared_secret:
        if not hmac_received or not ts:
            return jsonify({'error': 'missing hmac or timestamp'}), 400
        try:
            import hmac as _hmac
            import hashlib

            # Check timestamp skew
            now = int(time.time())
            ts_int = int(ts)
            if abs(now - ts_int) > MAX_SKEW:
                return jsonify({'error': 'timestamp skew too large'}), 400

            msg = f"{mac}|{ts_int}"
            computed = _hmac.new(shared_secret.encode('utf-8'), msg.encode('utf-8'), hashlib.sha256).hexdigest()
            if not _hmac.compare_digest(computed, hmac_received):
                return jsonify({'error': 'hmac mismatch'}), 403
        except Exception:
            return jsonify({'error': 'hmac verification failed'}), 400

    # Now check allowlist
    allowed = load_allowed_macs()
    allowed_normalized = [normalize_mac(a) for a in allowed]
    if mac in allowed_normalized:
        return jsonify({'allowed': True}), 200
    else:
        return jsonify({'allowed': False}), 403


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Verify MACs for Raspberry Pi')
    parser.add_argument('--host', default='0.0.0.0')
    parser.add_argument('--port', default=5000, type=int)
    args = parser.parse_args()
    app.run(host=args.host, port=args.port)
