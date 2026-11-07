// The commands a page calls, as bindings to the same Node code Vitest's provider calls: each takes
// a context of the shape that provider gives, built here from the spec file's own page.
import type { MountEvent } from "@unframework/codegen";
import type { Frame, Page } from "playwright";

import type {
  ArtefactRequest,
  ComponentEventsRequest,
  InputRequest,
  SerializedLocatorLike,
} from "../commands.ts";
import type { ColorScheme, HarnessProvided } from "../harness.ts";
import {
  mainSource,
  ufAriaSnapshot,
  ufArtefact,
  ufColorScheme,
  ufFocus,
  ufInput,
  ufResetInput,
} from "../node/commands.ts";
import { pageActions } from "../node/page-actions.ts";
import { ufVisualCapture } from "../node/visual.ts";
import type { VisualCommandContext } from "../node/visual.ts";
import type { CaptureRequest } from "../visual-types.ts";
import { FRAME_SELECTOR } from "./host.ts";

/**
 * What a command is handed, as Vitest's command context holds it: the page, the frame the spec runs
 * in, and the project's provided values.
 */
export type DriverCommandContext = VisualCommandContext & {
  frame(): Promise<Frame>;
};

/** A target's own command: it takes the context first, and what the page sent after it. */
export type TargetCommand = (context: never, ...payload: never[]) => unknown;

/** What the commands read beside the page. */
export interface CommandOptions {
  /** The project's name, for a refusal. */
  project: string;
  provided: HarnessProvided;
  /** Commands besides the testing API's own, such as a target's server-side render. */
  commands?: Readonly<Record<string, TargetCommand>>;
  /** The events of a compiled component's file, from what the build compiled. */
  events?: (file: string) => MountEvent[];
}

/** The context of one spec file's page. */
export function commandContext(page: Page, options: CommandOptions): DriverCommandContext {
  return {
    page,
    iframe: page.frameLocator(FRAME_SELECTOR),
    frame: async () => {
      const element = await page.waitForSelector(FRAME_SELECTOR);
      return (await element.contentFrame())!;
    },
    project: { name: options.project, getProvidedContext: () => options.provided },
  } as DriverCommandContext;
}

/** The testing API's commands. Each types the part of the context it reads. */
function ownCommands(context: DriverCommandContext, options: CommandOptions) {
  const parts = context as never;
  return {
    ufArtefact: (request: ArtefactRequest) => ufArtefact(context, request),
    ufAriaSnapshot: (locator: SerializedLocatorLike) => ufAriaSnapshot(parts, locator),
    ufVisualCapture: (request: CaptureRequest) => ufVisualCapture(context, request),
    ufFocus: (locator: SerializedLocatorLike) => ufFocus(parts, locator),
    ufInput: (request: InputRequest) => ufInput(parts, request),
    ufResetInput: () => ufResetInput(parts),
    ufColorScheme: (scheme: ColorScheme) => ufColorScheme(parts, scheme),
    ufComponentEvents: (request: ComponentEventsRequest) => {
      if (!options.events) throw new Error("[uf] This run has no build to read events from.");
      return { events: options.events(mainSource(context, request)) };
    },
    ufUnhover: () => pageActions.ufUnhover(parts),
    ufFill: (locator: SerializedLocatorLike, text: string) =>
      pageActions.ufFill(parts, locator, text),
    ufClear: (locator: SerializedLocatorLike) => pageActions.ufClear(parts, locator),
    ufSelectOptions: (locator: SerializedLocatorLike, values: readonly string[]) =>
      pageActions.ufSelectOptions(parts, locator, values),
  };
}

/**
 * Every binding of a spec file's page, by name. A target's command may not take the name of one of
 * the testing API's: it would replace the write policy or the visual comparison for that project
 * without a word.
 */
export function driverCommands(
  context: DriverCommandContext,
  options: CommandOptions,
): Record<string, (...args: never[]) => unknown> {
  const own = ownCommands(context, options);
  const target = options.commands ?? {};
  const taken = Object.keys(target).filter((name) => Object.hasOwn(own, name));
  if (taken.length) {
    throw new Error(
      `[uf] driverCommands(${options.project}): ${taken.join(", ")} would replace the testing API's own command(s). Give the target's command another name.`,
    );
  }
  const bound = Object.fromEntries(
    Object.entries(target).map(([name, command]) => [
      name,
      (...payload: never[]) => command(context as never, ...payload),
    ]),
  );
  return { ...own, ...bound };
}
