"""
Rate limiting for auth endpoints specifically — login and password reset are
the highest-value targets for brute-force/credential-stuffing attempts, and
per-account lockout (auth/service.py) alone isn't enough, since it doesn't
stop someone hammering DIFFERENT identity codes from the same IP. This adds
a second, independent layer: per-IP request throttling.

Uses an in-memory sliding window keyed by IP — adequate for a single-process
deployment; if the API ever runs multiple worker processes behind a load
balancer, this should move to Redis (settings.REDIS_URL is already
available) so the limit is shared across processes rather than per-worker.
Flagged here rather than silently shipped as if it were the final form.
"""
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

_WINDOW_SECONDS = 60
_MAX_REQUESTS_PER_WINDOW = 10  # 10 login attempts/minute per IP is generous for a real user, tight for an attacker

_request_log: dict[str, list[float]] = defaultdict(list)


def rate_limit_auth(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.time()

    _request_log[ip] = [t for t in _request_log[ip] if now - t < _WINDOW_SECONDS]

    if len(_request_log[ip]) >= _MAX_REQUESTS_PER_WINDOW:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many attempts from this network. Wait a minute and try again.",
        )

    _request_log[ip].append(now)
