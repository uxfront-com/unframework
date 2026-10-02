// A global declaration file (no imports or exports): this extends the global Window.
interface Window {
  /**
   * Amplitude's Browser SDK, as the main thread sees it: it runs in
   * Partytown's worker, and only `track()` is forwarded there. Undefined
   * when the site is built without an API key.
   */
  amplitude?: { track: (eventType: string, eventProperties?: Record<string, unknown>) => void };
  /** Called from the worker with the IDs the Browser SDK tracks the visit under. */
  amplitudeSessionReplay?: (deviceId: string, sessionId: number) => void;
  /** Forwarded to the worker: asks it for those IDs, now and whenever they change. */
  amplitudeSessionReplayReady?: () => void;
}
