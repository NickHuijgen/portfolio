#!/usr/bin/env python3
"""Print EXIF + geometry for one image as JSON, for the add-photos skill.

Pure stdlib — shells out to ImageMagick's `identify`, which is already a
project dependency of this workflow (not installed by this script).

Usage: inspect_photo.py <path-to-image>
"""
import json
import re
import subprocess
import sys

EXIF_FIELDS = [
    "Make",
    "Model",
    "LensModel",
    "FocalLength",
    "FNumber",
    "ExposureTime",
    "PhotographicSensitivity",
    "RecommendedExposureIndex",
    "DateTimeOriginal",
    "DateTimeDigitized",
    "DateTime",
    "Orientation",
    "GPSLatitude",
    "GPSLongitude",
]


def identify(path, fmt):
    # capture_output keeps stdout/stderr separate — `identify` writes a
    # warning line to stderr for every EXIF tag a photo doesn't have,
    # which would otherwise corrupt the line-per-field parsing below.
    proc = subprocess.run(
        ["identify", "-format", fmt, path],
        capture_output=True,
        text=True,
    )
    return proc.stdout


def parse_fraction(value):
    """EXIF rationals arrive as 'num/den' (or a bare integer). -> float | None."""
    if not value:
        return None
    value = value.strip()
    if "/" in value:
        num, _, den = value.partition("/")
        try:
            num, den = float(num), float(den)
        except ValueError:
            return None
        return num / den if den else None
    try:
        return float(value)
    except ValueError:
        return None


def main():
    if len(sys.argv) != 2:
        print("usage: inspect_photo.py <path-to-image>", file=sys.stderr)
        sys.exit(1)
    path = sys.argv[1]

    dims = identify(path, "%w %h\n").strip().splitlines()
    if not dims:
        print(json.dumps({"error": f"identify could not read {path}"}))
        sys.exit(1)
    width, height = (int(n) for n in dims[0].split())

    field_fmt = "".join(f"%[EXIF:{f}]\n" for f in EXIF_FIELDS)
    raw_lines = identify(path, field_fmt).split("\n")
    values = dict(zip(EXIF_FIELDS, (line.strip() for line in raw_lines)))

    iso_raw = values.get("PhotographicSensitivity") or values.get("RecommendedExposureIndex")
    date_raw = values.get("DateTimeOriginal") or values.get("DateTimeDigitized") or values.get("DateTime")
    date_iso = None
    if date_raw:
        m = re.match(r"(\d{4}):(\d{2}):(\d{2})", date_raw)
        if m:
            date_iso = "-".join(m.groups())

    focal = parse_fraction(values.get("FocalLength"))

    result = {
        "width": width,
        "height": height,
        "long_edge": max(width, height),
        "needs_resize": max(width, height) > 2400,
        "camera_raw": values.get("Model") or None,
        "lens_raw": values.get("LensModel") or None,
        "focal_length_mm": round(focal) if focal is not None else None,
        "aperture": parse_fraction(values.get("FNumber")),
        "shutter_speed": parse_fraction(values.get("ExposureTime")),
        "iso": int(float(iso_raw)) if iso_raw else None,
        "date": date_iso,
        "date_time_original_raw": date_raw,
        "orientation": values.get("Orientation") or None,
        "has_gps": bool(values.get("GPSLatitude") or values.get("GPSLongitude")),
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
