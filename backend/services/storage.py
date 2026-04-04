import mimetypes
import os
from pathlib import Path
from typing import Optional
from uuid import uuid4
from urllib.parse import quote

from fastapi import HTTPException, UploadFile

try:
    import cloudinary
    import cloudinary.uploader
except ImportError:  # pragma: no cover - dependency may be absent during partial installs
    cloudinary = None

try:
    from supabase import Client, create_client
except ImportError:  # pragma: no cover - dependency may be absent during partial installs
    Client = None
    create_client = None

try:
    from google.cloud import storage as gcs_storage
except ImportError:  # pragma: no cover - dependency may be absent during partial installs
    gcs_storage = None


ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
LOCAL_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "frontend" / "uploads"


def _configure_cloudinary() -> bool:
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")
    placeholder_markers = ("your_", "placeholder", "change_me")
    if any(
        value and any(marker in value.lower() for marker in placeholder_markers)
        for value in (cloud_name, api_key, api_secret)
    ):
        return False
    if not cloud_name or not api_key or not api_secret or cloudinary is None:
        return False
    cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True)
    return True


def _get_supabase_client() -> Optional["Client"]:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key or create_client is None:
        return None
    return create_client(url, key)


def _get_firebase_bucket_name() -> Optional[str]:
    return os.getenv("FIREBASE_STORAGE_BUCKET") or os.getenv("GCLOUD_STORAGE_BUCKET")


def _validate_suffix(filename: str) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only jpg, jpeg, png, webp, and gif images are allowed")
    return suffix


async def upload_space_image(space_id: int, file: UploadFile) -> str:
    suffix = _validate_suffix(file.filename or "")
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    filename = f"space-{space_id}-{uuid4().hex}{suffix}"
    object_path = f"spaces/{space_id}/{filename}"

    if _configure_cloudinary():
        try:
            result = cloudinary.uploader.upload(
                contents,
                folder=f"spacesync/spaces/{space_id}",
                public_id=Path(filename).stem,
                resource_type="image",
                overwrite=True,
            )
        except Exception as exc:  # pragma: no cover - depends on external service
            message = str(exc)
            if "Must supply api_key" in message or "Must supply cloud_name" in message:
                raise HTTPException(status_code=500, detail="Cloudinary is not configured correctly on the server") from exc
            raise HTTPException(status_code=500, detail=f"Cloudinary upload failed: {message}") from exc
        secure_url = result.get("secure_url")
        if not secure_url:
            raise HTTPException(status_code=500, detail="Cloudinary upload succeeded but no secure URL was returned")
        return secure_url

    bucket_name = _get_firebase_bucket_name()
    if bucket_name and gcs_storage is not None:
        client = gcs_storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(object_path)
        blob.metadata = {"firebaseStorageDownloadTokens": uuid4().hex}
        blob.upload_from_string(contents, content_type=content_type)
        token = blob.metadata["firebaseStorageDownloadTokens"]
        encoded_path = quote(object_path, safe="")
        return f"https://firebasestorage.googleapis.com/v0/b/{bucket_name}/o/{encoded_path}?alt=media&token={token}"

    client = _get_supabase_client()
    bucket_name = os.getenv("SUPABASE_STORAGE_BUCKET", "space-images")
    if client and bucket_name:
        response = client.storage.from_(bucket_name).upload(
            path=object_path,
            file=contents,
            file_options={
                "content-type": content_type,
                "upsert": "true",
            },
        )
        if getattr(response, "error", None):
            raise HTTPException(status_code=500, detail=f"Supabase storage upload failed: {response.error.message}")
        public_url = client.storage.from_(bucket_name).get_public_url(object_path)
        if not public_url:
            raise HTTPException(status_code=500, detail="Supabase storage upload succeeded but no public URL was returned")
        return public_url

    LOCAL_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    file_path = LOCAL_UPLOADS_DIR / filename
    file_path.write_bytes(contents)
    return f"/uploads/{filename}"
