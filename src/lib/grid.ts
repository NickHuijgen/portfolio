// Reference width is the upper edge of each breakpoint's range, so the
// computed row-span always covers the image at any narrower width within
// that range (extra whitespace below, never an overflow/crop).
//
// md and lg are each split into two reference sub-tiers (md/md2,
// lg/lg2) for the same reason xs/sm are split below: a single reference
// at the *top* of a wide range massively overshoots for any real
// viewport nearer the bottom of it. Unlike xs/sm, though, md/lg's
// problem was never a too-wide-viewport overflow (the pre-existing
// `.grid` max-width: 1200px already caps that, safely, for anything
// >=1200px) — it was the opposite: a *reference* far above the range's
// *lower* edge, reserving rows sized for a 1000px or 1200px column on
// viewports as narrow as 600px or 1000px. Measured live (resizing the
// actual grid, not just replaying the math) before this split: 81%
// dead space below every image at a 600px window, 27% at 1000px,
// dropping to a ~5% quantization-rounding floor only once the real
// viewport neared each old single reference. An iPad in portrait
// (768px) or landscape (1024px), a split-screen window, or any resized
// desktop browser routinely lands in these ranges.
//
// Splitting the reference (not just adding a `.grid` max-width, which
// only helps the too-wide case) is what actually fixes this: each new
// sub-tier's reference is set to its own CSS breakpoint's upper edge
// (800 for md's 600-799px range, 1000 for md2's 800-999px range, 1100
// for lg's 1000-1099px range, 1200 for lg2's 1100px+ range — the last
// still backstopped by the pre-existing `.grid` max-width), so each is
// safe by construction the same way xs/sm already are — no additional
// `.grid` max-width breakpoints needed for md/md2/lg/lg2, only new
// `@media` blocks (in PhotoGallery.astro) switching which row-height
// reference is active at each width. Column count and gap are
// unchanged within each original tier (md2 still shares md's 3
// columns/16px gap; lg2 still shares lg's 4 columns/16px gap) — only
// the row-height math changes.
export const TIERS = {
	lg2: { container: 1200, columns: 4, gap: 16 },
	lg: { container: 1100, columns: 4, gap: 16 },
	md2: { container: 1000, columns: 3, gap: 16 },
	md: { container: 800, columns: 3, gap: 16 },
	// The sm breakpoint spans 0-600px in CSS, but no real phone is
	// anywhere near that wide. Using 600 as the reference here reserved
	// rows sized for a much wider viewport than any phone actually
	// renders at, leaving a lot of dead space below every image on an
	// actual phone. 430px is the widest mainstream phone (iPhone 16 Pro
	// Max) — it's still a safe upper bound (no overflow on any real
	// device), but fits rows far tighter on the phones people actually
	// browse on.
	//
	// The gap is also tighter here: grid-auto-rows + gap sets the
	// row-quantization granularity, so every spanned row internally
	// "pays" one full gap even inside a single image's reserved box.
	// A smaller gap on mobile both tightens the visible spacing
	// between photos and shrinks that rounding slack.
	sm: { container: 430, columns: 3, gap: 8 },
	// Same reasoning as sm, one more time: 430px is a safe upper bound
	// for *that* tier, but it's the widest end of it — a Pro Max/Plus
	// -class phone. A genuinely slim phone (an SE, a mini, most compact
	// Android phones, ~360-393px) still renders every image ~10-20%
	// shorter than sm's math reserves for it, which reads as "a lot of
	// spacing" on exactly those devices. Splitting sm at 400px (below:
	// xs, above: sm) gives narrow phones their own tighter reference —
	// 393px covers the standard-width iPhones and most Android phones,
	// without ballooning back up to cover the Plus/Pro Max tier that
	// doesn't exist below 400px anyway. Column count and gap are
	// unchanged from sm — only the row-height math gets tighter, so
	// there's no matching `@media` breakpoint for `.grid` itself, only
	// for `.item`'s `grid-row`.
	xs: { container: 393, columns: 3, gap: 8 },
};

export function columnWidth(container: number, columns: number, gap: number) {
	return (container - gap * (columns - 1)) / columns;
}

// The `sizes` value for a grid thumbnail in its default (closed,
// unfiltered) state — shared between PhotoGallery.astro (every grid
// thumbnail) and index.astro (which needs the exact same value, matched
// to the same `widths` array, to preload the homepage's LCP photo
// without the browser treating it as a different request and fetching
// it twice — see the comment on that preload for why an exact match
// matters). Single-sourced here rather than duplicated so the two can
// never drift apart.
export function gridImageSizes(feature: boolean) {
	const colSpan = feature ? 2 : 1;
	const widthAt = (tier: keyof typeof TIERS) => {
		const { container, columns, gap } = TIERS[tier];
		const colWidth = columnWidth(container, columns, gap);
		return Math.round(colWidth * colSpan + gap * (colSpan - 1));
	};
	return `(min-width: 1100px) ${widthAt('lg2')}px, (min-width: 1000px) ${widthAt('lg')}px, (min-width: 800px) ${widthAt('md2')}px, (min-width: 600px) ${widthAt('md')}px, (min-width: 400px) ${widthAt('sm')}px, ${widthAt('xs')}px`;
}
