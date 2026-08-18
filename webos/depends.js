enyo.depends(
	"source/wumblr.css",

	// Configuration (gitignored; copy from Keys.example.js)
	"source/Keys.js",

	// Dependency-free replacements for crypto-js / oauth-1.0a
	"source/lib/Sha1.js",
	"source/lib/OAuth1.js",

	// Services
	"source/services/Store.js",
	"source/services/Config.js",
	"source/services/TumblrClient.js",

	// Views
	"source/PostItem.js",
	"source/FeedList.js",
	"source/BlogList.js",
	"source/LoginPanel.js",
	"source/NavPanel.js",
	"source/SettingsPanel.js",
	"source/MainPanel.js",
	"source/BlogPanel.js",
	"source/MediaPanel.js",
	"source/Wumblr.js"
);
