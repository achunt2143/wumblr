/*
	Sign-in.

	Unchanged in substance from the Enact build: a companion server (outside
	this repo) runs the Tumblr OAuth1 web flow and exchanges a short-lived
	code for an access token/secret pair, so the device never handles the
	3-legged handshake or an embedded browser.

	The server's address is editable here rather than baked in. On a TV
	"localhost:8080" was a stand-in for a machine on the same network; on a
	TouchPad it would resolve to the tablet itself, and the address changes
	often enough during development that repackaging to move it is a waste.
	It persists, so it only has to be typed once.
*/
enyo.kind({
	name: "LoginPanel",
	kind: enyo.VFlexBox,
	className: "wumblr-login",

	events: {
		onAuthenticate: ""
	},

	components: [
		{kind: "Header", content: "wumblr"},
		{kind: "Scroller", flex: 1, components: [
			{className: "wumblr-login-body", components: [
				{content: "Log in to wumblr", className: "wumblr-login-title"},
				{
					className: "wumblr-login-help",
					content: "Open the wumblr login page on another device to get your code, then enter it below."
				},

				{kind: "RowGroup", caption: "Login code", components: [
					{name: "code", kind: "Input", hint: "Enter your code"}
				]},

				{kind: "RowGroup", caption: "Login server", components: [
					{name: "server", kind: "Input", hint: "http://192.168.1.10:8080", inputType: "url"}
				]},

				{name: "verify", kind: "Button", className: "wumblr-login-verify", caption: "Verify code", onclick: "verifyClick"},
				{name: "error", className: "wumblr-login-error", showing: false}
			]}
		]},

		/*
			Shown while a request is in flight.

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

	create: function () {
		this.inherited(arguments);
		this.refreshConfig();
	},

	// Called again once the store has hydrated: this panel is built before
	// db8 has answered, so the first read only sees the packaged default.
	refreshConfig: function () {
		this.$.server.setValue(window.wumblr.config.getLoginServer());
	},

	trim: function (value) {
		return String(value === null || value === undefined ? "" : value).replace(/^\s+|\s+$/g, "");
	},

	/*
		`message` names the phase, because verifying a code and then fetching
		the account are two round trips and the scrim stays up across both -
		leaving it on "Verifying code" through the second one would read as a
		stall.
	*/
	setBusy: function (busy, message) {
		this.busy = busy;
		this.$.verify.setCaption(busy ? "Verifying…" : "Verify code");
		this.$.verify.setDisabled(busy);
		this.$.code.setDisabled(busy);
		this.$.server.setDisabled(busy);

		// Only on the way in: the label is meaningless once hidden, and
		// rewriting it on every hide would clobber the phase just shown.
		if (busy) {
			this.$.busyLabel.setContent(message || "Verifying code…");
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

	verifyClick: function () {
		if (this.busy) return true;

		var code = this.trim(this.$.code.getValue());
		var server = this.trim(this.$.server.getValue());

		if (!code) {
			this.showError("Enter the code from the login page.");
			return true;
		}
		if (!server) {
			this.showError("Enter the address of your login server.");
			return true;
		}

		window.wumblr.config.setLoginServer(server);
		this.showError("");
		this.setBusy(true, "Verifying code…");

		var url = server.replace(/\/+$/, "") + "/wumblr/heresTheCode?code=" + encodeURIComponent(code);

		enyo.xhr.request({
			url: url,
			method: "GET",
			callback: enyo.bind(this, function (text, xhr) {
				var status = xhr ? xhr.status : 0;

				if (status === 404) {
					this.reportFailure("That code is invalid.");
					return;
				}
				if (status < 200 || status >= 300) {
					// status 0 is the usual shape of "server not running" or
					// "TLS handshake refused" on this platform.
					this.reportFailure(status === 0 ?
						"Could not reach the login server at " + server + "." :
						"Something went wrong verifying that code (" + status + ").");
					return;
				}

				var data = null;
				try {
					data = text ? enyo.json.parse(text) : null;
				} catch (e) {
					data = null;
				}

				if (!data || !data.accessToken || !data.tokenSecret) {
					this.reportFailure("The login server sent back an unexpected response.");
					return;
				}

				// Stay busy: the app still has to fetch the account before it
				// can show anything, and dropping the scrim in between would
				// flash the form back up for a moment.
				this.setBusy(true, "Signing in…");
				this.doAuthenticate({token: data.accessToken, tokenSecret: data.tokenSecret});
			})
		});

		return true;
	},

	//* Called by the app when the token the server handed back is rejected.
	reportFailure: function (message) {
		this.setBusy(false);
		this.showError(message);
	}
});
