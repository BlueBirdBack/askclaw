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

    openclaw_config: str = "/root/.openclaw/openclaw.json"

    # Azure OpenAI — when set, overrides the default OpenAI provider
    # Set these to route through your Azure OpenAI deployment instead
    azure_openai_endpoint: str = ""        # e.g. https://YOUR_RESOURCE.openai.azure.com
    azure_openai_key: str = ""             # Azure OpenAI API key
    azure_openai_deployment: str = ""      # Deployment name, e.g. gpt-4o
    azure_openai_api_version: str = "2025-01-01-preview"

    model_config = {"env_prefix": "ASKCLAW_"}


settings = Settings()
