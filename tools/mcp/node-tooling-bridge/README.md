# DopaFlow Node Tooling MCP

Small MCP bridge for this repo's frontend Node workflow.

It exposes a persistent workspace Node install instead of relying on `/tmp` or shell startup files.

## Tools

- `node_version`
- `npm_version`
- `frontend_build`
- `frontend_install`
- `frontend_script`

## Paths

- Node bin: `/home/henry/vscode/.codex-bin`
- Frontend: `/home/henry/vscode/build/dopaflow/frontend`

## Run

```bash
python3 /home/henry/vscode/build/dopaflow/tools/mcp/node-tooling-bridge/server.py
```

## MCP Config

Use the repo-level `.mcp.json` or this snippet:

```json
{
  "mcpServers": {
    "dopaflow-node": {
      "command": "python3",
      "args": ["/home/henry/vscode/build/dopaflow/tools/mcp/node-tooling-bridge/server.py"],
      "env": {
        "DOPAFLOW_NODE_BIN": "/home/henry/vscode/.codex-bin",
        "DOPAFLOW_FRONTEND_DIR": "/home/henry/vscode/build/dopaflow/frontend"
      }
    }
  }
}
```
