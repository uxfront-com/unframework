import { addPluginTemplate, createResolver, defineNuxtModule, installModule } from "@nuxt/kit";

// The Browser SDK, from Amplitude's CDN. Pinned: it runs in Partytown's worker
// rather than on the page it was built for, so check a new version there first.
const SDK_URL = "https://cdn.amplitude.com/libs/analytics-browser-2.47.2-min.js.gz";

export interface ModuleOptions {
  /** The Amplitude project's API key. Without one, the module adds nothing to the site. */
  apiKey: string;
  /** `EU` for a project in Amplitude's EU data center. */
  serverZone: "US" | "EU";
  /**
   * The share of sessions Session Replay records, from 0 (off) to 1. The
   * sample rate in the project's Session Replay settings, once set, wins.
   */
  sessionReplaySampleRate: number;
}

/**
 * Amplitude Analytics and Session Replay, kept off the main thread where they can be.
 *
 * Partytown runs the Browser SDK in a web worker, where its page views,
 * sessions and attribution cost the page next to nothing. Session Replay
 * records the DOM, which it can't do from a worker, so it runs on the main
 * thread once the page is idle (see `amplitude/runtime/session-replay.ts`).
 *
 * The rest of the site tracks events with `window.amplitude?.track()`, which
 * Partytown forwards to the worker. An event tracked as the page unloads (a
 * click on a link to another page) doesn't reach the worker in time.
 */
export default defineNuxtModule<ModuleOptions>({
  meta: { name: "amplitude", configKey: "amplitude" },
  defaults: () => ({
    apiKey: process.env.NUXT_PUBLIC_AMPLITUDE_API_KEY ?? "",
    serverZone: "US",
    sessionReplaySampleRate: 1,
  }),
  async setup({ apiKey, serverZone, sessionReplaySampleRate }) {
    if (!apiKey) return;
    const resolver = createResolver(import.meta.url);
    const replay = sessionReplaySampleRate > 0;

    await installModule("@nuxtjs/partytown", {
      forward: ["amplitude.track", ...(replay ? ["amplitudeSessionReplayReady"] : [])],
      // Read from the worker on the main thread's window, not the worker's own.
      mainWindowAccessors: replay ? ["amplitudeSessionReplay"] : [],
    });

    const options = {
      serverZone,
      autocapture: {
        // Hash changes are the homepage's chapter links, not new pages.
        pageViews: { trackHistoryChanges: "pathOnly" },
        // Off, as by default: from the worker, the SDK can't read the clicked
        // element, and its clicks arrive without one.
        elementInteractions: false,
      },
    };
    const scripts = [
      { type: "text/partytown", src: SDK_URL },
      { type: "text/partytown", innerHTML: workerScript(apiKey, options, replay) },
    ];
    // Rendered on the server only. Partytown retypes the scripts it has run,
    // so the client's head would no longer find them, add them again, and
    // Partytown would run the SDK twice.
    addPluginTemplate({
      filename: "amplitude.server.mjs",
      mode: "server",
      getContents: () =>
        [
          `import { defineNuxtPlugin, useHead } from "#imports";`,
          `export default defineNuxtPlugin(() => { useHead({ script: ${JSON.stringify(scripts)} }); });`,
        ].join("\n"),
    });

    if (!replay) return;
    addPluginTemplate({
      filename: "amplitude-session-replay.client.mjs",
      mode: "client",
      getContents: () =>
        [
          `import { defineNuxtPlugin } from "#app/nuxt";`,
          `import { recordSessions } from ${JSON.stringify(resolver.resolve("./amplitude/runtime/session-replay"))};`,
          `export default defineNuxtPlugin(() => recordSessions(${JSON.stringify(apiKey)}, ${JSON.stringify({ serverZone, sampleRate: sessionReplaySampleRate })}));`,
        ].join("\n"),
    });
  },
});

/**
 * Runs in Partytown's worker, after the SDK's script, and initializes the SDK.
 * With Session Replay on, it then hands the main thread the device and session
 * IDs to record under: once the main thread asks for them, and again whenever
 * they change (after 30 minutes without events, the next one starts a new
 * session). Amplitude links each replay to the session's events by those IDs.
 */
const workerScript = (
  apiKey: string,
  options: object,
  replay: boolean,
) => `(function (apiKey, options, replay) {
  // Partytown's fallback, for browsers it can't run in, runs this on the main
  // thread without loading the SDK's script.
  if (!window.amplitude) return;
  var initialized = amplitude.init(apiKey, options).promise;
  if (!replay) return;

  var asked = false;
  var sent;
  function send() {
    var deviceId = amplitude.getDeviceId();
    var sessionId = amplitude.getSessionId();
    if (!asked || !deviceId || !sessionId || deviceId + "/" + sessionId === sent) return;
    sent = deviceId + "/" + sessionId;
    window.amplitudeSessionReplay(deviceId, sessionId);
  }
  window.amplitudeSessionReplayReady = function () {
    asked = true;
    initialized.then(send);
  };
  amplitude.add({
    name: "session-replay-ids",
    type: "enrichment",
    execute: function (event) {
      send();
      return Promise.resolve(event);
    },
  });
})(${JSON.stringify(apiKey)}, ${JSON.stringify(options)}, ${replay});`;
