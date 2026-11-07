// The Node side of the page host (`../hosts/page/`): hands a page its config before its modules
// load, answers its commands, and passes on what it reports.
import type { Page } from "playwright";

import { PAGE_CALL, PAGE_CONFIG, PAGE_REPORT } from "../hosts/page/protocol.ts";
import type { PageCallResult, PageEvent, PageHostConfig } from "../hosts/page/protocol.ts";

/** The part of a Playwright page this needs. */
export type PageHostPage = Pick<Page, "addInitScript" | "exposeBinding">;

/** What a driver gives a page. */
export interface PageHostOptions {
  config: PageHostConfig;
  /** The commands by name, each already holding what it needs of the driver. */
  commands: Readonly<Record<string, (...args: never[]) => unknown>>;
  onEvent(event: PageEvent): void;
}

/** Makes a page ready for the page host's boot. Call it before the page navigates. */
export async function exposePageHost(page: PageHostPage, options: PageHostOptions): Promise<void> {
  await page.addInitScript(
    `globalThis[${JSON.stringify(PAGE_CONFIG)}] = ${JSON.stringify(options.config)};`,
  );
  await page.exposeBinding(
    PAGE_CALL,
    async (_source, name: string, args: readonly never[]): Promise<PageCallResult> => {
      try {
        const command = options.commands[name];
        if (!command) throw new Error(`The driver has no command named ${name}.`);
        return { ok: true, value: await command(...args) };
      } catch (error) {
        const { name: errorName, message, stack } = error as Error;
        return { ok: false, error: { name: errorName, message: String(message), stack } };
      }
    },
  );
  await page.exposeBinding(PAGE_REPORT, (_source, event: PageEvent) => {
    options.onEvent(event);
  });
}
