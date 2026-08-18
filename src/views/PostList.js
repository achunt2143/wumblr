import BodyText from '@enact/sandstone/BodyText';
import Button from '@enact/sandstone/Button';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import TabLayout, {Tab} from '@enact/sandstone/TabLayout';
import kind from '@enact/core/kind';
import Spotlight from '@enact/spotlight';
import PropTypes from 'prop-types';
import {useCallback, useRef} from 'react';

import Post from '../components/Post';
import {$L} from '../utils/i18n';

import FollowingList from './FollowingList';
import css from './PostList.module.less';

// The rail is a fixed set of destinations. Viewing someone else's blog is a
// drill-down rather than a destination, so it keeps whichever tab it was
// reached from highlighted and offers Back in the header instead.
// Titles are resolved at render so a locale change re-translates them.
const TABS = [
	{icon: 'home', title: 'Dashboard'},
	{icon: 'profile', title: 'My Blog'},
	{icon: 'heart', title: 'Likes'},
	{icon: 'stargroup', title: 'Following'}
];

const emptyMessage = (source) => (
	source.type === 'likes' ? $L('You haven’t liked anything yet.') : $L('No posts here yet.')
);

// Guards rather than nested ternaries, so each state reads on its own.
const FeedStatus = kind({
	name: 'FeedStatus',

	propTypes: {
		source: PropTypes.shape({type: PropTypes.string}).isRequired,
		error: PropTypes.instanceOf(Error),
		isInitialLoad: PropTypes.bool
	},

	render: ({error, isInitialLoad, source}) => {
		if (isInitialLoad) return <Spinner>{$L('Loading…')}</Spinner>;
		if (error) return <BodyText>{$L('Couldn’t load that. Please try again.')}</BodyText>;
		return <BodyText>{emptyMessage(source)}</BodyText>;
	}
});

const PostList = ({
	error,
	followedBlogs,
	followingError,
	hasMore,
	isLoading,
	isLoadingFollowing,
	items,
	onLoadMore,
	onOpenMedia,
	onReblog,
	onSelectBlog,
	onSelectTab,
	onToggleLike,
	source,
	tabIndex,
	username
}) => {
	const isFollowingView = source.type === 'following';
	const isInitialLoad = items.length === 0 && isLoading;
	const isEmpty = items.length === 0 && !isLoading;

	// Sandstone's Scroller can lose track of the focused element and snap
	// back to the top when focus moves inside it (a pointer click far down
	// the list is the easiest way to trigger it), because nothing tells the
	// scroller's internal position tracking where focus actually landed.
	// Explicitly re-anchoring on every focus change (via cbScrollTo) keeps
	// it in sync. Skipped in pointer mode: a Magic Remote (or mouse) can
	// only hover something already on screen, so no scroll is needed, and
	// forcing one on every hover makes the list jump around as the cursor
	// sweeps across it. 5-way/keyboard nav still gets the fix.
	const scrollToRef = useRef(null);
	const handleFocusWithin = useCallback((ev) => {
		if (Spotlight.getPointerMode()) return;
		if (scrollToRef.current) scrollToRef.current({node: ev.target, focus: true});
	}, []);

	const handleSelect = useCallback(({index}) => onSelectTab(index), [onSelectTab]);

	const handleScrollTo = useCallback((scrollTo) => {
		scrollToRef.current = scrollTo;
	}, []);

	const body = isFollowingView ? (
		<FollowingList
			blogs={followedBlogs}
			error={followingError}
			isLoading={isLoadingFollowing}
			onFocusWithin={handleFocusWithin}
			onSelectBlog={onSelectBlog}
		/>
	) : (
		<Scroller cbScrollTo={handleScrollTo} className={css.scroller}>
			{isInitialLoad || isEmpty ? (
				<div className={css.status}>
					<FeedStatus error={error} isInitialLoad={isInitialLoad} source={source} />
				</div>
			) : (
				<div className={css.allposts}>
					{items.map((post, index) => (
						<Post
							key={post.id_string || post.id}
							even={index % 2 === 0}
							isOwnBlog={post.blog_name === username}
							post={post}
							onFocusWithin={handleFocusWithin}
							onOpenMedia={onOpenMedia}
							onReblog={onReblog}
							onSelectBlog={onSelectBlog}
							onToggleLike={onToggleLike}
						/>
					))}
					{hasMore ? (
						<div className={css.loadMoreRow}>
							<Button
								disabled={isLoading}
								onClick={onLoadMore}
								onFocus={handleFocusWithin}
							>
								{isLoading ? $L('Loading…') : $L('Load more')}
							</Button>
						</div>
					) : null}
				</div>
			)}
		</Scroller>
	);

	return (
		<TabLayout
			className={css.tabs}
			index={tabIndex}
			orientation="vertical"
			onSelect={handleSelect}
		>
			{TABS.map((tab, index) => (
				// Only the active tab gets the content: what's shown is driven
				// by `source`, not by the tab, so handing it to every tab would
				// mount several copies of the feed.
				<Tab key={tab.title} icon={tab.icon} title={$L(tab.title)}>
					{index === tabIndex ? body : null}
				</Tab>
			))}
		</TabLayout>
	);
};

PostList.propTypes = {
	items: PropTypes.array.isRequired,
	onLoadMore: PropTypes.func.isRequired,
	onOpenMedia: PropTypes.func.isRequired,
	onReblog: PropTypes.func.isRequired,
	onSelectBlog: PropTypes.func.isRequired,
	onSelectTab: PropTypes.func.isRequired,
	onToggleLike: PropTypes.func.isRequired,
	source: PropTypes.shape({
		blogName: PropTypes.string,
		type: PropTypes.oneOf(['dashboard', 'blog', 'likes', 'following'])
	}).isRequired,
	error: PropTypes.instanceOf(Error),
	followedBlogs: PropTypes.array,
	followingError: PropTypes.instanceOf(Error),
	hasMore: PropTypes.bool,
	isLoading: PropTypes.bool,
	isLoadingFollowing: PropTypes.bool,
	tabIndex: PropTypes.number,
	username: PropTypes.string
};

export default PostList;
