"""Offline unscored recognition sample. Credentials never enter saved artifacts."""
import argparse
import csv
import json
import os
import re
import time
from pathlib import Path

import requests

USER_AGENT = "MusicDNA-recognition-sample/0.2 (contact@musicdna.fm)"


def normalize(value):
    return re.sub(r"[^a-z0-9]", "", value.lower())


def select_recordings(recordings, years, decade, limit=3):
    """Popular original-looking titles; year is release-group year, not verified recording year."""
    rows, seen = [], set()
    for recording in sorted(recordings, key=lambda r: r.get("total_listen_count", 0), reverse=True):
        title = recording.get("recording_name", "")
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
            "genre_tags": "|".join(t["tag"] for t in sorted(recording.get("tags", []), key=lambda t: t.get("count", 0), reverse=True)[:5]),
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
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    args.output.mkdir(parents=True, exist_ok=True)
    cache = args.output / "cache"
    cache.mkdir(exist_ok=True)

    def get(url, params=None, authenticated=False):
        headers = {"Authorization": "Token " + token} if authenticated else {}
        for attempt in range(3):
            response = session.get(url, params=params, headers=headers, timeout=30)
            if "musicbrainz.org" in url and "listenbrainz" not in url:
                time.sleep(1.1)
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
    rows, gaps = [], []
    for rank, artist in enumerate(artists, 1):
        mbid = artist.get("artist_mbid")
        if not mbid:
            continue
        path = cache / (mbid + ".json")
        try:
            if path.exists():
                data = json.loads(path.read_text())
            else:
                groups = get("https://musicbrainz.org/ws/2/release-group", {
                    "query": f'arid:{mbid} AND firstreleasedate:[{args.decade} TO {args.decade + 9}] AND primarytype:album',
                    "fmt": "json", "limit": 100,
                })
                years = {}
                for group in groups.get("release-groups", []):
                    year = group.get("first-release-date", "")[:4]
                    if year.isdigit():
                        key = normalize(group["title"])
                        years[key] = min(years.get(key, int(year)), int(year))
                recordings = get(f"https://api.listenbrainz.org/1/popularity/top-recordings-for-artist/{mbid}", authenticated=True) if years else []
                data = {"years": years, "recordings": recordings}
                path.write_text(json.dumps(data))
            selected = select_recordings(data["recordings"], data["years"], args.decade, args.per_artist)
            for row in selected:
                row.update(artist_mbid=mbid, artist_rank=rank, artist_source="ListenBrainz sitewide all_time artists")
            rows.extend(selected)
            if not selected:
                gaps.append({"artist": artist["artist_name"], "reason": "No eligible decade album/recording match"})
            print(f'{rank}/{len(artists)} {artist["artist_name"]}: {len(selected)}; total {len(rows)}', flush=True)
        except (requests.RequestException, RuntimeError, ValueError, KeyError) as error:
            gaps.append({"artist": artist["artist_name"], "reason": type(error).__name__})
            print(f"{rank}/{len(artists)} provider gap", flush=True)
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