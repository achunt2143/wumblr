enyo.depends(
	"source/wumblr.css",

	// Configuration (gitignored; copy from Keys.example.js)
	"source/Keys.js",

	// Dependency-free replacements for crypto-js / oauth-1.0a
	"source/lib/Sha1.js",
	"source/lib/OAuth1.js",

	// Helpers.OAuthBroker - synced from webOSArchive/webos-common's
	// Enyo/OAuthBroker-Helper.js. Kept verbatim so it can be re-synced;
	// don't hand-edit this one.
	"source/lib/OAuthBroker-Helper.js",

	// Vendored unmodified from davidshimjs/qrcodejs - see the file for why.
	"source/lib/QrCodeLib.js",

	// Services
	"source/services/Store.js",
	"source/services/TumblrClient.js",

	// Views
	"source/PostItem.js",
	"source/FeedList.js",
	"source/BlogList.js",
	"source/QrCode.js",
	"source/LoginPanel.js",
	"source/NavPanel.js",
	"source/SettingsPanel.js",
	"source/MainPanel.js",
	"source/BlogPanel.js",
	"source/MediaPanel.js",
	"source/Wumblr.js"
);
