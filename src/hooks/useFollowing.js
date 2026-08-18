import {useCallback, useEffect, useRef, useState} from 'react';

import * as appCache from '../services/appCache';
import * as tumblrClient from '../services/tumblrClient';
import * as logger from '../utils/logger';

const MAX_PAGES = 200; // guard against a cursor that never terminates

// Tumblr returns the following list most-recently-followed first, so new
// follows land at the top. A delta sync therefore only has to read pages
// until it meets a blog already in the cache - usually a single request -
// rather than re-walking all ~21 pages and risking a rate limit.
async function fetchUntilKnown (known, {full}) {
	const collected = [];
	const seen = new Set();
	let offset = 0;
	let reachedKnown = false;

	for (let page = 0; page < MAX_PAGES && offset !== null; page++) {
		// eslint-disable-next-line no-await-in-loop
		const {blogs, nextOffset} = await tumblrClient.getFollowing({offset});

		for (const blog of blogs) {
			// Paging windows can overlap, so guard against repeats.
			if (seen.has(blog.name)) continue;
			seen.add(blog.name);
			if (!full && known.has(blog.name)) {
				reachedKnown = true;
				continue;
			}
			collected.push(blog);
		}

		// Stop as soon as this page reached blogs we already had; anything
		// older than that is already cached.
		if (reachedKnown) break;
		offset = nextOffset;
	}

	return {collected, reachedKnown};
}

function useFollowing (enabled, owner) {
	const [blogs, setBlogs] = useState(() => appCache.getFollowing());
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState(null);
	const runId = useRef(0);
	const synced = useRef(false);

	const sync = useCallback(async ({full = false} = {}) => {
		const id = ++runId.current;
		setIsLoading(true);
		setError(null);
		try {
			const cached = full ? [] : appCache.getFollowing();
			const known = new Set(cached.map((blog) => blog.name));
			const {collected} = await fetchUntilKnown(known, {full});
			if (id !== runId.current) return;

			// New follows go on top, ahead of what was already cached.
			const merged = full ? collected : [...collected, ...cached];
			appCache.setFollowing(merged);
			setBlogs(merged);
		} catch (err) {
			if (id !== runId.current) return;
			logger.warn('useFollowing: sync failed', err);
			setError(err);
		} finally {
			if (id === runId.current) setIsLoading(false);
		}
	}, []);

	// A new account (or sign-out) invalidates whatever is held here.
	useEffect(() => {
		synced.current = false;
		setBlogs(appCache.getFollowing());
	}, [owner]);

	useEffect(() => {
		if (!enabled || synced.current) return;
		synced.current = true;
		// With nothing cached this walks every page; with a cache it stops at
		// the first familiar blog.
		sync({full: appCache.getFollowing().length === 0});
	}, [enabled, sync]);

	const refresh = useCallback(() => sync({full: false}), [sync]);

	return {blogs, isLoading, error, refresh};
}

export default useFollowing;
