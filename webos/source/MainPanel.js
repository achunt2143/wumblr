/*
	The second panel: whatever destination the nav list currently points at.

	Only one of the two bodies is shown at a time. The feed is reused across
	the post-backed destinations (dashboard / my blog / likes) rather than
	mounted per destination, so switching between them doesn't rebuild the
	list machinery - it just changes the source.
*/
enyo.kind({
	name: "MainPanel",
	kind: enyo.VFlexBox,
	className: "wumblr-main",

	published: {
		username: ""
	},

	events: {
		onSelectBlog: "",
		onOpenMedia: "",
		//* Fires when the following list finishes a sync, so Settings can
		//* stop showing its refresh as in progress.
		onFollowingSynced: ""
	},

	components: [
		{name: "header", kind: "Header", content: "Dashboard"},

		{name: "feed", kind: "FeedList", flex: 1, onSelectBlog: "relaySelectBlog", onOpenMedia: "relayOpenMedia"},
		{
			name: "blogs", kind: "BlogList", flex: 1, showing: false,
			onSelectBlog: "relaySelectBlog", onSyncDone: "followingSynced"
		},

		{kind: "Toolbar", components: [
			{kind: "GrabButton"}
		]}
	],

	//* @protected
	destination: "dashboard",

	create: function () {
		this.inherited(arguments);
		this.showDestination("dashboard");
	},

	usernameChanged: function () {
		this.$.feed.setUsername(this.username);
		this.$.blogs.setAccountName(this.username);
		// Signing in is what makes the feed loadable at all - until then the
		// client has no token and FeedList declines to fetch - so this is
		// also the point at which the current destination gets its data.
		// "My Blog" additionally needs the name to resolve its source.
		if (this.username) {
			this.showDestination(this.destination);
		}
	},

	title: function (destination) {
		switch (destination) {
			case "ownBlog": return "My Blog";
			case "likes": return "Your Likes";
			case "following": return "Following";
			default: return "Dashboard";
		}
	},

	showDestination: function (destination) {
		this.destination = destination;
		this.$.header.setContent(this.title(destination));

		var isFollowing = destination === "following";

		this.$.feed.setShowing(!isFollowing);
		this.$.blogs.setShowing(isFollowing);

		if (isFollowing) {
			this.$.blogs.activate();
		} else {
			this.$.feed.setSource(this.sourceFor(destination));
		}
	},

	sourceFor: function (destination) {
		if (destination === "ownBlog") return {type: "blog", blogName: this.username};
		if (destination === "likes") return {type: "likes"};
		return {type: "dashboard"};
	},

	//* Called by the app when Settings asks for a rebuild.
	rebuildFollowing: function () {
		this.$.blogs.rebuild();
	},

	followingSynced: function () {
		this.doFollowingSynced();
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
