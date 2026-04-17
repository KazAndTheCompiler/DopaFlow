# dopaflow-backend.spec
# PyInstaller spec for DopaFlow v2 backend
# Build from repo root: bash v2/backend/build_backend.sh

import sys
from pathlib import Path

block_cipher = None

BACKEND_ROOT = Path(SPECPATH)

a = Analysis(
    [str(BACKEND_ROOT / 'run_packaged.py')],
    pathex=[str(BACKEND_ROOT)],
    binaries=[],
    datas=[
        (str(BACKEND_ROOT / 'migrations'), 'migrations'),
        (str(BACKEND_ROOT.parent / 'shared'), 'shared'),
    ],
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'apscheduler.schedulers.background',
        'apscheduler.executors.pool',
        'apscheduler.jobstores.sqlalchemy',
        'pydantic',
        'pydantic_settings',
        'fastapi',
        'starlette',
        'anyio',
        'anyio._backends._asyncio',
        'anyio._backends._trio',
        'multipart',
        'starlette.formparsers',
        'starlette.requests',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='dopaflow-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='dopaflow-backend',
)
