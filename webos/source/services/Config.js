/*
	Where the login server address comes from.

	Two sources want to set it: Keys.js, which ships with the build, and the
	field on the login/settings screens, which exists so the address can be
	corrected on-device without repackaging.

	Keys.js is the default and it wins. A stored override only survives while
	the packaged value it was made against is unchanged - so rebuilding with
	a new Keys.js supersedes whatever the device had, rather than being
	silently ignored in favour of a stale entry someone typed once.

	That is what the baseline is for: it records which packaged value the
	override was taken against.
*/
(function () {

	var SERVER_KEY = "loginServer";
	var BASELINE_KEY = "loginServerBaseline";

	function packaged () {
		var keys = window.wumblr.keys || {};
		return keys.loginServer || "";
	}

	function getLoginServer () {
		var prefs = window.wumblr.prefs;
		var base = packaged();

		// Not a plain read: a changed Keys.js retires the override here, so
		// the next write starts from the new packaged value.
		if (prefs.get(BASELINE_KEY, null) !== base) {
			prefs.set(BASELINE_KEY, base);
			prefs.remove(SERVER_KEY);
			return base;
		}

		return prefs.get(SERVER_KEY, base) || base;
	}

	function setLoginServer (value) {
		var prefs = window.wumblr.prefs;
		prefs.set(BASELINE_KEY, packaged());
		prefs.set(SERVER_KEY, value);
	}

	window.wumblr = window.wumblr || {};
	window.wumblr.config = {
		getLoginServer: getLoginServer,
		setLoginServer: setLoginServer
	};

})();
