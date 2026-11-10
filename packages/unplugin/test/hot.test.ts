// Hot updates on real Vite dev servers, with the watcher on and each framework's own plugin
// (ADR-0075). The project sits under this package, gitignored, because the outputs import their
// frameworks from the project's own directory.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import type { Toolchain } from "@unframework/codegen";
import type { CompilerPlugin, TargetName } from "@unframework/compiler";
import { toolchain as qwik } from "@unframework/target-qwik/toolchain";
import { toolchain as react } from "@unframework/target-react/toolchain";
import { toolchain as solid } from "@unframework/target-solid/toolchain";
import { toolchain as svelte } from "@unframework/target-svelte/toolchain";
import { toolchain as vue } from "@unframework/target-vue/toolchain";
import { dev } from "astro";
import { createServer } from "vite";
import type { HotPayload, Plugin, ViteDevServer } from "vite";
import solidPlugin from "vite-plugin-solid";
import { afterEach, describe, expect, it, vi } from "vitest";

import astro from "../src/astro.ts";
import unframework from "../src/vite.ts";

// A real server with real framework plugins, and a real watcher, which takes seconds.
const SLOW = 60_000;
const HOT = { timeout: 15_000, interval: 20 };

// Polling, because file events are late on macOS: they report the setup's writes after the watcher
// starts, and an edit written just after that report gets no event of its own. A poll only sees
// what changes after it starts, on every platform.
const WATCH = { usePolling: true, interval: 20, binaryInterval: 20 };

// How long after a path's last report chokidar drops a `change` for it.
const CHANGE_THROTTLE = 50;

const HOST = "127.0.0.1";

const CARD = (text: string) =>
  `import "./Card.css";\nimport type { Props } from "./types.ts";\n\nexport default function Card(props: Props) {\n  return <p class="card">${text}, {props.label}</p>;\n}\n`;
const TYPES = "export interface Props {\n  label: string;\n}\n";
const FILES: Record<string, string> = {
  "main.ts": 'import Card from "./src/Card.uf.tsx";\n\nexport { Card };\n',
  "src/Card.uf.tsx": CARD("Hello"),
  "src/Card.css": ".card { color: red; }\n",
  "src/types.ts": TYPES,
};

let roots: string[] = [];

function createRoot(files: Record<string, string>): string {
  const here = fileURLToPath(new URL("..", import.meta.url));
  mkdirSync(join(here, ".uf-tmp"), { recursive: true });
  const root = realpathSync(mkdtempSync(join(here, ".uf-tmp", "hot-")));
  roots.push(root);
  for (const [path, contents] of Object.entries(files)) write(root, path, contents);
  return root;
}

function write(root: string, path: string, contents: string): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
});

/** A dev server with its watcher on, and what it reports of each change. */
interface HotServer {
  server: ViteDevServer;
  /** What the server sent the client since the last {@link HotServer.edit}. */
  sent: HotPayload[];
  /** The modules the unframework plugin left in the ssr environment's list, by id. */
  ssrModules: string[];
  /** How many compiles the project has run, from a compiler plugin that sees every one. */
  compiles(): number;
  /** Runs an edit and resolves once Vite has finished the hot update it causes. */
  edit(path: string, change: () => void | Promise<void>): Promise<void>;
  /** What the browser would do: fetches the entry and every local module it imports. */
  fetchAll(): Promise<Map<string, string>>;
  close(): Promise<void>;
}

