/* eslint-disable camelcase -- Tumblr's REST payloads and oauth-1.0a's
   options use snake_case; these identifiers are an external contract,
   not our naming choice. */
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

function configureClient (accessToken, accessTokenSecret) {
	oauth = OAuth({
		consumer: {key: consumerKey, secret: consumerSecret},
		signature_method: 'HMAC-SHA1',
		hash_function: (baseString, key) => CryptoJS.HmacSHA1(baseString, key).toString(CryptoJS.enc.Base64)
	});
	token = {key: accessToken, secret: accessTokenSecret};
}

function resetClient () {
	oauth = null;
	token = null;
}

const requireAuth = () => {
	if (!oauth || !token) {
		throw new Error('tumblrClient: configureClient() must be called before use');
	}
	return {oauth, token};
};

async function request (method, path, data = {}) {
	const {oauth: signer, token: authToken} = requireAuth();
	const url = `${API_BASE}${path}`;

	let fetchUrl = url;
	let body;
	let headers;
	if (method === 'GET') {
		// Signature covers the query params (Tumblr's official SDK includes
		// them in the URL it signs for GET requests).
		const query = new URLSearchParams(data).toString();
		if (query) fetchUrl += `?${query}`;
		headers = signer.toHeader(signer.authorize({url: fetchUrl, method}, authToken));
	} else {
		// Tumblr's official SDK signs only the URL + method for writes and
		// sends the params as a JSON body, not as part of the OAuth1
		// signature base string - matching that here rather than the
		// stricter RFC5849 body-signing convention.
		headers = signer.toHeader(signer.authorize({url, method}, authToken));
		headers['Content-Type'] = 'application/json';
		body = JSON.stringify(data);
	}

	const response = await fetch(fetchUrl, {method, headers, body});
	const json = await response.json();
	if (!response.ok) {
		throw new Error((json && json.meta && json.meta.msg) || `Tumblr API request failed (${response.status})`);
	}
	return json.response;
}

// Normalised profile rather than the raw payload: the counts worth showing
// are split across two levels - likes/following belong to the account,
// followers/posts to a blog - and an account can own several blogs, so the
// primary one is the identity the app acts as (reblogs land there).
async function getUserInfo () {
	const data = await request('GET', '/user/info');
	const user = data.user || {};
	const blogs = user.blogs || [];
	const primary = blogs.find((blog) => blog.primary) || blogs[0] || {};
	return {
		name: user.name,
		likes: user.likes,
		following: user.following,
		followers: primary.followers,
		posts: primary.posts
	};
}

async function getDashboard ({limit = 20, offset = 0} = {}) {
	const data = await request('GET', '/user/dashboard', {limit, offset});
	return data.posts;
}

async function getBlogPosts (blogName, {limit = 20, offset = 0} = {}) {
	const data = await request('GET', `/blog/${blogIdentifier(blogName)}/posts`, {limit, offset});
	return data.posts;
}

async function getLikes ({limit = 20, offset = 0} = {}) {
	const data = await request('GET', '/user/likes', {limit, offset});
	return data.liked_posts;
}

// Returns blogs, not posts: {name, title, description, url, uuid}.
//
// This endpoint pages unlike the others: it ignores `limit` (asking for 20
// or 50 both yield ~12), and the next offset is NOT the number of blogs
// returned - it can hand back 12 while advancing the cursor by 38. Paging
// therefore has to follow the server's own `_links.next` cursor; deriving
// the offset from the item count re-reads overlapping windows and never
// reaches the end.
//
// `total_blogs` also overcounts what is actually retrievable (it reported
// 745 while a full traversal yielded 247 blogs), presumably counting
// follows of blogs that no longer serve data, so it isn't a usable
// completion signal either.
async function getFollowing ({offset = 0} = {}) {
	const data = await request('GET', '/user/following', {offset});
	const next = data._links && data._links.next && data._links.next.query_params;
	return {
		blogs: data.blogs || [],
		nextOffset: next && next.offset != null ? Number(next.offset) : null
	};
}

// The avatar endpoint is a public redirect to the image, so it can be used
// directly as an <img> src without signing the request.
const blogAvatarUrl = (blogName, size = 128) => (
	`${API_BASE}/blog/${blogIdentifier(blogName)}/avatar/${size}`
);

async function likePost (id, reblogKey) {
	return request('POST', '/user/like', {id, reblog_key: reblogKey});
}

async function unlikePost (id, reblogKey) {
	return request('POST', '/user/unlike', {id, reblog_key: reblogKey});
}

// The legacy /post/reblog endpoint 404s on current Tumblr - reblogging now
// goes through the NPF post-creation endpoint instead, identifying the
// source post by its parent blog's UUID rather than by name.
// Follow state is not exposed by /blog/{blog}/info, and /followed_by only
// answers the reverse question for blogs you own. It does ride along on the
// posts themselves though (every post carries `followed` for its blog), so
// the app reads it from the feed rather than making a separate request.
async function followBlog (blogName) {
	return request('POST', '/user/follow', {url: `https://${blogIdentifier(blogName)}/`});
}

async function unfollowBlog (blogName) {
	return request('POST', '/user/unfollow', {url: `https://${blogIdentifier(blogName)}/`});
}

async function reblogPost (blogName, {parentPostId, parentTumblelogUuid, reblogKey}) {
	return request('POST', `/blog/${blogIdentifier(blogName)}/posts`, {
		content: [],
		parent_post_id: parentPostId,
		parent_tumblelog_uuid: parentTumblelogUuid,
		reblog_key: reblogKey
	});
}

export {
	blogAvatarUrl,
	configureClient,
	followBlog,
	getBlogPosts,
	getDashboard,
	getFollowing,
	getLikes,
	getUserInfo,
	likePost,
	reblogPost,
	resetClient,
	unfollowBlog,
	unlikePost
};
