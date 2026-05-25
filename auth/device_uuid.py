import os
from auth.logger import auth_logger

def get_device_uuid() -> str:
    """
    Attempt to read the Linux device UUID.
    Falls back to a default string if unavailable (e.g. permission error).
    """
    path = "/sys/class/dmi/id/product_uuid"
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                uuid = f.read().strip()
                auth_logger.info(f"Device UUID detected: {uuid}")
                return uuid
        except Exception as e:
            auth_logger.warning(f"Failed to read device UUID: {e}")
    else:
        auth_logger.warning("Device UUID file does not exist.")

    auth_logger.warning("Falling back to UNKNOWN_UUID")
    return "UNKNOWN_UUID"
