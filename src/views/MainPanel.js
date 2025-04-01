import {Header, Panel} from '@enact/sandstone/Panels';
import Spinner from '@enact/sandstone/Spinner';
import React from 'react';

import usePostFeed from '../hooks/usePostFeed';
import useTumblrAuth from '../hooks/useTumblrAuth';
import * as tumblrClient from '../services/tumblrClient';
import AuthComponent from './AuthComponent';
import css from './MainPanel.module.less';
import PostList from './PostList';

const MainPanel = () => {
	const auth = useTumblrAuth();
	const feed = usePostFeed();

	const handleToggleLike = (post, liked) => (
		liked ?
			tumblrClient.likePost(post.id, post.reblog_key) :
			tumblrClient.unlikePost(post.id, post.reblog_key)
	);

	const handleReblog = (post) => (
		tumblrClient.reblogPost(auth.username, {id: post.id, reblogKey: post.reblog_key})
	);

	const handleSelectBlog = (blogName) => feed.setSource({type: 'blog', blogName});
	const handleShowDashboard = () => feed.setSource({type: 'dashboard'});
	const handleShowMyBlog = () => feed.setSource({type: 'blog', blogName: auth.username});

	let content;
	if (auth.isLoading) {
		content = <Spinner className={css.status}>Loading…</Spinner>;
	} else if (!auth.isLoggedIn) {
		content = <AuthComponent onAuthenticate={auth.login} />;
	} else {
		content = (
			<PostList
				error={feed.error}
				hasMore={feed.hasMore}
				isLoading={feed.isLoading}
				posts={feed.posts}
				source={feed.source}
				username={auth.username}
				onLoadMore={feed.loadMore}
				onReblog={handleReblog}
				onSelectBlog={handleSelectBlog}
				onShowDashboard={handleShowDashboard}
				onShowMyBlog={handleShowMyBlog}
				onToggleLike={handleToggleLike}
			/>
		);
	}

	return (
		<Panel className={css.panel} noCloseButton>
			<Header title="wumblr" type="mini" />
			{content}
		</Panel>
	);
};

export default MainPanel;
