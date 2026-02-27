from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    db_path: str = "/var/lib/askclaw/askclaw.db"
    htpasswd_path: str = "/etc/nginx/.htpasswd"
    upload_dir: str = "/var/lib/askclaw/uploads"
    max_file_size: int = 50 * 1024 * 1024
    max_files_per_message: int = 5
    image_types: set[str] = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    allowed_file_types: set[str] = {
        # Images
        "image/jpeg", "image/png", "image/gif", "image/webp",
        # PDF
        "application/pdf",
        # Office
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/msword",
        "application/vnd.ms-excel",
        "application/vnd.ms-powerpoint",
        # Text / code
        "text/plain", "text/csv", "text/html", "text/css", "text/javascript",
        "text/markdown", "text/xml",
        "application/json", "application/xml",
        # Archives
        "application/zip", "application/gzip", "application/x-tar",
        "application/x-7z-compressed", "application/x-rar-compressed",
    }

    model_config = {"env_prefix": "ASKCLAW_"}


settings = Settings()
