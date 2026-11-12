// A copy of the corpus's `noErrorBroadcast` (tests/integration/harness/projects.ts), for a
// project's browser projects: M7 keeps its parts off the harness's project builder (plan A7).
import type { Plugin } from "vite";

/** The plugin's name, which a test finds it by. */
export const NO_ERROR_BROADCAST = "uf-testing:no-error-broadcast";

/**
 * Keeps a module that fails to compile from failing the specs after it. Its import fails its own
 * spec, and Vite logs the error. Vite also sends it to every page the server serves, whose client
 * puts an overlay over the page: every later spec of the run then clicks in it, and captures it in
 * place of the component, so a case or an example that compiles would fail, or pass with the
 * overlay in its screenshot. `server.hmr.overlay: false` cannot stop it: Vitest sets
 * `server.hmr: false`, and Vite reads `overlay` only from an object.
 */
export function noErrorBroadcast(): Plugin {
  return {
    name: NO_ERROR_BROADCAST,
    configureServer(server) {
      const hot = server.environments.client.hot;
      const send = hot.send.bind(hot);
      hot.send = (...args: unknown[]) => {
        const [payload] = args;
        if (typeof payload === "object" && payload !== null && "type" in payload) {
          if (payload.type === "error") return;
        }
        Reflect.apply(send, undefined, args);
      };
    },
  };
}
