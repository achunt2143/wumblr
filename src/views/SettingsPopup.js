import Alert from '@enact/sandstone/Alert';
import BodyText from '@enact/sandstone/BodyText';
import Button from '@enact/sandstone/Button';
import Heading from '@enact/sandstone/Heading';
import Icon from '@enact/sandstone/Icon';
import Image from '@enact/sandstone/Image';
import Item from '@enact/sandstone/Item';
import Popup from '@enact/sandstone/Popup';
import Scroller from '@enact/sandstone/Scroller';
import {Cell, Column, Row} from '@enact/ui/Layout';
import PropTypes from 'prop-types';
import {useCallback, useState} from 'react';

import {blogAvatarUrl} from '../services/tumblrClient';
import {$L, $LF} from '../utils/i18n';

import css from './SettingsPopup.module.less';

// Counts read better grouped with a separator than as raw digits, and
// toLocaleString follows the viewer's locale.
const Stat = ({label, value}) => (
	<Cell className={css.stat}>
		<BodyText className={css.statValue}>
			{typeof value === 'number' ? value.toLocaleString() : '—'}
		</BodyText>
		<BodyText className={css.statLabel} size="small">{label}</BodyText>
	</Cell>
);

Stat.propTypes = {
	label: PropTypes.string.isRequired,
	value: PropTypes.number
};

const SettingsPopup = ({isRefreshingBlogs, open, profile, onClose, onRefreshBlogs, onSignOut}) => {
	// Signing back in means fetching a fresh code from another device, so a
	// mis-click on the remote is expensive - hence the confirmation step.
	const [confirming, setConfirming] = useState(false);

	const username = (profile && profile.name) || '';

	const handleAskSignOut = useCallback(() => setConfirming(true), []);
	const handleCancelSignOut = useCallback(() => setConfirming(false), []);

	const handleConfirmSignOut = useCallback(() => {
		setConfirming(false);
		onSignOut();
	}, [onSignOut]);

	return (
		<>
			{/* The confirmation replaces this popup rather than stacking on top
			    of it: nested popups fight over Spotlight focus on TV. */}
			<Popup
				className={css.popup}
				open={open && !confirming}
				position="right"
				scrimType="translucent"
				spotlightRestrict="self-only"
				onClose={onClose}
			>
				<Column className={css.content}>
					<Cell className={css.header} component={Row} shrink>
						<Cell component={Heading} className={css.title} shrink size="small">
							{$L('Settings')}
						</Cell>
						<Cell shrink>
							<Button
								aria-label={$L('Close')}
								backgroundOpacity="transparent"
								className={css.closeButton}
								icon="closex"
								size="small"
								onClick={onClose}
							/>
						</Cell>
					</Cell>

					{/* Header stays put so the dismiss control is always
					    reachable; everything below it scrolls. */}
					<Cell>
						<Scroller className={css.scroller}>
							<Row className={css.account}>
								<Cell shrink>
									<Image
										className={css.avatar}
										sizing="fill"
										src={blogAvatarUrl(username || 'tumblr')}
									/>
								</Cell>
								<Cell>
									<BodyText className={css.accountName}>{username || $L('unknown')}</BodyText>
									<BodyText className={css.accountMeta} size="small">{$L('Signed in')}</BodyText>
								</Cell>
							</Row>

							<div className={css.stats}>
								<Row>
									<Stat label={$L('Followers')} value={profile && profile.followers} />
									<Stat label={$L('Posts')} value={profile && profile.posts} />
								</Row>
								<Row className={css.statsRow}>
									<Stat label={$L('Following')} value={profile && profile.following} />
									<Stat label={$L('Likes')} value={profile && profile.likes} />
								</Row>
							</div>

							<BodyText className={css.sectionLabel} size="small">{$L('Manage')}</BodyText>

							<div className={css.actions}>
								<Item
									className={css.action}
									disabled={isRefreshingBlogs}
									label={$L('Check for newly followed blogs')}
									slotBefore={<Icon className={css.actionIcon}>refresh</Icon>}
									onClick={onRefreshBlogs}
								>
									{isRefreshingBlogs ? $L('Refreshing…') : $L('Refresh blogs')}
								</Item>
								<Item
									className={css.action}
									label={$L('A new code is needed to sign in')}
									slotBefore={<Icon className={css.signOutIcon}>lock</Icon>}
									onClick={handleAskSignOut}
								>
									{$L('Sign out')}
								</Item>
							</div>
						</Scroller>
					</Cell>
				</Column>
			</Popup>

			{/* An overlay Alert renders only its children - `title` is a
			    fullscreen-type feature - so the question lives in the body. */}
			<Alert
				open={confirming}
				type="overlay"
				onClose={handleCancelSignOut}
				buttons={[
					<Button key="signout" size="small" onClick={handleConfirmSignOut}>{$L('Sign out')}</Button>,
					<Button key="cancel" size="small" onClick={handleCancelSignOut}>{$L('Cancel')}</Button>
				]}
			>
				{$LF('Sign out of wumblr as {user}? You’ll need a new code to sign back in.', {
					user: username || $L('unknown')
				})}
			</Alert>
		</>
	);
};

SettingsPopup.propTypes = {
	onClose: PropTypes.func.isRequired,
	onRefreshBlogs: PropTypes.func.isRequired,
	onSignOut: PropTypes.func.isRequired,
	isRefreshingBlogs: PropTypes.bool,
	open: PropTypes.bool,
	profile: PropTypes.shape({
		followers: PropTypes.number,
		following: PropTypes.number,
		likes: PropTypes.number,
		name: PropTypes.string,
		posts: PropTypes.number
	})
};

export default SettingsPopup;
