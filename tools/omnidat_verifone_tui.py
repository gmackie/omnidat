from __future__ import annotations

import argparse
import curses
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from tools.omnidat_verifone import (
    simulate_field_directory,
    simulate_food_order,
    simulate_passport_stamp,
    simulate_pos_sale,
    simulate_terminal_update,
)


FLOW_LABELS = {
    "sale": "SALE",
    "directory": "DIRECTORY",
    "food": "FOOD ORDER",
    "passport": "PASSPORT",
    "update": "UPDATE",
}


@dataclass
class TerminalState:
    flow: str
    title: str
    screen_lines: list[str]
    dial_number: str
    x121: str
    transcript: str

    def render(self) -> str:
        return render_terminal_frame(
            title=self.title,
            screen_lines=self.screen_lines,
            status=f"POTS {self.dial_number} / X.121 {self.x121}",
            transcript=self.transcript,
        )


def render_terminal_frame(
    title: str,
    screen_lines: list[str],
    status: str,
    transcript: str,
    width: int = 72,
) -> str:
    inner = width - 2
    lines = [
        "+" + "-" * inner + "+",
        "|" + center(title, inner) + "|",
        "|" + " " * inner + "|",
        "|" + center("+" + "-" * 36 + "+", inner) + "|",
    ]

    lcd_lines = screen_lines[:6]
    while len(lcd_lines) < 6:
        lcd_lines.append("")
    for line in lcd_lines:
        lines.append("|" + center("|" + fit(line, 36) + "|", inner) + "|")
    lines.append("|" + center("+" + "-" * 36 + "+", inner) + "|")
    lines.append("|" + " " * inner + "|")
    for keypad_line in render_keypad().splitlines():
        lines.append("|" + center(keypad_line, inner) + "|")
    lines.append("|" + " " * inner + "|")
    lines.append("|" + fit(status, inner) + "|")
    lines.append("+" + "-" * inner + "+")
    lines.append("TRANSCRIPT")
    lines.extend(transcript.rstrip().splitlines())
    return "\n".join(lines) + "\n"


def render_keypad() -> str:
    return "\n".join(
        [
            "[1] [2] [3]",
            "[4] [5] [6]",
            "[7] [8] [9]",
            "[*] [0] [#]",
            "[CANCEL] [CLEAR] [ENTER]",
        ]
    )


def build_demo_state(
    flow: str,
    data_dir: Path = Path("data"),
    runtime_dir: Path | None = None,
) -> TerminalState:
    runtime_dir = runtime_dir or Path(tempfile.mkdtemp(prefix="omnidat-verifone-tui-"))
    runtime_dir.mkdir(parents=True, exist_ok=True)
    log_path = runtime_dir / "events.jsonl"

    if flow == "sale":
        result = simulate_pos_sale(
            data_dir=data_dir,
            terminal_id="VF-NITEMARKT-01",
            amount="12.50",
            tender="SBQR-TEST-0001",
            log_path=log_path,
        )
        screen_lines = [
            result["program"],
            "SALE 12.50",
            f"DIAL {result['dial_number']}",
            f"AUTH {result['auth_code']}",
            "APPROVED",
        ]
    elif flow == "directory":
        result = simulate_field_directory(
            data_dir=data_dir,
            terminal_id="VF-FIELD-01",
            query="miliways",
            log_path=log_path,
        )
        screen_lines = [
            result["program"],
            "QUERY MILIWAYS",
            f"DIAL {result['dial_number']}",
            "DIRECTORY FOUND",
            "COMPLETE",
        ]
    elif flow == "food":
        result = simulate_food_order(
            data_dir=data_dir,
            queue_dir=runtime_dir / "queue",
            terminal_id="VF-FOOD-01",
            passport_id="PASS-04271",
            item_id="tea",
            quantity=2,
            log_path=log_path,
        )
        screen_lines = [
            result["program"],
            "MILIWAYS TEA X2",
            f"DIAL {result['dial_number']}",
            f"TICKET {result['ticket_id']}",
            "ACCEPTED",
        ]
    elif flow == "passport":
        result = simulate_passport_stamp(
            data_dir=data_dir,
            activity_dir=runtime_dir / "activity",
            terminal_id="VF-PASS-01",
            passport_id="PASS-04271",
            action="CALL TEST LOOP",
            log_path=log_path,
        )
        screen_lines = [
            result["program"],
            "PASS-04271",
            f"DIAL {result['dial_number']}",
            f"STAMP {result['activity_id']}",
            "CLEARED",
        ]
    elif flow == "update":
        result = simulate_terminal_update(
            data_dir=data_dir,
            terminal_id="VF-NITEMARKT-01",
            package_name="OMNIDAT.DTZ",
            log_path=log_path,
        )
        screen_lines = [
            result["program"],
            "OMNIDAT.DTZ",
            f"DIAL {result['dial_number']}",
            "DOWNLOAD READY",
            "COMPLETE",
        ]
    else:
        raise ValueError(f"unknown demo flow {flow}")

    return TerminalState(
        flow=flow,
        title=f"OMNIDAT VERIFONE {FLOW_LABELS[flow]}",
        screen_lines=screen_lines,
        dial_number=result["dial_number"],
        x121=result["x121"],
        transcript=result["transcript"],
    )


def run_curses(data_dir: Path) -> int:
    def draw(stdscr: curses.window) -> None:
        curses.curs_set(0)
        selected = "sale"
        while True:
            state = build_demo_state(selected, data_dir=data_dir)
            stdscr.erase()
            for row, line in enumerate(state.render().splitlines()):
                if row >= curses.LINES - 2:
                    break
                stdscr.addstr(row, 0, line[: max(0, curses.COLS - 1)])
            help_line = "1 sale  2 directory  3 food  4 passport  5 update  q quit"
            stdscr.addstr(curses.LINES - 1, 0, help_line[: max(0, curses.COLS - 1)])
            stdscr.refresh()
            key = stdscr.getkey()
            if key.lower() == "q":
                return
            selected = {
                "1": "sale",
                "2": "directory",
                "3": "food",
                "4": "passport",
                "5": "update",
            }.get(key, selected)

    curses.wrapper(draw)
    return 0


def center(value: str, width: int) -> str:
    if len(value) >= width:
        return value[:width]
    left = (width - len(value)) // 2
    right = width - len(value) - left
    return " " * left + value + " " * right


def fit(value: str, width: int) -> str:
    if len(value) > width:
        return value[: max(0, width - 1)] + "~"
    return value.ljust(width)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Visual OMNIDAT VeriFone TUI simulator.")
    parser.add_argument("--data-dir", default="data", type=Path)
    parser.add_argument(
        "--demo",
        choices=sorted(FLOW_LABELS),
        help="print one deterministic terminal frame instead of launching curses",
    )
    parser.add_argument("--runtime-dir", type=Path)
    args = parser.parse_args(argv)

    if args.demo:
        print(build_demo_state(args.demo, data_dir=args.data_dir, runtime_dir=args.runtime_dir).render(), end="")
        return 0

    if not sys.stdout.isatty():
        print(build_demo_state("sale", data_dir=args.data_dir, runtime_dir=args.runtime_dir).render(), end="")
        return 0
    return run_curses(args.data_dir)


if __name__ == "__main__":
    raise SystemExit(main())
