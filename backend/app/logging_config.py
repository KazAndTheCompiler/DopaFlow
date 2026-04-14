from __future__ import annotations

import logging

from pythonjsonlogger import jsonlogger


def _build_formatter(production: bool) -> logging.Formatter:
    if production:
        return jsonlogger.JsonFormatter(
            "%(asctime)s %(levelname)s %(name)s %(message)s",
            rename_fields={
                "asctime": "timestamp",
                "levelname": "level",
                "name": "logger",
            },
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )
    return logging.Formatter(
        "%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    )


def configure_logging(*, production: bool) -> None:
    root_logger = logging.getLogger()
    formatter = _build_formatter(production)
    handlers = root_logger.handlers or [logging.StreamHandler()]
    if not root_logger.handlers:
        root_logger.addHandler(handlers[0])
    for handler in handlers:
        handler.setFormatter(formatter)
