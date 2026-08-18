/*
	The list of blogs the account follows, with a search filter.

	The list is never fetched on its own. Opening this panel shows what db8
	holds and costs nothing; fetching happens only when Rebuild is pressed in
	Settings, which re-reads every page and replaces the cached list.

	Paging follows the server's own `_links.next` cursor; see
	TumblrClient.getFollowing for why the obvious approaches don't work.
*/
enyo.kind({
	name: "BlogList",
	kind: enyo.VFlexBox,

	published: {
		//* The signed-in account, so a change of account drops the cache.
		accountName: ""
	},

	events: {
		onSelectBlog: "",
		//* Fires when a sync settles, either way, so a caller showing
		//* progress for it has something to stop on.
		onSyncDone: ""
	},

	components: [
		{kind: enyo.HFlexBox, className: "wumblr-search-row", align: "center", components: [
			{name: "search", kind: "Input", flex: 1, hint: "Search blogs", oninput: "searchChanged", onchange: "searchChanged"},
			{name: "count", className: "wumblr-search-count"}
		]},
		{name: "scroller", kind: "Scroller", flex: 1, components: [
			{name: "status", className: "wumblr-status", showing: false},
			{name: "rows"}
		]}
	],

	//* @protected
	maxPages: 200, // guard against a cursor that never terminates
	blogs: [],
	loading: false,
	error: null,
	runId: 0,

	create: function () {
		this.inherited(arguments);
		this.blogs = window.wumblr.appCache.getFollowing();
	},

	// A new account (or a sign-out) invalidates whatever is held here.
	accountNameChanged: function () {
		this.blogs = window.wumblr.appCache.getFollowing();
		this.update();
	},

	/*
		Called when the Following destination becomes visible.

		Deliberately does not sync. Opening this list shows what db8 already
		holds and costs no requests at all; fetching is an explicit act, done
		from Refresh blogs in Settings. On hardware this old, a request that
		happens on its own every launch is a request worth not making.
	*/
	activate: function () {
		// Re-read rather than trust what create() saw: the store hydrates
		// asynchronously and may well have filled in since.
		this.blogs = window.wumblr.appCache.getFollowing();
		this.update();
	},

	/*
		The only entry point that talks to Tumblr, and the only way the list
		is ever populated.

		It reads every page. An earlier version also had a cheap delta sync
		that stopped at the first blog it recognised, but two sync buttons
		doing almost the same thing is worse than one that is simply correct -
		and a delta can never notice a blog unfollowed somewhere else, so the
		full read had to exist anyway.
	*/
	rebuild: function () {
		var id = ++this.runId;

		this.loading = true;
		this.error = null;
		this.update();

		this.fetchPage(id, {collected: [], seen: {}, offset: 0, page: 0});
	},

	fetchPage: function (id, state) {
		if (state.page >= this.maxPages || state.offset === null || state.offset === undefined) {
			this.finishSync(id, state);
			return;
		}
		state.page++;

		window.wumblr.tumblr.getFollowing(state.offset, enyo.bind(this, function (result) {
			if (id !== this.runId) return;

			for (var i = 0; i < result.blogs.length; i++) {
				var blog = result.blogs[i];
				// Paging windows can overlap, so guard against repeats.
				if (state.seen[blog.name]) continue;
				state.seen[blog.name] = true;
				state.collected.push(blog);
			}

			state.offset = result.nextOffset;
			this.fetchPage(id, state);
		}), enyo.bind(this, function (err) {
			if (id !== this.runId) return;
			enyo.warn("BlogList: sync failed", err);
			this.loading = false;
			this.error = err;
			this.update();
			this.doSyncDone();
		}));
	},

	finishSync: function (id, state) {
		if (id !== this.runId) return;

		// Authoritative: this read every page, so it replaces the list rather
		// than merging into it. That is what lets unfollows disappear.
		window.wumblr.appCache.setFollowing(state.collected);
		// Distinguishes "fetched, and you follow nobody" from "never fetched",
		// which now that syncing is manual are quite different things to say.
		window.wumblr.prefs.set("followingSynced", true);
		this.blogs = window.wumblr.appCache.getFollowing();
		this.loading = false;
		this.update();
		this.doSyncDone();
	},

	trim: function (value) {
		return String(value === null || value === undefined ? "" : value).replace(/^\s+|\s+$/g, "");
	},

	matches: function () {
		var needle = this.trim(this.$.search.getValue()).toLowerCase();
		if (!needle) return this.blogs;

		var found = [];
		for (var i = 0; i < this.blogs.length; i++) {
			var blog = this.blogs[i];
			var title = (blog.title || "").toLowerCase();
			if (blog.name.toLowerCase().indexOf(needle) >= 0 || title.indexOf(needle) >= 0) {
				found.push(blog);
			}
		}
		return found;
	},

	searchChanged: function () {
		this.update();
		return true;
	},

	update: function () {
		var query = this.trim(this.$.search.getValue());
		var found = this.matches();
		var message = "";

		if (this.blogs.length === 0) {
			if (this.loading) {
				message = "Loading blogs you follow…";
			} else if (this.error) {
				message = "Couldn’t load your following list. Please try again.";
			} else if (window.wumblr.prefs.get("followingSynced", false)) {
				message = "You aren’t following any blogs yet.";
			} else {
				// Nothing has ever been fetched, which is not the same as
				// following nobody - say so, and say where the button is.
				message = "No blogs fetched yet. Use “Rebuild” in Settings.";
			}
		} else if (found.length === 0) {
			message = "No blogs match “" + query + "”.";
		}

		var label = query ?
			found.length + " of " + this.blogs.length :
			this.blogs.length + " blogs";
		this.$.count.setContent(this.loading ? label + " — loading…" : label);

		this.$.status.setShowing(Boolean(message));
		this.$.status.setContent(message);
		this.renderRows(message ? [] : found);
	},

	renderRows: function (found) {
		this.$.rows.destroyControls();

		var tumblr = window.wumblr.tumblr;
		for (var i = 0; i < found.length; i++) {
			var blog = found[i];
			this.$.rows.createComponent({
				kind: "Item", className: "wumblr-blog-row", blogName: blog.name,
				onclick: "rowClick",
				components: [
					{kind: enyo.HFlexBox, align: "center", components: [
						{kind: "Image", className: "wumblr-blog-avatar", src: tumblr.blogAvatarUrl(blog.name, 64)},
						{kind: enyo.VFlexBox, flex: 1, components: [
							{content: blog.name, className: "wumblr-blog-name"},
							{content: blog.title || blog.url || "", className: "wumblr-blog-title"}
						]}
					]}
				]
			}, {owner: this});
		}

		this.$.rows.render();
	},

	rowClick: function (inSender) {
		this.doSelectBlog({blogName: inSender.blogName});
		return true;
	}
});
