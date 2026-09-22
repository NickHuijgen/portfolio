// Shared between tag/[tag].astro (drives the `robots` meta) and
// astro.config.mjs's sitemap `filter` (drives whether the URL is
// submitted to the sitemap at all). These two decisions can't be
// allowed to diverge — a tag noindexed by one but still submitted by
// the other gets Search Console's "Submitted URL marked 'noindex'"
// warning. No `astro:content`/`astro:assets` import here on purpose —
// this file needs to be importable from astro.config.mjs, which can't
// reach those (confirmed directly — see the comment there).
//
// / and every /tag/[tag] measured 0.9998 similar (scripts/styles
// stripped) — near-duplicate content, because a tag covering nearly
// the whole collection renders almost the same figures as the
// homepage. A tag that's a small, genuinely distinct subset doesn't
// have that problem. A coverage threshold, not a hardcoded tag-name
// list (which would go stale the moment tags change), decides which —
// today: animals (63/64, 98%) and featured (11/64, 17%) both
// noindex; portrait (1/64, 2%) stays indexable.
export const NOINDEX_TAG_COVERAGE_THRESHOLD = 0.15;

export function isTagNoindexed(taggedCount: number, totalCount: number): boolean {
	return taggedCount / totalCount > NOINDEX_TAG_COVERAGE_THRESHOLD;
}
