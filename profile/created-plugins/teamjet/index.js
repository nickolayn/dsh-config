/**
 * Host half of the TeamJet board bundle.
 *
 * Like the hotel CRM board, this plugin is client-only: the page reads TeamJet
 * through the local bridge (`bridge/bridge.mjs` in the dsh-config repository),
 * because TeamJet authenticates through Keycloak and its API sends no CORS
 * headers. Credentials stay in the bridge configuration, never in the Web page.
 */
export function apply() {}
