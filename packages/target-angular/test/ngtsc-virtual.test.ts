import { EventEmitter } from "node:events";
import { join } from "node:path";

import type { ResolvedConfig } from "vite";
import { afterAll, describe, expect, it } from "vitest";

import { compilePool, ngtscVirtual, poolSize, workerUrl } from "../src/toolchain/ngtsc-virtual.ts";
import type {
  CompileRequest,
  CompileThread,
  Compiled,
  WorkerReply,
  WorkerRequest,
} from "../src/toolchain/ngtsc-virtual.ts";
import { loadCompiler } from "../src/toolchain/tools.ts";
import { component, context, isolatedDir, ngtscPlugin, removeScratch } from "./helpers.ts";

afterAll(removeScratch);

/** A parent component that binds `binding` on the child it imports from `./Child.uf.tsx`. */
const parent = (binding: string) =>
  [
    'import { Component } from "@angular/core";',
    'import Child from "./Child.uf.tsx";',
    "",
    "@Component({",
    '  selector: "uf-parent",',
    "  imports: [Child],",
    `  template: \`<uf-child ${binding}="'x'" />\`,`,
    "})",
    "export default class Parent {}",
    "",
  ].join("\n");

describe("ngtscVirtual", () => {
  const directory = isolatedDir();
  const id = (name: string) => join(directory, `${name}.uf.tsx.ts`);

  it("compiles a virtual module ahead of time", async () => {
    const { transform, warnings } = await ngtscPlugin();
    const result = await transform(id("Hello"), component("Hello", '<p class="greeting">Hi</p>'));
    expect(result.code).toContain("ɵɵdefineComponent");
    expect(result.code).toContain('ɵɵdomElementStart(0, "p", 0)');
    expect(result.code).not.toMatch(/@Component\(|sourceMappingURL/);
    expect(JSON.parse(result.map!)).toMatchObject({ version: 3, sources: ["Hello.uf.tsx.ts"] });
    expect(warnings).toEqual([]);
  });

  it("fails the module on a template parse error", async () => {
    const { transform } = await ngtscPlugin();
    await expect(transform(id("Broken"), component("Broken", "<p>x</span>"))).rejects.toThrow(
      /ngtsc rejected .*Broken\.uf\.tsx\.ts \(NG5002\)/,
    );
  });

  // A browser gets a module that failed to transform without its reason.
  it("makes a rejected module throw its reason in the browser", async () => {
    const { transform, logged } = await ngtscPlugin({}, "client");
    const code = `${component("Thrown", "<p>x</span>")}export const named = 1;\n`;
    const { code: replaced } = await transform(id("Thrown"), code);
    expect(logged).toEqual([
      expect.stringMatching(/ngtsc rejected .*Thrown\.uf\.tsx\.ts \(NG5002\)/),
    ]);
    expect(replaced).toBe(
      `throw new Error(${JSON.stringify(logged[0])});\n` +
        "export default undefined;\n" +
        "const failed = undefined;\n" +
        'export { failed as "named" };\n',
    );
  });

  it("fails the module on a template type error", async () => {
    const { transform } = await ngtscPlugin();
    await expect(transform(id("Typo"), component("Typo", "<p>{{ nope }}</p>"))).rejects.toThrow(
      /TS2339: Property 'nope' does not exist on type 'Typo'/,
    );
  });

  it("fails the module on a type error in its class", async () => {
    const { transform } = await ngtscPlugin();
    const code = component("Typed", "<p>x</p>", '\n  readonly count: number = "one";\n');
    await expect(transform(id("Typed"), code)).rejects.toThrow(/\(TS2322\)/);
  });

  it("passes extended template diagnostics on as warnings", async () => {
    const { transform, warnings } = await ngtscPlugin();
    const code = component(
      "Click",
      '<button type="button" (click)="go">x</button>',
      "\n  go(): void {}\n",
    );
    await expect(transform(id("Click"), code)).resolves.toMatchObject({ code: expect.any(String) });
    expect(warnings).toEqual([expect.stringMatching(/warning NG8111: /)]);
  });

  // Generated code imports `./Child.uf.tsx`: the child's generated Angular source, read from
  // the unframework plugin, not the unframework source on disk.
  it("compiles imports of other components against their generated source", async () => {
    const child = component(
      "Child",
      "<em>{{ label() }}</em>",
      "\n  readonly label = input.required<string>();\n",
    );
    const { transform } = await ngtscPlugin({ [id("Child")]: child });
    await expect(transform(id("Parent"), parent("[label]"))).resolves.toMatchObject({
      code: expect.stringContaining("dependencies: [Child]"),
    });
    await expect(transform(id("Parent"), parent("[lable]"))).rejects.toThrow(/NG8002/);
  });

  // ADR-0053: an output imports a child's output (`./field`), a virtual module the unframework
  // plugin serves only once Vite has loaded it.
  describe("a child's output", () => {
    const field = component(
      "Field",
      "<em>{{ label() }}</em>",
      "\n  readonly label = input.required<string>();\n",
    );
    /** A parent that imports `Field` from `specifier` and binds `binding` on it. */
    const form = (specifier: string, binding: string) =>
      [
        'import { Component } from "@angular/core";',
        `import Field from "${specifier}";`,
        "",
        "@Component({",
        '  selector: "uf-form",',
        "  imports: [Field],",
        `  template: \`<uf-field ${binding}="'x'" />\`,`,
        "})",
        "export default class Form {}",
        "",
      ].join("\n");

    it("is resolved through Vite and loaded before the parent compiles", async () => {
      const { transform, loaded } = await ngtscPlugin({ [id("Field")]: field }, "server", {
        lazy: true,
        resolve: (specifier, importer) =>
          specifier === "./field" && importer === id("Form") ? id("Field") : undefined,
      });
      await expect(transform(id("Form"), form("./field", "[label]"))).resolves.toMatchObject({
        code: expect.stringContaining("dependencies: [Field]"),
      });
      expect(loaded).toEqual([id("Field")]);
      // Checked against the child's inputs: a misspelt one fails strict templates.
      await expect(transform(id("Form"), form("./field", "[lable]"))).rejects.toThrow(/NG8002/);
      expect(loaded).toEqual([id("Field")]);
    });

    it("may be a file's other component (`X.uf.tsx.<output file>`)", async () => {
      const other = join(directory, "Fields.uf.tsx.field.ts");
      const { transform, loaded } = await ngtscPlugin({ [other]: field }, "server", {
        lazy: true,
        resolve: (specifier) => (specifier === "./field" ? other : undefined),
      });
      await expect(transform(id("Form"), form("./field", "[label]"))).resolves.toMatchObject({
        code: expect.stringContaining("dependencies: [Field]"),
      });
      expect(loaded).toEqual([other]);
    });

    // ADR-0069: a composable's module, `X.uf.ts.ts`, which the component's program reads, so
    // its template is checked against the composable's types.
    it("may be a composable's module (`X.uf.ts.ts`)", async () => {
      const composable = join(directory, "useLabel.uf.ts.ts");
      const source = [
        'import { signal } from "@angular/core";',
        "",
        "export function useLabel() {",
        '  const label = signal("x");',
        "  return { label: label.asReadonly() };",
        "}",
        "",
      ].join("\n");
      const caller = (read: string) =>
        [
          'import { Component } from "@angular/core";',
          'import { useLabel } from "./use-label";',
          "",
          "@Component({",
          '  selector: "uf-caller",',
          `  template: \`<em>{{ label.${read}() }}</em>\`,`,
          "})",
          "export default class Caller {",
          "  protected readonly label = useLabel();",
          "}",
          "",
        ].join("\n");
      const { transform, loaded } = await ngtscPlugin({ [composable]: source }, "server", {
        lazy: true,
        resolve: (specifier) => (specifier === "./use-label" ? composable : undefined),
      });
      await expect(transform(id("Caller"), caller("label"))).resolves.toMatchObject({
        code: expect.stringContaining("useLabel()"),
      });
      expect(loaded).toEqual([composable]);
      await expect(transform(id("Caller"), caller("lable"))).rejects.toThrow(/TS2551|TS2339/);
      // The module itself compiles as one of the plugin's ids.
      await expect(transform(composable)).resolves.toMatchObject({
        code: expect.stringContaining("asReadonly"),
      });
    });

    it("is loaded once along a cycle of imports", async () => {
      const cyclic = (name: string, other: string) =>
        [
          'import { Component, forwardRef } from "@angular/core";',
          `import ${other} from "./${other.toLowerCase()}";`,
          "",
          "@Component({",
          `  selector: "uf-${name.toLowerCase()}",`,
          `  imports: [forwardRef(() => ${other})],`,
          "  template: `<p>" + name + "</p>`,",
          "})",
          `export default class ${name} {}`,
          "",
        ].join("\n");
      const sources = {
        [id("Ping")]: cyclic("Ping", "Pong"),
        [id("Pong")]: cyclic("Pong", "Ping"),
      };
      const { transform, loaded } = await ngtscPlugin(sources, "server", {
        lazy: true,
        resolve: (specifier) =>
          new Map([
            ["./ping", id("Ping")],
            ["./pong", id("Pong")],
          ]).get(specifier),
      });
      await expect(transform(id("Ping"))).resolves.toMatchObject({
        code: expect.stringContaining("ɵɵdefineComponent"),
      });
      expect(loaded).toEqual([id("Pong")]);
    });

    // The golden guard fails a child it rejects in its load, inside the parent's transform.
    it("fails the parent with the reason a child failed to load for", async () => {
      const reason = "[uf guard] The angular output of Field.uf.tsx is not its golden output";
      const options = {
        lazy: true,
        loadError: reason,
        resolve: (specifier: string) => (specifier === "./field" ? id("Field") : undefined),
      };
      const server = await ngtscPlugin({}, "server", options);
      await expect(server.transform(id("Form"), form("./field", "[label]"))).rejects.toThrow(
        reason,
      );
      const client = await ngtscPlugin({}, "client", options);
      const { code } = await client.transform(id("Form"), form("./field", "[label]"));
      expect(client.logged).toEqual([expect.stringContaining(reason)]);
      expect(code).toBe(
        `throw new Error(${JSON.stringify(client.logged[0])});\nexport default undefined;\n`,
      );
    });

    it("fails the parent when Vite cannot resolve it", async () => {
      const { transform, loaded } = await ngtscPlugin({}, "server", { lazy: true });
      await expect(transform(id("Form"), form("./field", "[label]"))).rejects.toThrow(/TS2307/);
      expect(loaded).toEqual([]);
    });
  });

  it("fails the module when an imported component was never compiled", async () => {
    const { transform } = await ngtscPlugin();
    const code = [
      'import { Component } from "@angular/core";',
      'import Missing from "./Missing.uf.tsx";',
      "",
      '@Component({ selector: "uf-lonely", imports: [Missing], template: `<uf-missing />` })',
      "export default class Lonely {}",
      "",
    ].join("\n");
    await expect(transform(id("Lonely"), code)).rejects.toThrow(/TS2307/);
  });

  it("compiles modules requested together", async () => {
    const { transform } = await ngtscPlugin();
    const names = ["One", "Two", "Three"];
    const results = await Promise.all(
      names.map((name) => transform(id(name), component(name, `<p>${name}</p>`))),
    );
    for (const [index, name] of names.entries()) {
      expect(results[index]!.code).toContain(`ɵɵtext(1, "${name}")`);
    }
  });

  // Vitest serves every project's transforms from one main thread. A compile that held it would
  // stall the other projects' modules, and Angular's SSR renders behind them, for as long as it
  // runs: the compile runs in a worker.
  it("leaves the main thread free while it compiles", async () => {
    const { transform } = await ngtscPlugin();
    // Enough bindings that a compile takes a while even on a warm program.
    const template = Array.from(
      { length: 400 },
      (_, index) => `<p [title]="n + ${index}">{{ n }}</p>`,
    );
    const code = component("Busy", template.join(""), "\n  readonly n = 1;\n");
    let last = performance.now();
    let longest = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      longest = Math.max(longest, now - last);
      last = now;
    }, 5);
    const started = performance.now();
    try {
      await transform(id("Busy"), code);
    } finally {
      clearInterval(timer);
    }
    const ended = performance.now();
    longest = Math.max(longest, ended - last);
    expect(longest).toBeLessThan((ended - started) / 2);
  });

  // The worker has no unframework plugin to ask: every virtual module the compile reads is
  // posted to it with the request, a child's own imports too. Here the child's input takes its
  // type from the module it imports.
  it("compiles against the modules a child imports", async () => {
    const leaf = (size: string) =>
      `${component("Leaf", "<em>leaf</em>")}export type Size = ${JSON.stringify(size)};\n`;
    const child = [
      'import { Component, input } from "@angular/core";',
      'import type { Size } from "./Leaf.uf.tsx";',
      "",
      '@Component({ selector: "uf-child", template: `<p>{{ size() }}</p>` })',
      "export default class Child {",
      "  readonly size = input.required<Size>();",
      "}",
      "",
    ].join("\n");
    const fits = await ngtscPlugin({ [id("Leaf")]: leaf("x"), [id("Child")]: child });
    await expect(fits.transform(id("Parent"), parent("[size]"))).resolves.toMatchObject({
      code: expect.stringContaining("dependencies: [Child]"),
    });
    const misfits = await ngtscPlugin({ [id("Leaf")]: leaf("s"), [id("Child")]: child });
    await expect(misfits.transform(id("Parent"), parent("[size]"))).rejects.toThrow(/TS2322/);
  });

  // ADR-0063: the sheet is in no file on disk, and ngtsc reads a `styleUrl` itself.
  it("compiles a component's scoped sheet, which the unframework plugin serves", async () => {
    const styled = component("Card", '<p class="label">Hi</p>').replace(
      "  template:",
      '  styleUrl: "./Card.uf.tsx.css",\n  template:',
    );
    const sheet = ".label[data-uf-0a1b2c3d] { color: rgb(1, 2, 3); }\n";
    const { transform } = await ngtscPlugin({}, "server", {
      sheets: { [join(directory, "Card.uf.tsx")]: sheet },
    });
    const { code } = await transform(id("Card"), styled);
    expect(code).toContain("rgb(1, 2, 3)");
    const unserved = await ngtscPlugin();
    await expect(unserved.transform(id("Card"), styled)).rejects.toThrow(/Card\.uf\.tsx\.css/);
  });

  it("refuses to run without the unframework plugin", async () => {
    const plugin = ngtscVirtual(await loadCompiler(context.toolchainDir));
    expect(() =>
      (plugin.configResolved as (config: ResolvedConfig) => void)({
        plugins: [plugin],
      } as unknown as ResolvedConfig),
    ).toThrow(/no plugin named "unframework" exposing api\.getCompiled\(id\) and api\.getSheet/);
  });
});

