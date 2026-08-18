/*
	The leftmost panel: the app's destinations.

	Structured after the Photos app's LibraryNavigationPanel: the primary
	destination on its own, then a captioned Divider introducing the grouped
	ones. Rows are Item-based with a tap highlight and an explicit selected
	state, as LibraryNavigationItem does it.

	The header stays a plain start-aligned Header rather than Photos' centred
	panel header - it reads as the app title here, not as a column label.

	Two things deliberately aren't here. A blog drill-down is a pushed panel
	rather than a destination, so opening one leaves whichever destination it
	came from still highlighted. Settings lives in the app menu, which is
	where webOS puts app-level preferences.
*/
enyo.kind({
	name: "NavPanel",
	kind: enyo.VFlexBox,
	className: "wumblr-nav",

	events: {
		onSelectDestination: ""
	},

	components: [
		{kind: "Header", content: "wumblr"},

		{kind: "Scroller", flex: 1, components: [
			{name: "primary", components: [
				{kind: "NavPanel.Item", destination: "dashboard", caption: "Dashboard", onItemSelected: "itemSelected"}
			]},

			{kind: "Divider", caption: "MY TUMBLR", className: "wumblr-nav-divider"},

			{name: "group", components: [
				{kind: "NavPanel.Item", destination: "ownBlog", caption: "My Blog", onItemSelected: "itemSelected"},
				{kind: "NavPanel.Item", destination: "likes", caption: "Likes", onItemSelected: "itemSelected"},
				{kind: "NavPanel.Item", destination: "following", caption: "Following", onItemSelected: "itemSelected"}
			]}
		]}
	],

	//* @protected
	selected: "dashboard",

	create: function () {
		this.inherited(arguments);
		this.updateSelection();
	},

	items: function () {
		return this.$.primary.getControls().concat(this.$.group.getControls());
	},

	itemSelected: function (inSender) {
		this.select(inSender.destination);
		this.doSelectDestination({destination: inSender.destination});
		return true;
	},

	select: function (destination) {
		this.selected = destination;
		this.updateSelection();
	},

	updateSelection: function () {
		var items = this.items();
		for (var i = 0; i < items.length; i++) {
			items[i].setSelected(items[i].destination === this.selected);
		}
	}
});

//* @protected
//* One destination row, after LibraryNavigationItem: an Item that lays its
//* caption out in a flex row and carries an explicit selected state.
enyo.kind({
	name: "NavPanel.Item",
	kind: "Item",
	className: "wumblr-nav-item",
	tapHighlight: true,
	layoutKind: enyo.VFlexLayout,

	published: {
		caption: "",
		selected: false
	},

	events: {
		onItemSelected: ""
	},

	chrome: [
		{
			kind: "HFlexBox", flex: 1, align: "center",
			className: "wumblr-nav-item-inner", onclick: "doItemSelected",
			components: [
				{name: "caption", flex: 1, className: "wumblr-nav-caption"}
			]
		}
	],

	create: function () {
		this.inherited(arguments);
		this.captionChanged();
		this.selectedChanged();
	},

	captionChanged: function () {
		this.$.caption.setContent(this.caption);
	},

	selectedChanged: function () {
		this.addRemoveClass("wumblr-nav-selected", this.selected);
	}
});
