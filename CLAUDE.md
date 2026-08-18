# wumblr — webOS Project

This repo holds **two** builds of the same Tumblr client:

- `src/` — the original **LG webOS** (modern) app: React + Enact/Sandstone, built with `enact pack`.
- `webos/` — a port to **Palm/HP webOS** (original 2009–2012 platform): Enyo 1, targeting the TouchPad.

They are parallel targets. Changing one does not imply changing the other, so
be explicit about which is in scope. Most "webOS" requests in this repo mean
the legacy port.

## Session Setup

When working in `webos/`, load the full legacy platform context first:

```
webos://knowledge/all
```

This gives you the Mojo/Enyo frameworks, Luna service bus, SDK tools
(including novacom), app structure conventions, and common gotchas.

---

## Legacy port (`webos/`)

**App ID:** `com.achunt.wumblr`
**Framework:** Enyo 1 (`/usr/palm/frameworks/enyo/1.0` on device)
**Target device:** HP TouchPad (`topaz`), connected over USB
**webOS version:** 3.0.x

See `webos/README.md` for the navigation model, the two SlidingView traps that
shaped it, and what is and isn't verified.

### Hard constraints

- **ES5 only.** No `let`/`const`, arrow functions, template literals,
  `Promise`, `Set`, `Map`, or `Function.prototype.bind`. Use `enyo.bind`.
- Every new file must be listed in `webos/depends.js` or it silently never
  loads.
- `webos/source/Keys.js` is gitignored; copy it from `Keys.example.js`.
- The device needs the community modern TLS update to reach `api.tumblr.com`.

### Debugging

The TouchPad has no web inspector and no screenshot tool. Prefer the desktop
harness, which runs the app against the SDK's copy of the same Enyo 1
framework:

```bash
node webos/tools/preview.js     # http://localhost:8899/
```

Note that Enyo animations are driven by `requestAnimationFrame`, which
browsers freeze in a background tab — panel slides look stuck unless the tab
is visible. Drive them to their end state manually when asserting geometry.

Device-side, the only signal is the system log:

```bash
novacom -d usb run file://usr/bin/tail -- -n 200 /var/log/messages
```

### Useful commands

```bash
palm-package webos && palm-install -d usb com.achunt.wumblr_1.0.0_all.ipk && palm-launch -d usb com.achunt.wumblr
```

---

## Modern app (`src/`)

Enact/Sandstone for LG webOS TVs. `npm run serve`, `npm run pack-p`,
`npm run lint`. Tumblr keys live in `src/config/tumblrKeys.js` (gitignored).

## Shared background

Both builds talk to the same Tumblr REST API and both depend on a companion
login server (outside this repo) that exchanges a short code for an OAuth1
access token. The consumer secret ships with the client in both cases because
the client signs its own API requests.
