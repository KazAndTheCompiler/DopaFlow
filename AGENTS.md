# Local Agent Notes

- Persistent Node for this workspace lives at `/home/henry/vscode/.codex-tools/node-v20.20.2-linux-x64`.
- Use `/home/henry/vscode/.codex-bin/node` and `/home/henry/vscode/.codex-bin/npm` instead of `/tmp` paths.
- Frontend build command for this repo:
  - `PATH=/home/henry/vscode/.codex-bin:$PATH /home/henry/vscode/.codex-bin/npm --prefix /home/henry/vscode/build/dopaflow/frontend run build`
- Repo-local MCP config lives at `/home/henry/vscode/build/dopaflow/.mcp.json`.
- Repo-local Node tooling MCP server lives at `/home/henry/vscode/build/dopaflow/tools/mcp/node-tooling-bridge/server.py`.
