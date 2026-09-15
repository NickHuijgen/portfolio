---
name: add-photos
description: Turn newly uploaded, undescribed photos in src/content/images/ into full photos.yaml entries — EXIF-derived metadata, alt text, optional captions, tags, dedup against the existing library — then commit and push to main so Cloudflare Pages deploys them. Use when the user says things like "add the new photos", "pick up what I uploaded", "describe the new images", "deploy the photos I uploaded", or after they mention uploading photos via Pages CMS from their phone.
---

# Add photos

The intended workflow: upload a photo via Pages CMS from your phone, then
run this skill — nothing else. Pages CMS already handles getting the raw
file into `src/content/images/`; this skill does the judgment-heavy rest
(accurate alt text, clean EXIF-derived metadata, dedup against the
existing library) and — per standing authorization, see step 12 — commits
and pushes straight to `main`, so Cloudflare Pages deploys it. No laptop,
no separate commit step.

Two bundled scripts do the deterministic parts — never hand-roll their
logic inline, the parsing/arithmetic is easy to get subtly wrong twice:

- `scripts/scan_library.py <repo-root>` — surveys `photos.yaml` and
  `src/content/images/`. Returns orphan images (uploaded but not yet in
  `photos.yaml` — your actual worklist), the next `photo-N` id, every tag
  currently in use, and a fingerprint (date + camera + lens + focal length
  + aperture + shutter + iso) for every existing entry, for dedup.
- `scripts/inspect_photo.py <path>` — reads one image's dimensions and
  EXIF via ImageMagick's `identify`, returns clean JSON (see the script
  for exact fields: `camera_raw`, `lens_raw`, `focal_length_mm`,
  `aperture`, `shutter_speed`, `iso`, `date`, `needs_resize`, `has_gps`).

`gear.json` (same directory) maps raw EXIF camera/lens strings to the
clean display strings already used in `photos.yaml` — see step 4.

## Procedure

### 0. Sync first

Pages CMS commits land on the remote, not on whatever local clone this
session is running in. Before anything else:

```
git status   # confirm no uncommitted local changes would be clobbered
git pull
```

If `git status` shows unrelated local changes, stop and ask rather than
pulling over them.

### 1. Find the worklist

Run `scripts/scan_library.py <repo-root>`. `orphan_images` is every file
in `src/content/images/` not yet referenced by any `photos.yaml` entry —
that's what this run needs to process. If it's empty, say so and stop;
there's nothing to do.

### 2. Inspect and dedupe each orphan

Run `scripts/inspect_photo.py` on the orphan. Then check for duplicates
**before** doing any other work on it, two ways:

1. Against `fingerprints` from step 1: same `date` + `camera` (after
   normalizing per step 4 — compare like-for-like) + `focalLength` +
   `aperture` + `shutterSpeed` + `iso` as an existing entry means this is
   the same photo already on the site. Skip it — don't add a second
   entry — and tell the user which existing `photo-N` it duplicates. (A
   real example already sitting in this repo: `mg3595-1.jpeg` is a
   byte-for-byte EXIF match — same date *and* camera *and* every setting
   down to the second — for `photo-64`/`mg3595.jpeg`. That's the exact
   case this check exists for.)
2. Against other orphans in the *same* batch, the same way — two uploads
   of the same shot in one run should still only produce one entry.

If `inspect_photo.py` can't read EXIF at all (no `camera_raw`, no `date`)
— e.g. a screenshot or a re-export that stripped metadata — you can't
fingerprint it. Say so and ask the user for the date before continuing;
don't guess, and don't silently skip the dedup check.

### 3. Resize if needed

If `needs_resize` is true (long edge > 2400px — see the project's
"Photos: max 2400px long edge" constraint), resize in place:

```
sips -Z 2400 <path> --out <path>
```

This also handles `.heic`/`.HEIC` input (e.g. a photo shot straight from
an iPhone camera roll rather than a dedicated camera) — combine format
conversion with the resize:

```
sips -s format jpeg -Z 2400 <path>.heic --out <dest>.jpeg
```

`sips` preserves EXIF through both operations — verified when this skill
was built. Never *upscale*: if `needs_resize` is false, leave the file's
resolution alone.

### 4. Normalize camera/lens

Look up `camera_raw` and `lens_raw` in `gear.json`. If both are found,
use the mapped display strings directly.

If either is missing from `gear.json` — new gear — normalize it yourself
using the pattern already established there: expand cryptic model codes
("R6m2" → "R6 Mark II"), add the manufacturer name if the raw string
doesn't already start with one, insert a space between a lens-family code
and its focal length ("EF300mm" → "EF 300mm"), keep teleconverter suffixes
with normalized spacing ("+1.4x" → "+ 1.4x"), and drop manufacturer
product/version codes that mean nothing to a reader (e.g. Sigma's
trailing "015"). Tell the user what you inferred, then **add the new
raw → clean mapping to `gear.json`** so it's not re-derived (and
potentially normalized slightly differently) next time.

### 5. GPS check

If `has_gps` is true, stop and ask the user how to handle it before doing
anything else with that photo — don't publish exact shoot-location
coordinates by default, and don't silently strip EXIF data either. None
of the tools already available in this environment (`sips`, ImageMagick)
cleanly remove *just* the GPS tags without stripping the camera/lens/
exposure EXIF this whole skill exists to preserve, so this needs either a
judgment call from the user or a new tool (e.g. `exiftool`, not currently
installed) — don't install one without asking.

