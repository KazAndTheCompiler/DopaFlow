# DopaFlow Node Tooling MCP

Small MCP bridge for this repo's frontend Node workflow.

It exposes a persistent workspace Node install instead of relying on `/tmp` or shell startup files.

## Tools

- `node_version`
- `npm_version`
- `frontend_build`
- `frontend_install`
- `frontend_script`

## Run

```bash
python3 ./tools/mcp/node-tooling-bridge/server.py
```

## MCP Config

Use the repo-level `.mcp.json` or this snippet:

```json
{
  "mcpServers": {
    "dopaflow-node": {
      "command": "python3",
      "args": ["./tools/mcp/node-tooling-bridge/server.py"],
      "env": {
        "DOPAFLOW_NODE_BIN": "${DOPAFLOW_NODE_BIN:-.codex-bin}",
        "DOPAFLOW_FRONTEND_DIR": "${DOPAFLOW_FRONTEND_DIR:-./frontend}"
      }
    }
  }
}
```

## Defaults

- Node bin: `.codex-bin` (relative to repo root)
- Frontend: `./frontend` (relative to repo root)
