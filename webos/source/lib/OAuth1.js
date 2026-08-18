/*
	OAuth 1.0a request signing (HMAC-SHA1), replacing the `oauth-1.0a`
	package the Enact build used.

	Only the signing half of OAuth1 lives here. The 3-legged handshake still
	happens on the companion server - the device never sees a request token,
	it just receives an access token/secret pair and signs its own API calls
	with them from then on.
*/
(function () {

	// encodeURIComponent leaves !*'() alone, but RFC 3986 - and therefore
	// the signature base string - treats them as reserved. A mismatch here
	// produces a valid-looking signature that the server rejects.
	function percentEncode (value) {
		return encodeURIComponent(value === null || value === undefined ? "" : String(value))
			.replace(/[!*'()]/g, function (c) {
				return "%" + c.charCodeAt(0).toString(16).toUpperCase();
			});
	}

	var NONCE_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

	function nonce () {
		var s = "";
		for (var i = 0; i < 32; i++) {
			s += NONCE_CHARS.charAt(Math.floor(Math.random() * NONCE_CHARS.length));
		}
		return s;
	}

	// Splits "a=1&b=2" into an object, undoing form encoding. Values are
	// decoded here because they get percent-encoded again for the base
	// string, and double-encoding breaks the signature.
	function parseQuery (query) {
		var params = {};
		var pairs = query.split("&");
		for (var i = 0; i < pairs.length; i++) {
			if (!pairs[i]) continue;
			var eq = pairs[i].indexOf("=");
			var key = eq >= 0 ? pairs[i].substring(0, eq) : pairs[i];
			var val = eq >= 0 ? pairs[i].substring(eq + 1) : "";
			params[decodeURIComponent(key.replace(/\+/g, " "))] = decodeURIComponent(val.replace(/\+/g, " "));
		}
		return params;
	}

	function sortedKeys (obj) {
		var keys = [];
		for (var k in obj) {
			if (obj.hasOwnProperty(k)) keys.push(k);
		}
		keys.sort();
		return keys;
	}

	/*
		Returns the value for an Authorization header.

		opts:
			method          HTTP verb
			url             full request URL; any query string is parsed out
			                and folded into the signature, as the spec requires
			params          extra parameters to sign (form-encoded bodies).
			                Tumblr's write endpoints take JSON bodies, which
			                are not signed, so callers there pass nothing.
			consumerKey / consumerSecret
			token / tokenSecret
			nonce / timestamp   overridable, for tests
	*/
	function header (opts) {
		var qIndex = opts.url.indexOf("?");
		var baseUrl = qIndex >= 0 ? opts.url.substring(0, qIndex) : opts.url;
		var signed = qIndex >= 0 ? parseQuery(opts.url.substring(qIndex + 1)) : {};
		var key, i;

		for (key in opts.params || {}) {
			if (opts.params.hasOwnProperty(key)) signed[key] = opts.params[key];
		}

		var oauthParams = {
			oauth_consumer_key: opts.consumerKey,
			oauth_nonce: opts.nonce || nonce(),
			oauth_signature_method: "HMAC-SHA1",
			oauth_timestamp: String(opts.timestamp || Math.floor(new Date().getTime() / 1000)),
			oauth_version: "1.0"
		};
		if (opts.token) {
			oauthParams.oauth_token = opts.token;
		}

		for (key in oauthParams) {
			if (oauthParams.hasOwnProperty(key)) signed[key] = oauthParams[key];
		}

		var names = sortedKeys(signed);
		var pairs = [];
		for (i = 0; i < names.length; i++) {
			pairs.push(percentEncode(names[i]) + "=" + percentEncode(signed[names[i]]));
		}

		var baseString = opts.method.toUpperCase() +
			"&" + percentEncode(baseUrl) +
			"&" + percentEncode(pairs.join("&"));

		var signingKey = percentEncode(opts.consumerSecret) + "&" + percentEncode(opts.tokenSecret || "");
		oauthParams.oauth_signature = window.wumblr.hmacSha1Base64(signingKey, baseString);

		// Only oauth_* parameters belong in the header; request parameters
		// stay in the URL or body where they came from.
		var headerNames = sortedKeys(oauthParams);
		var parts = [];
		for (i = 0; i < headerNames.length; i++) {
			parts.push(percentEncode(headerNames[i]) + '="' + percentEncode(oauthParams[headerNames[i]]) + '"');
		}
		return "OAuth " + parts.join(", ");
	}

	window.wumblr = window.wumblr || {};
	window.wumblr.oauth1 = {
		header: header,
		percentEncode: percentEncode
	};

})();
