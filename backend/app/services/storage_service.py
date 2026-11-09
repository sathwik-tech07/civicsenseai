import os
import uuid
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from app.config import settings


class StorageError(Exception):
    """Base exception for storage operations."""
    pass


class StorageConfigurationError(StorageError):
    """Raised when storage credentials or configuration are missing or invalid."""
    pass


class StorageUploadError(StorageError):
    """Raised when file upload to storage fails."""
    pass


class BaseStorageProvider(ABC):
    """Abstract Base Class for CivicSense AI image evidence storage."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Returns the identifier name of the storage provider."""
        pass

    @abstractmethod
    async def store_image(
        self,
        contents: bytes,
        safe_ext: str,
        mime_type: str,
        prefix: str = "uploads"
    ) -> Dict[str, Any]:
        """
        Stores image bytes securely.
        Returns a dict:
        {
            "filename": str,           # Safe storage key or filename
            "file_url": str,           # Reachable URL
            "storage_provider": str,   # e.g. 'local' or 's3'
            "size_bytes": int
        }
        """
        pass

    @abstractmethod
    def generate_presigned_url(
        self,
        filename: str,
        expiration_seconds: Optional[int] = None
    ) -> str:
        """Generates an authenticated/presigned URL for private evidence object access."""
        pass

    @abstractmethod
    async def get_image_url(self, filename: str) -> str:
        """Resolves accessible URL for a stored image."""
        pass

    @abstractmethod
    async def delete_image(self, filename: str) -> bool:
        """Deletes an image from storage (for rollback or cleanup)."""
        pass


class LocalStorageProvider(BaseStorageProvider):
    """
    Local filesystem storage provider for development and testing.
    Stores files in backend/uploads with path traversal protections.
    """

    def __init__(self, upload_dir: Optional[str] = None):
        if upload_dir:
            self.upload_dir = os.path.abspath(upload_dir)
        else:
            backend_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            self.upload_dir = os.path.abspath(os.path.join(backend_root, "uploads"))
        os.makedirs(self.upload_dir, exist_ok=True)

    @property
    def provider_name(self) -> str:
        return "local"

    async def store_image(
        self,
        contents: bytes,
        safe_ext: str,
        mime_type: str,
        prefix: str = "uploads"
    ) -> Dict[str, Any]:
        from app.utils.image_security import generate_safe_storage_filename, validate_storage_path

        filename = generate_safe_storage_filename(safe_ext)
        filepath = validate_storage_path(self.upload_dir, filename)

        try:
            with open(filepath, "wb") as f:
                f.write(contents)
        except OSError as e:
            raise StorageUploadError(f"Failed to write image to local disk: {e}") from e

        file_url = await self.get_image_url(filename)
        return {
            "filename": filename,
            "file_url": file_url,
            "storage_provider": self.provider_name,
            "size_bytes": len(contents)
        }

    def generate_presigned_url(
        self,
        filename: str,
        expiration_seconds: Optional[int] = None
    ) -> str:
        clean_filename = os.path.basename(filename)
        return f"/uploads/{clean_filename}"

    async def get_image_url(self, filename: str) -> str:
        # Strip path traversal elements to guarantee safety
        clean_filename = os.path.basename(filename)
        return f"/uploads/{clean_filename}"

    async def delete_image(self, filename: str) -> bool:
        from app.utils.image_security import validate_storage_path
        try:
            clean_filename = os.path.basename(filename)
            filepath = validate_storage_path(self.upload_dir, clean_filename)
            if os.path.exists(filepath):
                os.remove(filepath)
            return True
        except Exception:
            return False


