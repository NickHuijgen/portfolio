/**
 * Accept-Language negotiation for the bare `/` URL.
 *
 * The site is symmetrically localized: every real page lives under `/en/`
 * or `/nl/` (see src/lib/i18n.ts). `/` holds no content — it exists only
 * to send a visitor to the right locale, which this worker does at the
 * edge, before a byte of HTML is sent.
 *
 * English is the default: a browser asking for a language this site
 * doesn't have lands on `/en/` rather than being offered a choice.
 *
 * Why a Worker and not a Pages Function: this project deploys via Workers
 * static assets (`assets.directory` in wrangler.jsonc), not Cloudflare
 * Pages. A `functions/_middleware.js` would simply never execute here.
 *
 * Why not a client-side redirect: it would fire only after the HTML is
 * parsed, so a Dutch visitor would download the English homepage's LCP
 * image — the one index.astro preloads at fetchpriority="high" — and only
 * then navigate away from it. That throws away the LCP work documented in
 * AGENTS.md's Performance section for exactly the audience this locale
 * was added for, and flashes English first.
 *
 * `run_worker_first: ["/"]` in wrangler.jsonc scopes this to the root, so
 * every other request still goes straight to the static asset handler and
 * never pays for a worker invocation. The pathname guard below is a second
 * line of defence in case that scoping is ever widened.
 *
 * SEO notes, because automatic language redirection is a documented
 * Google anti-pattern and this is the managed-risk version of it:
 *  - 302, never 301: the choice has to stay revisitable.
 *  - Only `/` ever redirects. A URL that already names a locale is served
 *    exactly as asked — that is what keeps a shared link landing where the
 *    sender meant, and what keeps Googlebot (which crawls with
 *    `Accept-Language: en` from US IPs) able to reach both locales.
 *  - A `lang` cookie, written by the header's language switcher, outranks
 *    the header — so a manual choice wins permanently.
 *  - `Vary` on every root response, so no shared cache serves one
 *    visitor's negotiated locale to another.
 */

// Duplicated from LOCALES/DEFAULT_LOCALE in src/lib/i18n.ts. This file is
// bundled by Cloudflare's own build, outside Astro's Vite pipeline and
// outside the files `astro check` actually diagnoses (it walks the Astro
// app's own reachable graph, which never reaches this file), so importing
// the real constants across that boundary is more fragile than restating
// them. See AGENTS.md's Invariants table — adding a locale means
// editing both.
const LOCALES = ['en', 'nl'];
const DEFAULT_LOCALE = 'en';

/** @param {Request} request */
function cookieLocale(request) {
	const cookie = request.headers.get('Cookie');
	if (!cookie) return null;
	const match = cookie.match(/(?:^|;\s*)lang=([^;]*)/);
	if (!match) return null;
	const value = decodeURIComponent(match[1]).trim().toLowerCase();
	return LOCALES.includes(value) ? value : null;
}

/**
 * Picks the highest-q locale this site actually has. Returns null when the
 * header is absent, malformed, or names no locale this site has — the
 * caller falls back to DEFAULT_LOCALE in that case.
 *
 * `*` is treated as "no preference" and stops the search, landing on the
 * same default: a client saying "anything is fine" gets the default rather
 * than whatever happens to appear later in its own list.
 *
 * Region variants match on the primary subtag, so `en-US`, `en-GB` and
 * plain `en` all resolve to `en`, and `nl-BE`/`nl-NL` to `nl`. This site
 * has no region-specific variants to distinguish between.
 *
 * @param {Request} request
 */
function headerLocale(request) {
	const header = request.headers.get('Accept-Language');
	if (!header) return null;

	const ranked = header
		.split(',')
		.map((part) => {
			const [tag, ...params] = part.trim().split(';');
			const qParam = params.map((p) => p.trim().toLowerCase()).find((p) => p.startsWith('q='));
			const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
			return { tag: tag.trim().toLowerCase(), q };
		})
		// Drop malformed entries and explicit q=0 ("never send me this").
		.filter((entry) => entry.tag !== '' && Number.isFinite(entry.q) && entry.q > 0)
		// Stable within equal q, so the header's own order breaks ties the
		// way the browser intended.
		.sort((a, b) => b.q - a.q);

	for (const { tag } of ranked) {
		if (tag === '*') return null;
		// `nl-BE` and `nl` both mean the Dutch page; match on the primary
		// subtag only, since this site has no region-specific variants.
		const base = tag.split('-')[0];
		if (LOCALES.includes(base)) return base;
	}
	return null;
}

/**
 * `search` is carried across: the bare domain is what goes on a business
 * card and in a bio link, so `/?utm_source=…` is exactly where campaign
 * parameters arrive. Dropping them on the redirect would silently break
 * attribution for the one URL most likely to carry it.
 *
 * @param {string} locale
 * @param {string} search
 */
function redirectTo(locale, search) {
	return new Response(null, {
		status: 302,
		headers: {
			Location: `/${locale}/${search}`,
			Vary: 'Accept-Language, Cookie',
			// This redirect is per-visitor by construction. `Vary` alone
			// would let a shared cache keep variants, but getting that
			// subtly wrong sends the wrong language to real people, and the
			// cost here is one round trip on the bare domain only — every
			// localized page is still a plain cached static asset.
			'Cache-Control': 'no-store',
		},
	});
}

export default {
	/**
	 * @param {Request} request
	 * @param {{ ASSETS: { fetch: (request: Request) => Promise<Response> } }} env
	 */
	async fetch(request, env) {
		const url = new URL(request.url);
		if (url.pathname !== '/') return env.ASSETS.fetch(request);

		// `/` always redirects — it has no content of its own. A browser
		// asking for a language this site doesn't have (de, fr, ja) gets
		// DEFAULT_LOCALE rather than being asked to choose.
		return redirectTo(cookieLocale(request) ?? headerLocale(request) ?? DEFAULT_LOCALE, url.search);
	},
};
