"""
Packaged entry point for DopaFlow v2 backend.
Runs uvicorn programmatically so PyInstaller can bundle it correctly.
"""

import os
import platform
from pathlib import Path

if not os.environ.get("DOPAFLOW_DB_PATH"):
    system = platform.system()
    if system == "Windows":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
    elif system == "Darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    data_dir = base / "DopaFlow"
    data_dir.mkdir(parents=True, exist_ok=True)
    os.environ["DOPAFLOW_DB_PATH"] = str(data_dir / "dopaflow.sqlite3")

import uvicorn

from app.main import app as dopaflow_app

if __name__ == "__main__":
    uvicorn.run(
        dopaflow_app,
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8000")),
        log_level="info",
        reload=False,
    )
