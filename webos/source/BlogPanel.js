/*
	A pushed panel showing one blog's posts.

	Follow state is not exposed by /blog/{blog}/info, and /followed_by only
	answers the reverse question for blogs you own. It does ride along on the
	posts themselves though - every post carries `followed` for its blog - so
	the first page of the feed seeds the button rather than a separate
	request doing it.
*/
enyo.kind({
	name: "BlogPanel",
	kind: enyo.VFlexBox,
	className: "wumblr-blogpanel",

	published: {
		blogName: "",
		username: ""
	},

	events: {
		onSelectBlog: "",
		onOpenMedia: ""
	},

	components: [
		// No close button: the grab handle in the toolbar drags the panel
		// away, which is how a webOS panel is dismissed.
		{kind: "Header", components: [
			{name: "title", flex: 1, className: "wumblr-header-title"},
			{name: "follow", kind: "Button", caption: "Follow", onclick: "followClick"}
		]},

		{
			name: "feed", kind: "FeedList", flex: 1,
			onSelectBlog: "relaySelectBlog", onOpenMedia: "relayOpenMedia", onFirstPage: "firstPage"
		},

		{kind: "Toolbar", components: [
			{kind: "GrabButton"}
		]}
	],

	//* @protected
	following: false,
	busy: false,

	create: function () {
		this.inherited(arguments);
		this.blogNameChanged();
	},

	usernameChanged: function () {
		this.$.feed.setUsername(this.username);
	},

	blogNameChanged: function () {
		this.$.title.setContent(this.blogName);
		// A fresh blog: drop the previous one's follow state rather than
		// letting it show through until the first page lands.
		this.following = false;
		this.busy = false;
		this.updateFollow();
		this.$.feed.setUsername(this.username);
		this.$.feed.setSource({type: "blog", blogName: this.blogName});
	},

	firstPage: function (inSender, inEvent) {
		var posts = inEvent.posts || [];
		if (posts.length > 0) {
			this.following = Boolean(posts[0].followed);
			this.updateFollow();
		}
		return true;
	},

	updateFollow: function () {
		// Your own blog can't be followed, so the button has nothing to do.
		var isOwn = this.blogName && this.blogName === this.username;
		this.$.follow.setShowing(!isOwn);
		this.$.follow.setCaption(this.following ? "Following" : "Follow");
		this.$.follow.addRemoveClass("wumblr-following", this.following);
		this.$.follow.setDisabled(this.busy);
	},

	followClick: function () {
		if (this.busy || !this.blogName) return true;

		var tumblr = window.wumblr.tumblr;
		var appCache = window.wumblr.appCache;
		var next = !this.following;
		var name = this.blogName;

		this.following = next;
		this.busy = true;
		this.updateFollow();

		var done = enyo.bind(this, function (result) {
			this.busy = false;
			if (next) {
				// Fold the change into the cached list so it shows up
				// without waiting for a refresh; the response carries the
				// blog record.
				appCache.addFollowedBlog((result && result.blog) || {name: name});
			} else {
				appCache.removeFollowedBlog(name);
			}
			this.updateFollow();
		});

		var fail = enyo.bind(this, function (err) {
			enyo.warn("BlogPanel: follow toggle failed", err);
			this.busy = false;
			this.following = !next;
			this.updateFollow();
		});

		if (next) {
			tumblr.followBlog(name, done, fail);
		} else {
			tumblr.unfollowBlog(name, done, fail);
		}
		return true;
	},

	relaySelectBlog: function (inSender, inEvent) {
		this.doSelectBlog(inEvent);
		return true;
	},

	relayOpenMedia: function (inSender, inEvent) {
		this.doOpenMedia(inEvent);
		return true;
	}
});
