import BodyText from '@enact/sandstone/BodyText';
import Button from '@enact/sandstone/Button';
import Image from '@enact/sandstone/Image';
import {Row} from '@enact/ui/Layout';
import PropTypes from 'prop-types';
import React, {useState} from 'react';

import css from './Post.module.less';

const Post = ({even, isOwnBlog, onReblog, onSelectBlog, onToggleLike, post}) => {
	const [liked, setLiked] = useState(Boolean(post.liked));
	const [reblogged, setReblogged] = useState(false);
	const [isReblogging, setIsReblogging] = useState(false);

	const photo = post.type === 'photo' && post.photos ? post.photos[0] : null;

	const handleSelectBlog = () => onSelectBlog(post.blog_name);

	const handleToggleLike = async () => {
		const nextLiked = !liked;
		setLiked(nextLiked);
		try {
			await onToggleLike(post, nextLiked);
		} catch (err) {
			console.warn('Post: like failed', err);
			setLiked(!nextLiked);
		}
	};

	const handleReblog = async () => {
		if (reblogged || isReblogging) return;
		setIsReblogging(true);
		try {
			await onReblog(post);
			setReblogged(true);
		} catch (err) {
			console.warn('Post: reblog failed', err);
		} finally {
			setIsReblogging(false);
		}
	};

	return (
		<div className={even ? css.postEVEN : css.postODD}>
			<Button
				backgroundOpacity="transparent"
				className={css.blogName}
				size="small"
				onClick={handleSelectBlog}
			>
				{post.blog_name}
			</Button>
			{photo ? (
				<Image className={css.postImage} sizing="fill" src={photo.original_size.url} />
			) : null}
			{post.type === 'text' && post.body ? (
				// Tumblr returns post bodies as HTML; rendering it is the point of a Tumblr client.
				// eslint-disable-next-line react/no-danger
				<BodyText className={css.postBody}><span dangerouslySetInnerHTML={{__html: post.body}} /></BodyText>
			) : null}
			{photo && post.caption ? (
				// eslint-disable-next-line react/no-danger
				<BodyText className={css.postBody}><span dangerouslySetInnerHTML={{__html: post.caption}} /></BodyText>
			) : null}
			<Row className={css.postActions}>
				<Button icon="heart" selected={liked} size="small" onClick={handleToggleLike}>
					Like
				</Button>
				{!isOwnBlog ? (
					<Button
						disabled={isReblogging}
						icon="arrowhookright"
						selected={reblogged}
						size="small"
						onClick={handleReblog}
					>
						{reblogged ? 'Reblogged' : 'Reblog'}
					</Button>
				) : null}
				<BodyText className={css.notes} size="small">Notes: {post.note_count}</BodyText>
			</Row>
		</div>
	);
};

Post.propTypes = {
	even: PropTypes.bool,
	isOwnBlog: PropTypes.bool,
	onReblog: PropTypes.func.isRequired,
	onSelectBlog: PropTypes.func.isRequired,
	onToggleLike: PropTypes.func.isRequired,
	post: PropTypes.shape({
		blog_name: PropTypes.string,
		body: PropTypes.string,
		caption: PropTypes.string,
		id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
		liked: PropTypes.bool,
		note_count: PropTypes.number,
		photos: PropTypes.array,
		reblog_key: PropTypes.string,
		type: PropTypes.string
	}).isRequired
};

export default Post;
