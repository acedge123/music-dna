"""Operator-only, resumable recognition imports; never scores or activates songs.

Requires LISTENBRAINZ_TOKEN, SUPABASE_URL and SB_SECRET_KEY in the environment.
Public selected metadata/checkpoints are durable; raw provider responses are not saved.
"""
import argparse
import csv
import json
import os
import re
import time
import unicodedata
from pathlib import Path
from uuid import UUID

import requests

USER_AGENT = "MusicDNA-recognition-expansion/0.3 (contact@musicdna.fm)"
DECADES = (2010, 2020, 1970, 1980, 1990, 2000)
PER_ARTIST = 3


def identity_key(title, artist):
    def clean(value):
        return "".join(c for c in unicodedata.normalize("NFKC", value).casefold() if c.isalnum())
    return clean(title), clean(artist)


def original_looking(title, comment=""):
    return not re.search(r"\b(live|remaster(?:ed)?|remix|demo|instrumental|karaoke)\b", title + " " + (comment or ""), re.I)


def select_verified(recordings, details, artist, rank, current_year):
    rows, counts, seen = [], {}, set()
    for recording in sorted(recordings, key=lambda r: r.get("total_listen_count") or 0, reverse=True):
        mbid = recording.get("recording_mbid")
        detail = details.get(mbid)
        if not detail or not original_looking(detail.get("title") or "", detail.get("disambiguation")):
            continue
        date = (detail.get("first-release-date") or "")[:4]
        if not date.isdigit():
            continue
        year = int(date)
        decade = year // 10 * 10
        title, credit = detail.get("title") or "", recording.get("artist_name") or ""
        if decade not in DECADES or year > current_year or not title or not credit or len(title) > 500 or len(credit) > 500:
            continue
        key = identity_key(title, credit)
        if key in seen or counts.get(decade, 0) >= PER_ARTIST:
            continue
        UUID(mbid)
        UUID(artist["artist_mbid"])
        counts[decade] = counts.get(decade, 0) + 1
        seen.add(key)
        rows.append({
            "title": title, "artist": credit, "year": year,
            "release": recording.get("release_name") or "",
            "year_basis": "MusicBrainz indexed recording first-release-date; community metadata, not independent verification",
            "genre_tags": "|".join(t["tag"] for t in sorted(recording.get("tags") or [], key=lambda t: t.get("count") or 0, reverse=True)[:5] if t.get("tag")),
            "listen_count": recording.get("total_listen_count") or 0,
            "recording_mbid": mbid, "artist_mbid": artist["artist_mbid"],
            "artist_rank": rank, "artist_source": "ListenBrainz sitewide all_time artists",
        })
    return rows


