import {is} from '@enact/core/keymap';
import BodyText from '@enact/sandstone/BodyText';
import Button from '@enact/sandstone/Button';
import Image from '@enact/sandstone/Image';
import Spottable from '@enact/spotlight/Spottable';
import {Row} from '@enact/ui/Layout';
import PropTypes from 'prop-types';
import {useCallback, useEffect, useRef, useState} from 'react';

import {hasReblogged, rememberReblog} from '../services/appCache';
import {$L, $LF} from '../utils/i18n';
import {postId} from '../utils/post';

import css from './Post.module.less';
import * as logger from '../utils/logger';

const SpottableDiv = Spottable('div');
const isEnter = is('enter');

// Tumblr writes blog links three ways: as a subdomain
// (blog.tumblr.com/post/1), as a bare path (tumblr.com/blog/1), and as
// tumblr.com/blog/view/<name>/<post> - the last of which would otherwise
// read as a blog literally named "blog". Returns null for anything else so
// genuinely external links aren't mistaken for blogs.
const blogNameFromHref = (href) => {
	if (!href) return null;
	const subdomain = href.match(/^https?:\/\/([\w-]+)\.tumblr\.com/i);
	if (subdomain && subdomain[1].toLowerCase() !== 'www') return subdomain[1];
	const mainDomain = href.match(/^https?:\/\/(?:www\.)?tumblr\.com\/(?:blog\/view\/)?([\w-]+)/i);
	return mainDomain ? mainDomain[1] : null;
};

// Sandstone's `css` prop merges these into the Button's own icon element,
// which is the supported way to reach a component's internal parts.
const iconClasses = (stateClass, isCelebrating) => (
	[css.actionIcon, stateClass, isCelebrating && css.celebrate].filter(Boolean).join(' ')
);

const mediaFromElement = (el) => {
	if (el.tagName === 'VIDEO') {
		const source = el.querySelector('source');
		return {type: 'video', src: el.currentSrc || el.src || (source && source.src)};
	}
	return {type: 'image', src: el.currentSrc || el.src};
};

