#!/usr/bin/env python3
"""
fetch_analytics.py — Pull read-only analytics from configured platforms.

Reads credentials from the environment (injected by the VS Code extension via
SecretStorage). Only fetches data for platforms whose credentials are present.
Writes results to database/analytics.json.

Supported platforms:
  YouTube    — channel stats via YouTube Data API v3 (YOUTUBE_API_KEY)
  LinkedIn   — profile/org stats via LinkedIn API   (LINKEDIN_ACCESS_TOKEN)
  Instagram  — account insights via Meta Graph API  (INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_ACCOUNT_ID)
  Mailchimp  — list stats via Mailchimp API v3      (MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX)
  ConvertKit — subscriber stats via Kit API v4      (CONVERTKIT_API_KEY)
  Beehiiv    — publication stats via Beehiiv API v2 (BEEHIIV_API_KEY, BEEHIIV_PUBLICATION_ID)

Usage:
  python fetch_analytics.py [--platform PLATFORM] [--output PATH]
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _brand import REPO_ROOT

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s", stream=sys.stderr)

ANALYTICS_DB = REPO_ROOT / "database" / "analytics.json"

# ── Fetchers ───────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def fetch_youtube(api_key: str, channel_id: str | None) -> dict[str, Any]:
    """Channel statistics via YouTube Data API v3."""
    if not channel_id:
        return {"error": "YOUTUBE_CHANNEL_ID not set — provide channel ID to look up stats"}
    url = "https://www.googleapis.com/youtube/v3/channels"
    params = {"part": "statistics,snippet", "id": channel_id, "key": api_key}
    resp = requests.get(url, params=params, timeout=15)
    if resp.status_code != 200:
        return {"error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    data = resp.json()
    items = data.get("items", [])
    if not items:
        return {"error": "Channel not found"}
    item = items[0]
    stats = item.get("statistics", {})
    return {
        "channel_id": channel_id,
        "title": item.get("snippet", {}).get("title"),
        "subscriber_count": int(stats.get("subscriberCount", 0)),
        "view_count": int(stats.get("viewCount", 0)),
        "video_count": int(stats.get("videoCount", 0)),
        "fetched_at": _now(),
    }


def fetch_linkedin(access_token: str, person_urn: str | None) -> dict[str, Any]:
    """Profile info + optional org follower count via LinkedIn API."""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "X-Restli-Protocol-Version": "2.0.0",
    }
    resp = requests.get("https://api.linkedin.com/v2/me", headers=headers, timeout=15)
    if resp.status_code != 200:
        return {"error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    profile = resp.json()
    result: dict[str, Any] = {
        "linkedin_id": profile.get("id"),
        "fetched_at": _now(),
    }
    # Org follower stats (requires r_organization_social scope)
    if person_urn and "organization" in person_urn:
        org_url = (
            "https://api.linkedin.com/v2/organizationalEntityFollowerStatistics"
            f"?q=organizationalEntity&organizationalEntity={person_urn}"
        )
        org_resp = requests.get(org_url, headers=headers, timeout=15)
        if org_resp.status_code == 200:
            body = org_resp.json()
            result["follower_count"] = body.get("firstDegreeSize", 0)
            result["organization_urn"] = person_urn
    return result


def fetch_instagram(access_token: str, account_id: str) -> dict[str, Any]:
    """Account summary via Meta Graph API."""
    url = f"https://graph.instagram.com/{account_id}"
    params = {
        "fields": "followers_count,media_count,name,username,biography,website",
        "access_token": access_token,
    }
    resp = requests.get(url, params=params, timeout=15)
    if resp.status_code != 200:
        return {"error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    data = resp.json()
    data["fetched_at"] = _now()
    return data


def fetch_mailchimp(api_key: str, server_prefix: str) -> dict[str, Any]:
    """List statistics via Mailchimp Marketing API v3."""
    base = f"https://{server_prefix}.api.mailchimp.com/3.0"
    auth = ("anystring", api_key)
    resp = requests.get(
        f"{base}/lists",
        auth=auth,
        params={"count": 50, "fields": "lists.id,lists.name,lists.stats"},
        timeout=15,
    )
    if resp.status_code != 200:
        return {"error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    lists = resp.json().get("lists", [])
    return {
        "lists": [
            {
                "id": lst["id"],
                "name": lst["name"],
                "member_count": lst.get("stats", {}).get("member_count", 0),
                "open_rate": lst.get("stats", {}).get("open_rate", 0),
                "click_rate": lst.get("stats", {}).get("click_rate", 0),
                "campaign_count": lst.get("stats", {}).get("campaign_count", 0),
            }
            for lst in lists
        ],
        "fetched_at": _now(),
    }


def fetch_convertkit(api_key: str) -> dict[str, Any]:
    """Subscriber stats via ConvertKit API v4."""
    resp = requests.get(
        "https://api.kit.com/v4/subscribers",
        params={"api_key": api_key},
        timeout=15,
    )
    if resp.status_code != 200:
        return {"error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    data = resp.json()
    return {
        "total_subscribers": data.get("total_subscribers", 0),
        "total_active": data.get("total_active", 0),
        "fetched_at": _now(),
    }


def fetch_beehiiv(api_key: str, publication_id: str) -> dict[str, Any]:
    """Publication stats via Beehiiv API v2."""
    url = f"https://api.beehiiv.com/v2/publications/{publication_id}"
    headers = {"Authorization": f"Bearer {api_key}"}
    resp = requests.get(url, headers=headers, timeout=15)
    if resp.status_code != 200:
        return {"error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    pub = resp.json().get("data", {})
    stats = pub.get("stats", {})
    return {
        "name": pub.get("name"),
        "total_active_subscriptions": stats.get("total_active_subscriptions"),
        "total_subscribers": stats.get("total_subscribers"),
        "fetched_at": _now(),
    }


# ── Runner ─────────────────────────────────────────────────────────────────

PLATFORM_RUNNERS: dict[str, Any] = {
    "youtube": lambda: fetch_youtube(
        os.environ["YOUTUBE_API_KEY"],
        os.environ.get("YOUTUBE_CHANNEL_ID"),
    ),
    "linkedin": lambda: fetch_linkedin(
        os.environ["LINKEDIN_ACCESS_TOKEN"],
        os.environ.get("LINKEDIN_PERSON_URN"),
    ),
    "instagram": lambda: fetch_instagram(
        os.environ["INSTAGRAM_ACCESS_TOKEN"],
        os.environ["INSTAGRAM_ACCOUNT_ID"],
    ),
    "mailchimp": lambda: fetch_mailchimp(
        os.environ["MAILCHIMP_API_KEY"],
        os.environ["MAILCHIMP_SERVER_PREFIX"],
    ),
    "convertkit": lambda: fetch_convertkit(os.environ["CONVERTKIT_API_KEY"]),
    "beehiiv": lambda: fetch_beehiiv(
        os.environ["BEEHIIV_API_KEY"],
        os.environ["BEEHIIV_PUBLICATION_ID"],
    ),
}

# Which env vars must be present for each platform to be considered configured
PLATFORM_REQUIRED_VARS: dict[str, list[str]] = {
    "youtube": ["YOUTUBE_API_KEY"],
    "linkedin": ["LINKEDIN_ACCESS_TOKEN"],
    "instagram": ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_ACCOUNT_ID"],
    "mailchimp": ["MAILCHIMP_API_KEY", "MAILCHIMP_SERVER_PREFIX"],
    "convertkit": ["CONVERTKIT_API_KEY"],
    "beehiiv": ["BEEHIIV_API_KEY", "BEEHIIV_PUBLICATION_ID"],
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch analytics from configured platforms")
    parser.add_argument(
        "--platform",
        choices=list(PLATFORM_RUNNERS.keys()),
        help="Only fetch this platform (default: all configured)",
    )
    parser.add_argument(
        "--output",
        default=str(ANALYTICS_DB),
        help="Path to write analytics JSON (default: database/analytics.json)",
    )
    args = parser.parse_args()

    # Load existing data to merge into
    output_path = Path(args.output)
    existing: dict[str, Any] = {}
    if output_path.exists():
        try:
            existing = json.loads(output_path.read_text())
        except json.JSONDecodeError:
            pass

    platforms_data: dict[str, Any] = existing.get("platforms", {})

    targets = [args.platform] if args.platform else list(PLATFORM_RUNNERS.keys())

    for platform in targets:
        required = PLATFORM_REQUIRED_VARS.get(platform, [])
        if not all(os.environ.get(var) for var in required):
            log.info("Skipping %s — credentials not configured", platform)
            continue
        log.info("Fetching %s …", platform)
        try:
            result = PLATFORM_RUNNERS[platform]()
            platforms_data[platform] = result
            if "error" in result:
                log.warning("  %s: %s", platform, result["error"])
            else:
                log.info("  OK")
        except Exception as exc:
            log.warning("  %s failed: %s", platform, exc)
            platforms_data[platform] = {"error": str(exc), "fetched_at": _now()}

    output: dict[str, Any] = {
        "last_updated": _now(),
        "platforms": platforms_data,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2))
    log.info("Wrote %s", output_path.relative_to(REPO_ROOT) if REPO_ROOT in output_path.parents else output_path)
    print(json.dumps(output))


if __name__ == "__main__":
    main()
