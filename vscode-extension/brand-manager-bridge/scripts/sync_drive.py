#!/usr/bin/env python3
"""
sync_drive.py — Sync generated content and brand assets to Google Drive.

Reads credentials from the environment (injected by the VS Code extension):
  GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON  — full contents of service-account JSON key
  GOOGLE_DRIVE_FOLDER_ID             — target root Drive folder ID

What gets synced:
  content/           → Drive/<root>/content/
  outputs/social/    → Drive/<root>/outputs/social/
  audio/recordings/  → Drive/<root>/audio/recordings/   (raw/ subdir excluded)
  audio/generated/   → Drive/<root>/audio/generated/
  audio/transcripts/ → Drive/<root>/audio/transcripts/
  pitch/             → Drive/<root>/pitch/
  database/          → Drive/<root>/database/            (leads*.json excluded)

Usage:
  python sync_drive.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

import googleapiclient.errors
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _brand import REPO_ROOT, require_env

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s", stream=sys.stderr)

# ── What to sync ───────────────────────────────────────────────────────────
# Each entry: (local_relative_path, drive_path_under_root)
SYNC_MANIFEST = [
    ("content", "content"),
    ("outputs/social", "outputs/social"),
    ("audio/recordings", "audio/recordings"),
    ("audio/generated", "audio/generated"),
    ("audio/transcripts", "audio/transcripts"),
    ("pitch", "pitch"),
    ("database", "database"),
]

# Never descend into these directory names
EXCLUDE_DIRS: set[str] = {"raw", "__pycache__"}

# Never upload files matching these names (case-sensitive)
EXCLUDE_FILES: set[str] = {"leads.json", "leads.example.json", ".DS_Store", "Thumbs.db"}


# ── Drive helpers ──────────────────────────────────────────────────────────

def get_service(sa_json: str):
    info = json.loads(sa_json)
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/drive"]
    )
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def ensure_folder(service, name: str, parent_id: str) -> str:
    """Return folder ID, creating it if it doesn't already exist."""
    q = (
        f"mimeType='application/vnd.google-apps.folder'"
        f" and name='{name}'"
        f" and '{parent_id}' in parents"
        f" and trashed=false"
    )
    result = service.files().list(q=q, fields="files(id)", pageSize=1).execute()
    items = result.get("files", [])
    if items:
        return items[0]["id"]
    body = {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_id],
    }
    created = service.files().create(body=body, fields="id").execute()
    return created["id"]


def ensure_path(service, parts: list[str], root_id: str) -> str:
    """Traverse (creating as needed) a nested folder path from root."""
    current = root_id
    for part in parts:
        current = ensure_folder(service, part, current)
    return current


def find_existing(service, name: str, parent_id: str) -> str | None:
    q = f"name='{name}' and '{parent_id}' in parents and trashed=false"
    result = service.files().list(q=q, fields="files(id)", pageSize=1).execute()
    items = result.get("files", [])
    return items[0]["id"] if items else None


def upload_file(service, local_path: Path, parent_id: str) -> str:
    name = local_path.name
    media = MediaFileUpload(str(local_path), mimetype="application/octet-stream", resumable=True)
    existing_id = find_existing(service, name, parent_id)
    if existing_id:
        service.files().update(fileId=existing_id, media_body=media).execute()
        return f"updated  {name}"
    body = {"name": name, "parents": [parent_id]}
    service.files().create(body=body, media_body=media, fields="id").execute()
    return f"created  {name}"


# ── Recursive sync ─────────────────────────────────────────────────────────

def sync_dir(
    service,
    local: Path,
    drive_folder_id: str,
    stats: dict[str, int],
    dry_run: bool = False,
) -> None:
    if not local.exists():
        return
    for child in sorted(local.iterdir()):
        if child.is_dir():
            if child.name in EXCLUDE_DIRS:
                continue
            if dry_run:
                sync_dir(service, child, drive_folder_id, stats, dry_run=True)
            else:
                sub_id = ensure_folder(service, child.name, drive_folder_id)
                sync_dir(service, child, sub_id, stats)
        elif child.is_file():
            if child.name in EXCLUDE_FILES:
                continue
            if dry_run:
                log.info("  would sync  %s", child.relative_to(REPO_ROOT))
                stats["pending"] += 1
            else:
                try:
                    msg = upload_file(service, child, drive_folder_id)
                    log.info("  %s", msg)
                    stats["synced"] += 1
                except googleapiclient.errors.HttpError as exc:
                    log.warning("  FAILED  %s: %s", child.name, exc)
                    stats["failed"] += 1


# ── Main ───────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Sync brand assets to Google Drive")
    parser.add_argument("--dry-run", action="store_true", help="List files without uploading")
    args = parser.parse_args()

    _sa_raw = os.environ.get("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON") or require_env(
        "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON"
    )
    # Allow the env var to be a file path instead of inlined JSON
    _sa_path = Path(_sa_raw.strip())
    if not _sa_raw.strip().startswith("{") and _sa_path.exists():
        sa_json = _sa_path.read_text()
    else:
        sa_json = _sa_raw
    folder_id = os.environ.get("GOOGLE_DRIVE_FOLDER_ID") or require_env("GOOGLE_DRIVE_FOLDER_ID")

    stats: dict[str, int] = {"synced": 0, "failed": 0, "pending": 0}

    if args.dry_run:
        log.info("DRY RUN — files that would be synced:")
        for local_rel, _ in SYNC_MANIFEST:
            sync_dir(None, REPO_ROOT / local_rel, "", stats, dry_run=True)  # type: ignore[arg-type]
        log.info("Total pending: %d", stats["pending"])
        print(json.dumps(stats))
        return

    service = get_service(sa_json)

    for local_rel, drive_path in SYNC_MANIFEST:
        local = REPO_ROOT / local_rel
        if not local.exists():
            continue
        drive_parts = drive_path.split("/")
        drive_folder = ensure_path(service, drive_parts, folder_id)
        log.info("Syncing %s …", local_rel)
        sync_dir(service, local, drive_folder, stats)

    log.info("Done: %d synced, %d failed", stats["synced"], stats["failed"])
    print(json.dumps(stats))


if __name__ == "__main__":
    main()
