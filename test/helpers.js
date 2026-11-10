'use strict';

/**
 * Replace global fetch with a stub that records each request and answers
 * with `body`. Returns { calls, restore }.
 */
function stubFetch(body) {
  const original = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), headers: options.headers || {} });
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(text, { status: 200 });
  };
  return { calls, restore: () => { global.fetch = original; } };
}

module.exports = { stubFetch };
