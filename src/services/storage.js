/* eslint-disable camelcase -- token_secret is the db8 record field name
   already written by earlier versions; renaming it would orphan stored
   credentials on existing installs. */
import {send} from './ls2';
import * as logger from '../utils/logger';

const KIND_ID = 'com.achunt.wumblr:userinfo';

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
async function getStoredToken () {
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
		logger.warn('storage: getStoredToken failed', err);
	}

	return null;
}

// Persisting the token is a convenience (so the next launch skips login),
// not a requirement for the current session, so a failure here (e.g. no
// LS2 bridge outside of webOS) shouldn't block a login that otherwise
// already succeeded against Tumblr's API.
async function saveToken (token, tokenSecret) {
	try {
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
	} catch (err) {
		logger.warn('storage: saveToken failed', err);
	}
}

async function clearStoredToken () {
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
		logger.warn('storage: clearStoredToken failed', err);
	}
}

export {getStoredToken, saveToken, clearStoredToken};
