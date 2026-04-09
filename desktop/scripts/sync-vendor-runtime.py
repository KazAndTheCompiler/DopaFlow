#!/usr/bin/env python3
"""Download and extract supplemental Ubuntu runtime libraries for desktop packaging."""

from __future__ import annotations

import io
import subprocess
import tempfile
from pathlib import Path
from urllib.request import urlopen

import tarfile

try:
    import zstandard
except ImportError:  # pragma: no cover - handled at runtime
    zstandard = None


REPO_ROOT = Path(__file__).resolve().parents[2]
VENDOR_DIR = REPO_ROOT / "desktop" / "vendor-runtime"
EXTRACT_DIR = VENDOR_DIR / "extract"

PACKAGE_URLS = [
    "https://mirror.archive.ubuntu.com/ubuntu/pool/main/libx/libxau/libxau6_1.0.9-1build6_amd64.deb",
    "https://archive.ubuntu.com/ubuntu/pool/main/libx/libxdmcp/libxdmcp6_1.1.3-0ubuntu6_amd64.deb",
    "https://archive.ubuntu.com/ubuntu/pool/main/libx/libxcb/libxcb-render0_1.15-1ubuntu2_amd64.deb",
    "https://archive.ubuntu.com/ubuntu/pool/main/libx/libxcb/libxcb-shm0_1.15-1ubuntu2_amd64.deb",
    "https://security.ubuntu.com/ubuntu/pool/main/p/pixman/libpixman-1-0_0.42.2-1build1_amd64.deb",
    "https://nl.archive.ubuntu.com/ubuntu/pool/main/w/wayland/libwayland-client0_1.22.0-2.1build1_amd64.deb",
    "https://nl.archive.ubuntu.com/ubuntu/pool/main/w/wayland/libwayland-cursor0_1.22.0-2.1build1_amd64.deb",
    "https://nl.archive.ubuntu.com/ubuntu/pool/main/w/wayland/libwayland-egl1_1.22.0-2.1build1_amd64.deb",
    "https://archive.ubuntu.com/ubuntu/pool/main/libx/libxcursor/libxcursor1_1.2.1-1build1_amd64.deb",
    "https://archive.ubuntu.com/ubuntu/pool/main/libx/libxinerama/libxinerama1_1.1.4-3build1_amd64.deb",
    "https://archive.ubuntu.com/ubuntu/pool/main/g/graphite2/libgraphite2-3_1.3.14-2build1_amd64.deb",
    "https://archive.ubuntu.com/ubuntu/pool/main/libd/libdatrie/libdatrie1_0.2.13-3build1_amd64.deb",
]


def iter_ar_members(blob: bytes):
    if not blob.startswith(b"!<arch>\n"):
        raise ValueError("unsupported deb archive format")
    offset = 8
    while offset + 60 <= len(blob):
        header = blob[offset : offset + 60]
        offset += 60
        name = header[:16].decode("utf-8").strip()
        size = int(header[48:58].decode("utf-8").strip())
        data = blob[offset : offset + size]
        offset += size + (size % 2)
        yield name.rstrip("/"), data


def extract_data_archive(deb_path: Path, dest_dir: Path) -> None:
    blob = deb_path.read_bytes()
    for name, data in iter_ar_members(blob):
        if not name.startswith("data.tar."):
            continue
        suffix = name.removeprefix("data.tar.")
        if suffix == "zst":
            if zstandard is None:
                raise RuntimeError("zstandard module is required to extract .zst runtime packages")
            with zstandard.ZstdDecompressor().stream_reader(io.BytesIO(data)) as stream:
                tar_bytes = io.BytesIO(stream.read())
            with tarfile.open(fileobj=tar_bytes, mode="r:") as archive:
                archive.extractall(dest_dir)
            return
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{suffix}") as handle:
            handle.write(data)
            temp_path = Path(handle.name)
        try:
            subprocess.run(["tar", "-xf", str(temp_path), "-C", str(dest_dir)], check=True)
        finally:
            temp_path.unlink(missing_ok=True)
        return
    raise ValueError(f"no data archive found in {deb_path.name}")


def download(url: str, target: Path) -> None:
    print(f"[vendor-runtime] downloading {target.name}")
    with urlopen(url, timeout=60) as response:
        target.write_bytes(response.read())


def main() -> int:
    VENDOR_DIR.mkdir(parents=True, exist_ok=True)
    EXTRACT_DIR.mkdir(parents=True, exist_ok=True)

    for url in PACKAGE_URLS:
        target = VENDOR_DIR / Path(url).name
        if not target.exists():
            download(url, target)
        print(f"[vendor-runtime] extracting {target.name}")
        extract_data_archive(target, EXTRACT_DIR)

    print("[vendor-runtime] supplemental runtime sync complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
