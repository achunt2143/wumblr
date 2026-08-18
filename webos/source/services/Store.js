/*
	Persistence, on db8.

	Replaces the earlier localStorage-only Prefs/AppCache. db8 is the native
	store: it lives on the encrypted partition (which matters for the OAuth
	token), it survives the app cache being cleared, and it is queryable
	rather than a bag of JSON strings.

	Three kinds, shaped the way the data actually is:

	  com.achunt.wumblr.prefs:1    one record per setting   {key, value}
	  com.achunt.wumblr.reblog:1   one record per post      {postId}
	  com.achunt.wumblr.blog:1     one record per blog      {name, title, …}

	The awkward part of db8 is that every read is asynchronous, while the UI
	needs answers during render - a post row decides its reblog state while
	it is drawing and cannot wait on a service call. So everything is loaded
	into memory once at launch (hydrate) and read synchronously from there
	afterwards; writes go to db8 in the background and update the mirror
	immediately.

	Outside webOS there is no service bus at all, so the same mirror is
	backed by localStorage instead and the app behaves identically. That is
	also what makes the desktop harness usable.
*/
(function () {

	var PREFS_KIND = "com.achunt.wumblr.prefs:1";
	var REBLOG_KIND = "com.achunt.wumblr.reblog:1";
	var BLOG_KIND = "com.achunt.wumblr.blog:1";
	var OWNER = "com.achunt.wumblr";

	var LOCAL_PREFIX = "wumblr.";

	// In-memory mirror. Every read below answers from these.
	var prefs = {};
	var reblogged = {};
	var following = [];

	var useDb8 = false;
	var pending = [];  // keeps bridges alive until their callback fires

	// --- luna plumbing ----------------------------------------------------

	function luna (method, params, onSuccess, onFailure) {
		if (typeof PalmServiceBridge === "undefined") {
			onFailure({errorText: "no service bus"});
			return;
		}

		var bridge = new PalmServiceBridge();
		pending.push(bridge);

		bridge.onservicecallback = function (raw) {
			for (var i = 0; i < pending.length; i++) {
				if (pending[i] === bridge) {
					pending.splice(i, 1);
					break;
				}
			}

			var res = null;
			try {
				res = enyo.json.parse(raw);
			} catch (e) {
				res = null;
			}

			// A call can succeed at the transport level and still have failed;
			// returnValue is the one that counts.
			if (!res || res.returnValue === false || res.errorCode) {
				onFailure(res || {errorText: "unparseable response"});
			} else {
				onSuccess(res);
			}
		};

		bridge.call("palm://com.palm.db/" + method, enyo.json.stringify(params || {}));
	}

	// onFailure is kept distinct from onSuccess: the first putKind doubles as
	// the probe, and a failure response is still an object, so folding the
	// two together would read "no service bus" as a working db8.
	function putKind (id, indexProp, onSuccess, onFailure) {
		luna("putKind", {
			id: id,
			owner: OWNER,
			indexes: [{name: indexProp, props: [{name: indexProp}]}]
		}, onSuccess, onFailure || onSuccess);
	}

	function findAll (kind, onDone) {
		luna("find", {query: {from: kind}}, function (res) {
			onDone((res && res.results) || []);
		}, function () {
			onDone([]);
		});
	}

	function put (objects) {
		if (!useDb8 || objects.length === 0) return;
		luna("put", {objects: objects}, function () {}, function (err) {
			enyo.warn("store: put failed", err);
		});
	}

	function del (kind, where, onDone) {
		if (!useDb8) {
			if (onDone) onDone();
			return;
		}
		var query = {from: kind};
		if (where) query.where = where;
		luna("del", {query: query}, function () {
			if (onDone) onDone();
		}, function (err) {
			enyo.warn("store: del failed", err);
			if (onDone) onDone();
		});
	}

	// --- localStorage fallback -------------------------------------------

	function localGet (name, dflt) {
		try {
			var raw = window.localStorage.getItem(LOCAL_PREFIX + name);
			return raw === null || raw === undefined ? dflt : enyo.json.parse(raw);
		} catch (e) {
			return dflt;
		}
	}

	function localSet (name, value) {
		try {
			window.localStorage.setItem(LOCAL_PREFIX + name, enyo.json.stringify(value));
		} catch (e) {
			enyo.warn("store: local write failed for " + name, e);
		}
	}

	function localRemove (name) {
		try {
			window.localStorage.removeItem(LOCAL_PREFIX + name);
		} catch (e) {}
	}

	// --- hydration --------------------------------------------------------

	function hydrateFromLocal () {
		prefs = {};
		var names = ["token", "tokenSecret", "loginServer", "loginServerBaseline"];
		for (var i = 0; i < names.length; i++) {
			var v = localGet(names[i], null);
			if (v !== null) prefs[names[i]] = v;
		}

		reblogged = {};
		var ids = localGet("cache.reblogged", []);
		if (enyo.isArray(ids)) {
			for (var j = 0; j < ids.length; j++) reblogged[String(ids[j])] = true;
		}

		var blogs = localGet("cache.following", []);
		following = enyo.isArray(blogs) ? blogs : [];
	}

	/*
		Anything already in localStorage came from a build that predates db8,
		so it is copied across on the first run rather than silently dropped -
		otherwise upgrading would sign the user out and throw away a
		following list that costs ~21 requests to rebuild.
	*/
	function migrateFromLocal () {
		var migrated = false;
		var objects = [];
		var names = ["token", "tokenSecret", "loginServer", "loginServerBaseline"];

		for (var i = 0; i < names.length; i++) {
			var v = localGet(names[i], null);
			if (v === null) continue;
			prefs[names[i]] = v;
			objects.push({_kind: PREFS_KIND, key: names[i], value: enyo.json.stringify(v)});
			migrated = true;
		}

		var ids = localGet("cache.reblogged", []);
		if (enyo.isArray(ids)) {
			for (var j = 0; j < ids.length; j++) {
				reblogged[String(ids[j])] = true;
				objects.push({_kind: REBLOG_KIND, postId: String(ids[j])});
				migrated = true;
			}
		}

		var blogs = localGet("cache.following", []);
		if (enyo.isArray(blogs) && blogs.length > 0) {
			following = blogs;
			for (var k = 0; k < blogs.length; k++) {
				objects.push(blogRecord(blogs[k]));
			}
			migrated = true;
		}

		if (migrated) {
			enyo.log("store: migrating " + objects.length + " records from localStorage to db8");
			put(objects);
			// The local copies stay for now. They are only dropped on a later
			// launch, once db8 has been seen to actually hold the data - see
			// clearLocalLeftovers. If this write failed, the fallback is still
			// there to migrate again next time.
		}
		return migrated;
	}

	/*
		Removes the pre-db8 copies, once db8 is known to have the data.

		Deferring to a later launch rather than doing it right after the write
		is what makes it safe: by the time this runs, the records have been
		read back out of db8. Leaving them would also defeat the point of
		moving - the access token would still be sitting in localStorage,
		outside the encrypted partition.
	*/
	function clearLocalLeftovers () {
		var names = [
			"token", "tokenSecret", "loginServer", "loginServerBaseline",
			"cache.reblogged", "cache.following"
		];
		var cleared = 0;
		for (var i = 0; i < names.length; i++) {
			if (localGet(names[i], null) !== null) {
				localRemove(names[i]);
				cleared++;
			}
		}
		if (cleared > 0) {
			enyo.log("store: cleared " + cleared + " migrated localStorage entries");
		}
	}

	function blogRecord (blog) {
		return {
			_kind: BLOG_KIND,
			name: blog.name,
			title: blog.title || "",
			url: blog.url || "",
			uuid: blog.uuid || ""
		};
	}

	function hydrate (onDone) {
		prefs = {};
		reblogged = {};
		following = [];

		// One putKind doubles as the probe: if the bus is not there, or the
		// kind cannot be registered, there is no point trying the rest.
		putKind(PREFS_KIND, "key", function () {
			useDb8 = true;
			putKind(REBLOG_KIND, "postId", function () {
				putKind(BLOG_KIND, "name", function () {
					loadAll(onDone);
				});
			});
		}, function (err) {
			useDb8 = false;
			enyo.warn("store: db8 unavailable, using localStorage", err);
			hydrateFromLocal();
			onDone();
		});
	}

	function loadAll (onDone) {
		findAll(PREFS_KIND, function (rows) {
			for (var i = 0; i < rows.length; i++) {
				try {
					prefs[rows[i].key] = enyo.json.parse(rows[i].value);
				} catch (e) {
					prefs[rows[i].key] = rows[i].value;
				}
			}

			findAll(REBLOG_KIND, function (reblogRows) {
				for (var j = 0; j < reblogRows.length; j++) {
					reblogged[String(reblogRows[j].postId)] = true;
				}

				findAll(BLOG_KIND, function (blogRows) {
					following = blogRows;

					// An empty store on a device that has localStorage data
					// means this is the first launch after the change.
					if (rows.length === 0 && reblogRows.length === 0 && blogRows.length === 0) {
						migrateFromLocal();
					} else {
						clearLocalLeftovers();
					}
					onDone();
				});
			});
		});
	}

	// --- prefs (sync reads, background writes) ----------------------------

	function prefGet (name, dflt) {
		return prefs[name] === undefined ? dflt : prefs[name];
	}

	function prefSet (name, value) {
		prefs[name] = value;
		if (useDb8) {
			del(PREFS_KIND, [{prop: "key", op: "=", val: name}]);
			put([{_kind: PREFS_KIND, key: name, value: enyo.json.stringify(value)}]);
		} else {
			localSet(name, value);
		}
	}

	function prefRemove (name) {
		delete prefs[name];
		if (useDb8) {
			del(PREFS_KIND, [{prop: "key", op: "=", val: name}]);
		} else {
			localRemove(name);
		}
	}

	// --- reblogs ----------------------------------------------------------

	function hasReblogged (id) {
		return reblogged[String(id)] === true;
	}

	function rememberReblog (id) {
		var key = String(id);
		if (reblogged[key]) return;
		reblogged[key] = true;
		if (useDb8) {
			put([{_kind: REBLOG_KIND, postId: key}]);
		} else {
			localSet("cache.reblogged", keysOf(reblogged));
		}
	}

	function keysOf (obj) {
		var out = [];
		for (var k in obj) {
			if (obj.hasOwnProperty(k)) out.push(k);
		}
		return out;
	}

	// --- following --------------------------------------------------------

	function getFollowing () {
		return following;
	}

	/*
		Replaces the whole list, which is what a rebuild produces.

		The put is chained onto the del rather than fired alongside it. They
		are independent Luna calls with no ordering guarantee between them, so
		issuing both at once can land the put first and have the del then wipe
		what it just wrote. Losing this list is expensive: an empty cache is
		what sends the next sync back through every page.
	*/
	function setFollowing (blogs) {
		following = blogs || [];

		if (!useDb8) {
			localSet("cache.following", following);
			return;
		}

		var objects = [];
		for (var i = 0; i < following.length; i++) {
			objects.push(blogRecord(following[i]));
		}
		del(BLOG_KIND, null, function () {
			put(objects);
		});
	}

	function addFollowedBlog (blog) {
		for (var i = 0; i < following.length; i++) {
			if (following[i].name === blog.name) return;
		}
		following = [blog].concat(following);
		if (useDb8) {
			put([blogRecord(blog)]);
		} else {
			localSet("cache.following", following);
		}
	}

	function removeFollowedBlog (blogName) {
		var kept = [];
		for (var i = 0; i < following.length; i++) {
			if (following[i].name !== blogName) kept.push(following[i]);
		}
		following = kept;
		if (useDb8) {
			del(BLOG_KIND, [{prop: "name", op: "=", val: blogName}]);
		} else {
			localSet("cache.following", following);
		}
	}

	// Sign-out: the caches belong to the account that was signed in.
	function clearAccountData () {
		reblogged = {};
		following = [];
		// Also account-scoped: the next account has not been fetched either.
		prefRemove("followingSynced");
		if (useDb8) {
			del(REBLOG_KIND);
			del(BLOG_KIND);
		} else {
			localRemove("cache.reblogged");
			localRemove("cache.following");
		}
	}

	// --- exports ----------------------------------------------------------

	window.wumblr = window.wumblr || {};

	window.wumblr.store = {
		hydrate: hydrate,
		usingDb8: function () { return useDb8; }
	};

	// Same shapes the rest of the app already used, so callers are unchanged.
	window.wumblr.prefs = {
		get: prefGet,
		set: prefSet,
		remove: prefRemove
	};

	window.wumblr.appCache = {
		addFollowedBlog: addFollowedBlog,
		clear: clearAccountData,
		getFollowing: getFollowing,
		hasReblogged: hasReblogged,
		removeFollowedBlog: removeFollowedBlog,
		rememberReblog: rememberReblog,
		setFollowing: setFollowing
	};

})();
