import {useCallback, useEffect, useRef, useState} from 'react';

import * as tumblrClient from '../services/tumblrClient';

const PAGE_SIZE = 20;

const fetchPage = (source, offset) => (
	source.type === 'blog' ?
		tumblrClient.getBlogPosts(source.blogName, {limit: PAGE_SIZE, offset}) :
		tumblrClient.getDashboard({limit: PAGE_SIZE, offset})
);

function usePostFeed() {
	const [source, setSource] = useState({type: 'dashboard'});
	const [posts, setPosts] = useState([]);
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
			const newPosts = await fetchPage(nextSource, offset);
			if (id !== requestId.current) return;
			setPosts((prev) => (offset === 0 ? newPosts : [...prev, ...newPosts]));
			setHasMore(newPosts.length === PAGE_SIZE);
		} catch (err) {
			if (id !== requestId.current) return;
			console.warn('usePostFeed: load failed', err);
			setError(err);
		} finally {
			if (id === requestId.current) setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		load(source, 0);
	}, [source, load]);

	const loadMore = useCallback(() => {
		if (isLoading || !hasMore) return;
		load(source, posts.length);
	}, [isLoading, hasMore, load, source, posts.length]);

	return {posts, isLoading, error, hasMore, source, setSource, loadMore};
}

export default usePostFeed;
