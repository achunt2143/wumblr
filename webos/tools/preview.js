/*
	Runs the webOS app in a desktop browser against the real Enyo 1
	framework from the HP webOS SDK.

	The device is the only place this app truly runs, but it has no web
	inspector and no screenshot tool, so debugging there means guessing from
	/var/log/messages. Serving the same framework the TouchPad ships with
	gives real stack traces and a DOM to inspect, which catches the ordinary
	mistakes long before packaging.

	    node webos/tools/preview.js      # then open http://localhost:8899/

	Two caveats, both harmless:
	  - window.PalmSystem does not exist, so anything Luna-backed is inert.
	  - Enyo animations are driven by requestAnimationFrame, which browsers
	    freeze in a hidden/background tab. Panel slides will appear stuck
	    unless the tab is actually visible.
*/
var http = require("http");
var fs = require("fs");
var path = require("path");

var SDK = process.env.WEBOS_SDK || "C:\\Program Files (x86)\\HP webOS\\SDK";
var FRAMEWORK = path.join(SDK, "share", "framework", "enyo", "1.0", "framework");
var APP = path.resolve(__dirname, "..");
var PORT = Number(process.env.PORT) || 8899;

var TYPES = {
	".html": "text/html; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml"
};

// The app's real index.html loads enyo from /usr/palm/frameworks, which only
// exists on a device. Everything else is served verbatim.
var INDEX =
	'<!doctype html>\n<html>\n<head>\n\t<meta charset="utf-8">\n' +
	'\t<title>wumblr (desktop harness)</title>\n' +
	'\t<script src="/framework/enyo.js" type="text/javascript"></script>\n' +
	'</head>\n<body>\n<script type="text/javascript">\n' +
	'\twindow.onerror = function (m, u, l) { console.error("UNCAUGHT: " + m + " @ " + u + ":" + l); };\n' +
	'\tnew Wumblr().renderInto(document.body);\n' +
	'</script>\n</body>\n</html>\n';

function send (res, code, type, body) {
	res.writeHead(code, {"Content-Type": type});
	res.end(body);
}

function serveFile (res, root, rel) {
	var file = path.join(root, rel);
	if (file.indexOf(root) !== 0) {
		send(res, 403, "text/plain", "forbidden");
		return;
	}
	fs.readFile(file, function (err, data) {
		if (err) {
			send(res, 404, "text/plain", "not found: " + rel);
			return;
		}
		send(res, 200, TYPES[path.extname(file)] || "application/octet-stream", data);
	});
}

http.createServer(function (req, res) {
	var url = decodeURIComponent(req.url.split("?")[0]);

	if (url === "/" || url === "/index.html") {
		send(res, 200, TYPES[".html"], INDEX);
		return;
	}
	if (url.indexOf("/framework/") === 0) {
		serveFile(res, FRAMEWORK, url.slice("/framework/".length));
		return;
	}
	serveFile(res, APP, url.replace(/^\//, ""));
}).listen(PORT, function () {
	if (!fs.existsSync(path.join(FRAMEWORK, "enyo.js"))) {
		console.error("WARNING: no Enyo framework at " + FRAMEWORK);
		console.error("Set WEBOS_SDK to your HP webOS SDK install directory.");
	}
	console.log("wumblr webOS harness on http://localhost:" + PORT + "/");
});
