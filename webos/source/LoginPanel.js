/*
	Sign-in, via the shared community webOS OAuth broker
	(https://oauth.wosa.link, github.com/webOSArchive/oauth-broker-for-webos)
	instead of a bespoke companion server.

	Tumblr requires the standard three-legged OAuth1 dance - a real consent
	screen on tumblr.com, not a direct username/password exchange - which the
	device categorically cannot do itself: its 2009-era TLS can't reach
	tumblr.com and its browser renders the consent page blank. The broker
	does that whole dance server-side. This panel's job shrinks to three
	calls: ask for a code, show it, poll until tokens show up.

	Helpers.OAuthBroker (source/lib/OAuthBroker-Helper.js, synced verbatim
	from webOSArchive/webos-common) is the engine; this is the view wired to
	it, following the pattern in that repo's OAuthExample almost exactly -
	notably the code is shown inline rather than in a ModalDialog (old Enyo
	builds a dialog's children lazily, so writing into one before it opens
	throws) and polling runs in the background rather than behind a manual
	Verify tap, so a slow poll never reads as a stall.
*/
enyo.kind({
	name: "LoginPanel",
	kind: enyo.VFlexBox,
	className: "wumblr-login",

	events: {
		onAuthenticate: ""
	},

	components: [
		// The slug wumblr is registered under on the broker - see
		// apps/wumblr/config.example.php in the broker repo. Not secret,
		// just an identifier; the consumer key/secret that actually sign
		// requests live in Keys.js, same as before.
		//
		// brokerBaseUrl is left unset deliberately: the Helper's own default
		// (https://oauth.wosa.link) is correct here, the same production
		// broker every other app on it uses. A local-machine override was
		// used during development to verify the oauth1_3legged flow against
		// real Tumblr before apps/wumblr existed on the real broker; it has
		// no reason to exist in this file once that app is actually deployed
		// there. If sign-in needs to be pointed at a dev broker again, add
		// brokerBaseUrl back here rather than reintroducing a stored,
		// user-editable setting - see webos/README.md's Sign-in section for
		// why that's not how this integration is meant to work.
		{
			kind: "Helpers.OAuthBroker", name: "broker", appName: "wumblr",
			onCode: "showCode", onConnected: "storeTokens",
			onExpired: "codeExpired", onError: "brokerError"
		},

		{kind: "Header", content: "wumblr"},

		{kind: "Scroller", flex: 1, components: [
			{className: "wumblr-login-body", components: [
				{content: "Log in to wumblr", className: "wumblr-login-title"},

				// ── Step 1: Sign In ────────────────────────────────────────
				{name: "startPanel", components: [
					{
						className: "wumblr-login-help",
						content: "Tap Sign In, then finish on a phone or computer."
					},
					{name: "signIn", kind: "Button", className: "wumblr-login-start", caption: "Sign In", onclick: "signInClick"}
				]},

				// ── Step 2: shown once the broker hands back a code ─────────
				{name: "codePanel", showing: false, className: "wumblr-login-code-panel", components: [
					{className: "wumblr-login-help", content: "On a modern phone or computer, go to:"},
					{name: "codeUrl", className: "wumblr-login-code-url"},
					{className: "wumblr-login-help", content: "and enter this code:"},
					{name: "codeValue", className: "wumblr-login-code-value"},

					// The activate page reads ?code= to pre-fill the code
					// field (see activate.php's $prefill), so encoding the
					// code into the URL turns "scan, read, type, submit"
					// into "scan, tap Continue" - kept alongside the text
					// above rather than replacing it, since not everyone
					// testing this has a phone camera to hand.
					{className: "wumblr-login-help", content: "or scan to open it pre-filled:"},
					{name: "qr", kind: "QrCode", size: 260, className: "wumblr-login-qr"},

					{name: "codeStatus", className: "wumblr-login-code-status"},
					{kind: enyo.HFlexBox, pack: "center", className: "wumblr-login-code-actions", components: [
						{name: "checkNow", kind: "Button", caption: "Check now", onclick: "checkNowClick"},
						{kind: "Button", className: "enyo-button-negative", caption: "Cancel", onclick: "cancelClick"}
					]}
				]},

				{name: "error", className: "wumblr-login-error", showing: false}
			]}
		]},

		/*
			Covers the two brief round trips - minting a code, and fetching
			the Tumblr profile once tokens arrive - not the wait in between.
			That wait is the whole point of showing the code: the user needs
			the device readable while they go do something on another one, so
			it gets the inline codePanel and a background poll instead of
			ever being scrimmed.

			The Scrim here is a component of this panel rather than the
			enyo.scrim singleton. The singleton renders into the popup layer,
			whose node *is* document.body, so its node does not survive this
			app re-rendering into the body - it ends up detached and nothing
			dims. A locally owned Scrim is created, rendered and torn down
			with the panel, which is the other usage the Scrim docs describe.
		*/
		{name: "busy", className: "wumblr-busy", showing: false, components: [
			{name: "busyScrim", kind: "Scrim"},
			{className: "wumblr-busy-content", components: [
				{kind: "SpinnerLarge", showing: true},
				{name: "busyLabel", className: "wumblr-busy-label"}
			]}
		]}
	],

	//* @protected
	busy: false,

	/*
		`message` names the phase, because minting a code and then fetching
		the account are two separate round trips that can both be busy - and
		because leaving the label on the first one's text through the second
		would read as a stall.
	*/
	setBusy: function (busy, message) {
		this.busy = busy;
		this.$.signIn.setDisabled(busy);

		// Only on the way in: the label is meaningless once hidden, and
		// rewriting it on every hide would clobber the phase just shown.
		if (busy) {
			this.$.busyLabel.setContent(message || "Working…");
		}

		// Overlay first, then the scrim. Scrim applies its dim class on the
		// next turn of the loop, so it has to already be displayed for the
		// opacity to have something to transition from.
		this.$.busy.setShowing(busy);
		this.$.busyScrim.setShowing(busy);
	},

	showError: function (message) {
		this.$.error.setShowing(Boolean(message));
		this.$.error.setContent(message || "");
	},

	signInClick: function () {
		if (this.busy) return true;
		this.showError("");
		this.setBusy(true, "Starting…");
		this.$.broker.start();
		return true;
	},

	// onCode: the broker minted a code and started polling in the
	// background. Show it; nothing more to do until onConnected/onExpired.
	showCode: function (inSender, codeInfo) {
		this.setBusy(false);
		this.$.codeUrl.setContent(codeInfo.useUrl);
		this.$.codeValue.setContent(codeInfo.code);
		// Deliberately not codeInfo.useUrl + "?code=": useUrl is the broker's
		// pretty /wumblr path, which needs a server rewrite to reach
		// activate.php at all. The live broker is nginx, .htaccess's rewrite
		// is Apache-only and never runs there, and whatever nginx has
		// instead for that path drops query strings - confirmed live, the
		// code never arrived and the box stayed empty. activate.php's
		// ?app=&code= form hits the same page directly, no rewrite involved
		// on any host, and activate.php's $prefill reads that same ?code=.
		this.$.qr.setText(
			this.$.broker.getBrokerBaseUrl() + "/activate.php?app=" +
			encodeURIComponent(this.$.broker.getAppName()) +
			"&code=" + encodeURIComponent(codeInfo.code));
		this.$.codeStatus.setContent("Waiting for you to finish signing in…");
		this.$.startPanel.hide();
		this.$.codePanel.show();
		return true;
	},

	// Manual fallback if the background poll feels slow.
	checkNowClick: function () {
		this.$.codeStatus.setContent("Checking…");
		this.$.broker.checkNow();
		return true;
	},

	// onConnected: tokens are here, handed over exactly once. Hand them
	// straight to the app in the {token, tokenSecret} shape it already
	// expects - Store.js/TumblrClient.js don't need to know the broker's
	// field names (oauth_token/oauth_token_secret) exist.
	storeTokens: function (inSender, tokens) {
		this.$.codePanel.hide();
		this.$.startPanel.show();
		// Still busy: the app has to fetch the Tumblr profile before it can
		// show anything, and dropping the scrim in between would flash the
		// sign-in screen back up for a moment.
		this.setBusy(true, "Signing in…");
		this.doAuthenticate({token: tokens.oauth_token, tokenSecret: tokens.oauth_token_secret});
		return true;
	},

	// onExpired: the broker no longer knows this code (expired, or already
	// claimed). Nothing to keep waiting for - say so and let Cancel reset.
	codeExpired: function () {
		this.$.codeStatus.setContent("That code expired. Tap Cancel, then Sign In again.");
		return true;
	},

	// onError: couldn't reach the broker at all (network down, or - on this
	// platform - a TLS handshake refused if the SSL-bump proxy isn't set up).
	brokerError: function (inSender, message) {
		this.setBusy(false);
		this.$.codePanel.hide();
		this.$.startPanel.show();
		this.showError(message || "Could not reach the sign-in service. Check your connection and try again.");
		return true;
	},

	cancelClick: function () {
		this.$.broker.stop();
		this.$.codePanel.hide();
		this.$.startPanel.show();
		this.showError("");
		return true;
	},

	//* Called by the app when the profile fetch after a successful sign-in
	//* fails outright (as opposed to the broker itself failing above).
	reportFailure: function (message) {
		this.setBusy(false);
		this.showError(message);
	}
});
