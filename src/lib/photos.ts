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
