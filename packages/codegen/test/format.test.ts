import { describe, expect, it } from "vitest";

import { formatOutput } from "../src/index.ts";

/** Formats a file, failing on a format error, and checks that formatting again changes nothing. */
async function formatted(path: string, contents: string): Promise<string> {
  const once = await formatOutput({ path, contents });
  if (once.error) throw new Error(once.error);
  const twice = await formatOutput(once.file);
  expect(twice.error).toBeUndefined();
  expect(twice.file.contents).toBe(once.file.contents);
  return once.file.contents;
}

// Markup that oxfmt would lay out differently: a run of inline elements past the print width,
// whose spaces Vue's `condense` would drop if a formatter moved them onto line breaks.
const line = `<p>${"<a>link</a> ".repeat(12)}</p>`;

describe("formatOutput on script blocks", () => {
  it('formats a Vue `<script setup lang="ts">` as TypeScript, unindented, and leaves the template', async () => {
    const contents = [
      '<script setup lang="ts">',
      "export interface BadgeProps {label: string; tone?: 'info'|'warn'}",
      "const {label,tone='info'}=defineProps<BadgeProps>()",
      "</script>",
      "",
      "<template>",
      `  ${line}`,
      "</template>",
      "",
      "",
    ].join("\n");
    expect(await formatted("Badge.vue", contents)).toBe(
      [
        '<script setup lang="ts">',
        "export interface BadgeProps {",
        "  label: string;",
        '  tone?: "info" | "warn";',
        "}",
        'const { label, tone = "info" } = defineProps<BadgeProps>();',
        "</script>",
        "",
        "<template>",
        `  ${line}`,
        "</template>",
        "",
      ].join("\n"),
    );
  });

  it('indents a Svelte `<script lang="ts">` two spaces, but not a literal\'s own lines', async () => {
    const contents = [
      "<svelte:options runes={true} preserveWhitespace={false} />",
      '<script lang="ts">',
      "interface Props {label?: string}",
      "let {label=`two",
      "lines`}: Props=$props()",
      "</script>",
      "",
      line,
    ].join("\n");
    expect(await formatted("Badge.svelte", contents)).toBe(
      [
        "<svelte:options runes={true} preserveWhitespace={false} />",
        '<script lang="ts">',
        "  interface Props {",
        "    label?: string;",
        "  }",
        "  let {",
        "    label = `two",
        "lines`,",
        "  }: Props = $props();",
        "</script>",
        "",
        line,
        "",
      ].join("\n"),
    );
  });

  it("narrows the print width by the Svelte indentation", async () => {
    const long = `let { label = "${"x".repeat(70)}", tone }: Props = $props();`;
    const result = await formatted("A.svelte", `<script lang="ts">\n${long}\n</script>\n`);
    expect(result.split("\n").every((text) => text.length <= 100)).toBe(true);
    expect(result).toContain("  let {\n    label =");
  });

  it("formats an Astro frontmatter as TypeScript and leaves the markup", async () => {
    const contents = [
      "---",
      "type Props = {label: string}",
      "const {label}=Astro.props",
      "---",
      line,
      "",
    ].join("\n");
    expect(await formatted("Badge.astro", contents)).toBe(
      [
        "---",
        "type Props = { label: string };",
        "const { label } = Astro.props;",
        "---",
        line,
        "",
      ].join("\n"),
    );
    // A file without frontmatter is markup only.
    expect(await formatted("Plain.astro", `${line}\n\n`)).toBe(`${line}\n`);
  });

  it("ends a block at its first `</script`, and keeps `<\\/script` in a string as written", async () => {
    const contents = [
      '<script setup lang="ts">',
      "const {label='<\\/script>'}=defineProps<{label?: string}>()",
      "</script>",
      "",
      "<template>",
      "  <p>{{ label }}</p>",
      "</template>",
    ].join("\n");
    const result = await formatted("A.vue", contents);
    expect(result).toContain(
      'const { label = "<\\/script>" } = defineProps<{ label?: string }>();',
    );
    expect(result.match(/<\/script/g)).toHaveLength(1);
  });

  it("formats every TypeScript block, and only those", async () => {
    const contents = [
      '<script lang="ts" module>',
      "export const a=1",
      "</script>",
      '<script lang="ts">',
      "let b=2",
      "</script>",
      "<script>",
      "let c=3",
      "</script>",
    ].join("\n");
    expect(await formatted("A.svelte", contents)).toBe(
      [
        '<script lang="ts" module>',
        "  export const a = 1;",
        "</script>",
        '<script lang="ts">',
        "  let b = 2;",
        "</script>",
        "<script>",
        "let c=3",
        "</script>",
        "",
      ].join("\n"),
    );
  });

  it("reports a block that does not parse instead of throwing", async () => {
    const outcome = await formatOutput({
      path: "A.vue",
      contents: '<script setup lang="ts">\nconst = ;\n</script>\n',
    });
    expect(outcome.error).toBeTruthy();
    expect(outcome.file.contents).toBe('<script setup lang="ts">\nconst = ;\n</script>\n');
    const unclosed = await formatOutput({ path: "A.astro", contents: "---\nconst a = 1;\n" });
    expect(unclosed.error).toMatch(/closing `---`/);
  });
});
