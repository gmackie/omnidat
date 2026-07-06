import tempfile
import unittest
from pathlib import Path

from tools.omnidat_atv import (
    export_station_pages,
    load_stations,
    render_teletext_page,
)


class AtvTeletextTests(unittest.TestCase):
    def test_load_stations_returns_teletext_pages_by_magazine_page(self):
        stations = load_stations(Path("data/atv-stations.sample.json"))

        station = stations["OMNI-TV-1"]
        self.assertEqual(station["packet_address"], "000040")
        self.assertEqual(station["teletext"]["service_name"], "OMNITEXT")
        self.assertIn("100", station["teletext"]["pages"])

    def test_render_page_is_teletext_width_and_contains_station_identity(self):
        stations = load_stations(Path("data/atv-stations.sample.json"))
        rendered = render_teletext_page(stations["OMNI-TV-1"], "100")
        lines = rendered.splitlines()

        self.assertEqual(len(lines), 24)
        self.assertTrue(all(len(line) == 40 for line in lines))
        self.assertIn("OMNITEXT 100", lines[0])
        self.assertIn("OMNI-TV-1", rendered)
        self.assertIn("X.25 000040", rendered)

    def test_export_station_pages_writes_numbered_text_pages(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir)

            written = export_station_pages(
                Path("data/atv-stations.sample.json"),
                output_dir,
                "OMNI-TV-1",
            )

            self.assertIn(output_dir / "OMNI-TV-1-100.txt", written)
            self.assertIn("OMNITEXT 100", (output_dir / "OMNI-TV-1-100.txt").read_text())


if __name__ == "__main__":
    unittest.main()
