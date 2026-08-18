import {useCallback, useEffect, useRef, useState} from 'react';

import * as tumblrClient from '../services/tumblrClient';
import * as logger from '../utils/logger';

const PAGE_SIZE = 20;

// These sources all page the same way - a fixed `limit` with the offset
// advancing by the number of posts received - so they share this hook.
// Following is deliberately not among them: that endpoint ignores `limit`
// and needs its own cursor, so it lives in useFollowing instead.
const fetchPage = (source, offset) => {
	const paging = {limit: PAGE_SIZE, offset};
	switch (source.type) {
		case 'blog':
			return tumblrClient.getBlogPosts(source.blogName, paging);
		case 'likes':
			return tumblrClient.getLikes(paging);
		default:
			return tumblrClient.getDashboard(paging);
	}
};

function usePostFeed (enabled) {
	const [source, setSource] = useState({type: 'dashboard'});
	const [items, setItems] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState(null);
	const [hasMore, setHasMore] = useState(true);
	// Guards against a slow, stale request overwriting state after a newer
	// one (e.g. source switched again before the first request resolved).
	const requestId = useRef(0);

	const load = useCallback(async (nextSource, offset) => {
		const id = ++requestId.current;
		setIsLoading(true);
		setError(null);
		try {
			const newItems = (await fetchPage(nextSource, offset)) || [];
			if (id !== requestId.current) return;
			setItems((prev) => (offset === 0 ? newItems : [...prev, ...newItems]));
			setHasMore(newItems.length === PAGE_SIZE);
		} catch (err) {
			if (id !== requestId.current) return;
			logger.warn('usePostFeed: load failed', err);
			setError(err);
		} finally {
			if (id === requestId.current) setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		// Not enabled before login: the client isn't configured yet, so
		// there's nothing to fetch. 'following' is served by useFollowing;
		// without this guard it would fall through and fetch the dashboard.
		if (enabled && source.type !== 'following') load(source, 0);
	}, [enabled, source, load]);

	const loadMore = useCallback(() => {
		if (isLoading || !hasMore) return;
		load(source, items.length);
	}, [isLoading, hasMore, load, source, items.length]);

	// Switching source resets the list so a stale page never shows under a
	// new heading while the first request is in flight.
	const showSource = useCallback((nextSource) => {
		setItems([]);
		setHasMore(true);
		setSource(nextSource);
	}, []);

	return {items, isLoading, error, hasMore, source, setSource: showSource, loadMore};
}

export default usePostFeed;