### 6. Destination filename

`src/content/images/` uses a consistent convention: the original camera
filename, lowercased, with underscores removed, extension normalized to
`.jpeg`. Canon bodies set to Adobe RGB prefix filenames with an
underscore (`_MG_6620.CR2`) — that pattern collapses the same way:
`_MG_6620` → `mg6620`. `IMG_2358` → `img2358`. If the orphan's current
filename doesn't already match this convention (any uppercase letters,
underscores, spaces, or a non-`.jpeg` extension), rename it to match
(`git mv` if it's already tracked, plain `mv` if not yet staged) before
referencing it from `photos.yaml`.

If the normalized name would collide with a *different* existing photo
(same target filename, but step 2 already established it's not a
duplicate of it), append `-1`, `-2`, etc. before the extension — same
pattern already in use elsewhere in this library.

### 7. Alt text and caption

Actually look at the image (read it) before writing either of these —
never infer content from the filename or EXIF alone.

- **Alt text is mandatory.** A real, accessible, factual description of
  the scene — subject, pose/action, notable context. Not the filename.
  Look at a few neighboring entries in `photos.yaml` for the established
  tone (e.g. "Snow leopard perched on a log, eyeing a hanging rabbit
  carcass") before writing yours.
- **Caption is optional and should stay that way.** Only add one when
  there's genuinely something worth saying beyond the alt text — short
  and editorial ("Announcing itself", "Golden hour"), never a restatement
  of the alt text. Roughly a quarter of existing entries have one; don't
  force every new photo to get one just because it can.
- **If you're not confident what you're looking at, ask — don't guess.**
  Wrong alt text is worse than no alt text: it's a factual claim (species,
  location, what's actually happening in the frame) that a screen-reader
  user has no way to double-check. If you can tell it's "a bird of prey"
  but aren't sure which species, or the scene is ambiguous, say what
  you're unsure about and ask the user rather than picking your best
  guess silently.

### 8. Tags

Use `known_tags` from step 1. Prefer an existing tag over inventing a new
one — the site's tag vocabulary is deliberately small (currently just
`wildlife` and `portrait`). If a photo genuinely doesn't fit anything
existing, or it's genuinely ambiguous which existing tag fits best, ask
the user rather than guessing or growing the vocabulary unilaterally.

### 9. Feature flag

Default `feature: false`. This flag spans the photo 2 columns in the grid
*and* makes it eligible as the site's default OG/share image (see
`Base.astro`) — don't set it without the user asking for that specific
photo to be featured.

### 10. Write the entry

Append to the end of `src/content/photos.yaml` (insertion order doesn't
matter — every page sorts by `date` at build time via
`src/lib/photos.ts`). Use `next_id_number` from step 1 (increment it
yourself for each additional photo in the same batch), matching the
existing `photo-NN` zero-padded-to-2 format:

```yaml
- id: photo-<next_id_number>
  src: images/<filename>.jpeg
  alt: <required, factual>
  caption: <optional, editorial — omit the key entirely if none>
  date: <YYYY-MM-DD from inspect_photo.py's "date">
  tags:
    - <tag>
  feature: false
  exif:
    camera: <normalized>
    lens: <normalized>
    focalLength: <integer mm>
    aperture: <decimal>
    shutterSpeed: <decimal — the raw fraction, e.g. 1/500 as 0.002, not the display string>
    iso: <integer>
```

Omit the whole `exif:` block (it's optional in the schema) if step 2
couldn't read camera EXIF at all.

### 11. Validate

Run `npx astro check` and `npx astro build`. Fix anything that fails
before going any further — a schema mismatch here means a bad build on
deploy, and step 12 is about to push straight to production.

### 12. Commit and push

**Standing authorization:** the user has explicitly asked for this skill
to commit and push to `main` on their behalf, specifically so that
uploading via Pages CMS and running this skill is the whole workflow —
no separate manual commit step, deploy happens immediately via Cloudflare
Pages' git integration. This overrides this project's normal "only
commit when asked" default, but **only for exactly what this skill
itself touched** — it is not a license to commit unrelated changes that
happen to be sitting in the working tree.

Before staging, run `git status` and confirm every changed/untracked path
is one this run actually produced: the `photos.yaml` edit, the specific
image files added/resized/renamed in `src/content/images/`, and
`gear.json` if step 4 extended it. If anything else shows up dirty or
untracked, stop and ask — don't sweep it into this commit, and don't
`git add -A`.

```
git add src/content/photos.yaml <specific image files> [.claude/skills/add-photos/gear.json]
git commit -m "$(cat <<'EOF'
Add <N> photo(s): <short description, e.g. photo ids or subjects>

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

If the push is rejected (remote has diverged — e.g. another Pages CMS
commit landed after step 0's pull), `git pull --rebase` and retry once;
if that doesn't resolve cleanly, stop and ask rather than force-pushing.

### 13. Report

Summarize: for each photo added, show its id, filename, **the exact alt
text and caption you wrote for it** (verbatim, not paraphrased — the
user should be able to read and correct them without opening the file),
and its tags. Confirm it's pushed. Also report what was skipped as a
duplicate (and of what), and anything that needed a judgment call along
the way (new gear added to `gear.json`, a new tag, GPS present, missing
EXIF) — including anything still sitting unprocessed because of one of
those judgment calls, since
those photos weren't part of the commit and will need a follow-up.
