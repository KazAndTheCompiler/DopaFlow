"""Chaos engineering tests and fault injection."""

from __future__ import annotations

import asyncio
import logging
import os
import random
import time
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum
from typing import Any

logger = logging.getLogger("dopaflow.chaos")


class FaultType(Enum):
    """Types of faults that can be injected."""

    DELAY = "delay"  # Add latency
    ERROR = "error"  # Return error
    TIMEOUT = "timeout"  # Cause timeout
    MEMORY_PRESSURE = "memory_pressure"  # Consume memory
    CPU_SPIKE = "cpu_spike"  # CPU intensive operation
    NETWORK_PARTITION = "network_partition"  # Simulate network issues
    DB_SLOWDOWN = "db_slowdown"  # Slow database queries
    KILL_PROCESS = "kill_process"  # Simulate crash (extreme)


@dataclass
class ChaosConfig:
    """Configuration for chaos experiments."""

    enabled: bool = False
    experiment_name: str = "default"
    fault_type: FaultType = FaultType.DELAY
    probability: float = 0.1  # 0.0 to 1.0
    duration_seconds: float = 5.0
    intensity: int = 1  # Severity level
    targets: list[str] = None  # Target endpoints/services

    def __post_init__(self):
        if self.targets is None:
            self.targets = []


class ChaosEngineering:
    """Chaos engineering fault injection system."""

    def __init__(self):
        self.enabled = os.getenv("CHAOS_ENABLED", "false").lower() == "true"
        self.experiments: list[ChaosConfig] = []
        self._load_experiments()

    def _load_experiments(self) -> None:
        """Load chaos experiments from environment."""
        if not self.enabled:
            return

        # Parse CHAOS_EXPERIMENTS env var (JSON format)
        experiments_json = os.getenv("CHAOS_EXPERIMENTS", "[]")
        try:
            import json

            experiments = json.loads(experiments_json)
            for exp in experiments:
                self.experiments.append(
                    ChaosConfig(
                        enabled=exp.get("enabled", True),
                        experiment_name=exp.get("name", "unnamed"),
                        fault_type=FaultType(exp.get("fault_type", "delay")),
                        probability=exp.get("probability", 0.1),
                        duration_seconds=exp.get("duration_seconds", 5.0),
                        intensity=exp.get("intensity", 1),
                        targets=exp.get("targets", []),
                    )
                )
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning(f"Failed to load chaos experiments: {exc}")

        # Default experiment if none configured
        if not self.experiments:
            self.experiments.append(
                ChaosConfig(
                    enabled=True,
                    experiment_name="default_delay",
                    fault_type=FaultType.DELAY,
                    probability=0.05,
                    duration_seconds=2.0,
                )
            )

    def should_inject(self, target: str | None = None) -> ChaosConfig | None:
        """Check if fault should be injected."""
        if not self.enabled:
            return None

        for experiment in self.experiments:
            if not experiment.enabled:
                continue
            if experiment.targets and target not in experiment.targets:
                continue
            if random.random() < experiment.probability:
                return experiment
        return None

    async def inject_fault(self, config: ChaosConfig) -> None:
        """Inject a fault based on configuration."""
        logger.warning(f"Injecting chaos: {config.fault_type.value} ({config.experiment_name})")

        if config.fault_type == FaultType.DELAY:
            await asyncio.sleep(config.duration_seconds)

        elif config.fault_type == FaultType.ERROR:
            raise ChaosException(f"Injected error: {config.experiment_name}")

        elif config.fault_type == FaultType.TIMEOUT:
            await asyncio.sleep(config.duration_seconds * 10)  # Long delay to trigger timeout

        elif config.fault_type == FaultType.MEMORY_PRESSURE:
            self._consume_memory(config.intensity)

        elif config.fault_type == FaultType.CPU_SPIKE:
            self._cpu_spike(config.duration_seconds)

        elif config.fault_type == FaultType.DB_SLOWDOWN:
            await asyncio.sleep(config.duration_seconds)

    def _consume_memory(self, intensity: int) -> None:
        """Consume memory to simulate pressure."""
        # Allocate memory (intensity * 10MB)
        size = intensity * 10 * 1024 * 1024
        data = bytearray(size)
        # Keep reference briefly
        time.sleep(0.1)
        del data

    def _cpu_spike(self, duration_seconds: float) -> None:
        """Cause CPU spike."""
        end_time = time.time() + duration_seconds
        while time.time() < end_time:
            # Busy work
            _ = sum(i * i for i in range(10000))

    def wrap_endpoint(self, endpoint_func: Callable) -> Callable:
        """Wrap an endpoint with chaos injection."""
        if not self.enabled:
            return endpoint_func

        async def wrapper(*args, **kwargs):
            config = self.should_inject(endpoint_func.__name__)
            if config:
                await self.inject_fault(config)
            return await endpoint_func(*args, **kwargs)

        return wrapper


