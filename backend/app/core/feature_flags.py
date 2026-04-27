"""Feature flag management system."""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from app.core.config import Settings

logger = logging.getLogger("dopaflow.feature_flags")


class FlagType(Enum):
    """Types of feature flags."""

    BOOLEAN = "boolean"
    PERCENTAGE = "percentage"
    USER_LIST = "user_list"
    TIME_BASED = "time_based"


@dataclass
class FeatureFlag:
    """Feature flag configuration."""

    name: str
    flag_type: FlagType
    enabled: bool = False
    percentage: int = 0  # For percentage rollout (0-100)
    users: list[str] = field(default_factory=list)  # For user-based rollout
    start_time: str | None = None  # For time-based rollout (ISO format)
    end_time: str | None = None
    description: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def evaluate(self, user_id: str | None = None) -> bool:
        """Evaluate if flag is enabled for given context."""
        if not self.enabled:
            return False

        if self.flag_type == FlagType.BOOLEAN:
            return self.enabled

        elif self.flag_type == FlagType.PERCENTAGE:
            if user_id:
                # Deterministic based on user_id
                import hashlib

                hash_val = int(hashlib.md5(user_id.encode()).hexdigest(), 16)
                return (hash_val % 100) < self.percentage
            return False

        elif self.flag_type == FlagType.USER_LIST:
            return user_id in self.users if user_id else False

        elif self.flag_type == FlagType.TIME_BASED:
            from datetime import datetime, timezone

            now = datetime.now(timezone.utc)
            if self.start_time:
                start = datetime.fromisoformat(self.start_time)
                if now < start:
                    return False
            if self.end_time:
                end = datetime.fromisoformat(self.end_time)
                if now > end:
                    return False
            return True

        return False


class FeatureFlagManager:
    """Manager for feature flags."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._flags: dict[str, FeatureFlag] = {}
        self._load_flags()

    def _load_flags(self) -> None:
        """Load flags from environment or config file."""
        # Load from environment variables (DOPAFLOW_FF_*)
        for key, value in os.environ.items():
            if key.startswith("DOPAFLOW_FF_"):
                flag_name = key.replace("DOPAFLOW_FF_", "").lower()
                try:
                    flag_data = json.loads(value)
                    self._flags[flag_name] = FeatureFlag(
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
                except (json.JSONDecodeError, ValueError):
                    # Simple boolean flag
                    self._flags[flag_name] = FeatureFlag(
                        name=flag_name,
                        flag_type=FlagType.BOOLEAN,
                        enabled=value.lower() in ("true", "1", "yes"),
                    )

        # Load default flags
        self._load_defaults()

    def _load_defaults(self) -> None:
        """Load default feature flags."""
        defaults = [
            FeatureFlag(
                name="new_ui",
                flag_type=FlagType.BOOLEAN,
                enabled=False,
                description="Enable new UI design",
            ),
            FeatureFlag(
                name="beta_features",
                flag_type=FlagType.USER_LIST,
                enabled=True,
                users=[],
                description="Beta features for select users",
            ),
            FeatureFlag(
                name="gradual_rollout",
                flag_type=FlagType.PERCENTAGE,
                enabled=True,
                percentage=10,
                description="Gradual feature rollout",
            ),
            FeatureFlag(
                name="scheduled_feature",
                flag_type=FlagType.TIME_BASED,
                enabled=True,
                start_time="2026-05-01T00:00:00+00:00",
                description="Time-based feature activation",
            ),
        ]

        for flag in defaults:
            if flag.name not in self._flags:
                self._flags[flag.name] = flag

    def is_enabled(self, flag_name: str, user_id: str | None = None) -> bool:
        """Check if a feature flag is enabled."""
        flag = self._flags.get(flag_name)
        if not flag:
            return False
        return flag.evaluate(user_id)

    def get_flag(self, flag_name: str) -> FeatureFlag | None:
        """Get a feature flag by name."""
        return self._flags.get(flag_name)

    def list_flags(self) -> list[FeatureFlag]:
        """List all feature flags."""
        return list(self._flags.values())

    def update_flag(self, flag: FeatureFlag) -> None:
        """Update a feature flag."""
        self._flags[flag.name] = flag
        logger.info(f"Updated feature flag: {flag.name}")

    def create_flag(self, flag: FeatureFlag) -> None:
        """Create a new feature flag."""
        if flag.name in self._flags:
            raise ValueError(f"Flag {flag.name} already exists")
        self._flags[flag.name] = flag
        logger.info(f"Created feature flag: {flag.name}")

    def delete_flag(self, flag_name: str) -> None:
        """Delete a feature flag."""
        if flag_name in self._flags:
            del self._flags[flag_name]
            logger.info(f"Deleted feature flag: {flag_name}")

    def get_enabled_features(self, user_id: str | None = None) -> list[str]:
        """Get list of enabled features for user."""
        return [
            name for name, flag in self._flags.items() if flag.evaluate(user_id)
        ]


# Global instance
_ff_manager: FeatureFlagManager | None = None

# Import at module level for decorator
import asyncio
import functools


def get_feature_flag_manager(settings: Settings | None = None) -> FeatureFlagManager:
    """Get or create the global feature flag manager."""
    global _ff_manager
    if _ff_manager is None:
        if settings is None:
            raise ValueError("Settings required for initial feature flag manager creation")
        _ff_manager = FeatureFlagManager(settings)
    return _ff_manager


def is_feature_enabled(flag_name: str, user_id: str | None = None) -> bool:
    """Check if a feature is enabled (uses global manager)."""
    if _ff_manager is None:
        return False
    return _ff_manager.is_enabled(flag_name, user_id)


def feature_flag(
    flag_name: str,
    default: Any = None,
    user_id_getter: Callable | None = None,
):
    """Decorator to conditionally enable features based on flag."""

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            uid = user_id_getter(*args, **kwargs) if user_id_getter else None
            if is_feature_enabled(flag_name, uid):
                return func(*args, **kwargs)
            return default

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            uid = user_id_getter(*args, **kwargs) if user_id_getter else None
            if is_feature_enabled(flag_name, uid):
                return await func(*args, **kwargs)
            return default

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return wrapper

    return decorator
