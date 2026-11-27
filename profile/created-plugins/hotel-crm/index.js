/**
 * Host half of the hotel request board bundle.
 *
 * The plugin is client-only by design: the page reads the CRM through the local
 * bridge (`bridge/bridge.mjs` in the dsh-config repository) so that the browser
 * half never deals with CORS and no secret reaches the Web page. This module
 * exists so the bundle has a Host entry that the Loader can mount.
 */
export function apply() {}
