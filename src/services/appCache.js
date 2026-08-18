import * as cacheStore from './cacheStore';

// Session-scoped caches, hydrated once at sign-in and persisted through
// cacheStore (db8 on webOS, localStorage elsewhere).
//
// Reads are synchronous against in-memory copies because they happen during
// render - a post can't await its own reblog state. Writes persist in the
// background.
const REBLOGGED_KEY = 'reblogged';
const FOLLOWING_KEY = 'following';
const ALL_KEYS = [REBLOGGED_KEY, FOLLOWING_KEY];

let reblogged = new Set();
let following = [];

async function hydrate () {
	const [storedReblogs, storedFollowing] = await Promise.all([
		cacheStore.read(REBLOGGED_KEY),
		cacheStore.read(FOLLOWING_KEY)
	]);
	reblogged = new Set(Array.isArray(storedReblogs) ? storedReblogs : []);
	following = Array.isArray(storedFollowing) ? storedFollowing : [];
}

async function clear () {
	reblogged = new Set();
	following = [];
	await cacheStore.clearAll(ALL_KEYS);
}

const hasReblogged = (id) => reblogged.has(String(id));

function rememberReblog (id) {
	reblogged.add(String(id));
	cacheStore.write(REBLOGGED_KEY, [...reblogged]);
}

const getFollowing = () => following;

function setFollowing (blogs) {
	following = blogs;
	cacheStore.write(FOLLOWING_KEY, blogs);
}

// Keeps the cached list honest when the user follows/unfollows from inside
// the app, so it doesn't take a refresh to reflect their own action.
function addFollowedBlog (blog) {
	if (following.some((entry) => entry.name === blog.name)) return;
	setFollowing([blog, ...following]);
}

function removeFollowedBlog (blogName) {
	setFollowing(following.filter((entry) => entry.name !== blogName));
}

export {
	addFollowedBlog,
	clear,
	getFollowing,
	hasReblogged,
	hydrate,
	removeFollowedBlog,
	rememberReblog,
	setFollowing
};
