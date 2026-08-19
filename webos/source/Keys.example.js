/*
	Copy this file to `Keys.js` (gitignored) and fill in your own values.
	Register an app at https://www.tumblr.com/oauth/apps to get a consumer
	key/secret pair. Never commit the real `Keys.js`.

	Both values still live on the device even though sign-in itself now goes
	through the shared webOS OAuth broker (see LoginPanel.js) rather than a
	bespoke companion server: the broker only brokers the *login*, trading a
	device code for a Tumblr access token. Every API call after that - posts,
	likes, reblogs - is still signed on-device with this consumer key/secret,
	and it must be the same consumer the broker's apps/wumblr config uses, or
	the token it hands back won't be accepted.
*/
window.wumblr = window.wumblr || {};
window.wumblr.keys = {
	consumerKey: "your-tumblr-consumer-key",
	consumerSecret: "your-tumblr-consumer-secret"
};
