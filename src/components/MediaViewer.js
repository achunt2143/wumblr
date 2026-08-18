import kind from '@enact/core/kind';
import $L from '@enact/i18n/$L';
import Button from '@enact/sandstone/Button';
import Image from '@enact/sandstone/Image';
import Popup from '@enact/sandstone/Popup';
import PropTypes from 'prop-types';

import css from './MediaViewer.module.less';

// Fullscreen lightbox for a single image or video pulled out of a post.
// `media` is null when nothing is open, which also drives the Popup.
const MediaViewer = kind({
	name: 'MediaViewer',

	propTypes: {
		onClose: PropTypes.func.isRequired,
		media: PropTypes.shape({
			src: PropTypes.string,
			type: PropTypes.oneOf(['image', 'video'])
		})
	},

	styles: {
		css,
		className: 'viewer'
	},

	computed: {
		isVideo: ({media}) => Boolean(media) && media.type === 'video'
	},

	render: ({className, isVideo, media, onClose}) => (
		<Popup
			noAnimation
			open={Boolean(media)}
			position="fullscreen"
			scrimType="translucent"
			spotlightRestrict="self-only"
			onClose={onClose}
		>
			{media ? (
				<div className={className}>
					{isVideo ? (
						// eslint-disable-next-line jsx-a11y/media-has-caption
						<video autoPlay className={css.media} controls loop src={media.src} />
					) : (
						<Image className={`${css.media} ${css.image}`} sizing="fit" src={media.src} />
					)}
					<Button className={css.close} icon="closex" size="small" onClick={onClose}>
						{$L('Close')}
					</Button>
				</div>
			) : null}
		</Popup>
	)
});

export default MediaViewer;
