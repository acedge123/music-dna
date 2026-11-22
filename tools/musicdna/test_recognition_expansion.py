import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("expansion", Path(__file__).with_name("expand-recognition.py"))
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RecognitionExpansionTests(unittest.TestCase):
    def rows(self):
        artist = {"artist_mbid": "00000000-0000-4000-8000-000000000001"}
        recordings, details = [], {}
        for index in range(8):
            mbid = f"00000000-0000-4000-8000-{index + 10:012d}"
            recordings.append({"recording_mbid": mbid, "recording_name": f"Song {index}", "artist_name": "Artist", "total_listen_count": 100 - index})
            details[mbid] = {"title": f"Song {index}", "first-release-date": "2011-01-01"}
        return artist, recordings, details

    def test_three_recordings_per_artist_per_decade(self):
        artist, recordings, details = self.rows()
        self.assertEqual(len(module.select_verified(recordings, details, artist, 1, 2026)), 3)

    def test_future_recordings_excluded(self):
        artist, recordings, details = self.rows()
        for detail in details.values():
            detail["first-release-date"] = "2027-01-01"
        self.assertEqual(module.select_verified(recordings, details, artist, 1, 2026), [])

    def test_missing_metadata_and_live_recordings_not_verified(self):
        artist, recordings, details = self.rows()
        details = {recordings[0]["recording_mbid"]: {"title": "Song", "first-release-date": "2011", "disambiguation": "live"}}
        self.assertEqual(module.select_verified(recordings, details, artist, 1, 2026), [])

    def test_target_is_5500_distinct_identities_not_rows(self):
        existing = {(str(i), "artist") for i in range(5499)}
        rows = [{"recording_mbid": str(i), "title": title, "artist": "Artist"} for i, title in enumerate(["0", "New Song", "New Song!", "Another Song"])]
        selected = module.choose_import(rows, set(), existing, 5500)
        self.assertEqual([r["title"] for r in selected], ["New Song"])

    def test_duplicate_recording_ids_do_not_overwrite(self):
        rows = [{"recording_mbid": "existing", "title": "Different title", "artist": "Artist"}]
        self.assertEqual(module.choose_import(rows, {"existing"}, set(), 5500), [])

    def test_retries_cannot_exceed_three_per_artist_decade(self):
        rows = [{"recording_mbid": "new", "title": "New song", "artist": "Artist", "artist_mbid": "artist-id", "year": 2016}]
        self.assertEqual(module.choose_import(rows, set(), set(), 5500, {("artist-id", 2010): 3}), [])


if __name__ == "__main__":
    unittest.main()