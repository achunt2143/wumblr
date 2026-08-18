# wumblr — HP webOS (TouchPad)

A port of the Enact/Sandstone LG webOS app in `../src` to **original Palm/HP
webOS**, targeting the TouchPad (webOS 3.0.x, Enyo 1).

The Enact version is untouched; this is a parallel target, not a replacement.

## Requirements

- HP webOS SDK (`palm-package`, `palm-install`, `novacom`) — the SDK also
  supplies the Enyo 1 framework used by the desktop harness below.
- A TouchPad in **Developer Mode**, connected over USB.
- The TouchPad needs the community **modern TLS update**; `api.tumblr.com`
  requires TLS 1.2+, which the 2011 stack cannot negotiate on its own.

## Setup

Copy the keys file and fill it in — it is gitignored:

```bash
cp webos/source/Keys.example.js webos/source/Keys.js
```

`consumerKey`/`consumerSecret` come from an app registered at
[tumblr.com/oauth/apps](https://www.tumblr.com/oauth/apps). They have to be on
the device because the app signs every API request itself; only the
code-for-token exchange happens on the companion server.

`loginServer` is that companion server's base URL. It can also be set on the
device from **Settings → Login server** (and on the login screen), which is
easier than repackaging while the server moves around.

`Keys.js` is the default and takes precedence: an address typed on the device
sticks only until this file changes, and a build carrying a new `loginServer`
retires it. Editing here is therefore always enough to move the server. See
`source/services/Config.js`.

## Build, install, run

```bash
palm-package webos && palm-install -d usb com.achunt.wumblr_1.0.0_all.ipk && palm-launch -d usb com.achunt.wumblr
```

Reading the device log (the app has no inspector):

```bash
novacom -d usb run file://usr/bin/tail -- -n 200 /var/log/messages
```

## Desktop harness

The TouchPad has no web inspector and no screenshot tool, so on-device
debugging is mostly guesswork. `tools/preview.js` serves this app against the
**same Enyo 1 framework** the device runs, from the SDK:

```bash
node webos/tools/preview.js
```

Then open <http://localhost:8899/>. Real stack traces, a real DOM. Two
caveats: `PalmSystem` doesn't exist, so Luna-backed things are inert; and
Enyo animations run on `requestAnimationFrame`, which browsers freeze in a
background tab — panel slides look stuck unless the tab is visible.

## Navigation model

Navigation is an `enyo.SlidingPane`. Each page is a `SlidingView` with a
`GrabButton` in its toolbar, `edgeDragging` on, and — for pushed panels —
`dismissible`, so it flies in from the right, leaves a peek strip of the panel
underneath, and can be dragged away.

Pushed panels carry no close button: the grab handle is how a webOS panel is
dismissed, so a button beside it would only be a second way to do the same
thing.

The nav panel follows the Photos app's `LibraryNavigationPanel` — the primary
destination on its own, then a captioned `Divider` introducing the grouped
ones:

```
Dashboard
── MY TUMBLR ──
My Blog
Likes
Following
```

Settings is not a destination. It opens from the **app menu** (tap the top-left
of the status bar), which is where webOS puts app-level preferences, and it
arrives as a pushed panel over whatever is on screen rather than replacing the
feed.

```
navView (230px) │ mainView │ stack1View │ stack2View
   destinations   the current   ── pushed pages ──
                  destination
```

Layout at each depth on a 1024px screen:

| State | nav | main | stack1 | stack2 |
|---|---|---|---|---|
| base | 0–230 | 230–1024 | — | — |
| blog open | covered | 0–397 (peek 0–64) | 64–1024 | — |
| photo over blog | covered | peek 0–64 | peek 64–128 | 128–1024 |

**Why two fixed slots rather than an unbounded stack.**
`SlidingView.shouldSlideHidden()` returns true when *any previous sibling* is
hidden, so a view whose predecessor is hidden can never be slid into view.
Visible panels must therefore form a contiguous prefix — which is exactly a
navigation stack. Two slots covers every path this app has: a blog, a photo,
or a photo opened from a blog. Content is created on push and destroyed on
close.

**One framework trap worth knowing.** `DomNode.getShowing()` recomputes
`showing` from `domStyles.display` *and assigns it back*. `SlidingView` hides
by sliding off-screen without setting `display: none`, so a closed panel
reports itself visible again the moment anything calls `getShowing()`.
`Wumblr.js` therefore tracks slot state in `slotOpen` and reconciles the
display style in `slideComplete`.

**A second one, in the same family.** `enyo.scrim` is a singleton that
renders into the popup layer, whose node *is* `document.body` — so once this
app renders into the body the scrim node ends up detached and nothing dims.
The busy overlay in `LoginPanel.js` therefore owns its own `Scrim` component,
which is created and torn down with the panel.

**And a third.** `Popup` extends `LazyControl`, so anything derived from it —
`AppMenu`, `Dialog`, `ModalDialog` — does not build its children until it is
first opened. Reaching into `$.something` inside a popup before then finds
nothing there. `SettingsPanel` calls `validateComponents()` before filling in
the sign-out dialog, because it populates the text *then* opens.

## Animated media

Nothing animated plays in the feed. GIFs and `<video>` elements are replaced
with tappable stubs by `PostItem.deferAnimatedMedia`, and the real file is
only fetched when the stub is opened in the media panel — where autoplay is
kept, since that is the one thing on screen.

A screenful of GIFs decoding at once is more than the TouchPad handles
gracefully, and the saving only counts if nothing is fetched: the swap
therefore happens on the HTML string *before* it reaches the DOM, because an
`<img>` starts downloading and animating the moment it is parsed. Stripping
the attribute afterwards would be too late.

Static images are untouched — they cost one decode and then sit there.
`<iframe>` embeds are also left alone, so a post carrying one still pays for
it.

## Storage

Everything persists to **db8**, in three kinds:

| Kind | Holds |
|---|---|
| `com.achunt.wumblr.prefs:1` | one record per setting — token, login server |
| `com.achunt.wumblr.reblog:1` | one record per reblogged post |
| `com.achunt.wumblr.blog:1` | one record per followed blog |

The kinds are registered with `putKind` at launch; the first one doubles as
the probe. Off-device there is no service bus, so the same data falls back to
`localStorage` and the app behaves identically — which is what keeps the
desktop harness usable.

The awkward part is that db8 reads are asynchronous while the UI needs answers
during render — a post row decides its reblog state while it is drawing.
So everything is read into memory once at launch (`hydrate`) and served
synchronously from there; writes go to db8 in the background. The app waits
behind the scrim until that finishes, which is also why `LoginPanel` has a
`refreshConfig` — it is built before the store can answer.

### The following list is the one that matters

`/user/following` pages badly and a cold walk costs ~21 requests, which is
enough to get rate limited. So the list is never fetched on its own: opening
the Following destination reads db8 and makes **no** requests at all.

Syncing is an explicit act: **Rebuild** in the Manage group in Settings, and
nothing else. It re-reads every page and replaces the cached list.

There was briefly a cheap delta sync alongside it, stopping at the first blog
it recognised. It was dropped — two buttons doing almost the same thing is
worse than one that is simply correct, and a delta can never notice a blog
unfollowed elsewhere, so the full read had to exist regardless.

Each Manage row states what it does and carries the button that does it. The
row itself is not a tap target: it gives nothing to aim at and no affordance
saying it is live.

Because nothing fetches automatically, an empty list is ambiguous — it could
mean "you follow nobody" or "this has never been fetched". A `followingSynced`
pref tells those apart so the empty state can say which, and point at the
button.

Losing the cache is therefore expensive, not just slow.

Two rules follow from that, both in `Store.js`:

- A delta sync **appends** (`addFollowedBlogs`) rather than replacing. It
  usually finds nothing new, and rewriting ~250 records to absorb none is
  pure churn. Only a full sync calls `setFollowing`.
- `setFollowing` chains its `put` onto the completion of its `del`. They are
  independent Luna calls with no ordering guarantee, so firing both at once
  can land the put first and have the del wipe what it just wrote — emptying
  the cache and sending the next sync back through every page.

Data written by the earlier localStorage-only build is migrated on first
launch, so upgrading does not sign you out or discard a following list that
costs ~21 requests to rebuild. The local copies are dropped on a *later*
launch, once db8 has been seen to hold the data — leaving them would keep the
access token outside the encrypted partition.

## What changed from the Enact version

Same feature set, same Tumblr API behaviour (including the awkward
`/user/following` cursor paging and the NPF reblog endpoint). The platform
differences:

| Enact / LG webOS | Here |
|---|---|
| React + Sandstone | Enyo 1 kinds |
| `Panels` + vertical `TabLayout` | `SlidingPane` + nav panel |
| Popups (media, settings) | Pushed panels; Settings opens from the app menu |
| `fetch` + Promises | `enyo.xhr` + callbacks |
| `crypto-js` + `oauth-1.0a` | `source/lib/Sha1.js`, `source/lib/OAuth1.js` |
| db8 via `LS2Request` | db8 via `services/Store.js` (localStorage only as an off-device fallback) |
| ES2015+, JSX | ES5 only — no `let`/`const`, arrow functions, template literals, `Promise`, `Set`, or `Function.prototype.bind` |

`Sha1.js` and `OAuth1.js` are dependency-free rewrites, verified against
Node's `crypto` (139 HMAC cases) and the published Twitter OAuth1 signature
test vector.

`$L`/ilib localisation was dropped: the Enact build had the scaffolding but
no actual translations, so strings are plain English here rather than carrying
an unused indirection layer.

## Not verified

The login flow is **untested end to end** — it needs the companion server,
which was not running. What is implemented is the same exchange the Enact app
performed: `GET {loginServer}/wumblr/heresTheCode?code=…` expecting
`{accessToken, tokenSecret}` back. Everything downstream of a token (feeds,
likes, reblogs, follow, following list) was exercised against a stubbed client
in the harness, not against live Tumblr.
