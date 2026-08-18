/*
	Application root.

	Navigation is an enyo.SlidingPane: the nav list and the current
	destination are always on screen, and anything deeper - a blog, a photo -
	is pushed as another SlidingView that flies in from the right, leaves a
	peek strip of the panel underneath, and can be dragged away by its grab
	handle.

	The two push slots are fixed rather than created on demand because of a
	SlidingView rule that isn't obvious: shouldSlideHidden() reports true if
	*any previous sibling* is hidden, so a view whose predecessor is hidden
	can never be slid into place. Visible panels therefore have to form a
	contiguous prefix, which is exactly a navigation stack. Two slots covers
	every path this app has - blog, photo, or a photo opened from a blog.
*/
enyo.kind({
	name: "Wumblr",
	kind: enyo.VFlexBox,

	components: [
		{kind: "ApplicationEvents", onWindowActivated: "windowActivated"},

		// AppMenu wires itself to the system open/close events, so it only
		// has to be declared. Settings lives here rather than in the nav
		// list: it is app-level configuration, not a destination.
		{kind: "AppMenu", components: [
			{caption: "Settings", onclick: "openSettings"}
		]},

		{name: "login", kind: "LoginPanel", flex: 1, onAuthenticate: "authenticate"},

		{name: "sliding", kind: "SlidingPane", flex: 1, showing: false, onSlideComplete: "slideComplete", components: [
			{name: "navView", kind: "SlidingView", width: "230px", components: [
				{name: "nav", kind: "NavPanel", flex: 1, onSelectDestination: "destinationSelected"}
			]},

			{name: "mainView", kind: "SlidingView", flex: 1, edgeDragging: true, components: [
				{
					name: "main", kind: "MainPanel", flex: 1,
					onSelectBlog: "openBlog", onOpenMedia: "openMedia",
					onFollowingSynced: "followingSynced"
				}
			]},

			// Push slots. Content is created on demand; see pushPanel.
			{
				name: "stack1View", kind: "SlidingView", flex: 1, showing: false,
				peekWidth: 64, edgeDragging: true, dismissible: true
			},
			{
				// Peeks past stack1 rather than level with it, so going two
				// deep leaves a strip of each panel below it, not just one.
				name: "stack2View", kind: "SlidingView", flex: 1, showing: false,
				peekWidth: 128, edgeDragging: true, dismissible: true
			}
		]}
	],

	//* @protected
	profile: null,
	pendingToken: null,
	slotPanels: null,
	// Which push slots are open. Tracked here rather than read back off the
	// views, because SlidingView.getShowing() is not trustworthy for them -
	// see slideComplete.
	slotOpen: null,

	create: function () {
		// Before inherited(): creating the SlidingPane selects its first
		// view, which fires onSlideComplete synchronously - so slideComplete
		// can run before this constructor body would otherwise reach here.
		this.slotPanels = [null, null];
		this.slotOpen = [false, false];
		this.inherited(arguments);

		// db8 reads are asynchronous, so nothing stored is known yet - not
		// the token, not the login server. The scrim covers the gap rather
		// than briefly showing a login form that may be about to disappear.
		this.$.login.setBusy(true, "Starting…");
		window.wumblr.store.hydrate(enyo.bind(this, "storeReady"));
	},

	// Everything persisted is now in memory and reads synchronously.
	storeReady: function () {
		// Panels were built before the store had anything to give them.
		this.$.login.refreshConfig();

		var token = window.wumblr.prefs.get("token", null);
		var tokenSecret = window.wumblr.prefs.get("tokenSecret", null);

		if (token && tokenSecret) {
			window.wumblr.tumblr.configure(token, tokenSecret);
			this.$.login.setBusy(true, "Signing in…");
			this.loadProfile(true);
		} else {
			this.$.login.setBusy(false);
		}
	},

	username: function () {
		return (this.profile && this.profile.name) || "";
	},

	slots: function () {
		return [this.$.stack1View, this.$.stack2View];
	},

	// --- authentication ---------------------------------------------------

	authenticate: function (inSender, inEvent) {
		this.pendingToken = {token: inEvent.token, tokenSecret: inEvent.tokenSecret};
		window.wumblr.tumblr.configure(inEvent.token, inEvent.tokenSecret);
		this.loadProfile(false);
		return true;
	},

	loadProfile: function (fromStoredToken) {
		window.wumblr.tumblr.getUserInfo(enyo.bind(this, function (profile) {
			// Only persist a token once Tumblr has actually accepted it.
			if (this.pendingToken) {
				window.wumblr.prefs.set("token", this.pendingToken.token);
				window.wumblr.prefs.set("tokenSecret", this.pendingToken.tokenSecret);
				this.pendingToken = null;
			}

			this.profile = profile;
			this.$.main.setUsername(profile.name || "");
			// Drop the scrim before swapping views: it is a full-screen
			// singleton, so leaving it up would dim the app it reveals.
			this.$.login.setBusy(false);
			this.showMain();
		}), enyo.bind(this, function (err) {
			enyo.warn("Wumblr: could not load profile", err);
			window.wumblr.tumblr.reset();
			this.pendingToken = null;

			if (fromStoredToken) {
				// The stored token was rejected - drop it and start over.
				this.$.login.setBusy(false);
				window.wumblr.prefs.remove("token");
				window.wumblr.prefs.remove("tokenSecret");
			} else {
				this.$.login.reportFailure(err.message || "Could not sign in.");
			}
			this.showLogin();
		}));
	},

	signOut: function () {
		this.closeSlotsFrom(0);
		window.wumblr.tumblr.reset();
		// Caches belong to the account that was signed in, so they go too.
		window.wumblr.appCache.clear();
		window.wumblr.prefs.remove("token");
		window.wumblr.prefs.remove("tokenSecret");

		this.profile = null;
		this.$.main.setUsername("");
		this.$.nav.select("dashboard");
		this.$.main.showDestination("dashboard");
		this.showLogin();
		return true;
	},

	showLogin: function () {
		this.$.sliding.setShowing(false);
		this.$.login.setShowing(true);
	},

	showMain: function () {
		this.$.login.setShowing(false);
		this.$.sliding.setShowing(true);
		// The pane measured itself while it was hidden, so its views have no
		// usable widths yet.
		this.$.sliding.resize();
	},

	// --- navigation -------------------------------------------------------

	destinationSelected: function (inSender, inEvent) {
		this.closeSlotsFrom(0);
		this.$.main.showDestination(inEvent.destination);
		return true;
	},

	openBlog: function (inSender, inEvent) {
		var blogName = inEvent && inEvent.blogName;
		if (!blogName) return true;

		// Chaining blog to blog replaces the open blog panel rather than
		// stacking another one - the stack is two deep and a photo may still
		// need a slot.
		var existing = this.slotPanels[0];
		if (existing && existing.kindName === "BlogPanel") {
			this.closeSlotsFrom(1);
			existing.setUsername(this.username());
			existing.setBlogName(blogName);
			this.$.sliding.selectView(this.$.stack1View);
			return true;
		}

		this.pushPanel({
			kind: "BlogPanel",
			blogName: blogName,
			username: this.username(),
			onSelectBlog: "openBlog",
			onOpenMedia: "openMedia"
		});
		return true;
	},

	openMedia: function (inSender, inEvent) {
		if (!inEvent || !inEvent.src) return true;
		this.pushPanel({
			kind: "MediaPanel",
			media: inEvent
		});
		return true;
	},

	openSettings: function () {
		// Push rather than swap the main panel: Settings is opened from the
		// app menu at any point, so it should lay over whatever is on screen
		// and be dismissed by its grab handle, leaving the feed as it was.
		this.pushPanel({
			kind: "SettingsPanel",
			profile: this.profile,
			onRebuildBlogs: "rebuildFollowing",
			onSignOut: "signOut"
		});
		return true;
	},

	rebuildFollowing: function (inSender) {
		inSender.setSyncing(true);
		this.$.main.rebuildFollowing();
		return true;
	},

	followingSynced: function () {
		// The Settings panel may well have been dismissed by the time the
		// sync lands, so this reaches for it rather than assuming it.
		for (var i = 0; i < this.slotPanels.length; i++) {
			var panel = this.slotPanels[i];
			if (panel && panel.kindName === "SettingsPanel") {
				panel.setSyncing(false);
			}
		}
		return true;
	},

	pushPanel: function (config) {
		var slots = this.slots();
		var index = 0;
		while (index < slots.length && this.slotOpen[index]) {
			index++;
		}
		// Stack full: replace what is on top rather than growing.
		if (index === slots.length) {
			index = slots.length - 1;
		}

		var slot = slots[index];
		this.destroySlotPanel(index);

		config.flex = 1;
		this.slotPanels[index] = slot.createComponent(config, {owner: this});
		slot.render();
		// setShowing on a rendered SlidingView parks it off the right edge
		// and animates it in - this is the fly-in.
		this.slotOpen[index] = true;
		slot.setShowing(true);
		this.$.sliding.selectView(slot);
		return this.slotPanels[index];
	},

	closeSlotsFrom: function (index) {
		var slots = this.slots();
		for (var i = slots.length - 1; i >= index; i--) {
			if (this.slotOpen[i]) {
				this.slotOpen[i] = false;
				// Slides out to the right; slideComplete does the cleanup
				// once it has actually left the screen.
				slots[i].setShowing(false);
			} else {
				this.destroySlotPanel(i);
			}
		}
		// Selection has to move to something still on screen, or the pane
		// keeps sliding toward a panel that is on its way out.
		//
		// Back at the base that means selecting the nav panel, not the main
		// one: selecting a view slides it to its own left edge, so selecting
		// main would slide it over the nav list and leave the destinations
		// unreachable. With nav selected the two sit side by side, which is
		// the layout this app wants whenever nothing is pushed.
		var target = index === 0 ? this.$.navView : slots[index - 1];
		this.$.sliding.selectView(target);
	},

	destroySlotPanel: function (index) {
		if (!this.slotPanels) return;
		var panel = this.slotPanels[index];
		if (!panel) return;
		if (panel.stop) panel.stop();
		panel.destroy();
		this.slotPanels[index] = null;
	},

	/*
		Fires after any slide settles, including one the user finished by
		flinging a dismissible panel away.

		This is also where a closed panel is reconciled with the DOM.
		SlidingView hides by sliding off-screen and deliberately does *not*
		set display:none - but DomNode.getShowing() recomputes `showing` from
		domStyles.display and assigns it back, so a slid-away panel reports
		itself visible again the moment anything asks. Forcing display:none
		once the slide has finished makes the two agree; the normal
		setShowing(true) path restores the display style on the way back in.
	*/
	slideComplete: function () {
		var slots = this.slots();
		var closed = false;

		for (var i = 0; i < slots.length; i++) {
			// A panel flung away by the user is hidden by SlidingPane itself,
			// so adopt that here rather than only tracking our own closes.
			// Read the raw property - getShowing() would rewrite it.
			if (this.slotOpen[i] && slots[i].showing === false) {
				this.slotOpen[i] = false;
			}
			// Keep the open panels a contiguous prefix: a SlidingView whose
			// predecessor is hidden can never be slid back into view.
			if (closed) {
				this.slotOpen[i] = false;
			}
			if (!this.slotOpen[i]) {
				closed = true;
				// Assign the property directly rather than via setShowing:
				// the setter would kick off another slide and re-enter here.
				slots[i].showing = false;
				slots[i].applyStyle("display", "none");
				this.destroySlotPanel(i);
			}
		}
		return true;
	},

	windowActivated: function () {
		// Coming back from the card view can leave the pane sized for the
		// previous orientation.
		if (this.$.sliding.getShowing()) {
			this.$.sliding.resize();
		}
		return true;
	}
});
