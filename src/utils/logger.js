/* eslint-disable no-console */
// One place for diagnostics, rather than console calls scattered through the
// app. Keeping them behind a module means they can be silenced, level-gated
// or routed to a webOS log service in a single edit - and it satisfies the
// no-console rule everywhere except here, where the exception is deliberate.

const warn = (...args) => console.warn(...args);

const error = (...args) => console.error(...args);

export {error, warn};