class ChaosException(Exception):
    """Exception raised by chaos engineering."""

    pass


# Global instance
_chaos: ChaosEngineering | None = None


def get_chaos() -> ChaosEngineering:
    """Get or create global chaos engineering instance."""
    global _chaos
    if _chaos is None:
        _chaos = ChaosEngineering()
    return _chaos


def chaos_inject(fault_type: FaultType | None = None, probability: float = 0.1):
    """Decorator to add chaos injection to a function."""

    def decorator(func: Callable) -> Callable:
        import functools

        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            chaos = get_chaos()
            if not chaos.enabled:
                return await func(*args, **kwargs)

            # Check if we should inject
            if random.random() < probability:
                config = ChaosConfig(
                    fault_type=fault_type or FaultType.DELAY,
                    probability=1.0,
                )
                await chaos.inject_fault(config)

            return await func(*args, **kwargs)

        return wrapper

    return decorator


class ChaosTestSuite:
    """Predefined chaos experiments for testing."""

    @staticmethod
    async def run_latency_test(duration_seconds: float = 60.0) -> dict[str, Any]:
        """Run latency injection test."""
        logger.info(f"Starting latency chaos test for {duration_seconds}s")
        config = ChaosConfig(
            enabled=True,
            experiment_name="latency_test",
            fault_type=FaultType.DELAY,
            probability=0.2,
            duration_seconds=2.0,
        )

        start = time.time()
        injections = 0

        while time.time() - start < duration_seconds:
            if random.random() < config.probability:
                await asyncio.sleep(config.duration_seconds)
                injections += 1
            await asyncio.sleep(0.1)

        return {
            "test": "latency",
            "duration": duration_seconds,
            "injections": injections,
        }

    @staticmethod
    async def run_error_injection_test(duration_seconds: float = 60.0) -> dict[str, Any]:
        """Run error injection test."""
        logger.info(f"Starting error injection test for {duration_seconds}s")
        config = ChaosConfig(
            enabled=True,
            experiment_name="error_test",
            fault_type=FaultType.ERROR,
            probability=0.1,
        )

        start = time.time()
        errors_injected = 0

        while time.time() - start < duration_seconds:
            if random.random() < config.probability:
                errors_injected += 1
                logger.warning(f"Error injection #{errors_injected}")
            await asyncio.sleep(1)

        return {
            "test": "error_injection",
            "duration": duration_seconds,
            "errors_injected": errors_injected,
        }

    @staticmethod
    async def run_resource_pressure_test(duration_seconds: float = 30.0) -> dict[str, Any]:
        """Run resource pressure test."""
        logger.info(f"Starting resource pressure test for {duration_seconds}s")

        # Memory pressure
        data = []
        for _ in range(10):  # 100MB
            data.append(bytearray(10 * 1024 * 1024))
            await asyncio.sleep(0.5)

        # CPU pressure
        end_time = time.time() + duration_seconds / 2
        while time.time() < end_time:
            _ = sum(i * i for i in range(100000))

        # Cleanup
        del data

        return {
            "test": "resource_pressure",
            "duration": duration_seconds,
            "memory_mb": 100,
        }


# Health check endpoint for chaos status
def get_chaos_status() -> dict[str, Any]:
    """Get current chaos engineering status."""
    chaos = get_chaos()
    return {
        "enabled": chaos.enabled,
        "experiments": [
            {
                "name": exp.experiment_name,
                "type": exp.fault_type.value,
                "probability": exp.probability,
                "enabled": exp.enabled,
            }
            for exp in chaos.experiments
        ],
    }