describe("workerUrl", () => {
  it("starts the worker beside the module, with the module's own extension", () => {
    expect(workerUrl("file:///pkg/src/toolchain/ngtsc-virtual.ts").href).toBe(
      "file:///pkg/src/toolchain/ngtsc-worker.ts",
    );
    expect(workerUrl("file:///pkg/dist/toolchain/ngtsc-virtual.js").href).toBe(
      "file:///pkg/dist/toolchain/ngtsc-worker.js",
    );
  });
});

/** A thread that records what it gets, and replies only when a test says so. */
class FakeThread extends EventEmitter implements CompileThread {
  readonly received: WorkerRequest[] = [];
  referenced = false;
  postMessage(message: WorkerRequest): void {
    this.received.push(message);
  }
  ref(): void {
    this.referenced = true;
  }
  unref(): void {
    this.referenced = false;
  }
  /** The compiles it holds that it has not replied to, by request number. */
  get compiles(): (CompileRequest & { request: number })[] {
    return this.received.filter((message) => "request" in message);
  }
  /** Replies to the compile of `id` with code naming the thread. */
  reply(id: string, code: string): void {
    const { request } = this.compiles.find((message) => message.id === id)!;
    this.emit("message", { request, compiled: compiled(code) } satisfies WorkerReply);
  }
}

