/*
	Copy this file to `Keys.js` (gitignored) and fill in your own values.
	Register an app at https://www.tumblr.com/oauth/apps to get a consumer
	key/secret pair. Never commit the real `Keys.js`.

	The consumer secret has to live on the device because the app signs
	every Tumblr API call itself; only the initial code-for-token exchange
	happens on the companion server.

	`loginServer` is the base URL of that companion server. It can also be
	changed on-device from Settings, which is the easier path while the
	server is moving around - but this file is the default and wins: an
	address typed on the device sticks only until this value changes.
*/
window.wumblr = window.wumblr || {};
window.wumblr.keys = {
	consumerKey: "your-tumblr-consumer-key",
	consumerSecret: "your-tumblr-consumer-secret",
	loginServer: "http://192.168.1.10:8080"
};
