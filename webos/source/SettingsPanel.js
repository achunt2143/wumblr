/*
	Account summary and app actions.

	On the TV this was a right-hand Popup, because a popup was the only way
	to overlay a fullscreen app. Here it is a pushed panel opened from the app
	menu, which is where webOS puts app-level preferences - and being a panel
	it is dismissed by its grab handle like any other, instead of a popup
	competing with the sliding panels for touch.
*/
enyo.kind({
	name: "SettingsPanel",
	kind: enyo.VFlexBox,
	className: "wumblr-settings",

	published: {
		profile: null,
		//* True while the following list is being rebuilt.
		syncing: false
	},

	events: {
		onRebuildBlogs: "",
		onSignOut: ""
	},

	components: [
		{kind: "Header", content: "Settings"},

		{kind: "Scroller", flex: 1, components: [
			{className: "wumblr-settings-body", components: [

				{kind: enyo.HFlexBox, className: "wumblr-account", align: "center", components: [
					{name: "avatar", kind: "Image", className: "wumblr-account-avatar"},
					{kind: enyo.VFlexBox, flex: 1, components: [
						{name: "accountName", className: "wumblr-account-name"},
						{content: "Signed in", className: "wumblr-account-meta"}
					]}
				]},

				{kind: enyo.HFlexBox, className: "wumblr-stats", components: [
					{name: "followers", kind: "SettingsPanel.Stat", label: "Followers"},
					{name: "posts", kind: "SettingsPanel.Stat", label: "Posts"},
					{name: "following", kind: "SettingsPanel.Stat", label: "Following"},
					{name: "likes", kind: "SettingsPanel.Stat", label: "Likes"}
				]},

				/*
					Each row states what it does and carries the control that
					does it. Tapping anywhere on a row to fire an action gives
					nothing to aim at and no affordance saying it is tappable.
				*/
				{kind: "RowGroup", caption: "Manage", components: [
					{kind: "Item", components: [
						{kind: enyo.HFlexBox, className: "wumblr-manage-row", align: "center", components: [
							{flex: 1, className: "wumblr-manage-label", content: "Rebuild following list"},
							{name: "rebuild", kind: "Button", caption: "Rebuild", onclick: "rebuildClick"}
						]}
					]},
					{kind: "Item", components: [
						{kind: enyo.HFlexBox, className: "wumblr-manage-row", align: "center", components: [
							{flex: 1, className: "wumblr-manage-label", content: "End this session"},
							{
								name: "signOut", kind: "Button", className: "enyo-button-negative",
								caption: "Sign out", onclick: "signOutClick"
							}
						]}
					]}
				]},
				{
					className: "wumblr-settings-note",
					content: "The following list is only fetched when you rebuild it."
				}
			]}
		]},

		{kind: "Toolbar", components: [
			{kind: "GrabButton"}
		]},

		/*
			Both actions get a modal rather than firing on the tap: one costs
			a fresh code from another device, the other ~21 requests against
			an API that rate limits.

			Two dialogs rather than one shared: each carries its own caption
			and buttons declaratively, so there is no pending-action field to
			get out of step with what the dialog is currently asking.
		*/
		{name: "confirmRebuild", kind: "ModalDialog", caption: "Rebuild following list", components: [
			{
				className: "wumblr-confirm-text",
				content: "Re-read your following list? This is the only way to drop blogs you unfollowed elsewhere."
			},
			{
				layoutKind: "HFlexLayout", pack: "center",
				className: "wumblr-confirm-buttons",
				components: [
					{kind: "Button", caption: "Cancel", onclick: "cancelRebuild"},
					{kind: "Button", caption: "Rebuild", onclick: "acceptRebuild"}
				]
			}
		]},

		{name: "confirmSignOut", kind: "ModalDialog", caption: "Sign out", components: [
			{name: "signOutText", className: "wumblr-confirm-text"},
			{
				layoutKind: "HFlexLayout", pack: "center",
				className: "wumblr-confirm-buttons",
				components: [
					{kind: "Button", caption: "Cancel", onclick: "cancelSignOut"},
					{kind: "Button", className: "enyo-button-negative", caption: "Sign out", onclick: "acceptSignOut"}
				]
			}
		]}
	],

	create: function () {
		this.inherited(arguments);
		this.profileChanged();
		this.syncingChanged();
	},

	// Counts read better grouped with a separator than as raw digits.
	// toLocaleString is unreliable on this engine, so group by hand.
	group: function (value) {
		if (typeof value !== "number") return "—";
		var s = String(value);
		var out = "";
		var count = 0;
		for (var i = s.length - 1; i >= 0; i--) {
			out = s.charAt(i) + out;
			if (++count % 3 === 0 && i > 0) out = "," + out;
		}
		return out;
	},

	profileChanged: function () {
		var profile = this.profile || {};
		var name = profile.name || "";

		this.$.accountName.setContent(name || "unknown");
		this.$.avatar.setSrc(window.wumblr.tumblr.blogAvatarUrl(name || "tumblr", 128));
		this.$.followers.setValue(this.group(profile.followers));
		this.$.posts.setValue(this.group(profile.posts));
		this.$.following.setValue(this.group(profile.following));
		this.$.likes.setValue(this.group(profile.likes));
	},

	syncingChanged: function () {
		this.$.rebuild.setCaption(this.syncing ? "Rebuilding…" : "Rebuild");
		this.$.rebuild.setDisabled(this.syncing);
	},

	// openAtCenter rather than open: plain open() applies no bounds at all,
	// which leaves the dialog in the top-left corner.
	rebuildClick: function () {
		if (this.syncing) return true;
		this.$.confirmRebuild.openAtCenter();
		return true;
	},

	cancelRebuild: function () {
		this.$.confirmRebuild.close();
		return true;
	},

	acceptRebuild: function () {
		this.$.confirmRebuild.close();
		this.doRebuildBlogs();
		return true;
	},

	signOutClick: function () {
		var name = (this.profile && this.profile.name) || "unknown";

		// ModalDialog is a Popup, and Popup is a LazyControl: its children do
		// not exist until it is first shown. Build them before populating,
		// rather than opening and then writing into an empty dialog. Only
		// this one needs it - the rebuild dialog's text is static.
		this.$.confirmSignOut.validateComponents();
		this.$.signOutText.setContent(
			"Sign out of wumblr as " + name + "? You’ll need a new code to sign back in."
		);
		this.$.confirmSignOut.openAtCenter();
		return true;
	},

	cancelSignOut: function () {
		this.$.confirmSignOut.close();
		return true;
	},

	acceptSignOut: function () {
		this.$.confirmSignOut.close();
		this.doSignOut();
		return true;
	}
});

//* @protected
//* One labelled figure in the stats row.
enyo.kind({
	name: "SettingsPanel.Stat",
	kind: enyo.VFlexBox,
	className: "wumblr-stat",
	flex: 1,

	published: {
		label: "",
		value: "—"
	},

	components: [
		{name: "value", className: "wumblr-stat-value"},
		{name: "label", className: "wumblr-stat-label"}
	],

	create: function () {
		this.inherited(arguments);
		this.labelChanged();
		this.valueChanged();
	},

	labelChanged: function () {
		this.$.label.setContent(this.label);
	},

	valueChanged: function () {
		this.$.value.setContent(this.value);
	}
});
