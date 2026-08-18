import {useCallback, useEffect, useState} from 'react';

import * as appCache from '../services/appCache';
import * as tumblrClient from '../services/tumblrClient';
import * as logger from '../utils/logger';

// Whether you follow a blog rides along on its posts - each one carries a
// `followed` flag - so viewing a blog already tells us the state and no
// extra request is needed. `followedFromFeed` is that flag; toggling keeps
// a local override so the button reacts immediately and only falls back to
// the feed value when the blog changes.
function useBlogFollow (blogName, followedFromFeed) {
	const [override, setOverride] = useState(null);
	const [isBusy, setIsBusy] = useState(false);

	// Clear the override when moving to another blog, so one blog's state
	// can't leak onto the next.
	useEffect(() => {
		setOverride(null);
	}, [blogName]);

	const isFollowing = override === null ? Boolean(followedFromFeed) : override;

	const toggle = useCallback(async () => {
		if (!blogName || isBusy) return;
		const next = !isFollowing;
		setOverride(next);
		setIsBusy(true);
		try {
			if (next) {
				const result = await tumblrClient.followBlog(blogName);
				// Fold the change into the cached list so it shows up without
				// waiting for a refresh; the response carries the blog record.
				appCache.addFollowedBlog((result && result.blog) || {name: blogName});
			} else {
				await tumblrClient.unfollowBlog(blogName);
				appCache.removeFollowedBlog(blogName);
			}
		} catch (err) {
			logger.warn('useBlogFollow: toggle failed', err);
			setOverride(!next);
		} finally {
			setIsBusy(false);
		}
	}, [blogName, isBusy, isFollowing]);

	return {isFollowing, isBusy, toggle};
}

export default useBlogFollow;
