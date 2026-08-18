import $L, {toIString} from '@enact/i18n/$L';

// $L looks a string up for the current locale; ilib's IString then does the
// substitution. Going through format() rather than concatenating fragments
// keeps placeholder order in the translator's hands - some locales need the
// count after the noun, or the blog name before the verb.
//
//   $LF('{count} blogs', {count: 12})
const $LF = (text, values) => String(toIString($L(text)).format(values));

export {$L, $LF};
