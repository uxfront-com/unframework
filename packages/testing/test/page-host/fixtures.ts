// The inputs both runners get, so the page host's verdicts, messages and strings are compared with
// what Vitest's own give: `../page-host-vitest.browser.test.ts` runs these on Vitest and checks
// `./vitest-results.json`, which holds its answers, and `../page-host.test.ts` runs them on the
// page host and checks the same file.

/** What a run reads of a locator. */
export interface FixtureLocator {
  serialize(): { selector: string; locator: string };
  toString(): string;
  readonly length: number;
  getByRole(role: string, options?: object): FixtureLocator;
  getByLabelText(text: string | RegExp, options?: object): FixtureLocator;
  getByAltText(text: string | RegExp, options?: object): FixtureLocator;
  getByPlaceholder(text: string | RegExp, options?: object): FixtureLocator;
  getByText(text: string | RegExp, options?: object): FixtureLocator;
  getByTitle(text: string | RegExp, options?: object): FixtureLocator;
  getByTestId(text: string | RegExp): FixtureLocator;
  all(): FixtureLocator[];
  query(): Element | null;
  element(): Element;
  elements(): Element[];
  nth(index: number): FixtureLocator;
  first(): FixtureLocator;
  last(): FixtureLocator;
  and(locator: never): FixtureLocator;
  or(locator: never): FixtureLocator;
  filter(options: object): FixtureLocator;
}

/** What the fixtures need from a runner. */
export interface FixtureRunner {
  page: Pick<
    FixtureLocator,
    | "getByRole"
    | "getByLabelText"
    | "getByAltText"
    | "getByPlaceholder"
    | "getByText"
    | "getByTitle"
    | "getByTestId"
  >;
  element(subject: unknown, options: { timeout: number }): Record<string, unknown>;
  expect(actual: unknown): Record<string, unknown>;
  stringMatching(expected: RegExp): unknown;
  hover(target: FixtureLocator): Promise<void>;
  unhover(target: FixtureLocator): Promise<void>;
  fill(target: FixtureLocator, text: string): Promise<void>;
  clear(target: FixtureLocator): Promise<void>;
  selectOptions(target: FixtureLocator, values: string[]): Promise<void>;
}

/** A matcher's call on an element of `html`, whose subject has `data-testid="subject"`. */
export interface MatcherFixture {
  id: string;
  html: string;
  matcher: string;
  args?: readonly unknown[];
  not?: boolean;
  /** The subject: the locator by default, its element, nothing, one out of the page, or neither. */
  subject?: "element" | "null" | "detached" | "text" | "object";
  /** Moves the focus to the subject first. */
  focus?: boolean;
  /** Appended to the arguments, as `expect.stringMatching` of this pattern. */
  matching?: RegExp;
}

const input = '<input data-testid="subject" value="text">';

