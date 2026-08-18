import LS2Request from '@enact/webos/LS2Request';

// Promise wrapper around LS2Request, shared by everything that talks to
// db8. Outside the webOS webview there is no service bridge at all, so
// callers get a rejection and fall back to their own storage.
const send = (options) => new Promise((resolve, reject) => {
	new LS2Request().send({
		...options,
		onSuccess: resolve,
		onFailure: reject
	});
});

const db8 = (method, parameters) => send({
	service: 'luna://com.palm.db/',
	method,
	parameters
});

export {db8, send};
