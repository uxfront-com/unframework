import { describe, expect, it } from "vitest";

import { componentHtml, CONTAINER_TAG } from "../src/toolchain/container.ts";

const open = `<${CONTAINER_TAG} q:container="paused" q:instance="5r5ljr" :="">`;
const close = `</${CONTAINER_TAG}>`;
const state = `<script type="qwik/state" q:instance="5r5ljr">[30,[0,0]]</script>`;
const vnode = `<script type="qwik/vnode">"~{B|q:type|S\`3=2}</script>`;
const funcs = `<script q:func="qwik/json">document["qFuncs_5r5ljr"]=[]</script>`;
const events = `<script>(window._qwikEv||(window._qwikEv=[])).push("e:click",0,"5r5ljr")</script>`;

describe("componentHtml", () => {
  it("returns the container's inner HTML", () => {
    expect(componentHtml(`${open}<p :="" class="greeting">Hi</p>${close}`)).toBe(
      `<p :="" class="greeting">Hi</p>`,
    );
  });

  it("drops the container data Qwik appends after the component", () => {
    const component = `<div><button q-e:click="mock-chunk#_run#1">+1</button></div>`;
    expect(componentHtml(`${open}${component}${state}${vnode}${funcs}${events}${close}`)).toBe(
      component,
    );
  });

  it("recognises an event registration that carries a CSP nonce", () => {
    const nonced = events.replace("<script>", `<script nonce="abc">`);
    expect(componentHtml(`${open}<p>Hi</p>${nonced}${close}`)).toBe("<p>Hi</p>");
  });

  it("keeps the component's own scripts, even ones that look like Qwik's", () => {
    const own = `<script type="qwik/state">{}</script>`;
    const component = `${own}<p>Hi</p>`;
    expect(componentHtml(`${open}${component}${state}${close}`)).toBe(component);
  });

  it("keeps a trailing script that is not container data", () => {
    const component = `<p>Hi</p><script>console.log("mine")</script>`;
    expect(componentHtml(`${open}${component}${close}`)).toBe(component);
  });

  it("keeps an attributed script that only resembles the event registration", () => {
    const module = `<script type="module">(window._qwikEv||(window._qwikEv=[])).push("x")</script>`;
    expect(componentHtml(`${open}<p>Hi</p>${module}${close}`)).toBe(`<p>Hi</p>${module}`);
  });

  it("accepts surrounding whitespace", () => {
    expect(componentHtml(`\n${open}<p>Hi</p>${close}\n`)).toBe("<p>Hi</p>");
  });

  it("throws, rather than guess, when the render is not one container", () => {
    expect(() => componentHtml("<p>Hi</p>")).toThrow(/not one <uf-qwik-container> container/);
    expect(() => componentHtml(`<html><body><p>Hi</p></body></html>`)).toThrow(
      /not one <uf-qwik-container> container/,
    );
    expect(() => componentHtml(`${open}<p>Hi</p>${close}${open}<p>Again</p>${close}`)).toThrow(
      /not one <uf-qwik-container> container/,
    );
    expect(() => componentHtml(`${open}<p>Hi</p>`)).toThrow(/not one/);
  });
});
