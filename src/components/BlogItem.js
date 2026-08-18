import kind from '@enact/core/kind';
import Image from '@enact/sandstone/Image';
import Item from '@enact/sandstone/Item';
import PropTypes from 'prop-types';

import {blogAvatarUrl} from '../services/tumblrClient';

import css from './BlogItem.module.less';

// A single row in the Following list; selecting it opens that blog's posts.
const BlogItem = kind({
	name: 'BlogItem',

	propTypes: {
		blog: PropTypes.shape({
			name: PropTypes.string,
			title: PropTypes.string,
			url: PropTypes.string
		}).isRequired,
		onSelectBlog: PropTypes.func.isRequired,
		onFocusWithin: PropTypes.func
	},

	styles: {
		css,
		className: 'blogItem'
	},

	handlers: {
		onClick: (ev, {blog, onSelectBlog}) => {
			onSelectBlog(blog.name);
		}
	},

	computed: {
		avatar: ({blog}) => <Image className={css.avatar} sizing="fill" src={blogAvatarUrl(blog.name)} />,
		label: ({blog}) => blog.title || blog.url
	},

	render: ({avatar, blog, className, label, onClick, onFocusWithin}) => (
		<Item
			className={className}
			label={label}
			slotBefore={avatar}
			onClick={onClick}
			onFocus={onFocusWithin}
		>
			{blog.name}
		</Item>
	)
});

export default BlogItem;
