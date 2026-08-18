# Release notes

## 1.0.0 — Browsing, navigation and account management

The first release where wumblr is a usable Tumblr client rather than a
proof of concept. The previous build could show a dashboard; this one lets
you move around Tumblr, act on posts, and manage the signed-in account.

### Browsing

- **Dashboard, My Blog, Likes and Following** are now separate destinations
  in a vertical tab rail down the left edge — TVs are wide and short, and a
  left rail is always one **Left** press away instead of a scroll back to
  the top.
- **Open any blog from anywhere.** Blog names are selectable on posts *and*
  inside reblog chains, so you can follow a conversation back to its
  source. The header names the blog you're on, with **Back** returning to
  the tab you came from.
- **Following list** loads in full (a few hundred blogs in under two
  seconds) with a search box that matches on blog name or title.
- **Load more** paging on the dashboard, blog and likes feeds.

### Posts

- **Full-screen media viewer** — select any photo, GIF or video, including
  media embedded inside a reblog, to open it large. Works with a pointer
  and with the 5-way pad.
- **Like and Reblog** show their current state on arrival: already-liked
  posts show a filled red heart and read "Liked".
- A brief flourish plays on the icon when an action is confirmed by the
  server — not merely when the button is pressed.
- **Follow / Unfollow** any blog you're viewing, from the header, with the
  current follow state shown.

### Account

- **Settings** panel, opened from the gear in the header: the signed-in
  blog with its avatar, how many blogs you follow, a **Refresh blogs**
  action, and **Sign out** (confirmed first, since signing back in needs a
  fresh code from another device).
- Signing out clears the stored credentials and all cached data.

### Under the hood

- Post feeds, the following list, and credentials are cached on-device
  (webOS db8), so returning to a tab is instant.
- Refreshing the following list reads only as far as the first blog it
  already knows about — normally one request instead of twenty.
- All user-facing text goes through Enact's `$L`, so the app can be
  localised.

### Fixed

- Reblogging failed entirely. Tumblr retired the endpoint the app was
  calling; reblogs now go through the current post-creation API.
- Post IDs are 64-bit and exceeded JavaScript's safe integer range, which
  could corrupt the ID sent with a like or reblog.
- Signing out left the stored token behind, so the app came back signed in.
- Reblogs went to a hard-coded blog rather than your own.
- Links inside posts navigated the whole app away from wumblr with no way
  back.
- Scrolling a long feed and then selecting something snapped the list back
  to the top.
- Moving the Magic Remote over the feed dragged the list around; only
  5-way navigation scrolls now.
- Images and GIFs rendered at wildly different sizes and could overflow
  their card; deeply nested reblogs marched off the right edge.
- White text on the lighter alternating card was too faint to read.

### Known limitations

- **Reblog state is per-device.** Tumblr's API reports whether you've liked
  a post but has no equivalent for reblogs, so "Reblogged" reflects reblogs
  made from this TV only.
- **Signing in needs the companion server** (not part of this repo) reachable
  from the TV, and it must send CORS headers.
- **Not yet tested on TV hardware** — verified in the browser preview and
  against the live Tumblr API. The db8 storage path in particular only runs
  inside the webOS webview; elsewhere it falls back to browser storage.
- Unfollowing a blog from another device isn't picked up by a refresh; the
  entry lingers until the next sign-in.

---

## 0.0.1 — Initial build

Dashboard rendering and Tumblr OAuth sign-in.