/** Each of the 14 matchers: passing, failing, negated, and what it refuses. */
export const MATCHER_FIXTURES: readonly MatcherFixture[] = [
  // toBeVisible
  { id: "visible", html: '<p data-testid="subject">x</p>', matcher: "toBeVisible" },
  {
    id: "visible-none",
    html: '<p data-testid="subject" style="display:none">x</p>',
    matcher: "toBeVisible",
  },
  {
    id: "visible-hidden",
    html: '<p data-testid="subject" style="visibility:hidden">x</p>',
    matcher: "toBeVisible",
  },
  { id: "visible-empty", html: '<p data-testid="subject"></p>', matcher: "toBeVisible" },
  { id: "visible-not", html: '<p data-testid="subject">x</p>', matcher: "toBeVisible", not: true },
  {
    id: "visible-not-none",
    html: '<p data-testid="subject" hidden>x</p>',
    matcher: "toBeVisible",
    not: true,
  },
  { id: "visible-detached", html: "", matcher: "toBeVisible", subject: "detached" },
  { id: "visible-missing", html: "<p>x</p>", matcher: "toBeVisible" },
  { id: "visible-not-missing", html: "<p>x</p>", matcher: "toBeVisible", not: true },
  { id: "visible-text", html: "", matcher: "toBeVisible", subject: "text" },
  { id: "visible-object", html: "", matcher: "toBeVisible", subject: "object" },
  {
    id: "visible-strict-many",
    html: '<p data-testid="subject">x</p>'.repeat(11),
    matcher: "toBeVisible",
  },
  {
    id: "visible-strict",
    html: '<p data-testid="subject">a</p><p data-testid="subject">b</p>',
    matcher: "toBeVisible",
  },
  // toBeInTheDocument
  { id: "document", html: '<p data-testid="subject">x</p>', matcher: "toBeInTheDocument" },
  { id: "document-missing", html: "<p>x</p>", matcher: "toBeInTheDocument" },
  { id: "document-not-missing", html: "<p>x</p>", matcher: "toBeInTheDocument", not: true },
  {
    id: "document-not",
    html: '<p data-testid="subject">x</p>',
    matcher: "toBeInTheDocument",
    not: true,
  },
  { id: "document-null", html: "", matcher: "toBeInTheDocument", subject: "null" },
  { id: "document-not-null", html: "", matcher: "toBeInTheDocument", subject: "null", not: true },
  { id: "document-detached", html: "", matcher: "toBeInTheDocument", subject: "detached" },
  {
    id: "document-element",
    html: '<p data-testid="subject">x</p>',
    matcher: "toBeInTheDocument",
    subject: "element",
  },
  // toHaveTextContent
  {
    id: "text",
    html: '<p data-testid="subject">Count: 2</p>',
    matcher: "toHaveTextContent",
    args: ["Count: 2"],
  },
  {
    id: "text-part",
    html: '<p data-testid="subject">Count: 2</p>',
    matcher: "toHaveTextContent",
    args: ["2"],
  },
  {
    id: "text-regex",
    html: '<p data-testid="subject">Count: 2</p>',
    matcher: "toHaveTextContent",
    args: [/\d/],
  },
  {
    id: "text-spaces",
    html: '<p data-testid="subject">  a \n  b </p>',
    matcher: "toHaveTextContent",
    args: ["a b"],
  },
  {
    id: "text-wrong",
    html: '<p data-testid="subject">Count: 2</p>',
    matcher: "toHaveTextContent",
    args: ["3"],
  },
  {
    id: "text-regex-wrong",
    html: '<p data-testid="subject">Count: 2</p>',
    matcher: "toHaveTextContent",
    args: [/^\d$/],
  },
  {
    id: "text-empty-string",
    html: '<p data-testid="subject">x</p>',
    matcher: "toHaveTextContent",
    args: [""],
  },
  { id: "text-none", html: '<p data-testid="subject"></p>', matcher: "toHaveTextContent" },
  {
    id: "text-not",
    html: '<p data-testid="subject">Count: 2</p>',
    matcher: "toHaveTextContent",
    args: ["2"],
    not: true,
  },
  {
    id: "text-not-pass",
    html: '<p data-testid="subject">Count: 2</p>',
    matcher: "toHaveTextContent",
    args: ["3"],
    not: true,
  },
  // toMatchTextContent
  {
    id: "match-text",
    html: '<p data-testid="subject">Count: 2</p>',
    matcher: "toMatchTextContent",
    args: ["Count: 2"],
  },
  {
    id: "match-text-regex",
    html: '<p data-testid="subject">Count: 2</p>',
    matcher: "toMatchTextContent",
    args: [/\d/],
  },
  {
    id: "match-text-wrong",
    html: '<p data-testid="subject">Count: 2</p>',
    matcher: "toMatchTextContent",
    args: ["3"],
  },
  {
    id: "match-text-not",
    html: '<p data-testid="subject">Count: 2</p>',
    matcher: "toMatchTextContent",
    args: ["2"],
    not: true,
  },
  // toHaveAttribute
  {
    id: "attribute",
    html: '<p data-testid="subject" title="a">x</p>',
    matcher: "toHaveAttribute",
    args: ["title"],
  },
  {
    id: "attribute-value",
    html: '<p data-testid="subject" title="a">x</p>',
    matcher: "toHaveAttribute",
    args: ["title", "a"],
  },
  {
    id: "attribute-empty",
    html: '<p data-testid="subject" hidden="">x</p>',
    matcher: "toHaveAttribute",
    args: ["hidden", ""],
  },
  {
    id: "attribute-absent",
    html: '<p data-testid="subject">x</p>',
    matcher: "toHaveAttribute",
    args: ["title"],
  },
  {
    id: "attribute-wrong",
    html: '<p data-testid="subject" title="a">x</p>',
    matcher: "toHaveAttribute",
    args: ["title", "b"],
  },
  {
    id: "attribute-not",
    html: '<p data-testid="subject" title="a">x</p>',
    matcher: "toHaveAttribute",
    args: ["title"],
    not: true,
  },
  {
    id: "attribute-not-value",
    html: '<p data-testid="subject" title="a">x</p>',
    matcher: "toHaveAttribute",
    args: ["title", "a"],
    not: true,
  },
  // toHaveValue
  { id: "value", html: input, matcher: "toHaveValue", args: ["text"] },
  { id: "value-wrong", html: input, matcher: "toHaveValue", args: ["other"] },
  { id: "value-not", html: input, matcher: "toHaveValue", args: ["text"], not: true },
  {
    id: "value-number",
    html: '<input data-testid="subject" type="number" value="4">',
    matcher: "toHaveValue",
    args: [4],
  },
  {
    id: "value-number-empty",
    html: '<input data-testid="subject" type="number">',
    matcher: "toHaveValue",
    args: [null],
  },
  {
    id: "value-checkbox",
    html: '<input data-testid="subject" type="checkbox">',
    matcher: "toHaveValue",
    args: ["on"],
  },
  {
    id: "value-select",
    html: '<select data-testid="subject"><option>a</option><option selected>b</option></select>',
    matcher: "toHaveValue",
    args: ["b"],
  },
  {
    id: "value-multiple",
    html: '<select data-testid="subject" multiple><option selected>a</option><option selected>b</option></select>',
    matcher: "toHaveValue",
    args: [["a", "b"]],
  },
  {
    id: "value-textarea",
    html: '<textarea data-testid="subject">t</textarea>',
    matcher: "toHaveValue",
    args: ["t"],
  },
  {
    id: "value-role",
    html: '<div data-testid="subject" role="slider" aria-valuenow="3"></div>',
    matcher: "toHaveValue",
    args: [3],
  },
  { id: "value-none", html: '<p data-testid="subject">x</p>', matcher: "toHaveValue", args: ["x"] },
  // toHaveClass
  {
    id: "class",
    html: '<p data-testid="subject" class="a b">x</p>',
    matcher: "toHaveClass",
    args: ["a"],
  },
  {
    id: "class-two",
    html: '<p data-testid="subject" class="a b">x</p>',
    matcher: "toHaveClass",
    args: ["a", "b"],
  },
  {
    id: "class-joined",
    html: '<p data-testid="subject" class="a b">x</p>',
    matcher: "toHaveClass",
    args: ["b a"],
  },
  {
    id: "class-regex",
    html: '<p data-testid="subject" class="a b">x</p>',
    matcher: "toHaveClass",
    args: [/^b$/],
  },
  {
    id: "class-exact",
    html: '<p data-testid="subject" class="a b">x</p>',
    matcher: "toHaveClass",
    args: ["a b", { exact: true }],
  },
  {
    id: "class-exact-wrong",
    html: '<p data-testid="subject" class="a b">x</p>',
    matcher: "toHaveClass",
    args: ["a", { exact: true }],
  },
  {
    id: "class-wrong",
    html: '<p data-testid="subject" class="a b">x</p>',
    matcher: "toHaveClass",
    args: ["c"],
  },
  { id: "class-none", html: '<p data-testid="subject">x</p>', matcher: "toHaveClass" },
  {
    id: "class-not",
    html: '<p data-testid="subject" class="a b">x</p>',
    matcher: "toHaveClass",
    args: ["a"],
    not: true,
  },
  {
    id: "class-not-any",
    html: '<p data-testid="subject" class="a b">x</p>',
    matcher: "toHaveClass",
    not: true,
  },
  // toHaveStyle
  {
    id: "style-object",
    html: '<p data-testid="subject" style="color:red">x</p>',
    matcher: "toHaveStyle",
    args: [{ color: "rgb(255, 0, 0)" }],
  },
  {
    id: "style-string",
    html: '<p data-testid="subject" style="color:red">x</p>',
    matcher: "toHaveStyle",
    args: ["color: red"],
  },
  {
    id: "style-named",
    html: '<p data-testid="subject" style="color:red">x</p>',
    matcher: "toHaveStyle",
    args: [{ color: "red" }],
  },
  {
    id: "style-camel",
    html: '<p data-testid="subject" style="background-color:blue">x</p>',
    matcher: "toHaveStyle",
    args: [{ backgroundColor: "blue" }],
  },
  {
    id: "style-custom",
    html: '<p data-testid="subject" style="--x: 1">x</p>',
    matcher: "toHaveStyle",
    args: [{ "--x": "1" }],
  },
  {
    id: "style-wrong",
    html: '<p data-testid="subject" style="color:red">x</p>',
    matcher: "toHaveStyle",
    args: [{ color: "blue" }],
  },
  {
    id: "style-string-wrong",
    html: '<p data-testid="subject" style="color:red">x</p>',
    matcher: "toHaveStyle",
    args: ["color: blue"],
  },
  {
    id: "style-not",
    html: '<p data-testid="subject" style="color:red">x</p>',
    matcher: "toHaveStyle",
    args: [{ color: "red" }],
    not: true,
  },
  // toHaveFocus
  { id: "focus", html: input, matcher: "toHaveFocus", focus: true },
  { id: "focus-none", html: input, matcher: "toHaveFocus" },
  { id: "focus-not", html: input, matcher: "toHaveFocus", focus: true, not: true },
  { id: "focus-not-pass", html: input, matcher: "toHaveFocus", not: true },
  // toBeChecked
  {
    id: "checked",
    html: '<input data-testid="subject" type="checkbox" checked>',
    matcher: "toBeChecked",
  },
  {
    id: "checked-radio",
    html: '<input data-testid="subject" type="radio" checked>',
    matcher: "toBeChecked",
  },
  {
    id: "checked-aria",
    html: '<div data-testid="subject" role="switch" aria-checked="true"></div>',
    matcher: "toBeChecked",
  },
  {
    id: "checked-not-yet",
    html: '<input data-testid="subject" type="checkbox">',
    matcher: "toBeChecked",
  },
  {
    id: "checked-not",
    html: '<input data-testid="subject" type="checkbox" checked>',
    matcher: "toBeChecked",
    not: true,
  },
  { id: "checked-invalid", html: input, matcher: "toBeChecked" },
  {
    id: "checked-aria-invalid",
    html: '<div data-testid="subject" role="switch" aria-checked="mixed"></div>',
    matcher: "toBeChecked",
  },
  // toBeDisabled, toBeEnabled
  {
    id: "disabled",
    html: '<button data-testid="subject" disabled>x</button>',
    matcher: "toBeDisabled",
  },
  {
    id: "disabled-fieldset",
    html: '<fieldset disabled><input data-testid="subject"></fieldset>',
    matcher: "toBeDisabled",
  },
  {
    id: "disabled-aria",
    html: '<button data-testid="subject" aria-disabled="true">x</button>',
    matcher: "toBeDisabled",
  },
  {
    id: "disabled-custom",
    html: '<my-box data-testid="subject" disabled>x</my-box>',
    matcher: "toBeDisabled",
  },
  {
    id: "disabled-wrong",
    html: '<button data-testid="subject">x</button>',
    matcher: "toBeDisabled",
  },
  {
    id: "disabled-not",
    html: '<button data-testid="subject" disabled>x</button>',
    matcher: "toBeDisabled",
    not: true,
  },
  { id: "enabled", html: '<button data-testid="subject">x</button>', matcher: "toBeEnabled" },
  {
    id: "enabled-wrong",
    html: '<button data-testid="subject" disabled>x</button>',
    matcher: "toBeEnabled",
  },
  {
    id: "enabled-not",
    html: '<button data-testid="subject">x</button>',
    matcher: "toBeEnabled",
    not: true,
  },
  // toBeRequired
  { id: "required", html: '<input data-testid="subject" required>', matcher: "toBeRequired" },
  {
    id: "required-aria",
    html: '<div data-testid="subject" role="textbox" aria-required="true"></div>',
    matcher: "toBeRequired",
  },
  {
    id: "required-select",
    html: '<select data-testid="subject" required></select>',
    matcher: "toBeRequired",
  },
  {
    id: "required-unsupported",
    html: '<input data-testid="subject" type="color" required>',
    matcher: "toBeRequired",
  },
  { id: "required-wrong", html: input, matcher: "toBeRequired" },
  {
    id: "required-not",
    html: '<input data-testid="subject" required>',
    matcher: "toBeRequired",
    not: true,
  },
  // toHaveAccessibleDescription
  {
    id: "description",
    html: '<button data-testid="subject" aria-describedby="d">x</button><p id="d">About it</p>',
    matcher: "toHaveAccessibleDescription",
    args: ["About it"],
  },
  {
    id: "description-any",
    html: '<button data-testid="subject" aria-describedby="d">x</button><p id="d">About it</p>',
    matcher: "toHaveAccessibleDescription",
  },
  {
    id: "description-regex",
    html: '<button data-testid="subject" aria-describedby="d">x</button><p id="d">About it</p>',
    matcher: "toHaveAccessibleDescription",
    args: [/about/i],
  },
  {
    id: "description-title",
    html: '<button data-testid="subject" title="About it">x</button>',
    matcher: "toHaveAccessibleDescription",
    args: ["About it"],
  },
  {
    id: "description-wrong",
    html: '<button data-testid="subject" aria-describedby="d">x</button><p id="d">About it</p>',
    matcher: "toHaveAccessibleDescription",
    args: ["Other"],
  },
  {
    id: "description-none",
    html: '<button data-testid="subject">x</button>',
    matcher: "toHaveAccessibleDescription",
  },
  {
    id: "description-not",
    html: '<button data-testid="subject" aria-describedby="d">x</button><p id="d">About it</p>',
    matcher: "toHaveAccessibleDescription",
    args: ["About it"],
    not: true,
  },
  // What isn't one of the 14: `toHaveLength` reads every match, chai's own matchers read the
  // element, and an unknown name is refused.
  {
    id: "length-two",
    html: '<p data-testid="subject">a</p><p data-testid="subject">b</p>',
    matcher: "toHaveLength",
    args: [2],
  },
  { id: "length-one", html: '<p data-testid="subject">a</p>', matcher: "toHaveLength", args: [1] },
  { id: "length-none", html: "<p>x</p>", matcher: "toHaveLength", args: [0] },
  {
    id: "length-element-wrong",
    html: '<p data-testid="subject">a</p><p data-testid="subject">b</p>',
    matcher: "toHaveLength",
    args: [3],
  },
  { id: "chai-truthy", html: '<p data-testid="subject">a</p>', matcher: "toBeTruthy" },
  { id: "chai-unknown", html: '<p data-testid="subject">a</p>', matcher: "toBeNonsense" },
  // Forms of the 14 that the corpus uses.
  {
    id: "text-spaces-kept",
    html: '<p data-testid="subject">  a  b </p>',
    matcher: "toHaveTextContent",
    args: ["  a  b ", { normalizeWhitespace: false }],
  },
  {
    id: "text-spaces-kept-wrong",
    html: '<p data-testid="subject">  a  b </p>',
    matcher: "toHaveTextContent",
    args: ["a b", { normalizeWhitespace: false }],
  },
  {
    id: "attribute-matching",
    html: '<p data-testid="subject" title="abc">x</p>',
    matcher: "toHaveAttribute",
    args: ["title"],
    matching: /b/,
  },
  {
    id: "attribute-matching-wrong",
    html: '<p data-testid="subject" title="abc">x</p>',
    matcher: "toHaveAttribute",
    args: ["title"],
    matching: /z/,
  },
  {
    id: "attribute-not-absent",
    html: '<p data-testid="subject">x</p>',
    matcher: "toHaveAttribute",
    args: ["title"],
    not: true,
  },
  {
    id: "checked-not-pass",
    html: '<input data-testid="subject" type="checkbox">',
    matcher: "toBeChecked",
    not: true,
  },
  {
    id: "disabled-not-pass",
    html: '<button data-testid="subject">x</button>',
    matcher: "toBeDisabled",
    not: true,
  },
  {
    id: "enabled-not-pass",
    html: '<button data-testid="subject" disabled>x</button>',
    matcher: "toBeEnabled",
    not: true,
  },
  {
    id: "required-not-pass",
    html: '<input data-testid="subject">',
    matcher: "toBeRequired",
    not: true,
  },
  {
    id: "style-several",
    html: '<p data-testid="subject" style="color:red;display:block;width:10px">x</p>',
    matcher: "toHaveStyle",
    args: [{ color: "rgb(255, 0, 0)", display: "block", width: "10px" }],
  },
];

