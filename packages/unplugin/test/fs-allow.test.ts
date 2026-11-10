// A dev server with `server.fs.strict` refuses a `.uf.tsx` outside `server.fs.allow` as it refuses
// any other file, by whichever id a request names it, and its text reaches no response (C21). A
// file an allowed module imports still loads, since Vite tracks it as safely imported. These run
// real servers over HTTP, because Vite's 403 is its middleware's answer, not the plugin
// container's.
import { symlinkSync } from "node:fs";
import { join, relative } from "node:path";

import type { TargetName } from "@unframework/compiler";
import { createServer } from "vite";
import type { Plugin, ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import unframework from "../src/vite.ts";
import { createProject, fakeVue } from "./fixtures.ts";
import type { Project } from "./fixtures.ts";

const HOST = "127.0.0.1";

/** What only the outside files hold: no response may contain it. */
const TOKEN = "SECRET_TOKEN_uf";

const SECRET = `export default function Secret() {\n  const token = "${TOKEN}";\n  return <p class="secret">{token}</p>;\n}\n`;
const SHEET = `import "./sheet.css";\n\nexport default function Sheet() {\n  return <p class="${TOKEN}">Sheet</p>;\n}\n`;
const TWO = `function Badge() {\n  return <b class="${TOKEN}">Badge</b>;\n}\n\nexport default function Two() {\n  return <div><Badge /></div>;\n}\n`;
const CHILD =
  'import "./child.css";\n\nexport default function Child() {\n  return <p class="child">Outside child</p>;\n}\n';
const SHIPPED = 'export default function Shipped() {\n  return <p class="kit">Shipped</p>;\n}\n';

/** The package as npm installs it, and as a link outside the allow list does. */
const PACKAGE = (name: string): Record<string, string> => ({
  "package.json": JSON.stringify({ name, type: "module", exports: { "./*": "./src/*" } }),
  "src/Shipped.uf.tsx": SHIPPED,
});
const under = (at: string, files: Record<string, string>) =>
  Object.fromEntries(Object.entries(files).map(([path, text]) => [`${at}/${path}`, text]));

let outside: Project;
let linked: Project;
beforeAll(() => {
  outside = createProject({
    "Secret.uf.tsx": SECRET,
    "Sheet.uf.tsx": SHEET,
    "sheet.css": `.${TOKEN} { color: red; }\n`,
    "Two.uf.tsx": TWO,
    "Child.uf.tsx": CHILD,
    "child.css": ".child { color: blue; }\n",
    "secret.js": `export const token = "${TOKEN}";\n`,
  });
  linked = createProject(PACKAGE("@ds/linked"));
});
afterAll(() => {
  outside.remove();
  linked.remove();
});

/** Each request's status and body, and whether the body holds an outside file's text. */
interface Answer {
  status: number;
  body: string;
  leaks: boolean;
}

/** A listening dev server whose allow list is its root alone, with strict checks on. */
async function serve(
  target: TargetName,
  extra: Plugin[],
  fn: (get: (url: string) => Promise<Answer>, root: string) => Promise<void>,
): Promise<void> {
  const app = createProject({
    // A stand-in for React's runtime, which this package's tests don't install for the browser.
    "stub.js": 'export const jsxDEV = () => null;\nexport const Fragment = "fragment";\n',
    ...under("node_modules/@ds/installed", PACKAGE("@ds/installed")),
  });
  symlinkSync(linked.root, join(app.root, "node_modules/@ds/linked"));
  const child = relative(app.root, join(outside.root, "Child.uf.tsx"));
  app.write("main.js", `import Child from "${child}";\nexport default Child;\n`);
  app.write(
    "kit.js",
    'import Installed from "@ds/installed/Shipped.uf.tsx";\nimport Linked from "@ds/linked/Shipped.uf.tsx";\n\nexport { Installed, Linked };\n',
  );
  let server: ViteDevServer | undefined;
  try {
    server = await createServer({
      root: app.root,
      configFile: false,
      appType: "custom",
      clearScreen: false,
      logLevel: "silent",
      cacheDir: join(app.root, ".vite"),
      server: {
        host: HOST,
        port: 0,
        hmr: false,
        ws: false,
        watch: null,
        fs: { strict: true, allow: [app.root] },
      },
      optimizeDeps: { noDiscovery: true, include: [] },
      resolve: { alias: { "react/jsx-dev-runtime": join(app.root, "stub.js") } },
      plugins: [...unframework({ target }), ...extra],
    });
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("the server has no port");
    const get = async (url: string): Promise<Answer> => {
      const response = await fetch(`http://${HOST}:${address.port}${url}`, {
        headers: { accept: "*/*" },
      });
      const body = await response.text();
      return { status: response.status, body, leaks: body.includes(TOKEN) };
    };
    await fn(get, app.root);
  } finally {
    await server?.close();
    app.remove();
  }
}

/** The URL an import of `specifier` became in a served module. */
function importedUrl(code: string, specifier: RegExp): string {
  for (const [, url] of code.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) {
    if (specifier.test(url!)) return url!;
  }
  throw new Error(`no import matches ${specifier} in:\n${code}`);
}

/** The URL a served module imports its default export `name` from. */
function importOf(code: string, name: string): string {
  const url = new RegExp(`import ${name} from "([^"]+)"`).exec(code)?.[1];
  if (url === undefined) throw new Error(`no import of ${name} in:\n${code}`);
  return url;
}

const refused = { status: 403, leaks: false };

describe("on react", () => {
  it("refuses an outside .uf.tsx by every id a request names it", async () => {
    await serve("react", [], async (get) => {
      const at = outside.root;
      expect(await get(`/@fs${at}/secret.js`)).toMatchObject(refused);
      for (const url of [
        `/@fs${at}/Secret.uf.tsx`,
        `${at}/Secret.uf.tsx`,
        `${at}/Secret.uf.tsx?t=1`,
        `${at}/Secret.uf.js`,
        `/@fs${at}/Sheet.uf.tsx.css`,
        `${at}/Sheet.uf.tsx.css`,
        `${at}/Two.uf.tsx.Badge.tsx`,
      ]) {
        expect({ url, ...(await get(url)) }).toMatchObject({ url, ...refused });
      }
    });
  });

  it("loads an outside child, and its sheet, after an allowed module imports it", async () => {
    await serve("react", [], async (get) => {
      const main = await get("/main.js");
      expect(main.status).toBe(200);
      const child = await get(importedUrl(main.body, /Child\.uf\.tsx$/));
      expect(child).toMatchObject({ status: 200, leaks: false });
      expect(child.body).toContain("Outside child");
      const sheet = await get(importedUrl(child.body, /Child\.uf\.tsx\.css$/));
      expect(sheet).toMatchObject({ status: 200, leaks: false });
      expect(sheet.body).toContain("color: blue");
    });
  });

  it("loads a package's shipped source, installed or linked from outside", async () => {
    await serve("react", [], async (get) => {
      const kit = await get("/kit.js");
      expect(kit.status).toBe(200);
      for (const name of ["Installed", "Linked"]) {
        const url = importOf(kit.body, name);
        const shipped = await get(url);
        expect({ url, status: shipped.status }).toEqual({ url, status: 200 });
        expect(shipped.body).toContain("Shipped");
      }
    });
  });
});

// plugin-vue's stand-in turns a module into a string, so a `.uf.tsx` importer's output records
// no import: the importer here is a plain `.js` module.
describe("on vue", () => {
  it("refuses an outside .uf.tsx by every id a request names it", async () => {
    await serve("vue", [fakeVue], async (get) => {
      const at = outside.root;
      expect(await get(`/@fs${at}/secret.js`)).toMatchObject(refused);
      for (const url of [
        `${at}/Secret.uf.tsx.vue`,
        `/@fs${at}/Secret.uf.tsx.vue`,
        `${at}/Secret.uf.tsx.vue?t=1`,
        `/@fs${at}/Secret.uf.tsx`,
        `${at}/Secret.uf.js`,
        `${at}/Sheet.uf.tsx.css`,
        `/@fs${at}/Sheet.uf.tsx.css`,
        `${at}/Sheet.uf.tsx.css?vue&type=style&index=0&src=true&lang.css`,
        `${at}/Two.uf.tsx.Badge.vue`,
        `/@fs${at}/Two.uf.tsx.Badge.vue`,
      ]) {
        expect({ url, ...(await get(url)) }).toMatchObject({ url, ...refused });
      }
    });
  });

  it("loads an outside child after an allowed module imports it", async () => {
    await serve("vue", [fakeVue], async (get) => {
      const main = await get("/main.js");
      expect(main.status).toBe(200);
      const child = await get(importedUrl(main.body, /Child\.uf\.tsx\.vue$/));
      expect(child).toMatchObject({ status: 200, leaks: false });
      expect(child.body).toContain("Outside child");
    });
  });

  it("loads a package's shipped source, installed or linked from outside", async () => {
    await serve("vue", [fakeVue], async (get) => {
      const kit = await get("/kit.js");
      expect(kit.status).toBe(200);
      for (const name of ["Installed", "Linked"]) {
        const url = importOf(kit.body, name);
        const shipped = await get(url);
        expect({ url, status: shipped.status }).toEqual({ url, status: 200 });
        expect(shipped.body).toContain("Shipped");
      }
    });
  });
});
