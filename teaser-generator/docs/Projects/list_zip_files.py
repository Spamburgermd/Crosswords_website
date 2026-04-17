#!/usr/bin/env python3
"""Extract qualifying file names from ZIP archives.

Usage
-----
python list_zip_files.py --output names.txt archive1.zip archive2.zip ...
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from zipfile import ZipFile, BadZipFile

WORD_RE = re.compile(r"[A-Za-z]{4,}")


def iter_zip_members(zip_path: Path):
    """Yield member names from *zip_path* that contain a word (>=4 letters)."""
    try:
        with ZipFile(zip_path) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                name = info.filename
                if WORD_RE.search(Path(name).name):
                    yield name
    except BadZipFile as exc:
        print(f"[warning] Skipping {zip_path}: not a valid ZIP file ({exc})", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Collect file names from ZIP archives.")
    parser.add_argument("archives", nargs="+", type=Path, help="One or more .zip files to scan")
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        required=True,
        help="Path to the text file that will receive the qualifying names.",
    )
    args = parser.parse_args(argv)

    output_lines: list[str] = []
    for archive in args.archives:
        if not archive.exists():
            print(f"[warning] Skipping {archive}: file does not exist", file=sys.stderr)
            continue
        for member in iter_zip_members(archive):
            output_lines.append(f"{archive.name}: {member}")

    if not output_lines:
        print("No matching entries were found.")
        return 0

    args.output.write_text("
".join(output_lines) + "
", encoding="utf-8")
    print(f"Wrote {len(output_lines)} entries to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
