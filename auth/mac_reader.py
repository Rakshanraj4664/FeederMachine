import os
from auth.logger import auth_logger

def get_mac_address() -> str:
    """
    Attempt to read the MAC address from eth0, then wlan0.
    Falls back to first available network interface.
    Returns MAC as uppercase string.
    """
    interfaces = ['eth0', 'wlan0']
    
    # Check preferred interfaces first
    for interface in interfaces:
        path = f"/sys/class/net/{interface}/address"
        if os.path.exists(path):
            try:
                with open(path, 'r') as f:
                    mac = f.read().strip().upper()
                    auth_logger.info(f"MAC detected on {interface}: {mac}")
                    return mac
            except Exception as e:
                auth_logger.warning(f"Failed to read MAC for {interface}: {e}")

    # Fallback to any active interface (excluding loopback)
    try:
        net_dir = "/sys/class/net/"
        for iface in os.listdir(net_dir):
            if iface != "lo":
                path = os.path.join(net_dir, iface, "address")
                if os.path.exists(path):
                    with open(path, 'r') as f:
                        mac = f.read().strip().upper()
                        auth_logger.info(f"Fallback MAC detected on {iface}: {mac}")
                        return mac
    except Exception as e:
        auth_logger.error(f"Fallback MAC detection failed: {e}")

    auth_logger.error("Could not determine MAC address.")
    return "UNKNOWN_MAC"
