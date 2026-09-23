---
name: add-photos
description: Turn newly uploaded, undescribed photos in src/content/images/ into full photos.yaml entries — title, slug, EXIF-derived metadata, alt text, optional captions, Dutch translations, location, tags, dedup against the existing library — then commit and push to main so Cloudflare deploys them. Use when the user says things like "add the new photos", "pick up what I uploaded", "describe the new images", "deploy the photos I uploaded", or after they mention uploading photos via Pages CMS from their phone.
---

# Add photos

The intended workflow: upload a photo via Pages CMS from your phone, then
run this skill — nothing else. Pages CMS already handles getting the raw
file into `src/content/images/`; this skill does the judgment-heavy rest
(a title, accurate alt text, clean EXIF-derived metadata, a confirmed
location, dedup against the existing library) and — per standing
authorization, see step 14 — commits and pushes straight to `main`, so
Cloudflare deploys it. No laptop, no separate commit step.

Two bundled scripts do the deterministic parts — never hand-roll their
logic inline, the parsing/arithmetic is easy to get subtly wrong twice:

- `scripts/scan_library.py <repo-root>` — surveys `photos.yaml` and
  `src/content/images/`. Returns orphan images (uploaded but not yet in
  `photos.yaml` — your actual worklist), the next `photo-N` id, every tag
  currently in use, every slug currently in use (for collision detection —
  see step 7), and a fingerprint (date + camera + lens + focal length
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

This is unrelated to (and doesn't replace) step 9's `location` field:
`location` is a venue name — a zoo or park — that the user tells you, not
something read out of GPS coordinates even when they're present. GPS
metadata says where the *camera* was; the venue is a fact about the
day, not something to derive from EXIF.

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

### 7. Title and slug

- **Title is mandatory** — a short human heading (e.g. "Snow leopard
  snarling"), separate from the alt text you'll write in step 8. Look at
  the image; don't derive it mechanically from the filename.
- **Slug is generated once, here, from the title — never regenerated.**
  It's the photo's public URL (`/photo/<slug>/`) and, once written, it's
  immutable: a later title edit (in Pages CMS or otherwise) must never
  change an already-published slug, since that would silently 404 any
  link already shared. This is also why `slug` isn't a Pages CMS field —
  this skill is its only writer.

  Generate it: lowercase the title, drop apostrophes (`'`/`’`) entirely
  (no replacement character — "Pallas's cat" → "pallass", not
  "pallas-s"), replace every run of one-or-more remaining non-`[a-z0-9]`
  characters with a single hyphen, then trim leading/trailing hyphens.

  Titles may repeat across photos; slugs must be unique. Check the
  generated slug against `known_slugs` from step 1 (and against any
  slug already assigned earlier in this same batch) — on collision,
  append `-2`, `-3`, etc. (the first use of a given base slug carries no
  suffix).

### 8. Alt text and caption

Actually look at the image (read it) before writing either of these —
never infer content from the filename or EXIF alone.

- **Alt text is mandatory.** A real, accessible, factual description of
  the scene — subject, pose/action, notable context. Not the filename,
  and not just a repeat of the title: alt text stays the full accessible
  description, title stays the short heading. Look at a few neighboring
  entries in `photos.yaml` for the established tone (e.g. "Snow leopard
  perched on a log, eyeing a hanging rabbit carcass") before writing
  yours.
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

### 8b. Dutch translation

The site is bilingual: `/en/...` and `/nl/...` (see `src/lib/i18n.ts`).
Every photo carries an optional `nl:` block with its own `title`, `alt`
and `caption`, and `localizedPhoto()` in `src/lib/photos.ts` falls back to
the English field when one is missing. Write the Dutch at the same time as
the English — a missing `nl:` block doesn't break the build, but it does
ship an English photo page under a Dutch URL, which is the near-duplicate
problem the whole locale split exists to avoid.

Translate exactly the three fields you just wrote, and nothing else:
`location` is a venue proper noun, `tags` are keys rather than display
text, and `slug` is the immutable public URL and stays English.

The Dutch is held to the same standard as the English, not a lower one —
a first pass at this library produced errors that only a careful reader
caught. In particular:

- **English "-ing" clauses become Dutch relative clauses**, never bare
  participles. "Tijger die slaapt met zijn kop tegen…", not "Tijger
  slapend met…". This is the single most common way the Dutch comes out
  wrong, and it reads as machine-translated immediately.
- **Use animal vocabulary**: `kop` (not `gezicht`) for an animal's head,
  `bek` (not `mond`), `snuit` for a muzzle, `voorpoten` where the English
  says paws doing the gripping.
- **Watch adjective inflection and de/het gender** — "een *andere*
  prairiehond", "een met mos begroeid*e* rots". Getting this wrong is the
  second most common error.
- **Dutch species names, or ask.** Same rule as the English alt text
  above, and it bites harder here: a Dutch name you're unsure of is a
  factual claim a Dutch screen-reader user can't check. The Dutch name
  is often **not** a translation, and calquing the English is the exact
  failure mode — both of these shipped once and had to be corrected by
  the user:
  - snow leopard is a **sneeuwpanter**, not a "sneeuwluipaard"
    (Dutch uses *-panter* across this genus, which is also why a clouded
    leopard is a *nevelpanter*)
  - Pallas's cat is a **manoel**, not a "Pallas-kat"

  Check the Dutch name against nl.wikipedia or a Dutch zoo's own species
  page rather than deriving it from the English. If you can't confirm it,
  ask — don't guess.
- **`foto's`** takes an apostrophe in the plural.
- **Prefer the precise Dutch term over a softened paraphrase.** A dead
  prey animal is a *karkas* (`konijnenkarkas`), not a "dood konijn" —
  the euphemism was tried and rejected.
- Match the English register: informal (`je`, not `u`), sentence case, no
  trailing period, captions short and editorial.

Report the Dutch verbatim in step 15 alongside the English, so it can be
corrected without opening the file.

### 9. Location

Ask the user which zoo or park this was shot at — **never guess or infer
it**, not from the species, the enclosure, the filename, nor from other
photos in the same upload batch or the same shoot day. Two uploads from
the same session are *usually* the same venue, but "usually" isn't a
confirmation: ask every time, even when it seems obvious. (This is a
venue name, not GPS coordinates — see step 5, which is a separate
concern.)

If the user hasn't said and doesn't answer before you need to move on,
leave the field out entirely (`location` is optional in the schema) —
don't block the rest of the entry on it, but do flag it as unconfirmed in
your step 15 report so it isn't forgotten.

### 10. Tags

Use `known_tags` from step 1. Prefer an existing tag over inventing a new
one — the site's tag vocabulary is deliberately small (currently
`animals`, `motorsport`, and `portrait`). If a photo genuinely doesn't
fit anything existing, or it's genuinely ambiguous which existing tag fits best, ask
the user rather than guessing or growing the vocabulary unilaterally.

### 11. Feature flag

Default `feature: false`. This flag spans the photo 2 columns in the grid
*and* makes it eligible as the site's default OG/share image (see
`Base.astro`) — don't set it without the user asking for that specific
photo to be featured.

### 12. Write the entry

Append to the end of `src/content/photos.yaml` (insertion order doesn't
matter — every page sorts by `date` at build time via
`src/lib/photos.ts`). Use `next_id_number` from step 1 (increment it
yourself for each additional photo in the same batch), matching the
existing `photo-NN` zero-padded-to-2 format:

```yaml
- id: photo-<next_id_number>
  slug: <generated once in step 7, e.g. snow-leopard-snarling>
  title: <required, short heading>
  src: images/<filename>.jpeg
  alt: <required, factual>
  caption: <optional, editorial — omit the key entirely if none>
  nl:
    title: <Dutch title, step 8b>
    alt: <Dutch alt, step 8b>
    caption: <only if the English entry has one — omit the key otherwise>
  date: <YYYY-MM-DD from inspect_photo.py's "date">
  location: <optional — the venue name from step 9; omit the key entirely if unconfirmed>
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

Key order matters here only for consistency with the rest of the file —
every existing entry follows this same order. Omit the whole `exif:`
block (it's optional in the schema) if step 2 couldn't read camera EXIF
at all.

### 12b. New subject? Re-read the site's self-description

Only when this run introduces a subject the library didn't meaningfully
have before — a tag used for the first time, or an existing tag whose
share of the library changes materially (a handful of photos becoming
tens). A routine batch of more animals is not that; skip straight to 13.

Nothing in the build reads `photos.yaml` to check any of the following,
so all of it drifts silently and costs no error — just claims that stop
being true:

- **`PERSON_LABELS.knowsAbout` (`src/lib/schema.ts`)** — names the
  subjects actually in the library, in proportion order, and ships in the
  JSON-LD on every page. Today it's a fixed two-tuple
  (`[string, string]`); going to one or three entries means editing that
  type on the same line.
- **`about.yaml`'s `homeIntro` and `body`** — both describe in prose what
  gets photographed ("Mostly animals, sometimes things that move a great
  deal faster"), in **both** locales. `homeIntro` is also the `Person`
  JSON-LD description and `/about/`'s meta description, so it's read in
  three places.
- **`about.yaml`'s `facts`** — `Next up` is where an *intention* lives;
  when the intention arrives as actual photos, it has stopped being next.
- **`homeTitle`/`homeDescription` (`src/lib/i18n.ts`)** — the homepage
  `<title>` and search snippet, per locale. Changing these has real SEO
  consequences, and the two locales are deliberately not translations of
  each other (see the doc comment there).

**Don't rewrite any of this unilaterally** — it's the user's own voice
and their site's search presence. Report what's now out of step with the
library and propose wording; let them choose. This is a prose judgment,
not a mechanical sync, which is exactly why it isn't automated.

### 13. Validate

Run `npm run verify` (this project's `astro check` then `astro build`, in
that order). Fix anything that fails before going any further — a schema
mismatch here means a bad build on deploy, and step 14 is about to push
straight to production.

### 14. Commit and push

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

### 15. Report

Summarize: for each photo added, show its id, slug, filename, **the exact
title, alt text, and caption you wrote for it, in both English and Dutch**
(verbatim, not paraphrased — the user should be able to read and correct
them without opening the file; the Dutch is the half most worth a native
speaker's eyes), its location (or "unconfirmed" if step 9
didn't get an answer), and its tags. Confirm it's pushed. Also report what was skipped
as a duplicate (and of what), and anything that needed a judgment call
along the way (new gear added to `gear.json`, a new tag, GPS present,
missing EXIF, an unconfirmed location, a Dutch species name you weren't
certain of) — including anything still sitting
unprocessed because of one of those judgment calls, since those photos
weren't part of the commit and will need a follow-up.
