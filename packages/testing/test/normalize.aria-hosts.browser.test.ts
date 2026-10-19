// Where Angular's hosts join two words, read from the live DOM (ADR-0060): the computed styles
// say which elements Playwright's ARIA snapshot spaces on every target, so only a host's edge
// inside one run of text is a join.
import { afterEach, describe, expect, it } from "vitest";

import { hostJoins } from "../src/normalize/rules/aria-hosts.ts";

const HOST = 'style="display: contents"';

/** The joins of `html`, rendered in the page. */
function joins(html: string): string[] {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return hostJoins(root).map(({ before, after }) => `${before}|${after}`);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("hostJoins", () => {
  it("finds the words two inline hosts join", () => {
    expect(
      joins(
        `<p><uf-badge ${HOST}><span>Build</span></uf-badge><uf-pill ${HOST}><span>passing</span></uf-pill></p>`,
      ),
    ).toEqual(["Build|passing"]);
    expect(
      joins(
        `<div><uf-tag ${HOST}><span>plain</span></uf-tag><uf-tag ${HOST}><span>wide</span></uf-tag><uf-tag ${HOST}><span>toggled</span></uf-tag><button>Toggle</button></div>`,
      ),
    ).toEqual(["plain|wide", "wide|toggled"]);
  });

  it("finds a join between text and a host, and across nested hosts", () => {
    expect(joins(`<p>a<uf-outer ${HOST}>b<uf-inner ${HOST}>c</uf-inner></uf-outer>d</p>`)).toEqual([
      "a|b",
      "b|c",
      "c|d",
    ]);
  });

  it("finds none where whitespace or a box already separates the words", () => {
    expect(joins(`<p>a <uf-x ${HOST}>b</uf-x> c</p>`)).toEqual([]);
    expect(joins(`<p><uf-x ${HOST}><b>a</b> </uf-x><uf-y ${HOST}>b</uf-y></p>`)).toEqual([]);
    // A block, an inline-block or an element with a role is spaced, or split, on every target.
    expect(
      joins(`<div><uf-x ${HOST}><div>a</div></uf-x><uf-y ${HOST}><div>b</div></uf-y></div>`),
    ).toEqual([]);
    expect(
      joins(
        `<p><uf-x ${HOST}><span style="display: inline-block">a</span></uf-x><uf-y ${HOST}>b</uf-y></p>`,
      ),
    ).toEqual([]);
    expect(joins(`<p><uf-x ${HOST}><a href="#">a</a></uf-x><uf-y ${HOST}>b</uf-y></p>`)).toEqual(
      [],
    );
    expect(
      joins(`<p><uf-x ${HOST}><span role="img">a</span></uf-x><uf-y ${HOST}>b</uf-y></p>`),
    ).toEqual([]);
  });

  it("finds none at an element that only looks like a host, or with nothing on one side", () => {
    expect(joins("<p><uf-x>a</uf-x><uf-y>b</uf-y></p>")).toEqual([]);
    expect(joins(`<p><uf-x ${HOST}>a</uf-x></p>`)).toEqual([]);
    expect(joins(`<p><uf-x ${HOST}></uf-x>a</p>`)).toEqual([]);
  });

  it("skips what the snapshot hides", () => {
    expect(
      joins(`<p>a<uf-x ${HOST}><span hidden>b</span></uf-x><uf-y ${HOST}>c</uf-y></p>`),
    ).toEqual(["a|c"]);
    expect(joins(`<p>a<uf-x ${HOST}><span aria-hidden="true">b</span></uf-x></p>`)).toEqual([]);
  });
});