class S3StorageProvider(BaseStorageProvider):
    """
    S3-compatible object storage provider for production deployments (Render, AWS, Cloudflare R2, MinIO).
    Stores evidence images in persistent buckets with random object keys.
    """

    def __init__(
        self,
        bucket_name: Optional[str] = None,
        region_name: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        public_url_prefix: Optional[str] = None,
        s3_client: Optional[Any] = None
    ):
        self.bucket_name = (bucket_name if bucket_name is not None else settings.S3_BUCKET_NAME).strip()
        self.region_name = (region_name if region_name is not None else settings.S3_REGION_NAME).strip() or "us-east-1"
        raw_endpoint = endpoint_url if endpoint_url is not None else settings.S3_ENDPOINT_URL
        self.endpoint_url = raw_endpoint.strip() if raw_endpoint else None
        self.access_key_id = (access_key_id if access_key_id is not None else settings.S3_ACCESS_KEY_ID).strip()
        self.secret_access_key = (secret_access_key if secret_access_key is not None else settings.S3_SECRET_ACCESS_KEY).strip()
        raw_public_prefix = public_url_prefix if public_url_prefix is not None else settings.S3_PUBLIC_URL_PREFIX
        self.public_url_prefix = raw_public_prefix.strip().rstrip("/") if raw_public_prefix else None
        self._client = s3_client

    @property
    def provider_name(self) -> str:
        return "s3"

    def validate_credentials(self):
        """
        Ensures credentials and bucket name are configured.
        Never prints or exposes secret values in error messages.
        """
        missing = []
        if not self.bucket_name:
            missing.append("S3_BUCKET_NAME")
        if not self.access_key_id:
            missing.append("S3_ACCESS_KEY_ID")
        if not self.secret_access_key:
            missing.append("S3_SECRET_ACCESS_KEY")
        if missing:
            raise StorageConfigurationError(
                f"S3 object storage is not properly configured. Missing required environment variables: {', '.join(missing)}."
            )

    def _get_client(self):
        if self._client is not None:
            return self._client

        self.validate_credentials()
        try:
            import boto3
            session_kwargs = {
                "aws_access_key_id": self.access_key_id,
                "aws_secret_access_key": self.secret_access_key,
                "region_name": self.region_name,
            }
            client_kwargs = {}
            if self.endpoint_url:
                client_kwargs["endpoint_url"] = self.endpoint_url

            session = boto3.session.Session(**session_kwargs)
            return session.client("s3", **client_kwargs)
        except ImportError:
            raise StorageConfigurationError(
                "The 'boto3' package is required for S3 object storage but is not installed in the environment."
            )

    async def store_image(
        self,
        contents: bytes,
        safe_ext: str,
        mime_type: str,
        prefix: str = "uploads"
    ) -> Dict[str, Any]:
        self.validate_credentials()

        # Random server-generated key - NEVER relies on client filenames
        random_token = uuid.uuid4().hex[:16]
        clean_prefix = prefix.strip("/") if prefix else "uploads"
        object_key = f"{clean_prefix}/img_{random_token}.{safe_ext}"

        client = self._get_client()
        try:
            client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=contents,
                ContentType=mime_type,
            )
        except Exception as e:
            # Mask any internal secrets in error message
            err_msg = str(e)
            if self.secret_access_key and self.secret_access_key in err_msg:
                err_msg = err_msg.replace(self.secret_access_key, "[REDACTED_SECRET]")
            raise StorageUploadError(
                f"Failed to upload image to S3 bucket '{self.bucket_name}': {type(e).__name__}: {err_msg}"
            ) from e

        file_url = await self.get_image_url(object_key)
        return {
            "filename": object_key,
            "file_url": file_url,
            "storage_provider": self.provider_name,
            "size_bytes": len(contents)
        }

    def generate_presigned_url(
        self,
        filename: str,
        expiration_seconds: Optional[int] = None
    ) -> str:
        """
        Generates an AWS SigV4 presigned GET URL for private S3 objects.
        Expires in expiration_seconds (defaults to settings.S3_PRESIGNED_EXPIRATION_SECONDS).
        Never exposes AWS credentials in output or errors.
        """
        client = self._get_client()
        exp = expiration_seconds if expiration_seconds is not None else getattr(settings, "S3_PRESIGNED_EXPIRATION_SECONDS", 900)
        key = filename.lstrip("/")
        try:
            url = client.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": self.bucket_name, "Key": key},
                ExpiresIn=exp
            )
            return url
        except Exception as e:
            err_msg = str(e)
            if self.secret_access_key and self.secret_access_key in err_msg:
                err_msg = err_msg.replace(self.secret_access_key, "[REDACTED_SECRET]")
            raise StorageError(f"Failed to generate presigned URL for S3 object: {err_msg}") from e

    async def get_image_url(self, filename: str, expiration_seconds: Optional[int] = None) -> str:
        """
        Resolves an AWS SigV4 presigned URL for the private S3 object.
        Direct public S3 URL generation is completely eliminated.
        """
        return self.generate_presigned_url(filename, expiration_seconds=expiration_seconds)

    async def delete_image(self, filename: str) -> bool:
        try:
            client = self._get_client()
            client.delete_object(Bucket=self.bucket_name, Key=filename.lstrip("/"))
            return True
        except Exception:
            return False


def get_storage_provider(
    provider_type: Optional[str] = None,
    s3_client: Optional[Any] = None,
    upload_dir: Optional[str] = None
) -> BaseStorageProvider:
    """
    Factory resolving the active storage provider based on configuration.
    Defaults to 'local' for development, 's3' for production.
    """
    selected = (provider_type or settings.STORAGE_PROVIDER).lower()

    if selected == "local":
        return LocalStorageProvider(upload_dir=upload_dir)
    elif selected == "s3":
        return S3StorageProvider(s3_client=s3_client)
    else:
        raise StorageConfigurationError(
            f"Unsupported STORAGE_PROVIDER '{selected}'. Must be 'local' or 's3'."
        )
