import { getCollection } from 'astro:content';

// Single-entry "about" collection (see src/content/about.yaml) — one file,
// one record, editable from Pages CMS without touching code.
export async function getAbout() {
	const [entry] = await getCollection('about');
	return entry.data;
}
