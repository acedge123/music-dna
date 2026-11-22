"""Offline unscored recognition sample. Credentials never enter saved artifacts."""
import argparse
import csv
import json
import os
import re
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

USER_AGENT = "MusicDNA-recognition-sample/0.2 (contact@musicdna.fm)"


def normalize(value):
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())


def select_recordings(recordings, years, decade, limit=3):
    """Popular original-looking titles; year is release-group year, not verified recording year."""
    rows, seen = [], set()
    for recording in sorted(recordings, key=lambda r: r.get("total_listen_count") or 0, reverse=True):
        title = recording.get("recording_name") or ""
        year = years.get(normalize(recording.get("release_name", "")))
        if not year or not decade <= year <= decade + 9:
            continue
        if re.search(r"\b(live|remaster(?:ed)?|remix|demo|instrumental|karaoke)\b", title, re.I):
            continue
        key = normalize(title)
        if not key or key in seen or not recording.get("recording_mbid"):
            continue
        seen.add(key)
        rows.append({
            "title": title, "artist": recording["artist_name"], "year": year,
            "release": recording.get("release_name", ""),
            "year_basis": "MusicBrainz release-group first-release-date",
            "genre_tags": "|".join(t["tag"] for t in sorted(recording.get("tags") or [], key=lambda t: t.get("count") or 0, reverse=True)[:5] if t.get("tag")),
            "listen_count": recording.get("total_listen_count", 0),
            "recording_mbid": recording["recording_mbid"],
        })
        if len(rows) >= limit:
            break
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--decade", type=int, required=True)
    parser.add_argument("--artists", type=int, default=400)
    parser.add_argument("--per-artist", type=int, default=3)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    token = re.sub(r"[^A-Za-z0-9-]", "", os.environ["LISTENBRAINZ_TOKEN"])
    args.output.mkdir(parents=True, exist_ok=True)
    cache = args.output / "cache"
    cache.mkdir(exist_ok=True)
    throttle = threading.Lock()
    next_musicbrainz = [0.0]

    def get(url, params=None, authenticated=False):
        headers = {"User-Agent": USER_AGENT}
        if authenticated:
            headers["Authorization"] = "Token " + token
        for attempt in range(3):
            if "musicbrainz.org" in url and "listenbrainz" not in url:
                with throttle:
                    time.sleep(max(0, next_musicbrainz[0] - time.monotonic()))
                    next_musicbrainz[0] = time.monotonic() + 1.15
            response = requests.get(url, params=params, headers=headers, timeout=15)
            if response.ok:
                return response.json()
            if response.status_code not in (429, 500, 502, 503, 504):
                raise RuntimeError(f"Provider rejected request: {response.status_code}")
            time.sleep(2 ** (attempt + 1))
        raise RuntimeError("Provider unavailable after bounded retries")

    seed_path = args.output / "artist-ranking.json"
    if seed_path.exists():
        seed = json.loads(seed_path.read_text())
    else:
        seed = get("https://api.listenbrainz.org/1/stats/sitewide/artists", {"count": args.artists, "range": "all_time"})
        seed_path.write_text(json.dumps(seed, indent=2))
    artists = seed["payload"]["artists"][:args.artists]
    def process(item):
        rank, artist = item
        mbid = artist.get("artist_mbid")
        if not mbid:
            return [], {"artist": artist["artist_name"], "reason": "No artist MBID"}
        path = cache / (mbid + "-verified.json")
        try:
            if path.exists():
                data = json.loads(path.read_text())
            else:
                groups = get("https://musicbrainz.org/ws/2/release-group", {
                    "artist": mbid, "type": "album", "fmt": "json", "limit": 100,
                })
                years = {}
                for group in groups.get("release-groups", []):
                    if group.get("secondary-types"):
                        continue
                    year = (group.get("first-release-date") or "")[:4]
                    if year.isdigit() and args.decade <= int(year) <= args.decade + 9:
                        key = normalize(group["title"])
                        years[key] = min(years.get(key, int(year)), int(year))
                recordings = get(f"https://api.listenbrainz.org/1/popularity/top-recordings-for-artist/{mbid}", authenticated=True) if years else []
                candidates = select_recordings(recordings, years, args.decade, args.per_artist + 3)
                verified = []
                for candidate in candidates:
                    detail = get("https://musicbrainz.org/ws/2/recording/" + candidate["recording_mbid"], {"fmt": "json"})
                    date = (detail.get("first-release-date") or "")[:4]
                    if re.search(r"\b(live|remix|demo|karaoke)\b", detail.get("disambiguation") or "", re.I):
                        continue
                    if not date.isdigit() or not args.decade <= int(date) <= args.decade + 9:
                        continue
                    candidate["year"] = int(date)
                    candidate["year_basis"] = "MusicBrainz recording first-release-date; community metadata, not independent verification"
                    verified.append(candidate)
                    if len(verified) >= args.per_artist:
                        break
                data = {"selected": verified, "release_group_count": groups.get("release-group-count", 0)}
                path.write_text(json.dumps(data))
            selected = data["selected"]
            for row in selected:
                row.update(artist_mbid=mbid, artist_rank=rank, artist_source="ListenBrainz sitewide all_time artists")
            print(f'{rank}/{len(artists)} {artist["artist_name"]}: {len(selected)}', flush=True)
            return selected, None if selected else {"artist": artist["artist_name"], "reason": "No eligible decade original album/recording match in first 100 album groups"}
        except (requests.RequestException, RuntimeError, ValueError, KeyError) as error:
            print(f"{rank}/{len(artists)} provider gap", flush=True)
            return [], {"artist": artist["artist_name"], "reason": type(error).__name__ + ": " + str(error) if isinstance(error, RuntimeError) else type(error).__name__}
    rows, gaps = [], []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for selected, gap in pool.map(process, enumerate(artists, 1)):
            rows.extend(selected)
            if gap:
                gaps.append(gap)
    unique = {row["recording_mbid"]: row for row in reversed(rows)}
    rows = sorted(unique.values(), key=lambda row: (row["year"], row["artist_rank"], row["title"]))
    if not rows:
        raise RuntimeError("No rows produced")
    with (args.output / f"sample-{args.decade}s.csv").open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    (args.output / "gaps.json").write_text(json.dumps(gaps, indent=2))
    (args.output / "summary.json").write_text(json.dumps({"decade": args.decade, "artist_seed_count": len(artists), "artists_represented": len({r["artist_mbid"] for r in rows}), "recordings": len(rows), "per_artist_cap": args.per_artist, "by_year": {str(y): sum(r["year"] == y for r in rows) for y in range(args.decade, args.decade + 10)}}, indent=2))


if __name__ == "__main__":
    main()