const compiled = (code: string): Compiled => ({
  code,
  errors: "",
  codes: [],
  warnings: "",
  exports: [],
});
const request = (plugin: number, id: string): CompileRequest => ({
  plugin,
  id,
  sources: [],
  children: [],
  declarations: [],
});

describe("compilePool", () => {
  /** A pool of fake threads, and the threads it started. */
  const fakePool = (size: number) => {
    const threads: FakeThread[] = [];
    const pool = compilePool(() => {
      const thread = new FakeThread();
      threads.push(thread);
      return thread;
    }, size);
    return { pool, threads };
  };

  it("runs two compiles of one plugin at once, on two threads, each with its own outcome", async () => {
    const { pool, threads } = fakePool(4);
    const first = pool.compile(request(0, "A"));
    const second = pool.compile(request(0, "B"));
    // Both are posted before either replies: the second does not wait for the first.
    expect(threads).toHaveLength(2);
    expect(threads.map((thread) => thread.compiles.map(({ id }) => id))).toEqual([["A"], ["B"]]);
    threads[1]!.reply("B", "b");
    threads[0]!.reply("A", "a");
    expect(await second).toEqual(compiled("b"));
    expect(await first).toEqual(compiled("a"));
  });

  it("starts a thread only when every thread alive is busy, and no more than its size", async () => {
    const { pool, threads } = fakePool(2);
    const a = pool.compile(request(0, "A"));
    threads[0]!.reply("A", "a");
    await a;
    // The first thread is idle again: the next compile reuses it, and its program.
    const b = pool.compile(request(0, "B"));
    expect(threads).toHaveLength(1);
    const c = pool.compile(request(0, "C"));
    const d = pool.compile(request(0, "D"));
    // At its size, a compile waits on the thread with the fewest compiles waiting.
    expect(threads).toHaveLength(2);
    expect(threads.map((thread) => thread.compiles.map(({ id }) => id))).toEqual([
      ["A", "B", "D"],
      ["C"],
    ]);
    threads[0]!.reply("B", "b");
    threads[1]!.reply("C", "c");
    threads[0]!.reply("D", "d");
    expect(await Promise.all([b, c, d])).toEqual([compiled("b"), compiled("c"), compiled("d")]);
  });

  it("holds the process open only while a compile waits on a thread", async () => {
    const { pool, threads } = fakePool(1);
    const a = pool.compile(request(0, "A"));
    expect(threads[0]!.referenced).toBe(true);
    threads[0]!.reply("A", "a");
    await a;
    expect(threads[0]!.referenced).toBe(false);
  });

  it("sends a released plugin to every thread, so its programs leave each one", async () => {
    const { pool, threads } = fakePool(3);
    const pending = [pool.compile(request(7, "A")), pool.compile(request(7, "B"))];
    pool.release(7);
    expect(threads).toHaveLength(2);
    for (const thread of threads) expect(thread.received.at(-1)).toEqual({ release: 7 });
    threads[0]!.reply("A", "a");
    threads[1]!.reply("B", "b");
    await Promise.all(pending);
  });

  it("fails only the compiles a dead thread held, and starts another for the next", async () => {
    const { pool, threads } = fakePool(2);
    const a = pool.compile(request(0, "A"));
    const b = pool.compile(request(0, "B"));
    const crash = new Error("out of memory");
    threads[0]!.emit("error", crash);
    await expect(a).rejects.toBe(crash);
    expect(pool.threads).toBe(1);
    // A thread emits `exit` after `error`: it rejects nothing more.
    threads[0]!.emit("exit", 1);
    const c = pool.compile(request(0, "C"));
    expect(threads).toHaveLength(3);
    expect(threads[2]!.compiles.map(({ id }) => id)).toEqual(["C"]);
    threads[1]!.reply("B", "b");
    threads[2]!.reply("C", "c");
    expect(await b).toEqual(compiled("b"));
    expect(await c).toEqual(compiled("c"));
  });

  it("fails the compiles of a thread that exits without an error", async () => {
    const { pool, threads } = fakePool(1);
    const a = pool.compile(request(0, "A"));
    threads[0]!.emit("exit", 0);
    await expect(a).rejects.toThrow(/exited with code 0/);
    expect(pool.threads).toBe(0);
  });

  it("passes on what a compile threw, and keeps the thread", async () => {
    const { pool, threads } = fakePool(1);
    const a = pool.compile(request(0, "A"));
    const { request: number } = threads[0]!.compiles[0]!;
    threads[0]!.emit("message", { request: number, failure: "boom" } satisfies WorkerReply);
    await expect(a).rejects.toBe("boom");
    expect(pool.threads).toBe(1);
  });

  it.each([0, -1, 1.5, Number.NaN])("refuses a size of %d", (size) => {
    expect(() => compilePool(() => new FakeThread(), size)).toThrow(/at least one thread/);
  });
});

describe("poolSize", () => {
  it("is half the machine's parallelism, from 1 to 4", () => {
    expect([1, 2, 3, 4, 6, 8, 9, 14, 64].map((parallelism) => poolSize(parallelism))).toEqual([
      1, 1, 1, 2, 3, 4, 4, 4, 4,
    ]);
  });
});
