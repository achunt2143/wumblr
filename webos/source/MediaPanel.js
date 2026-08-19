/*
	A pushed panel showing one image or video pulled out of a post.

	On the TV this was a fullscreen Popup lightbox. As a panel it keeps the
	post it came from visible in the strip alongside it, and can be flung
	away to dismiss like any other pushed panel.
*/
enyo.kind({
	name: "MediaPanel",
	kind: enyo.VFlexBox,
	className: "wumblr-mediapanel",

	published: {
		//* {type: "image" | "video", src: string}
		media: null
	},

	components: [
		// No close button: the grab handle in the toolbar drags the panel away.
		{name: "title", kind: "Header", content: "Media"},

		/*
			Same busy overlay as LoginPanel's - see its comment for why the
			Scrim is a child here rather than the enyo.scrim singleton. GIFs
			especially can take a while over this device's connection, and
			without this the panel just sits on a bare black scroller until
			they do. Starts shown: media always has a src by the time this
			panel is pushed (openMedia guards on it), so there is always a
			load to wait out.

			Declared before the scroller/video, not after: on-device, Video's
			nested PalmService (its hook into the native media pipeline) has
			thrown during construction and aborted the rest of this array
			before reaching whatever came later, which was this - "busy"
			registers into $ before that can happen. setBusy() also guards
			directly, since that only fixes construction order, not a
			mediaReady() that fires from a stale listener after teardown.
		*/
		{name: "busy", className: "wumblr-busy", showing: true, components: [
			{name: "busyScrim", kind: "Scrim", showing: true},
			{className: "wumblr-busy-content", components: [
				{name: "busySpinner", kind: "SpinnerLarge", showing: true},
				{name: "busyLabel", className: "wumblr-busy-label", content: "Loading…"}
			]}
		]},

		{name: "scroller", kind: "Scroller", flex: 1, className: "wumblr-media", components: [
			// SizeableImage over plain Image: it already does the loading a
			// gif needs - a buffered Image() that swaps in on load rather
			// than the visible tag painting partial downloads - and its
			// onImageLoaded is what tells the busy scrim below to drop.
			// Pinch zoom comes along for free.
			{name: "image", kind: "SizeableImage", className: "wumblr-media-image", showing: false, onImageLoaded: "mediaReady"},
			{name: "video", kind: "Video", className: "wumblr-media-video", showing: false, autoplay: true}
		]},

		{kind: "Toolbar", components: [
			{kind: "GrabButton"}
		]}
	],

	create: function () {
		this.inherited(arguments);
		// SizeableImage doesn't expose a failure event the way it does
		// onImageLoaded - imageError just logs - so it's overridden here,
		// before mediaChanged() can set a src and possibly trigger it, to
		// drop the busy scrim on a broken URL instead of leaving it stuck.
		this.$.image.imageError = enyo.bind(this, "mediaReady");
		this.mediaChanged();
	},

	// rendered(), not create(): the video node has to actually exist to
	// listen on, same $-hash timing rule as everywhere else in this app.
	rendered: function () {
		this.inherited(arguments);
		var node = this.$.video.hasNode();
		if (node) {
			node.addEventListener("error", enyo.bind(this, function () {
				var err = node.error;
				// SRC_NOT_SUPPORTED and DECODE both showed up on-device for
				// the same underlying "this WebKit has no QuickTime decoder"
				// case - which one depends on how much it managed to fetch
				// before giving up, not on anything meaningfully different -
				// so both get the same message rather than just the scrim
				// dropping onto a bare black screen for one of the two.
				if (err && (err.code === 3 || err.code === 4)) {
					this.showUnsupported("This video format isn't supported on this device.");
				} else {
					this.mediaReady();
				}
			}), false);
			node.addEventListener("loadeddata", enyo.bind(this, "mediaReady"), false);
		}
	},

	mediaChanged: function () {
		var media = this.media || {};
		var isVideo = media.type === "video";
		var hasSrc = Boolean(media.src);

		this.$.title.setContent(isVideo ? "Video" : "Image");
		this.$.image.setShowing(hasSrc && !isVideo);
		this.$.video.setShowing(hasSrc && isVideo);
		this.setBusy(hasSrc);

		if (!hasSrc) return;

		if (isVideo) {
			// Tumblr's own markup can't be trusted for this: it labels these
			// .mov files type="video/mp4" regardless of the actual
			// container, so canPlayType(the declared type) says "maybe" right
			// before the decoder fails. The extension is the one honest
			// signal available, and this WebKit has no QuickTime decoder at
			// all (canPlayType("video/quicktime") is "", confirmed
			// on-device) - so this is checked upfront rather than waiting on
			// an attempt that's already known to fail.
			if (/\.mov(\?|#|$)/i.test(media.src)) {
				this.showUnsupported("This video format isn't supported on this device.");
				return;
			}
			this.$.video.setSrc(media.src);
		} else {
			this.$.image.setSrc(media.src);
		}
	},

	setBusy: function (busy) {
		// Guards against a mediaReady() that fires after the panel is torn
		// down (a stale video/image listener) as much as the construction
		// order this is declared in - see the components comment above.
		if (!this.$.busy) return;
		this.$.busy.setShowing(busy);
		this.$.busyScrim.setShowing(busy);
	},

	// onImageLoaded, the video's loadeddata/error, and the imageError
	// override above all land here - three signals for the same thing,
	// that there is now something (or definitely never going to be
	// something) on screen instead of the scrim.
	mediaReady: function () {
		this.setBusy(false);
		return true;
	},

	// Reuses the busy overlay rather than a separate one: same centred
	// treatment, just swapped from a spinner that will resolve to a message
	// that is the resolution - this one doesn't auto-hide.
	showUnsupported: function (message) {
		if (!this.$.busy) return;
		this.$.busySpinner.setShowing(false);
		this.$.busyLabel.setContent(message);
		this.$.busy.setShowing(true);
		this.$.busyScrim.setShowing(true);
	},

	// Called before the panel is destroyed: without this a video keeps
	// playing (and holding the audio device) after its panel is gone.
	stop: function () {
		if (this.$.video.hasNode()) {
			this.$.video.pause();
			this.$.video.setSrc("");
		}
	}
});
