import LS2Request from '@enact/webos/LS2Request';

const KIND_ID = 'com.achunt.wumblr:userinfo';

const send = (options) => new Promise((resolve, reject) => {
	new LS2Request().send({
		...options,
		onSuccess: resolve,
		onFailure: reject
	});
});

const ensureKind = () => send({
	service: 'luna://com.palm.db/',
	method: 'putKind',
	parameters: {
		id: KIND_ID,
		owner: 'com.achunt.wumblr',
		schema: {
			id: KIND_ID,
			type: 'object',
			properties: {
				_kind: {type: 'string', value: KIND_ID},
				token: {type: 'string'},
				token_secret: {type: 'string'}
			}
		}
	}
});

// Reads the most recently stored token, if any. Resolves to `null` when
// none is found or when the LS2 bridge isn't available (e.g. in a plain
// browser preview outside of webOS), rather than rejecting.
async function getStoredToken() {
	try {
		const response = await send({
			service: 'luna://com.palm.db/',
			method: 'find',
			parameters: {
				query: {
					from: KIND_ID,
					select: ['token', 'token_secret'],
					desc: false
				}
			}
		});

		const record = response.results && response.results[response.results.length - 1];
		if (record && record.token) {
			return {token: record.token, tokenSecret: record.token_secret};
		}
	} catch (err) {
		console.warn('storage: getStoredToken failed', err);
	}

	return null;
}

async function saveToken(token, tokenSecret) {
	await ensureKind();
	await send({
		service: 'luna://com.palm.db/',
		method: 'put',
		parameters: {
			objects: [{
				_kind: KIND_ID,
				token,
				token_secret: tokenSecret
			}]
		}
	});
}

async function clearStoredToken() {
	try {
		const response = await send({
			service: 'luna://com.palm.db/',
			method: 'find',
			parameters: {query: {from: KIND_ID}}
		});
		const ids = (response.results || []).map((record) => record._id).filter(Boolean);
		if (ids.length > 0) {
			await send({
				service: 'luna://com.palm.db/',
				method: 'del',
				parameters: {ids}
			});
		}
	} catch (err) {
		console.warn('storage: clearStoredToken failed', err);
	}
}

export {getStoredToken, saveToken, clearStoredToken};
