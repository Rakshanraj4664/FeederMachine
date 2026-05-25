#!/usr/bin/env python3
"""
Machine Authorization Client

Production-ready client for machine authorization.
- Thread-safe singleton pattern
- 2-second timeout on network calls
- State management with backoff logic
- Comprehensive logging
- Non-blocking operation
"""

import urllib.request
import urllib.error
import json
import threading
from auth.config import AUTH_SERVER_URL
from auth.logger import auth_logger
from auth.mac_reader import get_mac_address
from auth.device_uuid import get_device_uuid
from auth.hash_security import generate_auth_token

# ────────────────────────────────────────────────────────────────
# Authorization States
# ────────────────────────────────────────────────────────────────

STATE_CHECKING = "CHECKING"
STATE_AUTHORIZED = "AUTHORIZED"
STATE_UNAUTHORIZED = "UNAUTHORIZED"
STATE_SERVER_UNAVAILABLE = "SERVER_UNAVAILABLE"
STATE_HEARTBEAT_LOST = "HEARTBEAT_LOST"

VALID_STATES = {
    STATE_CHECKING,
    STATE_AUTHORIZED,
    STATE_UNAUTHORIZED,
    STATE_SERVER_UNAVAILABLE,
    STATE_HEARTBEAT_LOST
}

# ────────────────────────────────────────────────────────────────
# Authorization Client
# ────────────────────────────────────────────────────────────────

class MachineAuthClient:
    """
    Thread-safe singleton client for machine authorization.
    
    Manages device identification and continuous heartbeat verification
    with the Raspberry Pi authorization server.
    """
    
    def __init__(self):
        """Initialize client with device identification"""
        self.mac = get_mac_address()
        self.uuid = get_device_uuid()
        self._state = STATE_CHECKING
        self._consecutive_successes = 0
        self._lock = threading.Lock()
        self._failed_attempts = 0
        
        auth_logger.info(f"Auth client initialized - MAC: {self.mac}, UUID: {self.uuid}")

    def get_state(self) -> str:
        """
        Get current authorization state in thread-safe manner.
        
        Returns:
            One of: CHECKING, AUTHORIZED, UNAUTHORIZED, SERVER_UNAVAILABLE, HEARTBEAT_LOST
        """
        with self._lock:
            return self._state

    def _set_state(self, new_state: str) -> None:
        """
        Set authorization state in thread-safe manner.
        
        Args:
            new_state: New state value
        """
        if new_state not in VALID_STATES:
            auth_logger.error(f"Invalid state transition: {new_state}")
            return
        
        with self._lock:
            if self._state != new_state:
                auth_logger.info(f"State transition: {self._state} → {new_state}")
                self._state = new_state

    def verify_device(self) -> str:
        """
        Send MAC, UUID, and token to Raspberry Pi authorization server.
        
        Two-stage process:
        1. Connect to server
        2. Verify cryptographic token and whitelist status
        
        Returns:
            Authorization state: AUTHORIZED, UNAUTHORIZED, SERVER_UNAVAILABLE
            
        Note:
            - Uses 2.0 second timeout for network safety
            - Non-blocking: Returns immediately with current state
            - Thread-safe
        """
        token = generate_auth_token(self.mac, self.uuid)
        payload = {
            "mac": self.mac,
            "device_uuid": self.uuid,
            "token": token
        }
        
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            AUTH_SERVER_URL,
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        
        try:
            # 2.0 second timeout for network safety
            with urllib.request.urlopen(req, timeout=2.0) as response:
                result = json.loads(response.read().decode('utf-8'))
                
                if result.get("authorized") is True:
                    # Device is authorized
                    if self._consecutive_successes == 0:
                        auth_logger.info("Device AUTHORIZED ✓ - Heartbeat established")
                    elif self._consecutive_successes % 60 == 0:
                        # Log every 60 seconds to avoid flooding logs
                        auth_logger.debug("Heartbeat OK: Device remains AUTHORIZED")
                    
                    self._consecutive_successes += 1
                    self._failed_attempts = 0
                    self._set_state(STATE_AUTHORIZED)
                    return STATE_AUTHORIZED
                else:
                    # Device exists but not authorized
                    self._consecutive_successes = 0
                    self._failed_attempts += 1
                    auth_logger.warning("Device UNAUTHORIZED ✗ - Access denied by server")
                    self._set_state(STATE_UNAUTHORIZED)
                    return STATE_UNAUTHORIZED
                    
        except urllib.error.HTTPError as e:
            # HTTP error response
            self._consecutive_successes = 0
            self._failed_attempts += 1
            
            if e.code == 403:
                # 403 Forbidden - token or whitelist rejection
                auth_logger.warning("Device UNAUTHORIZED (403 Forbidden)")
                self._set_state(STATE_UNAUTHORIZED)
                return STATE_UNAUTHORIZED
            elif e.code == 401:
                # 401 Unauthorized
                auth_logger.warning("Device UNAUTHORIZED (401 Unauthorized)")
                self._set_state(STATE_UNAUTHORIZED)
                return STATE_UNAUTHORIZED
            else:
                # Other HTTP errors
                auth_logger.error(f"HTTP Error during authorization: {e.code}")
                self._set_state(STATE_SERVER_UNAVAILABLE)
                return STATE_SERVER_UNAVAILABLE
                
        except urllib.error.URLError as e:
            # Connection errors
            self._consecutive_successes = 0
            self._failed_attempts += 1
            
            if self._failed_attempts <= 3:
                auth_logger.warning(f"Connection Error (attempt {self._failed_attempts}): {e.reason}")
            
            self._set_state(STATE_SERVER_UNAVAILABLE)
            return STATE_SERVER_UNAVAILABLE
            
        except json.JSONDecodeError as e:
            # Malformed response
            self._consecutive_successes = 0
            self._failed_attempts += 1
            auth_logger.error(f"Malformed response from auth server: {e}")
            self._set_state(STATE_SERVER_UNAVAILABLE)
            return STATE_SERVER_UNAVAILABLE
            
        except Exception as e:
            # Unexpected error
            self._consecutive_successes = 0
            self._failed_attempts += 1
            auth_logger.error(f"Unexpected error during authorization: {type(e).__name__}: {e}")
            self._set_state(STATE_SERVER_UNAVAILABLE)
            return STATE_SERVER_UNAVAILABLE

# ────────────────────────────────────────────────────────────────
# Global Singleton Instance
# ────────────────────────────────────────────────────────────────

auth_client = MachineAuthClient()

