import os
import jwt
from fastapi import Header, Query, HTTPException
from dotenv import load_dotenv

load_dotenv()

def get_jwt_config():
    key = os.getenv("JWT_KEY", "this-is-a-super-secret-key-change-me-later-min-32-chars")
    issuer = os.getenv("JWT_ISSUER", "DataCleanerApi")
    audience = os.getenv("JWT_AUDIENCE", "DataCleanerApiUsers")
    return key, issuer, audience

def get_current_user_id(
    authorization: str | None = Header(None),
    token_query: str | None = Query(None, alias="token")
) -> int:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()
    elif token_query:
        token = token_query.strip()
        
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authorization token")
        
    jwt_key, jwt_issuer, jwt_audience = get_jwt_config()
    
    try:
        payload = jwt.decode(
            token,
            jwt_key,
            algorithms=["HS256"],
            issuer=jwt_issuer,
            audience=jwt_audience,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
        
    user_id = (
        payload.get("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")
        or payload.get("nameid")
        or payload.get("sub")
    )
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token missing user ID claim")
    return int(user_id)
