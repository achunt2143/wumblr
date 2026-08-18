/*
	HMAC-SHA1 -> Base64, with no dependencies.

	The Enact build signed requests with crypto-js + oauth-1.0a. Neither can
	be used here: there is no bundler in the picture, and webOS 3.0.5's
	WebKit predates the ES5 features those packages assume. This is a plain
	ES5 implementation of just the one primitive OAuth 1.0a needs.

	Operates on byte arrays rather than binary strings so that non-ASCII
	post/blog names survive signing - the signature base string is UTF-8 by
	spec, and charCodeAt-based shortcuts silently corrupt anything above
	U+007F.
*/
(function () {

	function rotl (n, s) {
		return (n << s) | (n >>> (32 - s));
	}

	function utf8Bytes (str) {
		var bytes = [];
		var s = String(str);
		for (var i = 0; i < s.length; i++) {
			var c = s.charCodeAt(i);
			if (c < 0x80) {
				bytes.push(c);
			} else if (c < 0x800) {
				bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
			} else if (c < 0xd800 || c >= 0xe000) {
				bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
			} else {
				// Surrogate pair: combine into a single code point.
				i++;
				var cp = 0x10000 + (((c & 0x3ff) << 10) | (s.charCodeAt(i) & 0x3ff));
				bytes.push(
					0xf0 | (cp >> 18),
					0x80 | ((cp >> 12) & 0x3f),
					0x80 | ((cp >> 6) & 0x3f),
					0x80 | (cp & 0x3f)
				);
			}
		}
		return bytes;
	}

	function sha1 (bytes) {
		var bitLen = bytes.length * 8;
		var msg = bytes.slice(0);
		var i, j;

		msg.push(0x80);
		while ((msg.length % 64) !== 56) {
			msg.push(0);
		}
		// 64-bit big-endian length. Split rather than shifted: bit lengths
		// above 2^32 would be lost by a 32-bit shift.
		var hi = Math.floor(bitLen / 4294967296);
		msg.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
		msg.push((bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);

		var h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
		var w = new Array(80);

		for (i = 0; i < msg.length; i += 64) {
			for (j = 0; j < 16; j++) {
				var k4 = i + j * 4;
				w[j] = (msg[k4] << 24) | (msg[k4 + 1] << 16) | (msg[k4 + 2] << 8) | msg[k4 + 3];
			}
			for (j = 16; j < 80; j++) {
				w[j] = rotl(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
			}

			var a = h0, b = h1, c = h2, d = h3, e = h4, f, k, t;
			for (j = 0; j < 80; j++) {
				if (j < 20) {
					f = (b & c) | ((~b) & d);
					k = 0x5A827999;
				} else if (j < 40) {
					f = b ^ c ^ d;
					k = 0x6ED9EBA1;
				} else if (j < 60) {
					f = (b & c) | (b & d) | (c & d);
					k = 0x8F1BBCDC;
				} else {
					f = b ^ c ^ d;
					k = 0xCA62C1D6;
				}
				t = (rotl(a, 5) + f + e + k + w[j]) | 0;
				e = d;
				d = c;
				c = rotl(b, 30);
				b = a;
				a = t;
			}

			h0 = (h0 + a) | 0;
			h1 = (h1 + b) | 0;
			h2 = (h2 + c) | 0;
			h3 = (h3 + d) | 0;
			h4 = (h4 + e) | 0;
		}

		var out = [];
		var hs = [h0, h1, h2, h3, h4];
		for (i = 0; i < 5; i++) {
			out.push((hs[i] >>> 24) & 0xff, (hs[i] >>> 16) & 0xff, (hs[i] >>> 8) & 0xff, hs[i] & 0xff);
		}
		return out;
	}

	function hmacSha1 (keyBytes, msgBytes) {
		var BLOCK = 64;
		var key = keyBytes.slice(0);
		var i;

		if (key.length > BLOCK) {
			key = sha1(key);
		}
		while (key.length < BLOCK) {
			key.push(0);
		}

		var ipad = [], opad = [];
		for (i = 0; i < BLOCK; i++) {
			ipad.push(key[i] ^ 0x36);
			opad.push(key[i] ^ 0x5c);
		}

		return sha1(opad.concat(sha1(ipad.concat(msgBytes))));
	}

	var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

	function base64 (bytes) {
		var out = "";
		for (var i = 0; i < bytes.length; i += 3) {
			var b0 = bytes[i];
			var b1 = bytes[i + 1];
			var b2 = bytes[i + 2];
			var has1 = b1 !== undefined;
			var has2 = b2 !== undefined;

			out += B64.charAt(b0 >> 2);
			out += B64.charAt(((b0 & 3) << 4) | ((has1 ? b1 : 0) >> 4));
			out += has1 ? B64.charAt(((b1 & 15) << 2) | ((has2 ? b2 : 0) >> 6)) : "=";
			out += has2 ? B64.charAt(b2 & 63) : "=";
		}
		return out;
	}

	window.wumblr = window.wumblr || {};
	window.wumblr.hmacSha1Base64 = function (key, message) {
		return base64(hmacSha1(utf8Bytes(key), utf8Bytes(message)));
	};

})();