def choose_import(rows, existing_ids, existing_keys, target, artist_counts=None):
    selected = []
    keys, ids = set(existing_keys), set(existing_ids)
    counts = dict(artist_counts or {})
    for row in rows:
        if len(keys) >= target:
            break
        key = identity_key(row["title"], row["artist"])
        if row["recording_mbid"] in ids or key in keys:
            continue
        artist_decade = (row.get("artist_mbid"), (row.get("year") or 0) // 10 * 10)
        if artist_decade[0] and counts.get(artist_decade, 0) >= PER_ARTIST:
            continue
        selected.append(row)
        counts[artist_decade] = counts.get(artist_decade, 0) + 1
        keys.add(key)
        ids.add(row["recording_mbid"])
    return selected


class Provider:
    def __init__(self):
        self.next_mb = 0.0

    def get(self, url, params=None, authenticated=False):
        headers = {"User-Agent": USER_AGENT}
        if authenticated:
            headers["Authorization"] = "Token " + re.sub(r"[^A-Za-z0-9-]", "", os.environ["LISTENBRAINZ_TOKEN"])
        for attempt in range(3):
            if url.startswith("https://musicbrainz.org/"):
                time.sleep(max(0, self.next_mb - time.monotonic()))
                self.next_mb = time.monotonic() + 2.0
            try:
                response = requests.get(url, params=params, headers=headers, timeout=25)
                if response.ok:
                    return response.json()
                if response.status_code not in (429, 500, 502, 503, 504):
                    raise RuntimeError(f"Provider rejected request: {response.status_code}")
            except requests.RequestException:
                if attempt == 2:
                    raise RuntimeError("Provider transport failure") from None
            time.sleep(2 ** (attempt + 1))
        raise RuntimeError("MusicBrainz unavailable after bounded retries" if url.startswith("https://musicbrainz.org/") else "ListenBrainz unavailable after bounded retries")


def atomic_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
    temporary.replace(path)


def read_catalog():
    rows, offset = [], 0
    while True:
        response = requests.get(os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/song_recognition",
            headers={"apikey": os.environ["SB_SECRET_KEY"]},
            params={"select": "*", "order": "id", "offset": offset, "limit": 1000}, timeout=30)
        if not response.ok:
            raise RuntimeError(f"Recognition read failed: {response.status_code}")
        page = response.json()
        rows.extend(page)
        if len(page) < 1000:
            return rows
        offset += len(page)


def payload(row, batch):
    return {"id": row["recording_mbid"], "title": row["title"], "artist": row["artist"],
        "year": row["year"], "release_title": row["release"], "artist_mbid": row["artist_mbid"],
        "listen_count": row["listen_count"], "source_batch": batch, "year_basis": row["year_basis"]}


def import_rows(rows, batch):
    inserted = []
    for start in range(0, len(rows), 100):
        chunk = [payload(row, batch) for row in rows[start:start + 100]]
        response = requests.post(os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/song_recognition",
            headers={"apikey": os.environ["SB_SECRET_KEY"], "Prefer": "resolution=ignore-duplicates,return=representation"},
            params={"on_conflict": "id"}, json=chunk, timeout=45)
        if not response.ok:
            raise RuntimeError(f"Recognition insert failed: {response.status_code}; resume with readback before retry")
        inserted.extend(response.json())
    return inserted


def save_samples(output, checkpoints):
    all_rows = [row for checkpoint in checkpoints for row in checkpoint["rows"]]
    for decade in DECADES:
        rows = sorted((r for r in all_rows if r["year"] // 10 * 10 == decade), key=lambda r: (r["artist_rank"], -r["listen_count"]))
        folder = output / f"{decade}s"
        folder.mkdir(exist_ok=True)
        if rows:
            with (folder / f"sample-{decade}s.csv").open("w", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
                writer.writeheader()
                writer.writerows(rows)
        atomic_json(folder / "summary.json", {"decade": decade, "artists_processed": len(checkpoints),
            "recordings": len(rows), "artists_represented": len({r["artist_mbid"] for r in rows}),
            "per_artist_decade_cap": PER_ARTIST, "method": "Top 100 distinct original-looking ListenBrainz recording titles per artist; exact-ID MusicBrainz indexed date/disambiguation checks"})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--target", type=int, default=5500)
    parser.add_argument("--artists", type=int, default=1000)
    parser.add_argument("--steps", type=int, default=100)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--retry-gaps", action="store_true")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    checkpoints_dir = args.output / "selected-artists"
    checkpoints_dir.mkdir(exist_ok=True)
    provider = Provider()
    ranking_path = args.output / "artist-ranking.json"
    if ranking_path.exists():
        ranking = json.loads(ranking_path.read_text())
    else:
        ranking = provider.get("https://api.listenbrainz.org/1/stats/sitewide/artists", {"count": args.artists, "range": "all_time"})
        atomic_json(ranking_path, ranking)
    artists = ranking["payload"]["artists"][:args.artists]
    checkpoints = [json.loads(p.read_text()) for p in sorted(checkpoints_dir.glob("*.json"))]
    done = {c["rank"] for c in checkpoints if not (args.retry_gaps and c["gap"])}
    current_year = time.gmtime().tm_year
    steps = 0
    for rank, artist in enumerate(artists, 1):
        if rank in done:
            continue
        if steps >= args.steps:
            break
        steps += 1
        rows, gap = [], None
        mbid = artist.get("artist_mbid")
        try:
            if not mbid:
                raise RuntimeError("No canonical artist MBID")
            recordings = provider.get(f"https://api.listenbrainz.org/1/popularity/top-recordings-for-artist/{mbid}", authenticated=True)
            candidates, seen = [], set()
            for recording in sorted(recordings, key=lambda r: r.get("total_listen_count") or 0, reverse=True):
                title = recording.get("recording_name") or ""
                key = identity_key(title, recording.get("artist_name") or "")
                if key in seen or not title or not original_looking(title) or not recording.get("recording_mbid"):
                    continue
                seen.add(key)
                candidates.append(recording)
                if len(candidates) == 100:
                    break
            details = {}
            chunk_gaps = []
            for start in range(0, len(candidates), 50):
                ids = [r["recording_mbid"] for r in candidates[start:start + 50]]
                try:
                    result = provider.get("https://musicbrainz.org/ws/2/recording", {"query": "rid:(" + " OR ".join(ids) + ")", "fmt": "json", "limit": len(ids)})
                    details.update({r["id"]: r for r in result.get("recordings", []) if r["id"] in ids})
                except RuntimeError as error:
                    chunk_gaps.append(str(error))
            missing = len(candidates) - len(details)
            rows = select_verified(candidates, details, artist, rank, current_year)
            if missing:
                gap = f"{missing} candidate IDs absent from indexed results; not treated as verified"
            if chunk_gaps:
                gap = "; ".join(chunk_gaps)
        except (RuntimeError, ValueError, KeyError) as error:
            gap = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        checkpoint = {"rank": rank, "artist": artist["artist_name"], "rows": rows, "gap": gap}
        atomic_json(checkpoints_dir / f"{rank:04d}.json", checkpoint)
        checkpoints = [c for c in checkpoints if c["rank"] != rank]
        checkpoints.append(checkpoint)
        print(f"Collected {rank}/{len(artists)}: {len(rows)} recordings" + ("; provider/identity gap" if gap else ""), flush=True)
        if rank % 25 == 0:
            save_samples(args.output, checkpoints)
    save_samples(args.output, checkpoints)
    catalog = read_catalog()
    existing_ids = {r["id"] for r in catalog}
    existing_keys = {identity_key(r["title"], r["artist"]) for r in catalog}
    before = len(existing_keys)
    all_rows = [r for c in sorted(checkpoints, key=lambda c: c["rank"]) for r in c["rows"]]
    inserted_count = 0
    for decade in DECADES:
        eligible = [r for r in all_rows if r["year"] // 10 * 10 == decade]
        artist_counts = {}
        for saved in catalog:
            if "-expansion-" in saved["source_batch"]:
                key = (saved["artist_mbid"], (saved["year"] or 0) // 10 * 10)
                artist_counts[key] = artist_counts.get(key, 0) + 1
        selected = choose_import(eligible, existing_ids, existing_keys, args.target, artist_counts)
        if selected and args.execute:
            batch = f"listenbrainz-{decade}s-expansion-{time.strftime('%Y-%m-%d', time.gmtime())}"
            previous = {r["id"]: r for r in catalog}
            inserted = import_rows(selected, batch)
            catalog = read_catalog()
            by_id = {r["id"]: r for r in catalog}
            if any(by_id.get(key) != value for key, value in previous.items()):
                raise RuntimeError("Existing recognition row changed during import; stop for inspection")
            for row in selected:
                saved = by_id.get(row["recording_mbid"])
                if not saved or any(saved.get(key) != value for key, value in payload(row, batch).items()):
                    raise RuntimeError("Import readback mismatch; stop for inspection")
            inserted_count += len(inserted)
            existing_ids = set(by_id)
            existing_keys = {identity_key(r["title"], r["artist"]) for r in catalog}
            print(f"Imported/read back {decade}s: {len(inserted)} new; unique identities {len(existing_keys)}", flush=True)
        elif selected:
            print(f"Preview {decade}s: {len(selected)} candidates; no import", flush=True)
    receipt = {"target_unique_identities": args.target, "rows_total": len(catalog), "unique_title_artist": len(existing_keys),
        "unique_before_run": before, "inserted_this_run": inserted_count, "artists_processed": len(checkpoints),
        "artist_seed_count": len(artists), "execute": args.execute, "complete": len(existing_keys) >= args.target,
        "pending": max(0, args.target - len(existing_keys)), "as_of_utc": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    atomic_json(args.output / "import-status.json", receipt)
    print(json.dumps(receipt), flush=True)


if __name__ == "__main__":
    main()