const Post = ({even, isOwnBlog, onFocusWithin, onOpenMedia, onReblog, onSelectBlog, onToggleLike, post}) => {
	// `liked` comes from the API; `reblogged` can't, so it comes from what
	// this app remembers reblogging.
	const [liked, setLiked] = useState(Boolean(post.liked));
	const [reblogged, setReblogged] = useState(() => hasReblogged(postId(post)));
	const [isReblogging, setIsReblogging] = useState(false);
	// Which action just succeeded, so its icon can play the flourish.
	const [celebrating, setCelebrating] = useState(null);
	const bodyRef = useRef(null);
	const celebrateTimer = useRef(null);

	const celebrate = useCallback((which) => {
		setCelebrating(which);
		clearTimeout(celebrateTimer.current);
		celebrateTimer.current = setTimeout(() => setCelebrating(null), 620);
	}, []);

	useEffect(() => () => clearTimeout(celebrateTimer.current), []);

	const photo = post.type === 'photo' && post.photos ? post.photos[0] : null;

	const handleSelectBlog = useCallback(() => onSelectBlog(post.blog_name), [onSelectBlog, post.blog_name]);

	const handleOpenPhoto = useCallback(
		() => onOpenMedia({type: 'image', src: photo.original_size.url}),
		[onOpenMedia, photo]
	);

	// The body is raw Tumblr HTML, so its images, videos and blog links can't
	// be Spottable components. Tagging them is what makes them reachable with
	// the 5-way pad; the delegated handlers below do the rest.
	useEffect(() => {
		const root = bodyRef.current;
		if (!root) return;
		root.querySelectorAll('img, video, a[href]').forEach((el) => {
			if (el.tagName === 'A' && !blogNameFromHref(el.getAttribute('href'))) return;
			el.classList.add('spottable');
			el.setAttribute('tabindex', '-1');
		});
	}, [post.body, post.caption]);

	const activate = useCallback((target) => {
		const link = target.closest('a[href]');
		if (link) {
			const blogName = blogNameFromHref(link.getAttribute('href'));
			if (blogName) onSelectBlog(blogName);
			// Handled either way: letting an anchor navigate would take the
			// whole app off to tumblr.com with no way back.
			return true;
		}
		const media = target.closest('img, video');
		if (media) {
			onOpenMedia(mediaFromElement(media));
			return true;
		}
		return false;
	}, [onOpenMedia, onSelectBlog]);

	const handleBodyClick = useCallback((ev) => {
		if (activate(ev.target)) ev.preventDefault();
	}, [activate]);

	// Spotlight doesn't synthesise a click from the select key on plain
	// elements, so the 5-way path is wired up by hand.
	const handleBodyKeyUp = useCallback((ev) => {
		if (isEnter(ev.keyCode) && activate(ev.target)) ev.preventDefault();
	}, [activate]);

	const handleToggleLike = useCallback(async () => {
		const nextLiked = !liked;
		setLiked(nextLiked);
		try {
			await onToggleLike(post, nextLiked);
			// Only on the way in, and only once the server agrees - undoing a
			// like shouldn't throw confetti.
			if (nextLiked) celebrate('like');
		} catch (err) {
			logger.warn('Post: like failed', err);
			setLiked(!nextLiked);
		}
	}, [celebrate, liked, onToggleLike, post]);

	const handleReblog = useCallback(async () => {
		if (reblogged || isReblogging) return;
		setIsReblogging(true);
		try {
			await onReblog(post);
			setReblogged(true);
			rememberReblog(postId(post));
			celebrate('reblog');
		} catch (err) {
			logger.warn('Post: reblog failed', err);
		} finally {
			setIsReblogging(false);
		}
	}, [celebrate, isReblogging, onReblog, post, reblogged]);

	const bodyHtml = post.type === 'text' ? post.body : (photo && post.caption);

	return (
		<div className={even ? css.postEVEN : css.postODD} onFocus={onFocusWithin}>
			<div className={css.blogNameRow}>
				<Button
					backgroundOpacity="transparent"
					className={css.blogName}
					minWidth={false}
					size="small"
					onClick={handleSelectBlog}
				>
					{post.blog_name}
				</Button>
			</div>
			{photo ? (
				<SpottableDiv className={css.photoFrame} onClick={handleOpenPhoto}>
					<Image className={css.postImage} sizing="fit" src={photo.original_size.url} />
				</SpottableDiv>
			) : null}
			{bodyHtml ? (
				<BodyText className={css.postBody}>
					{/* eslint-disable react/no-danger -- post bodies are HTML by
					    design; rendering them is the whole point of a Tumblr
					    client, and the markup comes from Tumblr's own API. */}
					<span
						ref={bodyRef}
						dangerouslySetInnerHTML={{__html: bodyHtml}}
						onClick={handleBodyClick}
						onKeyUp={handleBodyKeyUp}
					/>
					{/* eslint-enable react/no-danger */}
				</BodyText>
			) : null}
			<Row className={css.postActions}>
				<Button
					css={{icon: iconClasses(liked && css.liked, celebrating === 'like')}}
					icon="heart"
					selected={liked}
					size="small"
					onClick={handleToggleLike}
				>
					{liked ? $L('Liked') : $L('Like')}
				</Button>
				{!isOwnBlog ? (
					<Button
						css={{icon: iconClasses(reblogged && css.reblogged, celebrating === 'reblog')}}
						disabled={isReblogging}
						icon="arrowhookright"
						selected={reblogged}
						size="small"
						onClick={handleReblog}
					>
						{reblogged ? $L('Reblogged') : $L('Reblog')}
					</Button>
				) : null}
				<BodyText className={css.notes} size="small">
					{$LF('Notes: {count}', {count: post.note_count})}
				</BodyText>
			</Row>
		</div>
	);
};

Post.propTypes = {
	onOpenMedia: PropTypes.func.isRequired,
	onReblog: PropTypes.func.isRequired,
	onSelectBlog: PropTypes.func.isRequired,
	onToggleLike: PropTypes.func.isRequired,
	/* eslint-disable camelcase -- mirrors Tumblr's post shape verbatim. */
	post: PropTypes.shape({
		blog: PropTypes.shape({uuid: PropTypes.string}),
		blog_name: PropTypes.string,
		body: PropTypes.string,
		caption: PropTypes.string,
		id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
		id_string: PropTypes.string,
		liked: PropTypes.bool,
		note_count: PropTypes.number,
		photos: PropTypes.array,
		reblog_key: PropTypes.string,
		type: PropTypes.string
	}).isRequired,
	/* eslint-enable camelcase */
	even: PropTypes.bool,
	isOwnBlog: PropTypes.bool,
	onFocusWithin: PropTypes.func
};

export default Post;
