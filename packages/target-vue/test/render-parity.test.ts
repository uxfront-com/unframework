// The Vue output, formatted and not, compiled by @vue/compiler-sfc as @vitejs/plugin-vue compiles
// it (the script block with the template inlined into `setup`, as in a build, or the template as a
// render function of its own, as under the dev server) and rendered by Vue's server renderer with
// the suite's props: the DOM must be exactly the one the reference describes, and Vue must not
// warn. Vue is the reference target (D10), so a space it loses here is written into every
// target's shared expectations.
import { format as formatMessage } from "node:util";

import { afterAll, describe, expect, it, vi } from "vitest";
import { compileScript, compileTemplate, parse } from "vue/compiler-sfc";

import { emitParity, parityProps, paritySuites } from "../../codegen/test/render-parity-node.ts";
import { compareCases, parseHtml } from "../../codegen/test/render-parity.ts";
import type { ParitySuite } from "../../codegen/test/render-parity.ts";
import target from "../src/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { importScratch, removeScratch } from "./helpers.ts";

afterAll(removeScratch);

/** How the component is emitted and compiled. */
interface Setup {
  format: boolean;
  /** Whether the template is inlined into `setup`, as plugin-vue does in a production build. */
  inline: boolean;
}

let compiled = 0;

/**
 * Compiles and server-renders the parity component, as the `ssr:vue` project would, with what
 * the compiler and Vue logged meanwhile.
 */
async function render(
  suite: ParitySuite,
  { format, inline }: Setup,
): Promise<{ html: string; logged: string[] }> {
  const [file] = await emitParity(target, suite, { format });
  const id = `render-parity-${compiled++}`;
  const { descriptor, errors } = parse(file!.contents, { filename: file!.path });
  expect(errors).toEqual([]);
  const logged: string[] = [];
  const capture = (...args: unknown[]) => void logged.push(formatMessage(...args));
  const onWarn = (warning: { message: string }) => void logged.push(warning.message);
  const spies = [
    vi.spyOn(console, "error").mockImplementation(capture),
    vi.spyOn(console, "warn").mockImplementation(capture),
  ];
  try {
    const script = descriptor.scriptSetup
      ? compileScript(descriptor, {
          id,
          inlineTemplate: inline,
          templateOptions: {
            ssr: true,
            ssrCssVars: [],
            transformAssetUrls: false,
            compilerOptions: { onWarn },
          },
        })
      : undefined;
    let code: string;
    if (script && inline) {
      code = script.content;
    } else {
      const template = compileTemplate({
        source: descriptor.template!.content,
        // plugin-vue reuses the descriptor's AST, so whitespace is condensed exactly once, there.
        ast: descriptor.template!.ast,
        filename: file!.path,
        id,
        ssr: true,
        ssrCssVars: [],
        transformAssetUrls: false,
        compilerOptions: {
          onWarn,
          ...(script
            ? { bindingMetadata: script.bindings, expressionPlugins: ["typescript"] }
            : {}),
        },
      });
      expect(template.errors).toEqual([]);
      const component = script
        ? script.content.replace("export default ", "const component = ")
        : "const component = {};";
      code = `${component}\n${template.code}\ncomponent.ssrRender = ssrRender;\nexport default component;\n`;
    }
    // A `.ts` scratch file: Vite strips the script block's types, as plugin-vue has it do.
    const { default: component } = await importScratch<{ default: unknown }>(`${id}.ts`, code);
    return { html: await renderToString(component, { props: parityProps(suite) }), logged };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

describe.each<Setup>([
  { format: true, inline: true },
  { format: true, inline: false },
  { format: false, inline: false },
])("vue output (formatted: $format, template inlined: $inline), rendered by Vue", (setup) => {
  it.each(paritySuites())(
    "renders $title exactly as the reference describes them",
    async (suite) => {
      const { html, logged } = await render(suite, setup);
      expect(logged).toEqual([]);
      for (const { name, expected, actual } of compareCases(parseHtml(html), suite)) {
        expect.soft(actual, name).toEqual(expected);
      }
    },
  );
});
