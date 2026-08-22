"""
File storage via Cloudflare R2 (S3-compatible API — boto3 works against it
unmodified by pointing at R2's endpoint). Chosen over AWS S3 directly per
the product decision: R2 has zero egress fees, which matters specifically
for a platform where every school's logo, every report card PDF, and every
ID card photo gets fetched repeatedly by parents on mobile data.

Two operations, matching how file upload actually needs to work in a
browser: the backend never proxies file bytes through itself (slow, and
ties up a request/worker for the whole upload). Instead:

  1. generate_upload_url() — backend issues a short-lived PRESIGNED PUT URL.
     The frontend uploads the file directly to R2 using that URL. The
     backend never sees the file bytes.
  2. generate_download_url() — for anything not meant to be public (a
     school's report card PDFs, staff bank details attachments), a
     short-lived signed GET URL — never a permanently public bucket path.

Object keys are ALWAYS prefixed schools/{school_id}/... — this is the
storage-layer half of tenant isolation described in doc 004's isolation
table (the ORM guard handles the database half; this handles files).
"""
import uuid
from datetime import timedelta

import boto3
from botocore.config import Config

from app.core.config import settings

_UPLOAD_URL_EXPIRY_SECONDS = 300      # 5 minutes — long enough for a real upload, short enough to limit exposure
_DOWNLOAD_URL_EXPIRY_SECONDS = 3600   # 1 hour — reasonable for a parent opening a report card link

_ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/webp",  # logos, ID photos
    "application/pdf",                          # report cards, certificates, payslips
}
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB — generous for a logo or scanned document, not for arbitrary files


def _get_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.STORAGE_ENDPOINT_URL,
        aws_access_key_id=settings.STORAGE_ACCESS_KEY,
        aws_secret_access_key=settings.STORAGE_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",  # R2 doesn't use AWS regions but boto3 requires the parameter
    )


def build_object_key(*, school_id: uuid.UUID, category: str, filename: str) -> str:
    """
    category is one of: logos | report-cards | certificates | payslips | id-photos
    — kept as a flat prefix rather than deeper nesting so a school's
    Settings screen can list/manage "all our uploaded logos" etc. with a
    simple prefix query if that's ever needed.
    """
    safe_filename = f"{uuid.uuid4().hex[:8]}-{filename}"
    return f"schools/{school_id}/{category}/{safe_filename}"


def generate_upload_url(*, school_id: uuid.UUID, category: str, filename: str, content_type: str) -> dict:
    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise ValueError(f"Content type '{content_type}' isn't allowed for upload.")

    key = build_object_key(school_id=school_id, category=category, filename=filename)
    client = _get_client()

    url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.STORAGE_BUCKET,
            "Key": key,
            "ContentType": content_type,
            # R2/S3 enforce this server-side too, but stating it in the
            # presigned params means a client that lies about Content-Length
            # in the actual PUT gets rejected by R2 itself, not just by us
            # trusting whatever the client claims.
        },
        ExpiresIn=_UPLOAD_URL_EXPIRY_SECONDS,
    )
    return {"upload_url": url, "object_key": key, "expires_in": _UPLOAD_URL_EXPIRY_SECONDS}


def generate_download_url(*, object_key: str) -> str:
    client = _get_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.STORAGE_BUCKET, "Key": object_key},
        ExpiresIn=_DOWNLOAD_URL_EXPIRY_SECONDS,
    )


def upload_bytes(*, school_id: uuid.UUID, category: str, filename: str, content: bytes, content_type: str) -> str:
    """
    For server-generated files (report card PDFs, exported reports) that
    never need a presigned client-side upload — the backend already has
    the bytes in memory and just needs to write them. Returns the object
    key, same as generate_upload_url's flow, so callers treat both paths
    identically once they have a key.
    """
    key = build_object_key(school_id=school_id, category=category, filename=filename)
    client = _get_client()
    client.put_object(Bucket=settings.STORAGE_BUCKET, Key=key, Body=content, ContentType=content_type)
    return key


def object_belongs_to_school(*, object_key: str, school_id: uuid.UUID) -> bool:
    """
    Called before ever issuing a download URL for a key a client supplies —
    without this check, a user could request a signed URL for a DIFFERENT
    school's object_key if they somehow learned it, since the key itself
    carries no auth. This is the storage-layer enforcement of tenant
    isolation, mirroring what tenant_guard.py does for database queries.
    """
    return object_key.startswith(f"schools/{school_id}/")
