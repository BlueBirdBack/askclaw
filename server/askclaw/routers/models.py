import json
import re

from fastapi import APIRouter, Depends, HTTPException

from ..auth import get_current_user
from ..config import settings
from ..models import ModelOut

router = APIRouter()


def _display_name(model_str: str) -> str:
    """Derive a display name from an API model string.

    "anthropic/claude-sonnet-4-6" → "Sonnet 4.6"
    "anthropic/claude-opus-4-6"   → "Opus 4.6"
    """
    # Strip provider prefix
    name = model_str.split("/")[-1]  # "claude-sonnet-4-6"

    # Remove "claude-" prefix
    name = re.sub(r"^claude-", "", name)  # "sonnet-4-6"

    # Split into family and version parts
    # Match: family name (letters+hyphens) then version digits separated by hyphens
    m = re.match(r"^([a-z]+(?:-[a-z]+)*)-(\d+(?:-\d+)*)$", name)
    if m:
        family = m.group(1).title()  # "Sonnet"
        version = m.group(2).replace("-", ".")  # "4.6"
        return f"{family} {version}"

    # Fallback: just title-case the whole thing
    return name.replace("-", " ").title()


@router.get("/models")
async def list_models(username: str = Depends(get_current_user)) -> list[ModelOut]:
    try:
        with open(settings.openclaw_config) as f:
            config = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        raise HTTPException(status_code=503, detail="Model configuration unavailable")

    agents = config.get("agents", {}).get("list", [])
    return [
        ModelOut(
            id=agent["id"],
            model=agent.get("model", ""),
            name=_display_name(agent.get("model", agent["id"])),
        )
        for agent in agents
        if "id" in agent
    ]
