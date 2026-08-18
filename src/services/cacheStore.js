import {db8} from './ls2';
import * as logger from '../utils/logger';

// Key/value cache persisted to webOS db8.
//
// db8 only exists inside the webOS webview, so there is a localStorage
// fallback - otherwise the app would have no caching at all in a browser
// (and none of this would be testable outside a TV). db8 is preferred
// whenever the service bridge answers.
const KIND_ID = 'com.achunt.wumblr:cache';
const LOCAL_PREFIX = 'wumblr.cache.';

let db8Usable = null; // null = not yet probed

const ensureKind = () => db8('putKind', {
	id: KIND_ID,
	owner: 'com.achunt.wumblr',
	indexes: [{name: 'key', props: [{name: 'key'}]}],
	schema: {
		id: KIND_ID,
		type: 'object',
		properties: {
			_kind: {type: 'string', value: KIND_ID},
			key: {type: 'string'},
			value: {type: 'string'}
		}
	}
});

const probeDb8 = async () => {
	if (db8Usable !== null) return db8Usable;
	try {
		await ensureKind();
		db8Usable = true;
	} catch (err) {
		logger.warn('cacheStore: db8 unavailable, using localStorage', err);
		db8Usable = false;
	}
	return db8Usable;
};

const localRead = (key) => {
	try {
		const raw = window.localStorage.getItem(LOCAL_PREFIX + key);
		return raw ? JSON.parse(raw) : null;
	} catch (err) {
		logger.warn('cacheStore: local read failed', err);
		return null;
	}
};

const localWrite = (key, value) => {
	try {
		window.localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(value));
	} catch (err) {
		logger.warn('cacheStore: local write failed', err);
	}
};

async function read (key) {
	if (await probeDb8()) {
		try {
			const res = await db8('find', {
				query: {from: KIND_ID, where: [{prop: 'key', op: '=', val: key}]}
			});
			const record = res.results && res.results[0];
			return record ? JSON.parse(record.value) : null;
		} catch (err) {
			logger.warn('cacheStore: db8 read failed', err);
			return null;
		}
	}
	return localRead(key);
}

async function write (key, value) {
	if (await probeDb8()) {
		try {
			// Replace rather than merge: the stored value is a whole
			// serialised blob, so there is nothing to merge field-wise.
			await db8('del', {
				query: {from: KIND_ID, where: [{prop: 'key', op: '=', val: key}]}
			});
			await db8('put', {
				objects: [{_kind: KIND_ID, key, value: JSON.stringify(value)}]
			});
			return;
		} catch (err) {
			logger.warn('cacheStore: db8 write failed', err);
			return;
		}
	}
	localWrite(key, value);
}

// Called on sign-out so the next account never inherits this one's caches.
async function clearAll (keys) {
	if (await probeDb8()) {
		try {
			await db8('del', {query: {from: KIND_ID}});
			return;
		} catch (err) {
			logger.warn('cacheStore: db8 clear failed', err);
			return;
		}
	}
	keys.forEach((key) => {
		try {
			window.localStorage.removeItem(LOCAL_PREFIX + key);
		} catch (err) {
			logger.warn('cacheStore: local clear failed', err);
		}
	});
}

export {clearAll, read, write};
