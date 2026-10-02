import type * as SessionReplaySdk from "@amplitude/session-replay-browser";
import type { SessionReplayOptions } from "@amplitude/session-replay-browser";

import { requestIdleCallback } from "#imports";

type SessionReplay = typeof SessionReplaySdk;

/**
 * Records sessions with Session Replay's standalone SDK. The Browser SDK runs
 * in Partytown's worker, where its Session Replay plugin couldn't see the DOM,
 * so the worker sends its device and session IDs over instead. Recording
 * starts once the page is idle, and a replay starts with the page as it is then.
 */
export function recordSessions(apiKey: string, options: SessionReplayOptions) {
  let sdk: Promise<SessionReplay> | undefined;

  window.amplitudeSessionReplay = (deviceId, sessionId) => {
    sdk = sdk
      ? sdk.then(async (replay) => {
          await replay.setSessionId(sessionId, deviceId).promise;
          return replay;
        })
      : whenIdle()
          .then(() => import("@amplitude/session-replay-browser"))
          .then(async (replay) => {
            await replay.init(apiKey, { ...options, deviceId, sessionId }).promise;
            return replay;
          });
    // A failed import (a chunk gone after a deploy) leaves the page unrecorded.
    sdk.catch(() => undefined);
  };

  window.amplitudeSessionReplayReady?.();
}

// As @uxfront/scene waits to boot its engine: after the load event, once the
// main thread is idle (Nuxt's requestIdleCallback falls back to a timeout).
function whenIdle() {
  return new Promise<void>((resolve) => {
    const schedule = () => requestIdleCallback(() => resolve(), { timeout: 1500 });
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
  });
}
