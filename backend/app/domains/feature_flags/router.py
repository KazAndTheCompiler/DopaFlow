"""Router for feature flag management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.core.config import Settings, get_settings_dependency
from app.core.feature_flags import (
    FeatureFlag,
    FlagType,
    get_feature_flag_manager,
)

router = APIRouter(prefix="/feature-flags", tags=["feature-flags"])


@router.get("")
async def list_feature_flags(
    settings: Settings = Depends(get_settings_dependency),
) -> dict:
    """List all feature flags."""
    manager = get_feature_flag_manager(settings)
    flags = manager.list_flags()
    return {
        "flags": [
            {
                "name": f.name,
                "type": f.flag_type.value,
                "enabled": f.enabled,
                "percentage": f.percentage,
                "users": f.users,
                "start_time": f.start_time,
                "end_time": f.end_time,
                "description": f.description,
            }
            for f in flags
        ]
    }


@router.get("/check/{flag_name}")
async def check_feature_flag(
    flag_name: str,
    user_id: str | None = None,
    settings: Settings = Depends(get_settings_dependency),
) -> dict:
    """Check if a feature flag is enabled for a user."""
    manager = get_feature_flag_manager(settings)
    is_enabled = manager.is_enabled(flag_name, user_id)
    return {
        "flag": flag_name,
        "user_id": user_id,
        "enabled": is_enabled,
    }


@router.get("/enabled")
async def get_enabled_features(
    user_id: str | None = None,
    settings: Settings = Depends(get_settings_dependency),
) -> dict:
    """Get all enabled features for a user."""
    manager = get_feature_flag_manager(settings)
    enabled = manager.get_enabled_features(user_id)
    return {
        "user_id": user_id,
        "enabled_features": enabled,
    }


@router.post("")
async def create_feature_flag(
    flag_data: dict,
    settings: Settings = Depends(get_settings_dependency),
) -> dict:
    """Create a new feature flag (requires ops access)."""
    manager = get_feature_flag_manager(settings)

    flag = FeatureFlag(
        name=flag_data["name"],
        flag_type=FlagType(flag_data.get("type", "boolean")),
        enabled=flag_data.get("enabled", False),
        percentage=flag_data.get("percentage", 0),
        users=flag_data.get("users", []),
        start_time=flag_data.get("start_time"),
        end_time=flag_data.get("end_time"),
        description=flag_data.get("description", ""),
        metadata=flag_data.get("metadata", {}),
    )

    try:
        manager.create_flag(flag)
        return {"status": "created", "flag": flag_data["name"]}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/{flag_name}")
async def update_feature_flag(
    flag_name: str,
    flag_data: dict,
    settings: Settings = Depends(get_settings_dependency),
) -> dict:
    """Update a feature flag (requires ops access)."""
    manager = get_feature_flag_manager(settings)

    flag = FeatureFlag(
        name=flag_name,
        flag_type=FlagType(flag_data.get("type", "boolean")),
        enabled=flag_data.get("enabled", False),
        percentage=flag_data.get("percentage", 0),
        users=flag_data.get("users", []),
        start_time=flag_data.get("start_time"),
        end_time=flag_data.get("end_time"),
        description=flag_data.get("description", ""),
        metadata=flag_data.get("metadata", {}),
    )

    manager.update_flag(flag)
    return {"status": "updated", "flag": flag_name}


@router.delete("/{flag_name}")
async def delete_feature_flag(
    flag_name: str,
    settings: Settings = Depends(get_settings_dependency),
) -> dict:
    """Delete a feature flag (requires ops access)."""
    manager = get_feature_flag_manager(settings)
    manager.delete_flag(flag_name)
    return {"status": "deleted", "flag": flag_name}
