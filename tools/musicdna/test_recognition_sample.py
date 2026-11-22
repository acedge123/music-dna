import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("recognition", Path(__file__).with_name("build-recognition-sample.py"))
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RecognitionSampleTests(unittest.TestCase):
    def test_missing_release_metadata_is_skipped_without_stopping_sample(self):
        rows = module.select_recordings([{"recording_name": "Song", "release_name": None, "total_listen_count": None}], {"album": 1994}, 1990)
        self.assertEqual(rows, [])

    def test_broader_sample_caps_each_artist_at_three(self):
        recordings = [{"recording_name": f"Song {i}", "artist_name": "Artist", "release_name": "Album", "recording_mbid": str(i), "total_listen_count": i} for i in range(12)]
        rows = module.select_recordings(recordings, {"album": 1994}, 1990)
        self.assertEqual(len(rows), 3)
        self.assertEqual([r["listen_count"] for r in rows], [11, 10, 9])

    def test_nineties_sample_excludes_other_decades_and_alternate_versions(self):
        recordings = [{"recording_name": t, "artist_name": "Artist", "release_name": album, "recording_mbid": t} for t, album in [("Original", "90s"), ("Original (live)", "90s"), ("Older", "80s"), ("Newer", "00s")]]
        rows = module.select_recordings(recordings, {"90s": 1991, "80s": 1989, "00s": 2000}, 1990)
        self.assertEqual([r["title"] for r in rows], ["Original"])


if __name__ == "__main__":
    unittest.main()