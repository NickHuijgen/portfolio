#!/usr/bin/env python3
"""Survey photos.yaml + src/content/images/ for the add-photos skill.

Pure stdlib, no YAML library — photos.yaml is machine-written by Pages CMS
in a flat, consistent shape, so a regex per-entry parse is reliable and
avoids adding a dependency for one script. If the schema in
src/content.config.ts ever changes shape, update ENTRY_RE to match.

Usage: scan_library.py <repo-root>

Prints JSON:
  existing_srcs   — every "images/<file>" already referenced in photos.yaml
  orphan_images   — files in src/content/images/ not referenced by any entry
                     (these are what Pages CMS uploaded but nobody has
                     described yet — the skill's actual worklist)
  next_id_number  — the integer to use for the next "photo-N" id
  known_tags      — every distinct tag already in use, sorted
  fingerprints    — [{id, date, camera, lens, focalLength, aperture,
                      shutterSpeed, iso}] for every existing entry that has
                     an exif block, for dedup matching against a new
                     photo's inspect_photo.py output
"""
import json
import re
import sys
from pathlib import Path

HEAD_RE = re.compile(
    r"^- id: photo-(?P<id_num>\d+)\n  src: images/(?P<src>[^\n]+)\n", re.MULTILINE
)
DATE_RE = re.compile(r"^  date: (?P<date>\S+)\n", re.MULTILINE)
TAGS_RE = re.compile(r"^  tags:\n(?P<block>(?:    - .+\n)*)", re.MULTILINE)
TAG_ITEM_RE = re.compile(r"^    - (.+)\n", re.MULTILINE)
# Independent search (not matched sequentially from the top of the block)
# so an optional, later section can't get skipped by an earlier lazy
# quantifier finding a "good enough" shorter match first.
EXIF_RE = re.compile(
    r"^  exif:\n"
    r"    camera: (?P<camera>.+)\n"
    r"    lens: (?P<lens>.+)\n"
    r"    focalLength: (?P<focal>.+)\n"
    r"    aperture: (?P<aperture>.+)\n"
    r"    shutterSpeed: (?P<shutter>.+)\n"
    r"    iso: (?P<iso>.+)\n",
    re.MULTILINE,
)


def parse_entries(text):
    entries = []
    # Split on entry boundaries first so each block's fields can't leak
    # into a neighbouring entry.
    blocks = re.split(r"(?=^- id: photo-\d+\n)", text, flags=re.MULTILINE)
    for block in blocks:
        head = HEAD_RE.match(block)
        if not head:
            continue
        date_m = DATE_RE.search(block)
        tags_m = TAGS_RE.search(block)
        tags = TAG_ITEM_RE.findall(tags_m.group("block")) if tags_m else []
        exif_m = EXIF_RE.search(block)
        exif = exif_m.groupdict() if exif_m else {}
        entries.append(
            {
                "id_num": int(head.group("id_num")),
                "src": head.group("src"),
                "date": date_m.group("date") if date_m else None,
                "tags": tags,
                "camera": exif.get("camera"),
                "lens": exif.get("lens"),
                "focalLength": exif.get("focal"),
                "aperture": exif.get("aperture"),
                "shutterSpeed": exif.get("shutter"),
                "iso": exif.get("iso"),
            }
        )
    return entries


def main():
    if len(sys.argv) != 2:
        print("usage: scan_library.py <repo-root>", file=sys.stderr)
        sys.exit(1)
    root = Path(sys.argv[1])
    yaml_path = root / "src/content/photos.yaml"
    images_dir = root / "src/content/images"

    text = yaml_path.read_text()
    entries = parse_entries(text)

    existing_srcs = sorted({e["src"] for e in entries})
    all_images = sorted(p.name for p in images_dir.iterdir() if p.is_file() and not p.name.startswith("."))
    orphan_images = [name for name in all_images if name not in existing_srcs]

    known_tags = sorted({t for e in entries for t in e["tags"]})
    next_id_number = (max((e["id_num"] for e in entries), default=0)) + 1

    fingerprints = [
        {
            "id": f"photo-{e['id_num']:02d}",
            "date": e["date"],
            "camera": e["camera"],
            "lens": e["lens"],
            "focalLength": e["focalLength"],
            "aperture": e["aperture"],
            "shutterSpeed": e["shutterSpeed"],
            "iso": e["iso"],
        }
        for e in entries
        if e["camera"]
    ]

    print(
        json.dumps(
            {
                "existing_srcs": existing_srcs,
                "orphan_images": orphan_images,
                "next_id_number": next_id_number,
                "known_tags": known_tags,
                "fingerprints": fingerprints,
                "entry_count": len(entries),
                "image_file_count": len(all_images),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
