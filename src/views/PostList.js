import BodyText from '@enact/sandstone/BodyText';
import Button from '@enact/sandstone/Button';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import {Row} from '@enact/ui/Layout';
import PropTypes from 'prop-types';
import React from 'react';

import Post from '../components/Post';

import css from './PostList.module.less';

const PostList = ({
	error,
	hasMore,
	isLoading,
	onLoadMore,
	onReblog,
	onSelectBlog,
	onShowDashboard,
	onShowMyBlog,
	onToggleLike,
	posts,
	source,
	username
}) => {
	const isDashboard = source.type === 'dashboard';
	const isMyBlog = source.type === 'blog' && source.blogName === username;
	const isInitialLoad = posts.length === 0 && isLoading;
	const isEmpty = posts.length === 0 && !isLoading;

	return (
		<>
			<Row className={css.sectionNav}>
				<Button selected={isDashboard} size="small" onClick={onShowDashboard}>Dashboard</Button>
				<Button selected={isMyBlog} size="small" onClick={onShowMyBlog}>My Blog</Button>
			</Row>
			<Scroller className={css.scroller}>
				{isInitialLoad ? (
					<Spinner className={css.status}>Loading posts…</Spinner>
				) : isEmpty && error ? (
					<BodyText className={css.status}>Couldn&apos;t load posts. Please try again.</BodyText>
				) : isEmpty ? (
					<BodyText className={css.status}>No posts here yet.</BodyText>
				) : (
					<div className={css.allposts}>
						{posts.map((post, index) => (
							<Post
								key={post.id}
								even={index % 2 === 0}
								isOwnBlog={post.blog_name === username}
								post={post}
								onReblog={onReblog}
								onSelectBlog={onSelectBlog}
								onToggleLike={onToggleLike}
							/>
						))}
						{hasMore ? (
							<Button className={css.loadMore} disabled={isLoading} onClick={onLoadMore}>
								{isLoading ? 'Loading…' : 'Load more'}
							</Button>
						) : null}
					</div>
				)}
			</Scroller>
		</>
	);
};

PostList.propTypes = {
	error: PropTypes.instanceOf(Error),
	hasMore: PropTypes.bool,
	isLoading: PropTypes.bool,
	onLoadMore: PropTypes.func.isRequired,
	onReblog: PropTypes.func.isRequired,
	onSelectBlog: PropTypes.func.isRequired,
	onShowDashboard: PropTypes.func.isRequired,
	onShowMyBlog: PropTypes.func.isRequired,
	onToggleLike: PropTypes.func.isRequired,
	posts: PropTypes.array.isRequired,
	source: PropTypes.shape({
		blogName: PropTypes.string,
		type: PropTypes.oneOf(['dashboard', 'blog'])
	}).isRequired,
	username: PropTypes.string
};

export default PostList;
