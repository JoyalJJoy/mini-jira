import json as json_module
import httpx
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.security import decode_token

app = FastAPI(title=settings.app_name, version=settings.app_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared HTTP client with connection pooling
_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient()
    return _client


def _extract_content(resp: httpx.Response):
    """Safely extract JSON content from a downstream response."""
    if not resp.content:
        return None
    try:
        return resp.json()
    except json_module.JSONDecodeError:
        return {"detail": f"Upstream returned non-JSON (status {resp.status_code})"}


async def proxy_request(target_url: str, request: Request) -> JSONResponse:
    body = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None)

    client = get_client()
    try:
        resp = await client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body,
            follow_redirects=True,
        )
        # Don't forward downstream headers blindly – let JSONResponse
        # set correct Content-Type / Content-Length, and let the CORS
        # middleware handle CORS headers.
        return JSONResponse(status_code=resp.status_code, content=_extract_content(resp))
    except httpx.RequestError as e:
        return JSONResponse(
            status_code=503,
            content={"detail": f"Service unavailable: {e}"},
        )


def validate_user_id(authorization: str) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = authorization.removeprefix("Bearer ")
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return user_id


@app.api_route("/api/v1/auth/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_auth(path: str, request: Request):
    target = f"{settings.user_service_url}/api/v1/auth/{path}"
    qs = str(request.query_params)
    if qs:
        target += f"?{qs}"
    return await proxy_request(target, request)


@app.api_route("/api/v1/users/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_users(path: str, request: Request):
    user_id = validate_user_id(request.headers.get("authorization", ""))
    target = f"{settings.user_service_url}/api/v1/users/{path}"
    qs = str(request.query_params)
    if qs:
        target += f"?{qs}"

    body = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None)
    headers["X-User-ID"] = user_id

    client = get_client()
    try:
        resp = await client.request(
            method=request.method,
            url=target,
            headers=headers,
            content=body,
            follow_redirects=True,
        )
        return JSONResponse(status_code=resp.status_code, content=_extract_content(resp))
    except httpx.RequestError as e:
        return JSONResponse(
            status_code=503,
            content={"detail": f"Service unavailable: {e}"},
        )


@app.api_route("/api/v1/projects/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_projects(path: str, request: Request):
    user_id = validate_user_id(request.headers.get("authorization", ""))
    target = f"{settings.task_service_url}/api/v1/projects/{path}"
    qs = str(request.query_params)
    if qs:
        target += f"?{qs}"

    body = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None)
    headers["X-User-ID"] = user_id

    client = get_client()
    try:
        resp = await client.request(
            method=request.method,
            url=target,
            headers=headers,
            content=body,
            follow_redirects=True,
        )
        return JSONResponse(status_code=resp.status_code, content=_extract_content(resp))
    except httpx.RequestError as e:
        return JSONResponse(
            status_code=503,
            content={"detail": f"Service unavailable: {e}"},
        )


@app.api_route("/api/v1/tasks/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_tasks(path: str, request: Request):
    user_id = validate_user_id(request.headers.get("authorization", ""))
    target = f"{settings.task_service_url}/api/v1/tasks/{path}"
    qs = str(request.query_params)
    if qs:
        target += f"?{qs}"

    body = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None)
    headers["X-User-ID"] = user_id

    client = get_client()
    try:
        resp = await client.request(
            method=request.method,
            url=target,
            headers=headers,
            content=body,
            follow_redirects=True,
        )
        return JSONResponse(status_code=resp.status_code, content=_extract_content(resp))
    except httpx.RequestError as e:
        return JSONResponse(
            status_code=503,
            content={"detail": f"Service unavailable: {e}"},
        )
