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

		{name: "scroller", kind: "Scroller", flex: 1, className: "wumblr-media", components: [
			{name: "image", kind: "Image", className: "wumblr-media-image", showing: false},
			{name: "video", nodeTag: "video", className: "wumblr-media-video", showing: false}
		]},

		{kind: "Toolbar", components: [
			{kind: "GrabButton"}
		]}
	],

	create: function () {
		this.inherited(arguments);
		this.mediaChanged();
	},

	mediaChanged: function () {
		var media = this.media || {};
		var isVideo = media.type === "video";
		var hasSrc = Boolean(media.src);

		this.$.title.setContent(isVideo ? "Video" : "Image");
		this.$.image.setShowing(hasSrc && !isVideo);
		this.$.video.setShowing(hasSrc && isVideo);

		if (!hasSrc) return;

		if (isVideo) {
			this.$.video.setAttribute("src", media.src);
			this.$.video.setAttribute("controls", "controls");
			this.$.video.setAttribute("autoplay", "autoplay");
		} else {
			this.$.image.setSrc(media.src);
		}
	},

	// Called before the panel is destroyed: without this a video keeps
	// playing (and holding the audio device) after its panel is gone.
	stop: function () {
		var node = this.$.video.hasNode();
		if (node && node.pause) {
			node.pause();
			node.removeAttribute("src");
		}
	}
});
