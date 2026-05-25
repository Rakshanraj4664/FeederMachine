import hashlib
from auth.config import SECRET_KEY

def generate_auth_token(mac: str, uuid: str) -> str:
    """
    Generate SHA256 token using MAC + Device UUID + SECRET_KEY.
    """
    raw_string = f"{mac}{uuid}{SECRET_KEY}"
    return hashlib.sha256(raw_string.encode('utf-8')).hexdigest()

def verify_auth_token(mac: str, uuid: str, provided_token: str) -> bool:
    """
    Verify the provided SHA256 token matches the expected hash.
    """
    expected_token = generate_auth_token(mac, uuid)
    return expected_token == provided_token
