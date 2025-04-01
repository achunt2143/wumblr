import CryptoJS from 'crypto-js';
import OAuth from 'oauth-1.0a';

import {consumerKey, consumerSecret} from '../config/tumblrKeys';

// A hand-rolled, fetch-based Tumblr REST client rather than the `tumblr.js`
// SDK: that package requires Node's `http`/`https`/`fs`/`crypto` modules
// directly, which webpack 5 refuses to bundle for the browser without deep
// polyfilling. OAuth1 signing here uses `oauth-1.0a` + `crypto-js`, both
// pure JS with no Node built-ins, which is the standard combo for
// client-side OAuth1.
const API_BASE = 'https://api.tumblr.com/v2';

let oauth = null;
let token = null;

const blogIdentifier = (blogName) => (blogName.includes('.') ? blogName : `${blogName}.tumblr.com`);

function configureClient(accessToken, accessTokenSecret) {
	oauth = OAuth({
		consumer: {key: consumerKey, secret: consumerSecret},
		signature_method: 'HMAC-SHA1',
		hash_function: (baseString, key) => CryptoJS.HmacSHA1(baseString, key).toString(CryptoJS.enc.Base64)
	});
	token = {key: accessToken, secret: accessTokenSecret};
}

function resetClient() {
	oauth = null;
	token = null;
}

const requireAuth = () => {
	if (!oauth || !token) {
		throw new Error('tumblrClient: configureClient() must be called before use');
	}
	return {oauth, token};
};

async function request(method, path, data = {}) {
	const {oauth: signer, token: authToken} = requireAuth();
	const url = `${API_BASE}${path}`;
	const headers = signer.toHeader(signer.authorize({url, method, data}, authToken));

	let fetchUrl = url;
	let body;
	const params = new URLSearchParams(data);
	if (method === 'GET') {
		const query = params.toString();
		if (query) fetchUrl += `?${query}`;
	} else {
		body = params.toString();
		headers['Content-Type'] = 'application/x-www-form-urlencoded';
	}

	const response = await fetch(fetchUrl, {method, headers, body});
	const json = await response.json();
	if (!response.ok) {
		throw new Error((json && json.meta && json.meta.msg) || `Tumblr API request failed (${response.status})`);
	}
	return json.response;
}

async function getUserInfo() {
	const data = await request('GET', '/user/info');
	return data.user;
}

async function getDashboard({limit = 20, offset = 0} = {}) {
	const data = await request('GET', '/user/dashboard', {limit, offset});
	return data.posts;
}

async function getBlogPosts(blogName, {limit = 20, offset = 0} = {}) {
	const data = await request('GET', `/blog/${blogIdentifier(blogName)}/posts`, {limit, offset});
	return data.posts;
}

async function likePost(id, reblogKey) {
	return request('POST', '/user/like', {id, reblog_key: reblogKey});
}

async function unlikePost(id, reblogKey) {
	return request('POST', '/user/unlike', {id, reblog_key: reblogKey});
}

async function reblogPost(blogName, {id, reblogKey}) {
	return request('POST', `/blog/${blogIdentifier(blogName)}/post/reblog`, {id, reblog_key: reblogKey});
}

export {configureClient, resetClient, getUserInfo, getDashboard, getBlogPosts, likePost, unlikePost, reblogPost};
