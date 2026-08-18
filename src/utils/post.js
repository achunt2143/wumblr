// Post IDs are 64-bit and can exceed Number.MAX_SAFE_INTEGER; Tumblr sends
// id_string alongside id specifically so callers can avoid the precision
// loss of treating it as a JS number.
const postId = (post) => post.id_string || String(post.id);

export {postId};
