/*
	A single post in a feed: blog name, optional photo, body HTML, and the
	like/reblog actions.

	Post bodies are raw Tumblr HTML, which is the whole point of a Tumblr
	client, so they are rendered with allowHtml. Their anchors are defused
	first (see neutraliseLinks) and taps inside the body are handled here by
	walking up from the event target, since the markup can't be made of Enyo
	controls.

	Animated media never plays in the feed. GIFs and videos are swapped for
	tappable stubs (see deferAnimatedMedia) and only fetched once opened in
	the media panel - a screenful of them decoding at once is more than the
	TouchPad can do smoothly.
*/

(function () {

// Tumblr writes blog links three ways: as a subdomain
// (blog.tumblr.com/post/1), as a bare path (tumblr.com/blog/1), and as
// tumblr.com/blog/view/<name>/<post> - the last of which would otherwise
// read as a blog literally named "blog". Returns null for anything else so
// genuinely external links aren't mistaken for blogs.
function blogNameFromHref (href) {
	if (!href) return null;
	var subdomain = href.match(/^https?:\/\/([\w-]+)\.tumblr\.com/i);
	if (subdomain && subdomain[1].toLowerCase() !== "www") return subdomain[1];
	var mainDomain = href.match(/^https?:\/\/(?:www\.)?tumblr\.com\/(?:blog\/view\/)?([\w-]+)/i);
	return mainDomain ? mainDomain[1] : null;
}

// Animated media is deferred rather than shown inline: a feed full of
// decoding GIFs and preloading <video> elements is more than the TouchPad
// can do smoothly. Anything matched here is replaced by a tappable stub and
// only fetched when it is opened in the media panel.
function isAnimated (url) {
	return /\.gif(\?|#|$)/i.test(String(url || ""));
}

// Reads one attribute out of a raw tag string, quoted or not.
function attr (tag, name) {
	var m = tag.match(new RegExp(name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
	if (!m) return null;
	if (m[2] !== undefined) return m[2];
	if (m[3] !== undefined) return m[3];
	return m[4];
}

function stub (type, src, label) {
	// Without a usable source the stub is inert rather than a tap that opens
	// an empty panel.
	//
	// & has to go first: a signed/tokenized URL (more likely on video than
	// a plain image path) can have several &-separated query params, and
	// each one left unescaped in an HTML attribute is a malformed entity
	// reference waiting to happen once this string is parsed as markup.
	var escapedSrc = String(src).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
	var attrs = src ?
		' data-wumblr-type="' + type + '" data-wumblr-src="' + escapedSrc + '"' :
		'';
	return '<div class="wumblr-media-stub"' + attrs + '>' + label + '</div>';
}

enyo.kind({
	name: "PostItem",
	kind: enyo.VFlexBox,
	className: "wumblr-post",

	published: {
		post: null,
		isOwnBlog: false,
		username: ""
	},

	events: {
		onSelectBlog: "",
		onOpenMedia: ""
	},

	components: [
		{kind: enyo.HFlexBox, className: "wumblr-post-head", align: "center", components: [
			{name: "blogName", kind: "CustomButton", className: "wumblr-blogname", onclick: "blogNameClick"}
		]},
		{name: "photo", kind: "Image", className: "wumblr-post-photo", showing: false, onclick: "photoClick"},
		{name: "photoStub", className: "wumblr-media-stub", showing: false, onclick: "photoClick"},
		{name: "body", className: "wumblr-post-body", allowHtml: true, showing: false, onclick: "bodyClick"},
		{kind: enyo.HFlexBox, className: "wumblr-post-actions", align: "center", components: [
			{name: "likeButton", kind: "Button", caption: "Like", onclick: "likeClick"},
			{name: "reblogButton", kind: "Button", caption: "Reblog", onclick: "reblogClick"},
			{kind: "Spacer"},
			{name: "notes", className: "wumblr-notes"}
		]}
	],

	//* @protected
	liked: false,
	reblogged: false,
	reblogging: false,
	photoSrc: null,

	create: function () {
		this.inherited(arguments);
		this.postChanged();
	},

	// Anchors are rewritten rather than preventDefault()ed on click: letting
	// one fire would take the whole app off to tumblr.com with no way back,
	// and an href that never exists cannot navigate at all.
	neutraliseLinks: function (html) {
		return String(html).replace(/\shref\s*=/gi, " data-href=");
	},

	/*
		Swaps animated media out of the markup for stubs.

		This has to happen on the string, before it reaches the DOM: an <img>
		starts fetching and animating the instant it is parsed, so stripping
		the attribute afterwards would be too late to save the work. Static
		images are left alone - they cost one decode and then sit there.
	*/
	deferAnimatedMedia: function (html) {
		return String(html)
			.replace(/<img\b[^>]*>/gi, function (tag) {
				var src = attr(tag, "src");
				return isAnimated(src) ? stub("image", src, "GIF — tap to play") : tag;
			})
			.replace(/<video\b[^>]*>[\s\S]*?<\/video>|<video\b[^>]*>/gi, function (tag) {
				// The source may be on the tag itself or on a nested <source>.
				// Confirmed on-device: Tumblr only ever embeds one <source>
				// here in practice (never an mp4 alongside the mov, which
				// would have been the fix for MediaPanel's unplayable-video
				// case - it isn't there to prefer). Still worth matching all
				// of them and preferring an mp4-typed one rather than just
				// the first, on the chance some post shape does offer more
				// than one - standard <source> fallback order, cheap to keep
				// correct even though it's not doing anything today.
				var src = attr(tag, "src");
				if (!src) {
					var sources = tag.match(/<source\b[^>]*>/gi) || [];
					var mp4Source = null;
					for (var i = 0; i < sources.length; i++) {
						var type = attr(sources[i], "type") || "";
						if (type.indexOf("mp4") >= 0) {
							mp4Source = sources[i];
							break;
						}
					}
					var chosen = mp4Source || sources[0];
					if (chosen) src = attr(chosen, "src");
				}
				return stub("video", src, "Video — tap to play");
			});
	},

	prepareBody: function (html) {
		return this.deferAnimatedMedia(this.neutraliseLinks(html));
	},

	postChanged: function () {
		var post = this.post;
		if (!post) return;

		var tumblr = window.wumblr.tumblr;
		this.liked = Boolean(post.liked);
		this.reblogged = window.wumblr.appCache.hasReblogged(tumblr.postId(post));

		this.$.blogName.setCaption(post.blog_name || "");

		var photo = (post.type === "photo" && post.photos) ? post.photos[0] : null;
		this.photoSrc = photo && photo.original_size ? photo.original_size.url : null;

		// A GIF cover gets the stub instead of the Image, so the feed never
		// holds a decoding animation. Tapping either opens the media panel.
		var deferred = isAnimated(this.photoSrc);
		this.$.photo.setShowing(Boolean(this.photoSrc) && !deferred);
		this.$.photoStub.setShowing(Boolean(this.photoSrc) && deferred);
		if (this.photoSrc && !deferred) {
			this.$.photo.setSrc(this.photoSrc);
		}
		if (deferred) {
			this.$.photoStub.setContent("GIF — tap to play");
		}

		var html = post.type === "text" ? post.body : (photo ? post.caption : null);
		this.$.body.setShowing(Boolean(html));
		if (html) {
			this.$.body.setContent(this.prepareBody(html));
		}

		this.$.notes.setContent("Notes: " + (post.note_count || 0));
		this.$.reblogButton.setShowing(!this.isOwnBlog);
		this.updateActions();
	},

	updateActions: function () {
		this.$.likeButton.setCaption(this.liked ? "Liked" : "Like");
		this.$.likeButton.addRemoveClass("wumblr-liked", this.liked);
		this.$.reblogButton.setCaption(this.reblogged ? "Reblogged" : "Reblog");
		this.$.reblogButton.addRemoveClass("wumblr-reblogged", this.reblogged);
		this.$.reblogButton.setDisabled(this.reblogging || this.reblogged);
	},

	blogNameClick: function () {
		this.doSelectBlog({blogName: this.post.blog_name});
		return true;
	},

	photoClick: function () {
		this.doOpenMedia({type: "image", src: this.photoSrc});
		return true;
	},

	// Walks up from the tapped node to the body root looking for one of the
	// given tags; WebKit 534 has no Element.closest.
	findTag: function (node, tags) {
		var root = this.$.body.hasNode();
		while (node && node !== root) {
			if (node.tagName && enyo.indexOf(node.tagName.toUpperCase(), tags) >= 0) {
				return node;
			}
			node = node.parentNode;
		}
		return null;
	},

	// Same walk as findTag, but matching the stubs deferAnimatedMedia left
	// behind, which are plain divs rather than a tag we can name.
	findStub: function (node) {
		var root = this.$.body.hasNode();
		while (node && node !== root) {
			if (node.className && String(node.className).indexOf("wumblr-media-stub") >= 0) {
				return node;
			}
			node = node.parentNode;
		}
		return null;
	},

	bodyClick: function (inSender, inEvent) {
		// Deferred media first: a stub carries its own source, and the real
		// element it replaced is no longer in the markup to be found.
		var deferred = this.findStub(inEvent.target);
		if (deferred) {
			var deferredSrc = deferred.getAttribute("data-wumblr-src");
			if (deferredSrc) {
				this.doOpenMedia({
					type: deferred.getAttribute("data-wumblr-type") || "image",
					src: deferredSrc
				});
			}
			return true;
		}

		var link = this.findTag(inEvent.target, ["A"]);
		if (link) {
			var blogName = blogNameFromHref(link.getAttribute("data-href"));
			if (blogName) this.doSelectBlog({blogName: blogName});
			// Handled either way - an external link has nowhere to go here.
			return true;
		}

		var media = this.findTag(inEvent.target, ["IMG", "VIDEO"]);
		if (media) {
			if (media.tagName.toUpperCase() === "VIDEO") {
				var source = media.getElementsByTagName("source")[0];
				this.doOpenMedia({type: "video", src: media.getAttribute("src") || (source && source.getAttribute("src"))});
			} else {
				this.doOpenMedia({type: "image", src: media.getAttribute("src")});
			}
			return true;
		}
	},

	likeClick: function () {
		var post = this.post;
		var tumblr = window.wumblr.tumblr;
		var next = !this.liked;

		// Optimistic: the button reacts immediately and rolls back if the
		// server disagrees.
		this.liked = next;
		this.updateActions();

		var rollback = enyo.bind(this, function (err) {
			enyo.warn("PostItem: like failed", err);
			this.liked = !next;
			this.updateActions();
		});

		var id = tumblr.postId(post);
		if (next) {
			tumblr.likePost(id, post.reblog_key, enyo.bind(this, "likeDone"), rollback);
		} else {
			tumblr.unlikePost(id, post.reblog_key, enyo.bind(this, "likeDone"), rollback);
		}
		return true;
	},

	likeDone: function () {
		// State was already applied optimistically; nothing more to do.
	},

	reblogClick: function () {
		if (this.reblogged || this.reblogging) return true;

		var post = this.post;
		var tumblr = window.wumblr.tumblr;

		this.reblogging = true;
		this.updateActions();

		tumblr.reblogPost(this.username, {
			parentPostId: tumblr.postId(post),
			parentTumblelogUuid: post.blog && post.blog.uuid,
			reblogKey: post.reblog_key
		}, enyo.bind(this, function () {
			this.reblogging = false;
			this.reblogged = true;
			window.wumblr.appCache.rememberReblog(tumblr.postId(post));
			this.updateActions();
		}), enyo.bind(this, function (err) {
			enyo.warn("PostItem: reblog failed", err);
			this.reblogging = false;
			this.updateActions();
		}));
		return true;
	}
});

})();