/** The assertions the runtime and the corpus make on plain values, which `@vitest/expect` gives. */
export const VALUE_FIXTURES: readonly {
  id: string;
  actual: unknown;
  matcher: string;
  args: readonly unknown[];
}[] = [
  { id: "equal", actual: [[5]], matcher: "toEqual", args: [[[5]]] },
  { id: "equal-wrong", actual: [[5]], matcher: "toEqual", args: [[[6]]] },
  { id: "be", actual: 1, matcher: "toBe", args: [1] },
  { id: "be-wrong", actual: 1, matcher: "toBe", args: [2] },
  { id: "length", actual: [1, 2], matcher: "toHaveLength", args: [2] },
  { id: "length-wrong", actual: [1, 2], matcher: "toHaveLength", args: [3] },
];

/** How long a fixture's failing `expect.element` tries. */
const TIMEOUT = 100;

/** One outcome: L8 reads an error's name and its message, without the colours or the page's HTML. */
export interface Outcome {
  verdict: "pass" | "fail";
  name?: string;
  message?: string;
}

/** Terminal colours, and the page's HTML that follows an element error (`behaviour.ts`). */
const NOISE = [
  // oxlint-disable-next-line no-control-regex -- the escape character is what it matches
  /\u001b\[[0-9;]*m/g,
  /\n+HTML:\n[\s\S]*$/,
];

async function outcomeOf(run: () => unknown): Promise<Outcome> {
  try {
    await run();
    return { verdict: "pass" };
  } catch (error) {
    const { name, message } = error as Error;
    return {
      verdict: "fail",
      name,
      message: NOISE.reduce((text, noise) => text.replace(noise, ""), message),
    };
  }
}

/** Where a fixture's HTML goes: straight in the body, as a view's root is. */
function place(html: string): HTMLElement {
  const box = document.createElement("div");
  box.innerHTML = html;
  document.body.append(box);
  return box;
}

/** Runs every matcher fixture. */
export async function runMatchers(runner: FixtureRunner): Promise<Record<string, Outcome>> {
  const outcomes: Record<string, Outcome> = {};
  for (const fixture of MATCHER_FIXTURES) {
    const box = place(fixture.html);
    const locator = runner.page.getByTestId("subject");
    if (fixture.focus) (box.querySelector('[data-testid="subject"]') as HTMLElement).focus();
    const subjects = {
      element: () => box.querySelector('[data-testid="subject"]'),
      null: () => null,
      detached: () => document.createElement("p"),
      text: () => "text",
      object: () => ({}),
    };
    const subject = fixture.subject ? subjects[fixture.subject]() : locator;
    outcomes[fixture.id] = await outcomeOf(() => {
      const assertion = runner.element(subject, { timeout: TIMEOUT });
      const target = (fixture.not ? assertion.not : assertion) as Record<
        string,
        (...args: readonly unknown[]) => unknown
      >;
      const asymmetric = fixture.matching ? [runner.stringMatching(fixture.matching)] : [];
      return target[fixture.matcher]!(...(fixture.args ?? []), ...asymmetric);
    });
    box.remove();
    (document.activeElement as HTMLElement | null)?.blur();
  }
  for (const { id, actual, matcher, args } of VALUE_FIXTURES) {
    outcomes[id] = await outcomeOf(() =>
      (runner.expect(actual)[matcher] as (...values: readonly unknown[]) => unknown)(...args),
    );
  }
  return outcomes;
}

/** Each `getBy*`, and what a locator chains, as a command and a trace receive it. */
export function serializeLocators(runner: FixtureRunner): Record<string, unknown> {
  const { page } = runner;
  const root = page.getByTestId("uf-root-1");
  const button = root.getByRole("button", { name: "+3" });
  const locators: Record<string, FixtureLocator> = {
    testId: page.getByTestId("uf-root-1"),
    testIdRegex: page.getByTestId(/uf-root/),
    role: root.getByRole("button"),
    roleName: button,
    roleExact: root.getByRole("button", { name: "Save", exact: true }),
    roleRegex: root.getByRole("button", { name: /save/i }),
    roleStates: root.getByRole("checkbox", { checked: true, disabled: false }),
    roleExpanded: root.getByRole("button", { expanded: true, pressed: false }),
    roleLevel: root.getByRole("heading", { level: 2, includeHidden: true }),
    roleSelected: root.getByRole("option", { selected: true }),
    text: root.getByText("Hello"),
    textExact: root.getByText("Hello", { exact: true }),
    textNotExact: root.getByText("Hello", { exact: false }),
    roleNotExact: root.getByRole("button", { name: "Save", exact: false }),
    labelNotExact: root.getByLabelText("Name", { exact: false }),
    roleLevelName: root.getByRole("heading", { level: 2, name: "Title" }),
    textRegex: root.getByText(/hel+o/i),
    textQuotes: root.getByText(`it's "quoted"`),
    label: root.getByLabelText("Name"),
    labelExact: root.getByLabelText("Name", { exact: true }),
    labelRegex: root.getByLabelText(/name/),
    alt: root.getByAltText("Logo"),
    altExact: root.getByAltText("Logo", { exact: true }),
    placeholder: root.getByPlaceholder("Search"),
    placeholderExact: root.getByPlaceholder("Search", { exact: true }),
    title: root.getByTitle("Tip"),
    titleExact: root.getByTitle("Tip", { exact: true }),
    nested: root.getByTestId("inner"),
    nth: root.getByRole("listitem").nth(1),
    first: root.getByRole("listitem").first(),
    last: root.getByRole("listitem").last(),
    and: root.getByRole("button").and(root.getByTitle("Tip") as never),
    or: root.getByRole("button").or(root.getByRole("link") as never),
    hasText: root.getByRole("listitem").filter({ hasText: "one" }),
    hasTextRegex: root.getByRole("listitem").filter({ hasText: /o'n"e/ }),
    hasNotText: root.getByRole("listitem").filter({ hasNotText: "one" }),
    has: root.getByRole("listitem").filter({ has: root.getByRole("link") }),
    hasNot: root.getByRole("listitem").filter({ hasNot: root.getByRole("link") }),
  };
  return Object.fromEntries(
    Object.entries(locators).map(([id, locator]) => {
      const { selector, locator: described } = locator.serialize();
      return [id, { selector, locator: described }];
    }),
  );
}

/** How many elements each kind of query finds, on one page of HTML: the engine's own answers. */
export function resolveLocators(runner: FixtureRunner): Record<string, number> {
  const box = place(`
    <div data-testid="root">
      <button title="Tip">Save</button><button>+3</button>
      <label>Name <input placeholder="Search"></label>
      <img src="data:," alt="Logo">
      <h2>Hello</h2>
      <ul><li>one</li><li>two <a href="#x">link</a></li></ul>
      <input type="checkbox" checked aria-label="box">
    </div>`);
  const root = runner.page.getByTestId("root");
  const counts = {
    button: root.getByRole("button").length,
    named: root.getByRole("button", { name: "+3" }).length,
    prefix: root.getByRole("button", { name: "sav" }).length,
    exact: root.getByRole("button", { name: "sav", exact: true }).length,
    heading: root.getByRole("heading", { level: 2 }).length,
    checked: root.getByRole("checkbox", { checked: true }).length,
    text: root.getByText("hello").length,
    label: root.getByLabelText("Name").length,
    alt: root.getByAltText("Logo").length,
    placeholder: root.getByPlaceholder("Search").length,
    title: root.getByTitle("Tip").length,
    second: root.getByRole("listitem").nth(1).length,
    filtered: root.getByRole("listitem").filter({ hasText: "one" }).length,
    has: root.getByRole("listitem").filter({ has: root.getByRole("link") }).length,
    either: root.getByRole("button").or(root.getByRole("link") as never).length,
    none: root.getByTestId("nothing").length,
  };
  box.remove();
  return counts;
}

/** What a locator answers about the page, and its refusals. */
export async function callLocators(runner: FixtureRunner): Promise<Record<string, unknown>> {
  const box = place('<div data-testid="root"><button>a</button><button>b</button></div>');
  const root = runner.page.getByTestId("root");
  const buttons = root.getByRole("button");
  const missing = root.getByTestId("nothing");
  const strings = (locator: FixtureLocator) => {
    const { selector, locator: described } = locator.serialize();
    return { selector, locator: described };
  };
  const results = {
    all: buttons.all().map(strings),
    string: String(buttons),
    json: strings({ serialize: () => JSON.parse(JSON.stringify(buttons)) } as FixtureLocator),
    elements: buttons.elements().map((element) => element.textContent),
    query: root.getByRole("button", { name: "a" }).query()?.textContent,
    queryMissing: missing.query(),
    queryStrict: await outcomeOf(() => buttons.query()),
    element: root.getByRole("button", { name: "b" }).element().textContent,
    elementMissing: await outcomeOf(() => missing.element()),
    filterNothing: await outcomeOf(() => buttons.filter({})),
  };
  box.remove();
  return results;
}

/** The four actions, each with what the page saw of it. */
export async function runActions(runner: FixtureRunner): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  const box = place(`
    <input data-testid="field" value="old">
    <textarea data-testid="area">old</textarea>
    <select data-testid="one"><option value="a">First</option><option value="b">Second</option></select>
    <select data-testid="many" multiple><option value="a">First</option><option value="b">Second</option><option value="c">Third</option></select>
    <button data-testid="hovered" style="position:fixed;left:0;top:0;width:20px;height:20px">x</button>`);
  const seen: string[] = [];
  // Only the fixture's own elements: where the mouse lands on the body depends on the page's CSS,
  // which the setup's reset changes on the page host's run.
  // No `mouseenter`: on Vitest's frame the button sits under the resting mouse at (0,0), and Linux
  // sends it when the button appears.
  for (const type of ["input", "change", "mouseleave"]) {
    box.addEventListener(
      type,
      (event) => {
        const id = (event.target as HTMLElement).dataset["testid"];
        if (id) seen.push(`${type} ${id}`);
      },
      true,
    );
  }
  const take = (): string[] => seen.splice(0);
  const { page } = runner;
  const value = (id: string): unknown => {
    const field = box.querySelector(`[data-testid="${id}"]`) as
      | HTMLInputElement
      | HTMLSelectElement;
    return field instanceof HTMLSelectElement && field.multiple
      ? [...field.selectedOptions].map((option) => option.value)
      : field.value;
  };

  await runner.fill(page.getByTestId("field"), "new");
  results["fill"] = { value: value("field"), events: take() };
  await runner.fill(page.getByTestId("area"), "line\nline");
  results["fillArea"] = { value: value("area"), events: take() };
  await runner.clear(page.getByTestId("field"));
  results["clear"] = { value: value("field"), events: take() };
  await runner.selectOptions(page.getByTestId("one"), ["b"]);
  results["selectValue"] = { value: value("one"), events: take() };
  await runner.selectOptions(page.getByTestId("one"), ["First"]);
  results["selectLabel"] = { value: value("one"), events: take() };
  await runner.selectOptions(page.getByTestId("many"), ["a", "Third"]);
  results["selectMany"] = { value: value("many"), events: take() };
  await runner.hover(page.getByTestId("hovered"));
  take();
  await runner.unhover(page.getByTestId("hovered"));
  results["unhover"] = {
    events: take(),
    hovered: box.querySelector('[data-testid="hovered"]')!.matches(":hover"),
  };
  box.remove();
  return results;
}

/** What the timeouts act on: nothing, as in the L8 canary. */
function missingField(runner: Pick<FixtureRunner, "page">): FixtureLocator {
  return runner.page.getByTestId("uf-root-9").getByRole("textbox", { name: "Nothing" });
}

/**
 * The actions on what isn't there, whose error L8 and its canary read. Not `clear`: Vitest's takes
 * no timeout, so here it would wait out the project's whole one.
 */
export async function runActionTimeouts(
  runner: Pick<FixtureRunner, "page" | "fill" | "selectOptions">,
): Promise<Record<string, Outcome>> {
  return {
    fill: await outcomeOf(() => runner.fill(missingField(runner), "x")),
    selectOptions: await outcomeOf(() => runner.selectOptions(missingField(runner), ["x"])),
  };
}

/** `clear` on what isn't there. */
export function runClearTimeout(runner: Pick<FixtureRunner, "page" | "clear">): Promise<Outcome> {
  return outcomeOf(() => runner.clear(missingField(runner)));
}
