/*
	A scrolling list of posts for one source (dashboard, a blog, or likes),
	with the same fixed-page paging the Enact build used: a fixed `limit`
	with the offset advancing by the number of posts received.

	Following is deliberately not a source here - that endpoint ignores
	`limit` and needs its own cursor, so it lives in BlogList instead.
*/
enyo.kind({
	name: "FeedList",
	kind: enyo.VFlexBox,

	published: {
		//* {type: "dashboard" | "blog" | "likes", blogName: string}
		source: null,
		username: ""
	},

	events: {
		onSelectBlog: "",
		onOpenMedia: "",
		//* Fires with the first page, so a blog panel can read `followed`
		//* off a post rather than making a separate request for it.
		onFirstPage: ""
	},

	components: [
		{name: "scroller", kind: "Scroller", flex: 1, components: [
			{name: "status", className: "wumblr-status", showing: false},
			{name: "posts"},
			{name: "loadMoreRow", className: "wumblr-loadmore", showing: false, components: [
				{name: "loadMore", kind: "Button", caption: "Load more", onclick: "loadMoreClick"}
			]}
		]}
	],

	//* @protected
	pageSize: 20,
	count: 0,
	hasMore: true,
	loading: false,
	error: null,
	// Guards against a slow, stale request overwriting state after a newer
	// one (source switched again before the first request resolved).
	requestId: 0,

	sourceChanged: function () {
		this.reload();
	},

	reload: function () {
		this.count = 0;
		this.hasMore = true;
		this.error = null;
		this.$.posts.destroyControls();
		this.$.posts.render();
		this.load(0);
	},

	load: function (offset) {
		// Nothing to fetch before sign-in: the client has no token yet, and
		// the panel is built (and given a source) while the login view is
		// still up. MainPanel re-shows the destination once auth lands.
		if (!this.source || !window.wumblr.tumblr.isConfigured()) return;

		var id = ++this.requestId;
		var source = this.source;
		var tumblr = window.wumblr.tumblr;

		this.loading = true;
		this.updateStatus();

		var ok = enyo.bind(this, function (posts) {
			if (id !== this.requestId) return;
			this.loading = false;
			this.error = null;
			this.appendPosts(posts || [], offset === 0);
			this.hasMore = (posts || []).length === this.pageSize;
			this.updateStatus();
			if (offset === 0) {
				this.doFirstPage({posts: posts || []});
			}
		});

		var fail = enyo.bind(this, function (err) {
			if (id !== this.requestId) return;
			this.loading = false;
			this.error = err;
			enyo.warn("FeedList: load failed", err);
			this.updateStatus();
		});

		var paging = {limit: this.pageSize, offset: offset};
		if (source.type === "blog") {
			tumblr.getBlogPosts(source.blogName, paging, ok, fail);
		} else if (source.type === "likes") {
			tumblr.getLikes(paging, ok, fail);
		} else {
			tumblr.getDashboard(paging, ok, fail);
		}
	},

	appendPosts: function (posts, replace) {
		if (replace) {
			this.$.posts.destroyControls();
			this.count = 0;
		}

		for (var i = 0; i < posts.length; i++) {
			var post = posts[i];
			this.$.posts.createComponent({
				kind: "PostItem",
				post: post,
				isOwnBlog: post.blog_name === this.username,
				username: this.username,
				className: (this.count + i) % 2 === 0 ?
					"wumblr-post wumblr-post-even" :
					"wumblr-post wumblr-post-odd",
				onSelectBlog: "postSelectBlog",
				onOpenMedia: "postOpenMedia"
			}, {owner: this});
		}

		this.count += posts.length;
		this.$.posts.render();

		if (replace) {
			this.$.scroller.setScrollTop(0);
		}
	},

	updateStatus: function () {
		var isInitialLoad = this.count === 0 && this.loading;
		var isEmpty = this.count === 0 && !this.loading;
		var message = "";

		if (isInitialLoad) {
			message = "Loading…";
		} else if (isEmpty && this.error) {
			message = "Couldn’t load that. Please try again.";
		} else if (isEmpty) {
			message = this.source && this.source.type === "likes" ?
				"You haven’t liked anything yet." :
				"No posts here yet.";
		}

		this.$.status.setShowing(Boolean(message));
		this.$.status.setContent(message);

		this.$.loadMoreRow.setShowing(this.count > 0 && this.hasMore);
		this.$.loadMore.setCaption(this.loading ? "Loading…" : "Load more");
		this.$.loadMore.setDisabled(this.loading);
	},

	loadMoreClick: function () {
		if (this.loading || !this.hasMore) return true;
		this.load(this.count);
		return true;
	},

	postSelectBlog: function (inSender, inEvent) {
		this.doSelectBlog(inEvent);
		return true;
	},

	postOpenMedia: function (inSender, inEvent) {
		this.doOpenMedia(inEvent);
		return true;
	}
});
