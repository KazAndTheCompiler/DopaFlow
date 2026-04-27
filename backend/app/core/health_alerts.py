"""Health check alerting and monitoring."""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum

import httpx

from app.domains.health.service import HealthService

logger = logging.getLogger("dopaflow.health_alerts")


class AlertSeverity(Enum):
    """Alert severity levels."""

    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class AlertConfig:
    """Configuration for health check alerting."""

    # Check intervals
    check_interval_seconds: int = 60
    alert_cooldown_seconds: int = 300  # 5 minutes between same alerts

    # Thresholds
    consecutive_failures_before_alert: int = 2
    slow_response_threshold_ms: float = 1000.0

    # Webhook URLs
    slack_webhook_url: str | None = None
    pagerduty_key: str | None = None
    custom_webhook_url: str | None = None

    # Alert channels enabled
    enable_slack: bool = False
    enable_pagerduty: bool = False
    enable_email: bool = False

    # Environment
    environment: str = "production"
    service_name: str = "dopaflow"


class HealthAlertManager:
    """Manages health check monitoring and alerting.

    Features:
    - Periodic health checks
    - Alert deduplication
    - Multiple notification channels
    - Alert history tracking
    """

    def __init__(self, config: AlertConfig, db_path: str):
        self.config = config
        self.db_path = db_path
        self._running = False
        self._task: asyncio.Task | None = None
        self._failure_count = 0
        self._last_alert_time: datetime | None = None
        self._alert_history: list[dict] = []
        self._max_history = 100

    async def start(self) -> None:
        """Start the health check monitoring loop."""
        if self._running:
            return

        self._running = True
        self._task = asyncio.create_task(self._monitor_loop())
        logger.info("Health alert manager started")

    async def stop(self) -> None:
        """Stop the health check monitoring loop."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Health alert manager stopped")

    async def _monitor_loop(self) -> None:
        """Main monitoring loop."""
        while self._running:
            try:
                await self._check_health()
                await asyncio.sleep(self.config.check_interval_seconds)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error(f"Error in health monitor loop: {exc}")
                await asyncio.sleep(self.config.check_interval_seconds)

    async def _check_health(self) -> None:
        """Perform health check and trigger alerts if needed."""
        try:
            # Get health status
            health_data = HealthService.get_ready(self.db_path)
            status = health_data.get("status", "unknown")

            if status == "ready":
                # Reset failure count on success
                if self._failure_count > 0:
                    logger.info(f"Health check recovered after {self._failure_count} failures")
                    await self._send_recovery_alert()
                self._failure_count = 0
            else:
                self._failure_count += 1
                logger.warning(f"Health check failed ({self._failure_count} consecutive): {status}")

                # Trigger alert if threshold reached
                if self._failure_count >= self.config.consecutive_failures_before_alert:
                    await self._trigger_alert(
                        severity=AlertSeverity.CRITICAL if self._failure_count >= 5 else AlertSeverity.WARNING,
                        message=f"Health check failed {self._failure_count} times consecutively",
                        details=health_data,
                    )

        except Exception as exc:
            self._failure_count += 1
            logger.error(f"Health check exception: {exc}")

            if self._failure_count >= self.config.consecutive_failures_before_alert:
                await self._trigger_alert(
                    severity=AlertSeverity.CRITICAL,
                    message=f"Health check exception: {exc!s}",
                    details={"error": str(exc)},
                )

    async def _trigger_alert(
        self,
        severity: AlertSeverity,
        message: str,
        details: dict | None = None,
    ) -> None:
        """Trigger an alert if not in cooldown."""
        now = datetime.utcnow()

        # Check cooldown
        if self._last_alert_time:
            cooldown_end = self._last_alert_time + timedelta(
                seconds=self.config.alert_cooldown_seconds
            )
            if now < cooldown_end:
                logger.debug(f"Alert in cooldown, skipping: {message}")
                return

        self._last_alert_time = now

        # Build alert payload
        alert = {
            "timestamp": now.isoformat(),
            "severity": severity.value,
            "service": self.config.service_name,
            "environment": self.config.environment,
            "message": message,
            "details": details or {},
            "consecutive_failures": self._failure_count,
        }

        # Add to history
        self._alert_history.append(alert)
        if len(self._alert_history) > self._max_history:
            self._alert_history.pop(0)

        # Send to configured channels
        await self._send_alert(alert)

    async def _send_alert(self, alert: dict) -> None:
        """Send alert to all configured channels."""
        tasks = []

        if self.config.enable_slack and self.config.slack_webhook_url:
            tasks.append(self._send_slack_alert(alert))

        if self.config.enable_pagerduty and self.config.pagerduty_key:
            tasks.append(self._send_pagerduty_alert(alert))

        if self.config.custom_webhook_url:
            tasks.append(self._send_custom_webhook_alert(alert))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _send_slack_alert(self, alert: dict) -> None:
        """Send alert to Slack webhook."""
        severity_emoji = {
            AlertSeverity.INFO.value: "ℹ️",
            AlertSeverity.WARNING.value: "⚠️",
            AlertSeverity.CRITICAL.value: "🚨",
        }

        payload = {
            "text": f"{severity_emoji.get(alert['severity'], '❓')} Health Alert: {alert['service']}",
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"{severity_emoji.get(alert['severity'], '❓')} {alert['severity'].upper()}: {alert['service']}",
                    },
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Environment:*\n{alert['environment']}",
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*Time:*\n{alert['timestamp']}",
                        },
                    ],
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Message:*\n{alert['message']}",
                    },
                },
            ],
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.config.slack_webhook_url,
                    json=payload,
                    timeout=10.0,
                )
                response.raise_for_status()
                logger.info("Slack alert sent successfully")
        except Exception as exc:
            logger.error(f"Failed to send Slack alert: {exc}")

    async def _send_pagerduty_alert(self, alert: dict) -> None:
        """Send alert to PagerDuty."""
        severity_map = {
            AlertSeverity.INFO.value: "info",
            AlertSeverity.WARNING.value: "warning",
            AlertSeverity.CRITICAL.value: "critical",
        }

        payload = {
            "routing_key": self.config.pagerduty_key,
            "event_action": "trigger",
            "dedup_key": f"{alert['service']}-{alert['environment']}-health",
            "payload": {
                "summary": alert["message"],
                "severity": severity_map.get(alert["severity"], "error"),
                "source": alert["service"],
                "custom_details": alert["details"],
            },
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://events.pagerduty.com/v2/enqueue",
                    json=payload,
                    timeout=10.0,
                )
                response.raise_for_status()
                logger.info("PagerDuty alert sent successfully")
        except Exception as exc:
            logger.error(f"Failed to send PagerDuty alert: {exc}")

    async def _send_custom_webhook_alert(self, alert: dict) -> None:
        """Send alert to custom webhook."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.config.custom_webhook_url,
                    json=alert,
                    timeout=10.0,
                )
                response.raise_for_status()
                logger.info("Custom webhook alert sent successfully")
        except Exception as exc:
            logger.error(f"Failed to send custom webhook alert: {exc}")

    async def _send_recovery_alert(self) -> None:
        """Send recovery notification."""
        alert = {
            "timestamp": datetime.utcnow().isoformat(),
            "severity": AlertSeverity.INFO.value,
            "service": self.config.service_name,
            "environment": self.config.environment,
            "message": f"Service recovered after {self._failure_count} failures",
        }

        # Only send to Slack for recovery
        if self.config.enable_slack and self.config.slack_webhook_url:
            await self._send_slack_alert(alert)

    def get_alert_history(self, limit: int = 50) -> list[dict]:
        """Get recent alert history."""
        return self._alert_history[-limit:]


def create_alert_manager_from_env(db_path: str) -> HealthAlertManager:
    """Create alert manager from environment variables."""
    config = AlertConfig(
        check_interval_seconds=int(os.getenv("HEALTH_CHECK_INTERVAL", "60")),
        alert_cooldown_seconds=int(os.getenv("ALERT_COOLDOWN_SECONDS", "300")),
        consecutive_failures_before_alert=int(
            os.getenv("CONSECUTIVE_FAILURES_THRESHOLD", "2")
        ),
        slack_webhook_url=os.getenv("SLACK_WEBHOOK_URL"),
        pagerduty_key=os.getenv("PAGERDUTY_INTEGRATION_KEY"),
        custom_webhook_url=os.getenv("HEALTH_ALERT_WEBHOOK_URL"),
        enable_slack=bool(os.getenv("SLACK_WEBHOOK_URL")),
        enable_pagerduty=bool(os.getenv("PAGERDUTY_INTEGRATION_KEY")),
        environment=os.getenv("ENVIRONMENT", "production"),
        service_name=os.getenv("SERVICE_NAME", "dopaflow"),
    )

    return HealthAlertManager(config, db_path)
