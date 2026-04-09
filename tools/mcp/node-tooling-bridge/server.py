#!/usr/bin/env python3
"""DopaFlow MCP bridge for persistent Node/npm tooling.

This keeps frontend verification off shell dotfiles and off `/tmp`.
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

VENDOR = Path(__file__).resolve().parent / "vendor"
if VENDOR.exists():
    sys.path.insert(0, str(VENDOR))

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool


logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s"
)
logger = logging.getLogger("dopaflow-node-mcp")

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_NODE_BIN = ROOT / ".codex-bin"
DEFAULT_FRONTEND_DIR = ROOT / "frontend"


def _resolve_node_bin() -> Path:
    value = os.environ.get("DOPAFLOW_NODE_BIN")
    return Path(value).expanduser() if value else DEFAULT_NODE_BIN


def _resolve_frontend_dir() -> Path:
    value = os.environ.get("DOPAFLOW_FRONTEND_DIR")
    return Path(value).expanduser() if value else DEFAULT_FRONTEND_DIR


def _command_env() -> dict[str, str]:
    env = os.environ.copy()
    node_bin = _resolve_node_bin()
    env["PATH"] = (
        f"{node_bin}:{env.get('PATH', '')}" if env.get("PATH") else str(node_bin)
    )
    return env


def _run(command: list[str], *, cwd: Path | None = None) -> dict[str, Any]:
    logger.info("exec cwd=%s cmd=%s", cwd or ROOT, command)
    completed = subprocess.run(
        command,
        cwd=str(cwd or ROOT),
        env=_command_env(),
        capture_output=True,
        text=True,
        check=False,
    )
    return {
        "command": command,
        "cwd": str(cwd or ROOT),
        "exit_code": completed.returncode,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
        "ok": completed.returncode == 0,
    }


def create_server() -> Server:
    app = Server("dopaflow-node-tooling")

    @app.list_tools()
    async def list_tools() -> list[Tool]:
        return [
            Tool(
                name="node_version",
                description="Return the persistent workspace Node version.",
                inputSchema={"type": "object", "properties": {}},
            ),
            Tool(
                name="npm_version",
                description="Return the persistent workspace npm version.",
                inputSchema={"type": "object", "properties": {}},
            ),
            Tool(
                name="frontend_build",
                description="Run the DopaFlow frontend production build with the persistent Node toolchain.",
                inputSchema={"type": "object", "properties": {}},
            ),
            Tool(
                name="frontend_install",
                description="Run npm install in the DopaFlow frontend with the persistent Node toolchain.",
                inputSchema={"type": "object", "properties": {}},
            ),
            Tool(
                name="frontend_script",
                description="Run an allowed npm script in the DopaFlow frontend.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "script": {
                            "type": "string",
                            "enum": ["build", "dev", "preview"],
                            "description": "Frontend npm script to run.",
                        }
                    },
                    "required": ["script"],
                },
            ),
        ]

    @app.call_tool()
    async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
        frontend_dir = _resolve_frontend_dir()
        node_bin = _resolve_node_bin()

        if name == "node_version":
            result = _run([str(node_bin / "node"), "-v"])
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        if name == "npm_version":
            result = _run([str(node_bin / "npm"), "-v"])
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        if name == "frontend_build":
            result = _run(
                [str(node_bin / "npm"), "--prefix", str(frontend_dir), "run", "build"]
            )
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        if name == "frontend_install":
            result = _run(
                [str(node_bin / "npm"), "--prefix", str(frontend_dir), "install"]
            )
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        if name == "frontend_script":
            script = str(arguments.get("script") or "")
            if script not in {"build", "dev", "preview"}:
                result = {"ok": False, "error": f"Unsupported script: {script}"}
                return [TextContent(type="text", text=json.dumps(result, indent=2))]
            result = _run(
                [str(node_bin / "npm"), "--prefix", str(frontend_dir), "run", script]
            )
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        return [
            TextContent(
                type="text",
                text=json.dumps(
                    {"ok": False, "error": f"Unknown tool: {name}"}, indent=2
                ),
            )
        ]

    return app


async def main() -> None:
    server = create_server()
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
