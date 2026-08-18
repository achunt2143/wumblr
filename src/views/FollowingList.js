import kind from '@enact/core/kind';
import BodyText from '@enact/sandstone/BodyText';
import {InputField} from '@enact/sandstone/Input';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import Changeable from '@enact/ui/Changeable';
import {Cell, Row} from '@enact/ui/Layout';
import PropTypes from 'prop-types';

import BlogItem from '../components/BlogItem';
import {$L, $LF} from '../utils/i18n';

import css from './FollowingList.module.less';

const filterBlogs = (blogs, value) => {
	const needle = value.trim().toLowerCase();
	if (!needle) return blogs;
	return blogs.filter((blog) => (
		blog.name.toLowerCase().includes(needle) ||
		(blog.title || '').toLowerCase().includes(needle)
	));
};

// The five states read as guards here rather than as nested ternaries in
// the parent's JSX.
const FollowingBody = kind({
	name: 'FollowingBody',

	propTypes: {
		blogs: PropTypes.array.isRequired,
		matches: PropTypes.array.isRequired,
		onSelectBlog: PropTypes.func.isRequired,
		error: PropTypes.instanceOf(Error),
		isLoading: PropTypes.bool,
		onFocusWithin: PropTypes.func,
		query: PropTypes.string
	},

	render: ({blogs, error, isLoading, matches, onFocusWithin, onSelectBlog, query}) => {
		if (blogs.length === 0) {
			if (isLoading) {
				return <div className={css.status}><Spinner>{$L('Loading blogs you follow…')}</Spinner></div>;
			}
			if (error) {
				return (
					<div className={css.status}>
						<BodyText>{$L('Couldn’t load your following list. Please try again.')}</BodyText>
					</div>
				);
			}
			return (
				<div className={css.status}>
					<BodyText>{$L('You aren’t following any blogs yet.')}</BodyText>
				</div>
			);
		}

		if (matches.length === 0) {
			return (
				<div className={css.status}>
					<BodyText>{$LF('No blogs match “{query}”.', {query: query.trim()})}</BodyText>
				</div>
			);
		}

		return (
			<div className={css.list}>
				{matches.map((blog) => (
					<BlogItem
						key={blog.uuid || blog.name}
						blog={blog}
						onFocusWithin={onFocusWithin}
						onSelectBlog={onSelectBlog}
					/>
				))}
			</div>
		);
	}
});

// The only state here is the search text, which Changeable supplies as
// `value`/`onChange` - leaving the view itself a stateless kind.
const FollowingListBase = kind({
	name: 'FollowingList',

	propTypes: {
		blogs: PropTypes.array.isRequired,
		onSelectBlog: PropTypes.func.isRequired,
		error: PropTypes.instanceOf(Error),
		isLoading: PropTypes.bool,
		onChange: PropTypes.func,
		onFocusWithin: PropTypes.func,
		value: PropTypes.string
	},

	defaultProps: {
		value: ''
	},

	computed: {
		matches: ({blogs, value}) => filterBlogs(blogs, value),
		countLabel: ({blogs, isLoading, value}) => {
			const shown = filterBlogs(blogs, value).length;
			const base = value.trim() ?
				$LF('{shown} of {total}', {shown, total: blogs.length}) :
				$LF('{count} blogs', {count: blogs.length});
			// One sentence rather than an appended fragment, so the dash and
			// word order stay the translator's call.
			return isLoading ? $LF('{count} — loading…', {count: base}) : base;
		}
	},

	render: ({blogs, countLabel, error, isLoading, matches, onChange, onFocusWithin, onSelectBlog, value}) => (
		<>
			{/* Cells, not bare children: a Layout Row stretches anything that
			    isn't a Cell, which leaves the count drawn over the input. */}
			<Row className={css.searchRow}>
				<Cell shrink>
					<InputField
						className={css.search}
						dismissOnEnter
						placeholder={$L('Search blogs')}
						size="small"
						type="text"
						value={value}
						onChange={onChange}
					/>
				</Cell>
				<Cell shrink>
					<BodyText className={css.count} size="small">{countLabel}</BodyText>
				</Cell>
			</Row>
			<Scroller className={css.scroller}>
				<FollowingBody
					blogs={blogs}
					error={error}
					isLoading={isLoading}
					matches={matches}
					query={value}
					onFocusWithin={onFocusWithin}
					onSelectBlog={onSelectBlog}
				/>
			</Scroller>
		</>
	)
});

const FollowingList = Changeable({change: 'onChange', prop: 'value'}, FollowingListBase);

export default FollowingList;
export {FollowingListBase};