async function startHot(
  root: string,
  target: TargetName,
  toolchain: Toolchain,
  mode: "browser" | "ssr" = "browser",
): Promise<HotServer> {
  let compiles = 0;
  const counter: CompilerPlugin = { name: "count", output: () => void (compiles += 1) };
  const framework = await toolchain.vite(mode, { root, toolchainDir: root });
  const ssrModules: string[] = [];
  const probe: Plugin = {
    name: "probe",
    enforce: "post",
    hotUpdate(options) {
      if (this.environment.name === "client") {
        started.add(options.file);
        inFlight += 1;
      }
      if (this.environment.name === "ssr") {
        ssrModules.push(...options.modules.flatMap((node) => (node.id ? [node.id] : [])));
      }
    },
  };
  // `hotUpdateEnvironments` isn't told which change it finishes, so an edit is done once its own
  // file's update has started and none is left running.
  const started = new Set<string>();
  let inFlight = 0;
  let settle: ((file: string) => void) | undefined;
  const server = await createServer({
    ...framework,
    root,
    configFile: false,
    appType: "custom",
    clearScreen: false,
    logLevel: "silent",
    server: {
      middlewareMode: true,
      ws: false,
      watch: WATCH,
      async hotUpdateEnvironments(viteServer, hmr) {
        await Promise.all(Object.values(viteServer.environments).map((each) => hmr(each)));
        inFlight -= 1;
        if (inFlight === 0) for (const file of started) settle?.(file);
      },
    },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [...unframework({ target, plugins: [counter] }), ...(framework.plugins ?? []), probe],
  });
  const reported = new Map<string, number>();
  server.watcher.on("all", (_event, file) => reported.set(file, performance.now()));
  // The watcher's `ready` event may fire before any plugin can listen for it, so this waits for
  // the watcher to report a file in the deepest directory the tests edit. chokidar reads a
  // directory before it starts polling it, so a file created between the two is in neither: the
  // read missed it, and the poll's first look already includes it. Rewriting that file never
  // changes its directory again, so each attempt creates a new file, which does.
  const sentinels: string[] = [];
  await vi.waitFor(() => {
    const sentinel = `src/.watching-${sentinels.length}`;
    write(root, sentinel, "");
    sentinels.push(join(root, sentinel));
    expect(sentinels.some((file) => reported.has(file))).toBe(true);
  }, HOT);
  const client = server.environments.client;
  // The environment the page's modules load in: Qwik and Astro render on the server.
  const environment = mode === "ssr" ? server.environments.ssr : client;
  const sent: HotPayload[] = [];
  const send = client.hot.send.bind(client.hot);
  vi.spyOn(client.hot, "send").mockImplementation((...args: Parameters<typeof send>) => {
    if (typeof args[0] === "object") sent.push(args[0]);
    send(...args);
  });
  return {
    server,
    sent,
    ssrModules,
    compiles: () => compiles,
    edit: async (path, change) => {
      const wanted = join(root, path);
      const elapsed = performance.now() - (reported.get(wanted) ?? Number.NEGATIVE_INFINITY);
      if (elapsed <= CHANGE_THROTTLE) await delay(CHANGE_THROTTLE - elapsed + 1);
      sent.length = 0;
      ssrModules.length = 0;
      started.clear();
      let timer: NodeJS.Timeout | undefined;
      const settled = new Promise<void>((resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Vite finished no hot update of ${path}.`)),
          HOT.timeout,
        );
        settle = (file) => {
          if (file === wanted) resolve();
        };
      });
      try {
        await change();
        await settled;
      } finally {
        clearTimeout(timer);
      }
    },
    fetchAll: async () => {
      const seen = new Map<string, string>();
      const visit = async (url: string): Promise<void> => {
        if (seen.has(url)) return;
        const result = await environment.transformRequest(url);
        seen.set(url, result?.code ?? "");
        // Only the imports its code names: a watch edge is in the graph, but no browser asks for it.
        for (const [, imported] of result?.code.matchAll(
          /(?:from|import|__vite_ssr_import__\()\s*"([^"]+)"/g,
        ) ?? []) {
          const plain = imported!.replace(/\bt=\d+&?/, "").replace(/[?&]$/, "");
          if (plain.startsWith("/") && !/node_modules|^\/@/.test(plain)) await visit(plain);
        }
      };
      await visit("/main.ts");
      return seen;
    },
    close: () => server.close(),
  };
}

const updates = (sent: readonly HotPayload[]) =>
  sent.flatMap((payload) => (payload.type === "update" ? payload.updates.map((u) => u.path) : []));

const contentsOf = (modules: ReadonlyMap<string, string>, part: string): string => {
  const entry = [...modules].find(([url]) => url.includes(part));
  if (!entry) throw new Error(`no fetched module holds ${part}: ${[...modules.keys()].join(", ")}`);
  return entry[1];
};

/** Solid's toolchain turns solid-refresh off for the tests, and an app has it on. */
const solidWithHmr: Toolchain = {
  ...solid,
  vite: () => ({ plugins: [solidPlugin()], resolve: { dedupe: ["solid-js"] } }),
};

// vite-plugin-svelte drops a module whose JS did not change, and types never change Svelte's JS,
// so a type-dependency edit reaches its page through the sheet alone.
//
// plugin-vue tracks the type files its own compiler read, and updates what imports them whatever
// changed there. That is Vue's own HMR: the project still compiles nothing.
const HMR_TARGETS: [TargetName, Toolchain, string, string, string[]][] = [
  ["react", react, "", "Card.uf.tsx", []],
  ["vue", vue, ".vue", "Card.uf.tsx.vue", ["/src/Card.uf.tsx.vue"]],
  ["svelte", svelte, ".svelte", "Card.uf.tsx.css", []],
  ["solid", solidWithHmr, "", "Card.uf.tsx", []],
];

describe.each(HMR_TARGETS)(
  "hot updates on %s",
  (target, toolchain, suffix, typeUpdate, frameworkUpdates) => {
    const main = `Card.uf.tsx${suffix}`;

    it(
      "sends an update for a .uf.tsx edit, a stylesheet edit and a type-dependency edit",
      { timeout: SLOW },
      async () => {
        const root = createRoot(FILES);
        const hot = await startHot(root, target, toolchain);
        try {
          await hot.fetchAll();

          await hot.edit("src/Card.uf.tsx", () => write(root, "src/Card.uf.tsx", CARD("Goodbye")));
          expect(updates(hot.sent).join()).toContain(main);
          expect(hot.sent.map((payload) => payload.type)).not.toContain("full-reload");
          expect(contentsOf(await hot.fetchAll(), main)).toContain("Goodbye");

          await hot.edit("src/Card.css", () =>
            write(root, "src/Card.css", ".card { color: blue; }\n"),
          );
          expect(updates(hot.sent).join()).toContain("Card.uf.tsx.css");
          // The scope id hashes the sheet (ADR-0063), so the markup changes with it.
          expect(updates(hot.sent).join()).toContain(main);
          expect(hot.sent.map((payload) => payload.type)).not.toContain("full-reload");
          expect(contentsOf(await hot.fetchAll(), "Card.uf.tsx.css")).toContain("blue");

          await hot.edit("src/types.ts", () =>
            write(
              root,
              "src/types.ts",
              "export interface Props {\n  label: string;\n  tone?: string;\n}\n",
            ),
          );
          expect(updates(hot.sent).join()).toContain(typeUpdate);
          expect(hot.sent.map((payload) => payload.type)).not.toContain("full-reload");
        } finally {
          await hot.close();
        }
      },
    );

    it(
      "recompiles nothing, and sends nothing, for an edit nothing reaches",
      { timeout: SLOW },
      async () => {
        const root = createRoot(FILES);
        const hot = await startHot(root, target, toolchain);
        try {
          await hot.fetchAll();
          const before = hot.compiles();

          // A declaration the component never reads leaves the shape the oracle read as it was.
          await hot.edit("src/types.ts", () =>
            write(
              root,
              "src/types.ts",
              `${TYPES}export type Unrelated = string;
`,
            ),
          );
          expect(updates(hot.sent)).toEqual(frameworkUpdates);
          expect(hot.sent.map((payload) => payload.type)).not.toContain("full-reload");
          await hot.fetchAll();
          expect(hot.compiles()).toBe(before);

          // A save that changes nothing.
          await hot.edit("src/Card.uf.tsx", () => write(root, "src/Card.uf.tsx", CARD("Hello")));
          expect(updates(hot.sent)).toEqual([]);
          expect(hot.sent.map((payload) => payload.type)).not.toContain("full-reload");
          expect(hot.compiles()).toBe(before);
        } finally {
          await hot.close();
        }
      },
    );
  },
);

describe("what a change reaches", () => {
  const FORM = {
    "main.ts": 'import Form from "./src/Form.uf.tsx";\n\nexport { Form };\n',
    "src/Form.uf.tsx":
      'import Field from "./Field.uf.tsx";\n\nexport default function Form() {\n  return <form><Field /></form>;\n}\n',
    "src/Field.uf.tsx": "export default function Field() {\n  return <input />;\n}\n",
  };

  it(
    "updates a parent when a child is deleted, and again when it is created",
    { timeout: SLOW },
    async () => {
      const root = createRoot(FORM);
      const hot = await startHot(root, "vue", vue);
      try {
        await hot.fetchAll();
        const child = FORM["src/Field.uf.tsx"];

        await hot.edit("src/Field.uf.tsx", () => rmSync(join(root, "src/Field.uf.tsx")));
        expect(updates(hot.sent).join()).toContain("Form.uf.tsx.vue");

        await hot.edit("src/Field.uf.tsx", () => write(root, "src/Field.uf.tsx", child));
        expect(updates(hot.sent).join()).toContain("Form.uf.tsx.vue");
      } finally {
        await hot.close();
      }
    },
  );

  it(
    "updates a file's own sheet when it is deleted and created again",
    { timeout: SLOW },
    async () => {
      const root = createRoot(FILES);
      const hot = await startHot(root, "vue", vue);
      try {
        await hot.fetchAll();
        await hot.edit("src/Card.uf.tsx", () => rmSync(join(root, "src/Card.uf.tsx")));
        expect(updates(hot.sent).join()).toContain("Card.uf.tsx.css");

        await hot.edit("src/Card.uf.tsx", () => write(root, "src/Card.uf.tsx", CARD("Back")));
        expect(updates(hot.sent).join()).toContain("Card.uf.tsx.css");
        expect(contentsOf(await hot.fetchAll(), "Card.uf.tsx.vue")).toContain("Back");
      } finally {
        await hot.close();
      }
    },
  );

  it("gives every environment the same modules for one change", { timeout: SLOW }, async () => {
    const root = createRoot(FILES);
    const hot = await startHot(root, "vue", vue);
    try {
      await hot.fetchAll();
      const module = join(root, "src/Card.uf.tsx.vue");
      await hot.server.environments.ssr.transformRequest(module);

      await hot.edit("src/Card.uf.tsx", () => write(root, "src/Card.uf.tsx", CARD("Goodbye")));
      expect(updates(hot.sent).join()).toContain("Card.uf.tsx.vue");
      expect(hot.ssrModules).toContain(module);
    } finally {
      await hot.close();
    }
  });

  it(
    "still sends an update when a load hands the change over first",
    { timeout: SLOW },
    async () => {
      const root = createRoot({
        ...FILES,
        // A boundary, so that a module caught between its two states can't reach a dead end.
        "lazy.ts":
          'import Other from "./src/Other.uf.tsx";\n\nexport { Other };\nimport.meta.hot.accept();\n',
        "src/Other.uf.tsx":
          'import type { Props } from "./types.ts";\n\nexport default function Other(props: Props) {\n  return <i>{props.label}</i>;\n}\n',
      });
      const hot = await startHot(root, "react", react);
      try {
        await hot.fetchAll();
        await hot.server.environments.client.transformRequest("/lazy.ts");
        await hot.edit("src/types.ts", async () => {
          write(root, "src/types.ts", "export interface Props {\n  label: number;\n}\n");
          // A first load of another module reaches the file, and hands the change to the project
          // before Vite's watcher reports it.
          await hot.server.environments.client.transformRequest("/src/Other.uf.tsx");
        });
        expect(updates(hot.sent).join()).toContain("Card.uf.tsx");
      } finally {
        await hot.close();
      }
    },
  );

  it(
    "updates a file's other components, and modules of composables",
    { timeout: SLOW },
    async () => {
      const root = createRoot({
        "main.ts":
          'import Pair from "./src/Pair.uf.tsx";\nimport { useCount } from "./src/useCount.uf.ts";\n\nexport { Pair, useCount };\n',
        "src/Pair.uf.tsx":
          "function Inner() {\n  return <i>one</i>;\n}\n\nexport default function Pair() {\n  return <b><Inner /></b>;\n}\n",
        "src/useCount.uf.ts":
          'import { ref } from "unframework";\n\nexport function useCount() {\n  const count = ref(1);\n  return { count };\n}\n',
      });
      const hot = await startHot(root, "vue", vue);
      try {
        await hot.fetchAll();
        await hot.edit("src/Pair.uf.tsx", () =>
          write(
            root,
            "src/Pair.uf.tsx",
            "function Inner() {\n  return <i>two</i>;\n}\n\nexport default function Pair() {\n  return <b><Inner /></b>;\n}\n",
          ),
        );
        expect(updates(hot.sent).join()).toContain("Pair.uf.tsx.vue");
        expect(updates(hot.sent).join()).toContain("Pair.uf.tsx.Inner.vue");

        await hot.edit("src/useCount.uf.ts", () =>
          write(
            root,
            "src/useCount.uf.ts",
            'import { ref } from "unframework";\n\nexport function useCount() {\n  const count = ref(2);\n  return { count };\n}\n',
          ),
        );
        expect(hot.sent.map((payload) => payload.type)).toContain("full-reload");
        expect([...(await hot.fetchAll()).values()].join("\n")).toContain("ref(2)");
      } finally {
        await hot.close();
      }
    },
  );

  it(
    "sends an update for an edit that no longer compiles, and for its fix",
    { timeout: SLOW },
    async () => {
      const root = createRoot(FILES);
      const hot = await startHot(root, "vue", vue);
      try {
        await hot.fetchAll();
        await hot.edit("src/Card.uf.tsx", () =>
          write(root, "src/Card.uf.tsx", "export default function Card( {\n"),
        );
        expect(updates(hot.sent).join()).toContain("Card.uf.tsx.vue");
        await expect(hot.fetchAll()).rejects.toThrow();

        await hot.edit("src/Card.uf.tsx", () => write(root, "src/Card.uf.tsx", CARD("Fixed")));
        expect(updates(hot.sent).join()).toContain("Card.uf.tsx.vue");
        expect(contentsOf(await hot.fetchAll(), "Card.uf.tsx.vue")).toContain("Fixed");
      } finally {
        await hot.close();
      }
    },
  );

  it("finds a project under a path with spaces and an ampersand", { timeout: SLOW }, async () => {
    const here = fileURLToPath(new URL("..", import.meta.url));
    mkdirSync(join(here, ".uf-tmp"), { recursive: true });
    const parent = realpathSync(mkdtempSync(join(here, ".uf-tmp", "hot-")));
    roots.push(parent);
    const root = join(parent, "R&D app");
    for (const [path, contents] of Object.entries(FILES)) write(root, path, contents);
    const hot = await startHot(root, "vue", vue);
    try {
      await hot.fetchAll();
      await hot.edit("src/Card.uf.tsx", () => write(root, "src/Card.uf.tsx", CARD("Goodbye")));
      expect(updates(hot.sent).join()).toContain("Card.uf.tsx.vue");
    } finally {
      await hot.close();
    }
  });

  it("leaves a shared module the output really imports to Vite", { timeout: SLOW }, async () => {
    const root = createRoot({
      "main.ts": FILES["main.ts"]!,
      "src/label.ts": 'export const LABEL = "one";\n',
      "src/Card.uf.tsx":
        'import { LABEL } from "./label.ts";\n\nexport default function Card() {\n  return <p>{LABEL}</p>;\n}\n',
    });
    const hot = await startHot(root, "react", react);
    try {
      await hot.fetchAll();
      await hot.edit("src/label.ts", () =>
        write(root, "src/label.ts", 'export const LABEL = "two";\n'),
      );
      expect(updates(hot.sent).join()).toContain("Card.uf.tsx");
    } finally {
      await hot.close();
    }
  });

  it("leaves a file no compile read to Vite", { timeout: SLOW }, async () => {
    const root = createRoot({ ...FILES, "src/other.ts": "export const other = 1;\n" });
    const hot = await startHot(root, "vue", vue);
    try {
      await hot.fetchAll();
      const before = hot.compiles();
      await hot.edit("src/other.ts", () =>
        write(root, "src/other.ts", "export const other = 2;\n"),
      );
      expect(updates(hot.sent)).toEqual([]);
      expect(hot.compiles()).toBe(before);
    } finally {
      await hot.close();
    }
  });
});

describe("a framework with no hot update of its own", () => {
  it("reloads the page on Qwik, and serves the new content", { timeout: SLOW }, async () => {
    const root = createRoot(FILES);
    const hot = await startHot(root, "qwik", qwik, "ssr");
    try {
      await hot.fetchAll();
      await hot.edit("src/Card.uf.tsx", () => write(root, "src/Card.uf.tsx", CARD("Goodbye")));
      expect(hot.sent.map((payload) => payload.type)).toContain("full-reload");
      const fetched = [...(await hot.fetchAll()).values()].join("\n");
      expect(fetched).toContain("Goodbye");
    } finally {
      await hot.close();
    }
  });

  it("reloads the page on Astro, and serves the new content", { timeout: SLOW }, async () => {
    const root = createRoot({
      "src/pages/index.astro":
        '---\nimport Card from "../Card.uf.tsx";\n---\n<html><body><Card label="Astro" /></body></html>\n',
      "src/Card.uf.tsx": CARD("Hello"),
      "src/Card.css": FILES["src/Card.css"]!,
      "src/types.ts": TYPES,
    });
    vi.stubEnv("VITEST", "");
    vi.stubEnv("ASTRO_TELEMETRY_DISABLED", "1");
    // Astro turns Vite's HMR off under NODE_ENV=test, which Vitest sets.
    vi.stubEnv("NODE_ENV", "development");
    let vite: ViteDevServer | undefined;
    const server = await dev({
      root,
      configFile: false,
      logLevel: "silent",
      devToolbar: { enabled: false },
      server: { host: HOST, port: 0 },
      vite: { server: { watch: WATCH } },
      integrations: [
        astro(),
        {
          name: "keeps-the-vite-server",
          hooks: { "astro:server:setup": ({ server: viteServer }) => void (vite = viteServer) },
        },
      ],
    });
    try {
      const url = `http://${HOST}:${server.address.port}/`;
      expect(await (await fetch(url)).text()).toContain("Hello, Astro");
      const reloads = vi.spyOn(vite!.ws, "send");

      write(root, "src/Card.uf.tsx", CARD("Goodbye"));
      await vi.waitFor(() => expect(reloads).toHaveBeenCalledWith({ type: "full-reload" }), HOT);
      expect(await (await fetch(url)).text()).toContain("Goodbye, Astro");
    } finally {
      await server.stop();
      vi.unstubAllEnvs();
    }
  });
});
