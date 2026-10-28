// router.js — the tiny route matcher for the JSON API.
//
// Routes are declared as "METHOD /path/with/:params" keys on a plain object.
// A literal segment always beats a :param at the same position, so
// "POST /api/researchers/scout" wins over "POST /api/researchers/:id" no matter
// which is declared first — reordering the route table can never silently
// change which handler runs.

/**
 * @returns {{handler: Function, params: Object, route: string}|null}
 *   `route` is the matched declaration, so a caller can log/trace what ran.
 */
export function matchRoute(routes, method, pathname) {
  const pathParts = pathname.split('/');
  let best = null;

  for (const [key, handler] of Object.entries(routes)) {
    const [routeMethod, pattern] = key.split(' ');
    if (routeMethod !== method) continue;

    const patternParts = pattern.split('/');
    if (patternParts.length !== pathParts.length) continue;

    const params = {};
    let literals = 0;
    let matches = true;
    for (let i = 0; i < patternParts.length && matches; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (patternParts[i] === pathParts[i]) {
        literals++;
      } else {
        matches = false;
      }
    }
    // most literal segments wins — the most specific route
    if (matches && (!best || literals > best.literals)) {
      best = { handler, params, route: key, literals };
    }
  }
  return best;
}
