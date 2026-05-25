#!/usr/bin/env python3
"""
Raspberry Pi Authorization Server

Production-ready FastAPI server for machine authorization.
- Verifies MAC address, device UUID, and cryptographic token
- Loads authorized devices from JSON configuration
- Thread-safe operations
- Comprehensive logging
- CORS support for browser-based requests
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import json
import os
import hashlib
import logging
import asyncio
from pathlib import Path

# ────────────────────────────────────────────────────────────────
# Configuration
# ────────────────────────────────────────────────────────────────

SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "prod_super_secret_key_2026")
AUTHORIZED_DEVICES_FILE = os.getenv("AUTHORIZED_DEVICES_FILE", "authorized_devices.json")
AUTH_SERVER_PORT = int(os.getenv("AUTH_SERVER_PORT", "5000"))
AUTH_SERVER_HOST = os.getenv("AUTH_SERVER_HOST", "0.0.0.0")

# ────────────────────────────────────────────────────────────────
# Logging Setup
# ────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("AuthServer")

# ────────────────────────────────────────────────────────────────
# FastAPI Application
# ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Machine Authorization Server",
    version="1.0.0",
    description="Industrial-grade authorization for machine control system"
)

# Add CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ────────────────────────────────────────────────────────────────
# Data Models
# ────────────────────────────────────────────────────────────────

class VerifyRequest(BaseModel):
    """Authorization verification request from machine client"""
    mac: str = Field(..., description="MAC address of the requesting device")
    device_uuid: str = Field(..., description="Device UUID of the requesting device")
    token: str = Field(..., description="SHA256 cryptographic token for verification")

class VerifyResponse(BaseModel):
    """Authorization verification response"""
    authorized: bool = Field(..., description="Whether the device is authorized")

class HealthResponse(BaseModel):
    """Health check response"""
    status: str = Field(..., description="Service status")
    service: str = Field(..., description="Service name")
    timestamp: str = Field(..., description="ISO timestamp")

class DeviceInfo(BaseModel):
    """Authorized device information"""
    mac: str
    uuid: str
    description: Optional[str] = None

# ────────────────────────────────────────────────────────────────
# Device Storage
# ────────────────────────────────────────────────────────────────

def _ensure_authorized_devices_file():
    """Ensure authorized_devices.json exists with defaults if needed"""
    if not os.path.exists(AUTHORIZED_DEVICES_FILE):
        logger.warning(f"Creating default {AUTHORIZED_DEVICES_FILE}")
        default_devices = {
            "version": "1.0",
            "devices": [
                {
                    "mac": "D8:F8:83:A6:4F:DC",
                    "uuid": "SAMPLE_UUID_HERE",
                    "description": "Development Machine"
                }
            ]
        }
        try:
            os.makedirs(os.path.dirname(AUTHORIZED_DEVICES_FILE) or ".", exist_ok=True)
            with open(AUTHORIZED_DEVICES_FILE, 'w') as f:
                json.dump(default_devices, f, indent=2)
            logger.info(f"Created default {AUTHORIZED_DEVICES_FILE}")
        except Exception as e:
            logger.error(f"Failed to create {AUTHORIZED_DEVICES_FILE}: {e}")

def load_authorized_devices() -> List[dict]:
    """
    Load authorized devices from JSON file.
    
    Returns:
        List of authorized device dictionaries with 'mac' and 'uuid' keys
    """
    try:
        if not os.path.exists(AUTHORIZED_DEVICES_FILE):
            logger.warning(f"{AUTHORIZED_DEVICES_FILE} not found")
            _ensure_authorized_devices_file()
            return []
        
        with open(AUTHORIZED_DEVICES_FILE, 'r') as f:
            data = json.load(f)
            
            # Support both flat array and object with 'devices' key
            if isinstance(data, dict):
                devices = data.get("devices", [])
            elif isinstance(data, list):
                devices = data
            else:
                logger.error(f"Invalid format in {AUTHORIZED_DEVICES_FILE}")
                return []
            
            # Normalize MAC addresses to uppercase
            normalized = []
            for device in devices:
                if isinstance(device, dict) and "mac" in device:
                    normalized.append({
                        "mac": device["mac"].upper(),
                        "uuid": device.get("uuid", ""),
                        "description": device.get("description", "")
                    })
            
            logger.info(f"Loaded {len(normalized)} authorized devices")
            return normalized
            
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error in {AUTHORIZED_DEVICES_FILE}: {e}")
        return []
    except Exception as e:
        logger.error(f"Error loading authorized devices: {e}")
        return []

def is_device_authorized(mac: str, uuid: str) -> bool:
    """
    Check if a device (MAC + UUID pair) is authorized.
    
    Args:
        mac: MAC address (will be normalized to uppercase)
        uuid: Device UUID
        
    Returns:
        True if device is in authorized list, False otherwise
    """
    mac_upper = mac.upper()
    devices = load_authorized_devices()
    
    for device in devices:
        if device["mac"] == mac_upper and device["uuid"] == uuid:
            return True
    
    return False

# ────────────────────────────────────────────────────────────────
# Token Verification
# ────────────────────────────────────────────────────────────────

def verify_token(mac: str, uuid: str, provided_token: str) -> bool:
    """
    Verify SHA256 cryptographic token.
    
    Token format: SHA256(MAC + UUID + SECRET_KEY)
    
    Args:
        mac: MAC address
        uuid: Device UUID
        provided_token: Token received from client
        
    Returns:
        True if token is valid, False otherwise
    """
    raw_string = f"{mac}{uuid}{SECRET_KEY}"
    expected_token = hashlib.sha256(raw_string.encode('utf-8')).hexdigest()
    is_valid = expected_token == provided_token
    
    if not is_valid:
        logger.debug(f"Token mismatch for MAC: {mac}")
    
    return is_valid

# ────────────────────────────────────────────────────────────────
# API Endpoints
# ────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Ensure authorized devices file exists on startup"""
    _ensure_authorized_devices_file()
    logger.info("Auth server startup complete")

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint.
    
    Returns:
        Health status information
    """
    from datetime import datetime, timezone
    return HealthResponse(
        status="ok",
        service="Raspberry Pi Auth Server",
        timestamp=datetime.now(timezone.utc).isoformat()
    )

@app.post("/verify", response_model=VerifyResponse)
async def verify_device(req: VerifyRequest):
    """
    Verify machine authorization.
    
    Two-stage verification:
    1. Cryptographic token validation
    2. MAC+UUID whitelist check
    
    Args:
        req: Verification request with MAC, UUID, and token
        
    Returns:
        Authorized: true/false
        
    Raises:
        HTTPException 403: Invalid token or unauthorized device
    """
    mac = req.mac.upper()
    
    logger.info(f"Authorization request from MAC: {mac}")
    
    # Stage 1: Verify cryptographic token
    if not verify_token(mac, req.device_uuid, req.token):
        logger.warning(f"Token verification FAILED for MAC: {mac}")
        raise HTTPException(
            status_code=403,
            detail=json.dumps({"authorized": False, "reason": "Invalid token"})
        )
    
    # Stage 2: Verify MAC+UUID against whitelist
    if is_device_authorized(mac, req.device_uuid):
        logger.info(f"Authorization GRANTED: {mac}")
        return VerifyResponse(authorized=True)
    else:
        logger.warning(f"Authorization DENIED: {mac} not in whitelist")
        raise HTTPException(
            status_code=403,
            detail=json.dumps({"authorized": False})
        )

@app.get("/status", response_model=dict)
async def status():
    """
    Get server status for React UI polling.
    
    Used by React frontend to check authorization state without auth checks.
    """
    devices = load_authorized_devices()
    return {
        "status": "ok",
        "devices_count": len(devices),
        "timestamp": __import__('datetime').datetime.now(
            __import__('datetime').timezone.utc
        ).isoformat()
    }

@app.get("/devices", response_model=List[DeviceInfo])
async def list_devices():
    """
    List all authorized devices (debugging endpoint).
    
    WARNING: This is an internal debugging endpoint.
    In production, restrict access to this endpoint.
    """
    logger.warning("Authorized devices list requested (debugging endpoint)")
    devices = load_authorized_devices()
    return [
        DeviceInfo(mac=d["mac"], uuid=d["uuid"], description=d.get("description"))
        for d in devices
    ]

# ────────────────────────────────────────────────────────────────
# Main Entry Point
# ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    
    logger.info("=" * 70)
    logger.info("MACHINE AUTHORIZATION SERVER - PRODUCTION")
    logger.info("=" * 70)
    logger.info(f"Starting server on {AUTH_SERVER_HOST}:{AUTH_SERVER_PORT}")
    logger.info(f"Authorized devices file: {AUTHORIZED_DEVICES_FILE}")
    logger.info("=" * 70)
    
    uvicorn.run(
        app,
        host=AUTH_SERVER_HOST,
        port=AUTH_SERVER_PORT,
        log_level="info",
        access_log=True
    )
