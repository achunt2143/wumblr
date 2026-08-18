import Button from '@enact/sandstone/Button';
import {Header, Panel} from '@enact/sandstone/Panels';
import Spinner from '@enact/sandstone/Spinner';
import {useCallback, useState} from 'react';

import MediaViewer from '../components/MediaViewer';
import useBlogFollow from '../hooks/useBlogFollow';
import useFollowing from '../hooks/useFollowing';
import usePostFeed from '../hooks/usePostFeed';
import useTumblrAuth from '../hooks/useTumblrAuth';
import * as tumblrClient from '../services/tumblrClient';
import {$L} from '../utils/i18n';
import {postId} from '../utils/post';
import AuthComponent from './AuthComponent';
import css from './MainPanel.module.less';
import PostList from './PostList';
import SettingsPopup from './SettingsPopup';

// The header doubles as the "where am I" indicator, so it names the blog
// being viewed and falls back to the app name on the dashboard.
const headerTitle = (source, username) => {
	switch (source.type) {
		case 'blog':
			return source.blogName === username ? $L('My Blog') : source.blogName;
		case 'likes':
			return $L('Your Likes');
		case 'following':
			return $L('Following');
		default:
			return 'wumblr';
	}
};

// Matches the tab order in PostList.
const TAB_SOURCES = ['dashboard', 'ownBlog', 'likes', 'following'];

const sourceForTab = (index, username) => (
	TAB_SOURCES[index] === 'ownBlog' ?
		{type: 'blog', blogName: username} :
		{type: TAB_SOURCES[index] || 'dashboard'}
);

const tabForSource = (source, username, fallback) => {
	switch (source.type) {
		case 'blog':
			// Another blog isn't a tab; keep the one it was opened from lit.
			return source.blogName === username ? 1 : fallback;
		case 'likes':
			return 2;
		case 'following':
			return 3;
		default:
			return 0;
	}
};

const MainPanel = () => {
	const auth = useTumblrAuth();
	const feed = usePostFeed(auth.isLoggedIn);
	const [media, setMedia] = useState(null);
	const [settingsOpen, setSettingsOpen] = useState(false);
	// The tab a blog drill-down was launched from, so the rail keeps a
	// sensible selection and Back knows where to return.
	const [homeTab, setHomeTab] = useState(0);

	// Only another blog can be followed, and its posts carry the current
	// follow state, so the first one seeds the button.
	const viewedBlog = feed.source.type === 'blog' && feed.source.blogName !== auth.username ?
		feed.source.blogName :
		null;
	const followedFromFeed = feed.items.length > 0 && Boolean(feed.items[0].followed);
	const follow = useBlogFollow(viewedBlog, followedFromFeed);

	// The following list pages differently from the post feeds, so it has its
	// own hook and only fetches while that tab is open.
	const following = useFollowing(auth.isLoggedIn && feed.source.type === 'following', auth.username);

	const handleToggleLike = useCallback((post, liked) => (
		liked ?
			tumblrClient.likePost(postId(post), post.reblog_key) :
			tumblrClient.unlikePost(postId(post), post.reblog_key)
	), []);

	const handleReblog = useCallback((post) => (
		tumblrClient.reblogPost(auth.username, {
			parentPostId: postId(post),
			parentTumblelogUuid: post.blog.uuid,
			reblogKey: post.reblog_key
		})
	), [auth.username]);

	const isOtherBlog = Boolean(viewedBlog);
	const tabIndex = tabForSource(feed.source, auth.username, homeTab);

	const handleSelectTab = useCallback((index) => {
		setHomeTab(index);
		feed.setSource(sourceForTab(index, auth.username));
	}, [auth.username, feed]);

	const handleSelectBlog = useCallback((blogName) => {
		// Remember the tab this drill-down started from so Back can return
		// there; chaining blog to blog keeps the original starting point.
		if (!isOtherBlog) setHomeTab(tabIndex);
		feed.setSource({type: 'blog', blogName});
	}, [feed, isOtherBlog, tabIndex]);

	const handleBack = useCallback(
		() => feed.setSource(sourceForTab(homeTab, auth.username)),
		[auth.username, feed, homeTab]
	);

	const handleOpenMedia = useCallback((next) => setMedia(next), []);
	const handleCloseMedia = useCallback(() => setMedia(null), []);
	const handleOpenSettings = useCallback(() => setSettingsOpen(true), []);
	const handleCloseSettings = useCallback(() => setSettingsOpen(false), []);

	const handleSignOut = useCallback(() => {
		setSettingsOpen(false);
		// Send the feed home too, so signing in as someone else doesn't land
		// on the previous account's blog.
		feed.setSource({type: 'dashboard'});
		auth.logout();
	}, [auth, feed]);

	let content;
	if (auth.isLoading) {
		content = <Spinner className={css.status}>{$L('Loading…')}</Spinner>;
	} else if (!auth.isLoggedIn) {
		content = <AuthComponent onAuthenticate={auth.login} />;
	} else {
		content = (
			<PostList
				error={feed.error}
				followedBlogs={following.blogs}
				followingError={following.error}
				hasMore={feed.hasMore}
				isLoading={feed.isLoading}
				isLoadingFollowing={following.isLoading}
				items={feed.items}
				source={feed.source}
				tabIndex={tabIndex}
				username={auth.username}
				onLoadMore={feed.loadMore}
				onOpenMedia={handleOpenMedia}
				onReblog={handleReblog}
				onSelectBlog={handleSelectBlog}
				onSelectTab={handleSelectTab}
				onToggleLike={handleToggleLike}
			/>
		);
	}

	return (
		<Panel className={css.panel} noCloseButton>
			{/* Follow and Back act on the blog currently being viewed, so they
			    belong beside the title rather than in the tab rail - tabs are
			    destinations, these are actions. */}
			<Header
				slotAfter={auth.isLoggedIn ? (
					<>
						{isOtherBlog ? (
							<Button aria-label={$L('Back')} icon="arrowhookleft" size="small" onClick={handleBack} />
						) : null}
						{isOtherBlog ? (
							<Button
								disabled={follow.isBusy}
								icon={follow.isFollowing ? 'check' : 'plus'}
								selected={follow.isFollowing}
								size="small"
								onClick={follow.toggle}
							>
								{follow.isFollowing ? $L('Following') : $L('Follow')}
							</Button>
						) : null}
						<Button aria-label={$L('Settings')} icon="gear" size="small" onClick={handleOpenSettings} />
					</>
				) : null}
				title={auth.isLoggedIn ? headerTitle(feed.source, auth.username) : 'wumblr'}
				type="mini"
			/>
			{content}
			<MediaViewer media={media} onClose={handleCloseMedia} />
			<SettingsPopup
				isRefreshingBlogs={following.isLoading}
				open={settingsOpen}
				profile={auth.profile}
				onClose={handleCloseSettings}
				onRefreshBlogs={following.refresh}
				onSignOut={handleSignOut}
			/>
		</Panel>
	);
};

export default MainPanel;
