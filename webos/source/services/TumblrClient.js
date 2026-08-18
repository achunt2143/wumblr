/*
	Tumblr REST client.

	A direct port of the Enact build's hand-rolled client. The shape of every
	call is unchanged - same endpoints, same paging quirks, same OAuth1
	signing rules - but fetch/Promises are gone, since webOS 3.0.5's WebKit
	has neither. Everything is (onSuccess, onFailure) callbacks over
	enyo.xhr instead.

	Cross-origin XHR needs no CORS handling here: webOS apps are privileged
	and are not subject to same-origin restrictions.
*/
(function () {

	var API_BASE = "https://api.tumblr.com/v2";

	var token = null;
	var tokenSecret = null;

	function blogIdentifier (blogName) {
		return blogName.indexOf(".") >= 0 ? blogName : blogName + ".tumblr.com";
	}

	function configure (accessToken, accessTokenSecret) {
		token = accessToken;
		tokenSecret = accessTokenSecret;
	}

	function reset () {
		token = null;
		tokenSecret = null;
	}

	function isConfigured () {
		return Boolean(token && tokenSecret);
	}

	function noop () {}

	function request (method, path, data, onSuccess, onFailure) {
		var ok = onSuccess || noop;
		var fail = onFailure || noop;

		if (!isConfigured()) {
			fail(new Error("tumblr: configure() must be called before use"));
			return;
		}

		var keys = window.wumblr.keys || {};
		var url = API_BASE + path;
		var headers = {};
		var body = null;

		if (method === "GET") {
			// The signature covers the query params, so they go on the URL
			// before the header is built (Tumblr's own SDK signs GETs this
			// way).
			var query = enyo.objectToQuery(data || {});
			if (query) url += "?" + query;
		} else {
			// Tumblr's SDK signs only the URL + method for writes and sends
			// the params as a JSON body, outside the signature base string.
			// Matching that rather than the stricter RFC 5849 convention.
			body = enyo.json.stringify(data || {});
			headers["Content-Type"] = "application/json";
		}

		headers.Authorization = window.wumblr.oauth1.header({
			method: method,
			url: url,
			consumerKey: keys.consumerKey,
			consumerSecret: keys.consumerSecret,
			token: token,
			tokenSecret: tokenSecret
		});

		enyo.xhr.request({
			url: url,
			method: method,
			body: body,
			headers: headers,
			callback: function (text, xhr) {
				var status = xhr ? xhr.status : 0;
				var json = null;
				try {
					json = text ? enyo.json.parse(text) : null;
				} catch (e) {
					json = null;
				}

				if (status >= 200 && status < 300) {
					ok(json ? json.response : null);
					return;
				}

				// status 0 means the request never completed - on this
				// platform that is almost always the TLS handshake failing
				// against a modern server, so say so rather than reporting
				// a bare "failed (0)".
				var message = (json && json.meta && json.meta.msg) ||
					(status === 0 ?
						"Could not reach Tumblr. Check the network connection and TLS support." :
						"Tumblr API request failed (" + status + ")");
				fail(new Error(message));
			}
		});
	}

	// Normalised profile rather than the raw payload: the counts worth
	// showing are split across two levels - likes/following belong to the
	// account, followers/posts to a blog - and an account can own several
	// blogs, so the primary one is the identity the app acts as.
	function getUserInfo (onSuccess, onFailure) {
		request("GET", "/user/info", {}, function (data) {
			var user = (data && data.user) || {};
			var blogs = user.blogs || [];
			var primary = blogs[0] || {};
			for (var i = 0; i < blogs.length; i++) {
				if (blogs[i].primary) {
					primary = blogs[i];
					break;
				}
			}
			onSuccess({
				name: user.name,
				likes: user.likes,
				following: user.following,
				followers: primary.followers,
				posts: primary.posts
			});
		}, onFailure);
	}

	function paging (options) {
		var o = options || {};
		return {limit: o.limit || 20, offset: o.offset || 0};
	}

	function getDashboard (options, onSuccess, onFailure) {
		request("GET", "/user/dashboard", paging(options), function (data) {
			onSuccess((data && data.posts) || []);
		}, onFailure);
	}

	function getBlogPosts (blogName, options, onSuccess, onFailure) {
		request("GET", "/blog/" + blogIdentifier(blogName) + "/posts", paging(options), function (data) {
			onSuccess((data && data.posts) || []);
		}, onFailure);
	}

	function getLikes (options, onSuccess, onFailure) {
		request("GET", "/user/likes", paging(options), function (data) {
			onSuccess((data && data.liked_posts) || []);
		}, onFailure);
	}

	/*
		Returns blogs, not posts: {name, title, description, url, uuid}.

		This endpoint pages unlike the others: it ignores `limit` (asking for
		20 or 50 both yield ~12), and the next offset is NOT the number of
		blogs returned - it can hand back 12 while advancing the cursor by
		38. Paging therefore has to follow the server's own `_links.next`
		cursor; deriving the offset from the item count re-reads overlapping
		windows and never reaches the end.

		`total_blogs` also overcounts what is actually retrievable (it
		reported 745 while a full traversal yielded 247 blogs), so it isn't a
		usable completion signal either.
	*/
	function getFollowing (offset, onSuccess, onFailure) {
		request("GET", "/user/following", {offset: offset || 0}, function (data) {
			var next = data && data._links && data._links.next && data._links.next.query_params;
			onSuccess({
				blogs: (data && data.blogs) || [],
				nextOffset: next && next.offset !== null && next.offset !== undefined ? Number(next.offset) : null
			});
		}, onFailure);
	}

	// The avatar endpoint is a public redirect to the image, so it can be
	// used directly as an <img> src without signing the request.
	function blogAvatarUrl (blogName, size) {
		return API_BASE + "/blog/" + blogIdentifier(blogName) + "/avatar/" + (size || 128);
	}

	function likePost (id, reblogKey, onSuccess, onFailure) {
		request("POST", "/user/like", {id: id, reblog_key: reblogKey}, onSuccess, onFailure);
	}

	function unlikePost (id, reblogKey, onSuccess, onFailure) {
		request("POST", "/user/unlike", {id: id, reblog_key: reblogKey}, onSuccess, onFailure);
	}

	// Follow state is not exposed by /blog/{blog}/info, and /followed_by
	// only answers the reverse question for blogs you own. It does ride
	// along on the posts themselves though (every post carries `followed`
	// for its blog), so the app reads it from the feed instead.
	function followBlog (blogName, onSuccess, onFailure) {
		request("POST", "/user/follow", {url: "https://" + blogIdentifier(blogName) + "/"}, onSuccess, onFailure);
	}

	function unfollowBlog (blogName, onSuccess, onFailure) {
		request("POST", "/user/unfollow", {url: "https://" + blogIdentifier(blogName) + "/"}, onSuccess, onFailure);
	}

	// The legacy /post/reblog endpoint 404s on current Tumblr - reblogging
	// now goes through the NPF post-creation endpoint instead, identifying
	// the source post by its parent blog's UUID rather than by name.
	function reblogPost (blogName, options, onSuccess, onFailure) {
		request("POST", "/blog/" + blogIdentifier(blogName) + "/posts", {
			content: [],
			parent_post_id: options.parentPostId,
			parent_tumblelog_uuid: options.parentTumblelogUuid,
			reblog_key: options.reblogKey
		}, onSuccess, onFailure);
	}

	// Post IDs are 64-bit and can exceed Number.MAX_SAFE_INTEGER; Tumblr
	// sends id_string alongside id specifically so callers can avoid the
	// precision loss of treating it as a JS number.
	function postId (post) {
		return post.id_string || String(post.id);
	}

	window.wumblr = window.wumblr || {};
	window.wumblr.tumblr = {
		blogAvatarUrl: blogAvatarUrl,
		configure: configure,
		followBlog: followBlog,
		getBlogPosts: getBlogPosts,
		getDashboard: getDashboard,
		getFollowing: getFollowing,
		getLikes: getLikes,
		getUserInfo: getUserInfo,
		isConfigured: isConfigured,
		likePost: likePost,
		postId: postId,
		reblogPost: reblogPost,
		reset: reset,
		unfollowBlog: unfollowBlog,
		unlikePost: unlikePost
	};

})();
