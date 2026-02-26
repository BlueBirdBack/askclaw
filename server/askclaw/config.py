from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    db_path: str = str(Path(__file__).resolve().parent.parent / "data" / "askclaw.db")
    htpasswd_path: str = "/etc/nginx/.htpasswd"

    model_config = {"env_prefix": "ASKCLAW_"}


settings = Settings()
