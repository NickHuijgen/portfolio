import { getCollection } from 'astro:content';

// Canonical photo order for the whole site: newest-to-oldest by the date
// the picture was taken. The grid, the /tag pages, and /photo/[id]'s
// prev/next all derive from this so they stay in the same order as each
// other — a photo's "next" in the lightbox is always its neighbour in the
// grid, not an artifact of YAML file order.
export async function getSortedPhotos() {
	const photos = await getCollection('photos');
	return photos.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

// "featured" is a pseudo-tag: it isn't in any photo's `tags` array, it's
// backed by the separate `feature` boolean (the same one that drives the
// grid's editorial column span and the og:image fallback). Matching it here
// — rather than re-deriving `tag === 'featured' ? photo.data.feature : ...`
// wherever a photo needs to be tested against the active filter — keeps the
// grid, /tag/[tag]'s static paths, and its page filter from drifting apart.
export function photoMatchesTag(photo: { data: { tags: string[]; feature: boolean } }, tag: string) {
	return tag === 'featured' ? photo.data.feature : photo.data.tags.includes(tag);
}
