// An embed's options and the props rule it shares with the shell (ADR-0113, ADR-0116), without a
// browser: what the embed page and the frame read from a URL, and the props a set of fields gives.
import { describe, expect, it } from "vitest";

import type { PropControl } from "../src/preview/controls.ts";
import { embedOptions } from "../src/preview/embed-options.ts";
import { embedData, embedPage } from "../src/preview/embed.ts";
import type { ExampleControl } from "../src/preview/instrument.ts";
import { controlKit } from "../src/preview/panel.ts";
import type { ControlField } from "../src/preview/panel.ts";
import { CONTROLS_PARAM, RESIZE_PARAM, THEME_PARAM } from "../src/preview/protocol.ts";
import { shellData, shellPage } from "../src/preview/shell.ts";

const NAMES = { controls: CONTROLS_PARAM, theme: THEME_PARAM, resize: RESIZE_PARAM };
const read = (query: string) => embedOptions(new URLSearchParams(query), NAMES);

describe("embedOptions", () => {
  it("turns each option on only when its parameter holds a value it takes", () => {
    expect(read("")).toEqual({ controls: false, resize: false });
    expect(read("example=a&target=vue")).toEqual({ controls: false, resize: false });
    expect(read("controls=true")).toEqual({ controls: true, resize: false });
    expect(read("resize=true")).toEqual({ controls: false, resize: true });
    expect(read("theme=light")).toEqual({ controls: false, theme: "light", resize: false });
    expect(read("controls=true&theme=dark&resize=true")).toEqual({
      controls: true,
      theme: "dark",
      resize: true,
    });
  });

  it("names the parameter and its values for any other value, empty and repeated ones too", () => {
    const cases: [string, string][] = [
      ["controls=yes", 'The controls parameter takes true, not "yes".'],
      ["controls=", 'The controls parameter takes true, not "".'],
      ["controls", 'The controls parameter takes true, not "".'],
      ["controls=TRUE", 'The controls parameter takes true, not "TRUE".'],
      ["theme=blue", 'The theme parameter takes light or dark, not "blue".'],
      ["theme=system", 'The theme parameter takes light or dark, not "system".'],
      ["resize=1", 'The resize parameter takes true, not "1".'],
      // Read the same by the page and the frame: a second value must be one it takes too.
      ["controls=true&controls=false", 'The controls parameter takes true, not "false".'],
      ["theme=dark&theme=x", 'The theme parameter takes light or dark, not "x".'],
      ["theme=%3C%2Fscript%3E", 'The theme parameter takes light or dark, not "</script>".'],
    ];
    for (const [query, error] of cases) expect(read(query), query).toEqual({ error });
  });
});

describe("the embed page", () => {
  it("writes its option parser into its script, and nothing a value could close", () => {
    const page = embedPage(
      embedData({ examples: [] }, [{ target: "vue", src: "./vue/frame.html" }]),
    );
    expect(page).toContain(embedOptions.toString());
    expect(page.match(/<\/script>/g)).toHaveLength(2);
  });
});

/** A field holding a value, as a select or a text input does, or a checkbox's state. */
const field = (value: string, checked?: boolean): ControlField => ({
  value,
  ...(checked === undefined ? {} : { checked }),
});

describe("controlKit's props rule", () => {
  const kit = controlKit();
  const tone: PropControl = {
    name: "tone",
    optional: true,
    kind: "select",
    options: ["info", "warn"],
    initial: "info",
  };
  const on: PropControl = { name: "on", optional: true, kind: "boolean", initial: false };
  const open: PropControl = { name: "open", optional: false, kind: "boolean", initial: false };
  const size: PropControl = { name: "size", optional: true, kind: "number", initial: 0 };
  const count: PropControl = { name: "count", optional: false, kind: "number", initial: 3 };
  const label: PropControl = { name: "label", optional: false, kind: "string", initial: "" };

  it("gives a component each control's value, leaving out an optional one at its default", () => {
    const rows: [Record<string, ControlField>, Record<string, unknown>][] = [
      [
        {
          tone: field(""),
          on: field(""),
          open: field("", false),
          size: field(""),
          count: field(""),
          label: field(""),
        },
        { open: false, count: 3, label: "" },
      ],
      [
        {
          tone: field("warn"),
          on: field("false"),
          open: field("", true),
          size: field("2.5"),
          count: field("0"),
          label: field("Hi"),
        },
        { tone: "warn", on: false, open: true, size: 2.5, count: 0, label: "Hi" },
      ],
    ];
    for (const [fields, props] of rows) {
      expect(
        kit.componentProps([tone, on, open, size, count, label], (name) => fields[name]!),
      ).toEqual(props);
    }
  });

  it("gives an example nothing at its defaults, and otherwise every key, undefined at default", () => {
    const controls: ExampleControl[] = [
      { ...tone, key: "ufControl0" },
      { ...on, key: "ufControl1" },
      { ...size, key: "ufControl2" },
    ];
    const rows: [Record<string, string>, Record<string, unknown>][] = [
      [{ ufControl0: "", ufControl1: "", ufControl2: "" }, {}],
      [
        { ufControl0: "warn", ufControl1: "", ufControl2: "" },
        { ufControl0: "warn", ufControl1: undefined, ufControl2: undefined },
      ],
      [
        { ufControl0: "", ufControl1: "true", ufControl2: "4" },
        { ufControl0: undefined, ufControl1: true, ufControl2: 4 },
      ],
    ];
    for (const [values, props] of rows) {
      const result = kit.exampleProps(controls, (key) => field(values[key]!));
      expect(result).toEqual(props);
      // `toEqual` passes a missing key for an undefined one: the keys themselves are the rule.
      expect(Object.keys(result).toSorted()).toEqual(Object.keys(props).toSorted());
    }
  });

  it("is the one the shell writes into its page", () => {
    const page = shellPage(shellData({ examples: [], components: [], diagnostics: [] }, []));
    expect(page).toContain(controlKit.toString());
  });
});
