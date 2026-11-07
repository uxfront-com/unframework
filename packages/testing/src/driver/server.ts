// A static build on a free local port, for a driver or a walk of a catalogue. No server of the
// bundler's: the run opens what `storybook build` wrote.
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".mjs": "text/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** A running {@link serveStatic}. */
export interface StaticServer {
  origin: string;
  close(): Promise<void>;
}

/** Serves a directory, and each of `pages` at its path, on a free port of this machine. */
export function serveStatic(
  directory: string,
  pages: Readonly<Record<string, string>> = {},
): Promise<StaticServer> {
  const server = createServer((request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url!, "http://build").pathname));
    const page = Object.hasOwn(pages, path) ? pages[path] : undefined;
    if (page !== undefined) {
      response.setHeader("content-type", TYPES[".html"]!);
      response.end(page);
      return;
    }
    readFile(join(directory, path)).then(
      (contents) => {
        response.setHeader("content-type", TYPES[extname(path)] ?? "application/octet-stream");
        response.end(contents);
      },
      () => {
        response.statusCode = 404;
        response.end();
      },
    );
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((closed) => {
            server.close(() => closed());
            // A page's open connections keep the server up otherwise.
            server.closeAllConnections();
          }),
      });
    });
  });
}
