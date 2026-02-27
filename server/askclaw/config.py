from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    db_path: str = str(Path(__file__).resolve().parent.parent / "data" / "askclaw.db")
    htpasswd_path: str = "/etc/nginx/.htpasswd"
    upload_dir: str = str(Path(__file__).resolve().parent.parent / "data" / "uploads")
    max_image_size: int = 5 * 1024 * 1024
    max_images_per_message: int = 5
    allowed_image_types: set[str] = {"image/jpeg", "image/png", "image/gif", "image/webp"}

    model_config = {"env_prefix": "ASKCLAW_"}


settings = Settings()
