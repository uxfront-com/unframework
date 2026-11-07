// What `storybook:check` decides, apart from the page it reads: `scripts/storybook.ts` opens the
// stories, and this says what is wrong with what it found. The `harness` project runs with no
// browser, so these are plain functions, which keep the catalogue's detectors under test until CI
// runs the check itself.
import { selectTargets } from "./targets.ts";

const USAGE =
  "Usage: storybook.ts serve <target> [--cases <id>[,<id>…]] | build <target> | check <target> [--story <id>]";

/** The flag each command takes, and what it has none of. */
const FLAGS = { build: undefined, serve: "--cases", check: "--story" } as const;

/** A command line of `scripts/storybook.ts`. */
export interface StorybookCommand {
  command: keyof typeof FLAGS;
  target: string;
  /** The value of the command's flag, comma-separated. */
  value: string | undefined;
}

function isCommand(name: string): name is keyof typeof FLAGS {
  return Object.hasOwn(FLAGS, name);
}

/**
 * Reads a command line. Throws on anything else: a flag a command doesn't take, `--story=<id>`, or
 * a stray argument would otherwise read as no flag at all, and walk the whole build to a pass.
 */
export function parseCommand(argv: readonly string[]): StorybookCommand {
  const [command, target, flag, ...values] = argv.filter((arg) => arg !== "--");
  if (!command || !target || !isCommand(command)) throw new Error(USAGE);
  // Throws on a name that isn't a target.
  selectTargets(target);
  if (flag === undefined) return { command, target, value: undefined };
  if (flag !== FLAGS[command] || values.some((value) => value.startsWith("--"))) {
    throw new Error(USAGE);
  }
  if (!values.length) throw new Error(`${flag} needs a value.\n${USAGE}`);
  return { command, target, value: values.join(",") };
}

/** Whether a request's path is the chunk a spec builds to: `/assets/counter.test-<hash>.js`. */
export function isSpecChunk(path: string): boolean {
  return /\/assets\/[^/]*\.test-[^/]*\.js$/.test(path);
}

/** What opening a story found in the page. */
export interface StoryPage {
  /** Whether Storybook finished rendering it before the time ran out. */
  finished: boolean;
  /** Whether the body shows Storybook's error display (`.sb-show-errordisplay`). */
  showsError: boolean;
  /** The error display's message, if it has one. */
  errorMessage: string | undefined;
  /** Whether the body shows that Storybook has no preview (`.sb-show-nopreview`). */
  noPreview: boolean;
  /** `#storybook-root`, if the page has one. */
  root: { elements: number; content: string } | undefined;
  /** Whether the root shows a story's no-output reason. */
  noOutput: boolean;
  /** What the root reads as. */
  text: string;
}

/** A story that didn't finish: the page may be blocked, so nothing was read from it. */
export const UNFINISHED_STORY: StoryPage = {
  finished: false,
  showsError: false,
  errorMessage: undefined,
  noPreview: false,
  root: undefined,
  noOutput: false,
  text: "",
};

/**
 * What `work` gives within `ms`, or nothing if it fails or takes longer. A deadline of its own,
 * because a page whose main thread is blocked can hold Playwright's calls for ever: `evaluate` has
 * no timeout, and `waitForFunction`'s can wait on the page too.
 */
export async function within<T>(work: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms);
  });
  try {
    return await Promise.race([work.catch(() => undefined), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/** Why a story didn't render, if it didn't. */
function renderError(page: StoryPage): string | undefined {
  if (page.showsError) return page.errorMessage ?? "the error display is showing";
  if (page.noPreview) return "Storybook has no preview of it";
  return page.finished ? undefined : "it did not finish rendering";
}

/** Whether a story's root holds nothing to see. */
function isEmpty(page: StoryPage): boolean {
  return !page.root || (page.root.elements === 0 && !page.root.content.trim());
}

/** What is wrong with a corpus story, if anything. */
export function storyProblem(page: StoryPage): string | undefined {
  return renderError(page) ?? (isEmpty(page) ? "its root is empty" : undefined);
}

/** What is wrong with the runner story, which must render nothing and be ready to run a spec. */
export function runnerProblems(
  id: string,
  page: StoryPage,
  runSpec: string,
  ready: boolean,
): string[] {
  const error = renderError(page);
  return [
    ...(error === undefined ? [] : [`${id}: ${error}`]),
    ...(isEmpty(page) ? [] : [`${id}: it rendered something`]),
    ...(ready ? [] : [`${id}: it doesn't set ${runSpec}`]),
  ];
}

/** The stories that showed a no-output reason. */
export function noOutputStories(pages: ReadonlyMap<string, StoryPage>): string[] {
  return [...pages].filter(([, page]) => page.noOutput).map(([id]) => id);
}

/** What a walk of the catalogue has to say. */
export interface Catalogue {
  /** The generator's stories. */
  stories: readonly { id: string; title: string }[];
  /** What opening each of the build's stories found. */
  pages: ReadonlyMap<string, StoryPage>;
  /** The cases the target has no output for, by id (`noOutputCases`). */
  noOutput: readonly string[];
  /** The URLs of the spec chunks the walk loaded. */
  specChunks: readonly string[];
}

/** Everything wrong with a catalogue: nothing when it passes. */
export function catalogueProblems(catalogue: Catalogue): string[] {
  const { stories, pages, noOutput, specChunks } = catalogue;
  const listed = new Set(stories.map(({ id }) => id));
  const problems = [
    ...[...listed]
      .filter((id) => !pages.has(id))
      .map((id) => `${id}: the generator lists it, the build lacks it`),
    ...[...pages.keys()]
      .filter((id) => !listed.has(id))
      .map((id) => `${id}: the build holds it, the generator lacks it`),
  ];
  for (const [id, page] of pages) {
    const problem = storyProblem(page);
    if (problem !== undefined) problems.push(`${id}: ${problem}`);
  }
  const showing = new Set(noOutputStories(pages));
  const shown = new Set(stories.filter(({ id }) => showing.has(id)).map(({ title }) => title));
  for (const id of noOutput) {
    if (!shown.has(id)) problems.push(`${id}: it has no output, and no story says so`);
  }
  for (const id of shown) {
    if (!noOutput.includes(id)) problems.push(`${id}: a story says it has no output, and it has`);
  }
  for (const url of specChunks) problems.push(`the catalogue loaded a spec: ${url}`);
  return problems;
}
