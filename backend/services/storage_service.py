"""
TRIVAANA AI: S3-Compatible Object Storage & Local Media Fallback Service
Stores call recordings, broadcast audio, knowledge-base files, and exported reports.
"""

from pathlib import Path
from typing import Any, Dict, Optional
import uuid
from core.config import settings


class StorageService:
    @staticmethod
    def save_file(
        tenant_id: str,
        category: str,
        filename: str,
        content: bytes,
        content_type: str = "application/octet-stream",
    ) -> Dict[str, Any]:
        safe_name = Path(filename or "file.bin").name.replace(" ", "_")
        storage_key = f"{tenant_id}/{category}/{uuid.uuid4().hex[:10]}_{safe_name}"

        if settings.has_s3_storage:
            try:
                import boto3  # type: ignore

                client = boto3.client(
                    "s3",
                    endpoint_url=settings.STORAGE_ENDPOINT,
                    aws_access_key_id=settings.STORAGE_ACCESS_KEY,
                    aws_secret_access_key=settings.STORAGE_SECRET_KEY,
                )
                client.put_object(
                    Bucket=settings.STORAGE_BUCKET,
                    Key=storage_key,
                    Body=content,
                    ContentType=content_type,
                )
                return {
                    "storage_backend": "s3",
                    "storage_key": storage_key,
                    "url": f"{settings.STORAGE_ENDPOINT.rstrip('/')}/{settings.STORAGE_BUCKET}/{storage_key}",
                    "size_bytes": len(content),
                }
            except Exception:
                # Fall through to local storage if S3 SDK/network is unavailable in dev
                pass

        dest = settings.LOCAL_STORAGE_PATH / storage_key
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)
        return {
            "storage_backend": "local",
            "storage_key": storage_key,
            "url": f"/api/media/{storage_key}",
            "size_bytes": len(content),
        }

    @staticmethod
    def read_local_file(storage_key: str) -> Optional[bytes]:
        # Prevent directory traversal
        base = settings.LOCAL_STORAGE_PATH.resolve()
        target = (base / storage_key).resolve()
        if not str(target).startswith(str(base)) or not target.is_file():
            return None
        return target.read_bytes()

