import os

# Server configuration
AUTH_SERVER_HOST = os.getenv("AUTH_SERVER_HOST", "http://192.168.0.105:5000")
AUTH_SERVER_URL = f"{AUTH_SERVER_HOST}/verify"

# Shared secret key for SHA256 hashing (Must match on client and server)
SECRET_KEY = "prod_super_secret_key_2026"

# File paths
AUTHORIZED_DEVICES_FILE = "authorized_devices.json"
LOG_FILE_PATH = "logs/auth.log"
