import tempfile
import unittest
from pathlib import Path

from tools.omnidat_verifone_tui import (
    build_demo_state,
    render_keypad,
    render_terminal_frame,
)


class VerifoneTuiTests(unittest.TestCase):
    def test_terminal_frame_draws_lcd_keypad_and_flow_status(self):
        rendered = render_terminal_frame(
            title="OMNIDAT VERIFONE 330",
            screen_lines=["SALE", "DIAL 8810", "APPROVED"],
            status="POTS 8810 / X.121 311088002010",
            transcript="POS.SALE|VF-NITEMARKT-01|12.50|SBQR...0001",
        )

        self.assertIn("OMNIDAT VERIFONE 330", rendered)
        self.assertIn("SALE", rendered)
        self.assertIn("DIAL 8810", rendered)
        self.assertIn("APPROVED", rendered)
        self.assertIn("[1] [2] [3]", rendered)
        self.assertIn("[CANCEL] [CLEAR] [ENTER]", rendered)
        self.assertIn("POTS 8810 / X.121 311088002010", rendered)
        self.assertIn("POS.SALE|VF-NITEMARKT-01|12.50|SBQR...0001", rendered)

    def test_keypad_layout_is_fixed_width_for_terminal_display(self):
        keypad = render_keypad()
        lines = keypad.splitlines()

        self.assertEqual(lines[0], "[1] [2] [3]")
        self.assertEqual(lines[1], "[4] [5] [6]")
        self.assertEqual(lines[2], "[7] [8] [9]")
        self.assertEqual(lines[3], "[*] [0] [#]")
        self.assertEqual(lines[4], "[CANCEL] [CLEAR] [ENTER]")

    def test_demo_state_runs_food_flow_against_temp_queue(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            state = build_demo_state(
                "food",
                data_dir=Path("data"),
                runtime_dir=Path(temp_dir),
            )

            self.assertEqual(state.flow, "food")
            self.assertEqual(state.dial_number, "8813")
            self.assertEqual(state.x121, "311088020501")
            self.assertIn("OMNIFOOD.TCL", state.screen_lines)
            self.assertIn("TICKET MLY-000001", state.screen_lines)
            self.assertIn("ORDER.CREATE|311088020501|PASS-04271|tea|2", state.transcript)
            self.assertIn("DIAL 8813", state.render())

    def test_demo_state_runs_update_flow(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            state = build_demo_state(
                "update",
                data_dir=Path("data"),
                runtime_dir=Path(temp_dir),
            )

            self.assertEqual(state.flow, "update")
            self.assertEqual(state.dial_number, "8811")
            self.assertIn("OMNIUPDATE.TCL", state.screen_lines)
            self.assertIn("DOWNLOAD READY", state.screen_lines)
            self.assertIn("APP.UPDATE|311088002020|OMNIDAT.DTZ", state.transcript)


if __name__ == "__main__":
    unittest.main()
