"""Router for chaos engineering endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.chaos import (
    ChaosConfig,
    ChaosTestSuite,
    FaultType,
    get_chaos,
    get_chaos_status,
)
from app.core.config import Settings, get_settings_dependency

router = APIRouter(prefix="/chaos", tags=["chaos"])


@router.get("/status")
async def chaos_status() -> dict:
    """Get chaos engineering status."""
    return get_chaos_status()


@router.post("/experiments")
async def create_experiment(
    config: dict,
    settings: Settings = Depends(get_settings_dependency),
) -> dict:
    """Create a new chaos experiment (requires ops access)."""
    chaos = get_chaos()

    experiment = ChaosConfig(
        enabled=config.get("enabled", True),
        experiment_name=config["name"],
        fault_type=FaultType(config.get("fault_type", "delay")),
        probability=config.get("probability", 0.1),
        duration_seconds=config.get("duration_seconds", 5.0),
        intensity=config.get("intensity", 1),
        targets=config.get("targets", []),
    )

    chaos.experiments.append(experiment)
    return {"status": "created", "experiment": config["name"]}


@router.get("/experiments")
async def list_experiments() -> dict:
    """List all chaos experiments."""
    chaos = get_chaos()
    return {
        "experiments": [
            {
                "name": exp.experiment_name,
                "type": exp.fault_type.value,
                "probability": exp.probability,
                "duration_seconds": exp.duration_seconds,
                "intensity": exp.intensity,
                "targets": exp.targets,
                "enabled": exp.enabled,
            }
            for exp in chaos.experiments
        ]
    }


@router.post("/tests/latency")
async def run_latency_test(duration_seconds: float = 60.0) -> dict:
    """Run latency chaos test."""
    result = await ChaosTestSuite.run_latency_test(duration_seconds)
    return result


@router.post("/tests/error-injection")
async def run_error_injection_test(duration_seconds: float = 60.0) -> dict:
    """Run error injection test."""
    result = await ChaosTestSuite.run_error_injection_test(duration_seconds)
    return result


@router.post("/tests/resource-pressure")
async def run_resource_pressure_test(duration_seconds: float = 30.0) -> dict:
    """Run resource pressure test."""
    result = await ChaosTestSuite.run_resource_pressure_test(duration_seconds)
    return result


@router.post("/enable")
async def enable_chaos() -> dict:
    """Enable chaos engineering."""
    chaos = get_chaos()
    chaos.enabled = True
    return {"status": "enabled"}


@router.post("/disable")
async def disable_chaos() -> dict:
    """Disable chaos engineering."""
    chaos = get_chaos()
    chaos.enabled = False
    return {"status": "disabled"}
