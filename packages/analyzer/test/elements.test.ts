import { defaultTreeAdapter, html as spec, parseFragment, serialize } from "parse5";
import { describe, expect, it } from "vitest";

import { applyAndRecheck, codes, component, slices } from "./helpers.ts";

function problems(jsx: string): string[] {
  const { source, diagnostics } = component(jsx);
  return diagnostics.map(
    (diagnostic) =>
      `${diagnostic.code} ${source.slice(diagnostic.span.start, diagnostic.span.end)}`,
  );
}

describe("element names", () => {
  it.each([
    ["<div><foo>a</foo></div>", "foo", "<foo> is not an HTML element."],
    ["<div><myElement>a</myElement></div>", "myElement", "<myElement> is not an HTML element."],
    ["<div><center>a</center></div>", "center", "<center> is obsolete: HTML no longer defines it."],
    [
      "<div><marquee>a</marquee></div>",
      "marquee",
      "<marquee> is obsolete: HTML no longer defines it.",
    ],
    [
      "<div><listing>a</listing></div>",
      "listing",
      "<listing> is obsolete: HTML no longer defines it.",
    ],
  ])("reports %s as not an HTML element", (jsx, tag, message) => {
    const { source, diagnostics } = component(jsx);
    expect(codes(diagnostics)).toEqual(["UF3001"]);
    expect(slices(source, diagnostics)).toEqual([tag]);
    expect(diagnostics[0]!.message).toBe(message);
  });

  it("fixes the case of an HTML element, opening and closing tags alike", () => {
    const { source, diagnostics } = component("<div><dIV>a</dIV><sPan /></div>");
    expect(codes(diagnostics)).toEqual(["UF3001", "UF3001"]);
    expect(applyAndRecheck(source, diagnostics)).toContain("<div><div>a</div><span /></div>");
  });

  it("checks a misspelt element as the element its fix gives, so the fix reveals nothing new", () => {
    const { source, diagnostics } = component('<p><dIV className="x">a</dIV></p>');
    expect(codes(diagnostics)).toEqual(["UF3001", "UF3003", "UF3004"]);
    applyAndRecheck(source, diagnostics);
  });

  it.each([
    "html",
    "head",
    "body",
    "base",
    "link",
    "meta",
    "title",
    "style",
    "script",
    "noscript",
    "template",
    "slot",
  ])("reports <%s>, which a component cannot render", (tag) => {
    expect(problems(`<div><${tag}></${tag}></div>`)).toEqual([`UF3002 ${tag}`]);
  });

  it.each([
    ["ng-container", "Angular"],
    ["ng-template", "Angular"],
    ["ng-content", "Angular"],
    ["component", "Vue"],
    ["transition", "Vue"],
    ["transition-group", "Vue"],
    ["keep-alive", "Vue"],
    ["teleport", "Vue"],
    ["suspense", "Vue"],
  ])("reports <%s> as %s's", (tag, framework) => {
    const { diagnostics } = component(`<div><${tag}>a</${tag}></div>`);
    expect(codes(diagnostics)).toEqual(["UF3002"]);
    expect(diagnostics[0]!.message).toContain(`${framework}'s built-in elements`);
  });

  it.each([
    [
      "<div><my-widget>a</my-widget></div>",
      "Custom elements such as <my-widget> are not supported yet.",
    ],
    ["<div><math></math></div>", "MathML (`<math>`) is not supported yet."],
    [
      "<div><select><selectedcontent /></select></div>",
      "<selectedcontent> is not supported yet: Vue 3.5 does not know <selectedcontent> as an HTML element and resolves it as a component.",
    ],
  ])("reports %s as not supported yet", (jsx, message) => {
    const { diagnostics } = component(jsx);
    expect(codes(diagnostics)).toEqual(["UF1002"]);
    expect(diagnostics[0]!.message).toBe(message);
  });

  // Vue 3.5 resolves <search> as a component (targets-markup-4). The landmark is the same, but
  // not the element (type selectors, `querySelector("search")`), so the fix needs a review.
  it('fixes <search> to <div role="search">, as a likely fix', () => {
    const { source, diagnostics } = component('<div><search class="s"><p>q</p></search></div>');
    expect(codes(diagnostics)).toEqual(["UF1002"]);
    expect(diagnostics[0]!.fixes).toEqual([
      expect.objectContaining({ title: 'Use <div role="search">', confidence: "likely" }),
    ]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      '<div><div role="search" class="s"><p>q</p></div></div>',
    );
  });

  it("offers no <search> fix when the element has a role already", () => {
    const { diagnostics } = component('<div><search role="none">q</search></div>');
    expect(diagnostics[0]!.fixes).toBeUndefined();
  });

  it("still checks the children of an element it reports", () => {
    expect(problems("<foo><p><div>a</div></p></foo>")).toEqual(["UF3001 foo", "UF3003 div"]);
  });

  // Its children are MathML, which the HTML checks would only misreport.
  it("reports <math> once, and nothing inside it", () => {
    expect(problems("<div><math><mi>x</mi><mo>=</mo><mn>2</mn></math></div>")).toEqual([
      "UF1002 math",
    ]);
  });

  // Tags are looked up in tables keyed by name: none may answer from a prototype.
  it.each(["toString", "constructor", "valueOf", "hasOwnProperty"])(
    "reports <%s>, and checks what is inside it, as an unknown element",
    (tag) => {
      const { diagnostics } = component(`<div><${tag}><b>x</b></${tag}></div>`);
      expect(codes(diagnostics)).toEqual(["UF3001"]);
      expect(diagnostics[0]!.message).toBe(`<${tag}> is not an HTML element.`);
    },
  );

  it("treats a capitalised tag as a component, as JSX does", () => {
    expect(problems("<div><Div>a</Div></div>")).toEqual(["UF3047 Div"]);
  });
});

describe("nesting the browser repairs", () => {
  it.each([
    [
      "<div><p><div>a</div></p></div>",
      "UF3003 div",
      "<div> cannot be inside <p>: the browser closes the <p> before it.",
    ],
    [
      "<div><p><span><ul></ul></span></p></div>",
      "UF3003 ul",
      "<ul> cannot be inside <p>: the browser closes the <p> before it.",
    ],
    [
      '<div><a href="/"><span><a href="/">a</a></span></a></div>',
      "UF3003 a",
      "<a> cannot be inside <a>: the browser closes the outer <a> first.",
    ],
    [
      "<div><button><button>a</button></button></div>",
      "UF3003 button",
      "<button> cannot be inside <button>: the browser closes the outer <button> first.",
    ],
    [
      "<div><form><div><form></form></div></form></div>",
      "UF3003 form",
      "<form> cannot be inside <form>: the browser ignores a form inside a form.",
    ],
    [
      "<div><h1><span><h2>a</h2></span></h1></div>",
      "UF3003 h2",
      "<h2> cannot be inside <h1>: the browser closes the <h1> before it.",
    ],
    [
      "<ul><li><div><li>a</li></div></li></ul>",
      "UF3003 li",
      "<li> cannot be inside <li>: the browser closes the <li> before it.",
    ],
    [
      "<dl><dd><div><dt>a</dt></div></dd></dl>",
      "UF3003 dt",
      "<dt> cannot be inside <dd>: the browser closes the <dd> before it.",
    ],
    [
      "<div><textarea><b>a</b></textarea></div>",
      "UF3003 b",
      "<b> cannot be inside <textarea>: its content is text, and the browser reads markup there as text.",
    ],
    [
      "<div><select><option><b>a</b></option></select></div>",
      "UF3003 b",
      "<b> cannot be inside <option>: its content is text, and the browser reads markup there as text.",
    ],
  ])("reports %s", (jsx, problem, message) => {
    const { diagnostics } = component(jsx);
    expect(problems(jsx)).toEqual([problem]);
    expect(diagnostics[0]!.message).toBe(message);
  });

  it("points at the ancestor the browser would close", () => {
    const { source, diagnostics } = component("<div><p><span><div>a</div></span></p></div>");
    const [related] = diagnostics[0]!.related!;
    expect(source.slice(related!.span.start, related!.span.end)).toBe("p");
    expect(related!.message).toBe("The <p>");
  });

  it.each([
    [
      "<table><tr><td>a</td></tr></table>",
      "UF3003 tr",
      "<tr> cannot be a child of <table>: it belongs inside <thead>, <tbody> or <tfoot>.",
    ],
    [
      "<table><tbody><td>a</td></tbody></table>",
      "UF3003 td",
      "<td> cannot be a child of <tbody>: it belongs inside <tr>.",
    ],
    [
      "<table><div>a</div></table>",
      "UF3003 div",
      "<div> cannot be a child of <table>: the browser moves it out or drops it. Only <caption>, <colgroup>, <thead>, <tbody> and <tfoot> can be.",
    ],
    [
      "<table><tbody><tr><div>a</div></tr></tbody></table>",
      "UF3003 div",
      "<div> cannot be a child of <tr>: the browser moves it out or drops it. Only <td> and <th> can be.",
    ],
    [
      "<table><col /></table>",
      "UF3003 col",
      "<col> cannot be a child of <table>: it belongs inside <colgroup>.",
    ],
    [
      "<div><select><div>a</div></select></div>",
      "UF3003 div",
      "<div> cannot be a child of <select>: the browser moves it out or drops it. Only <option>, <optgroup> and <hr> can be.",
    ],
    [
      "<div><select><optgroup><optgroup></optgroup></optgroup></select></div>",
      "UF3003 optgroup",
      "<optgroup> cannot be a child of <optgroup>: the browser moves it out or drops it. Only <option> can be.",
    ],
    [
      "<div><span><tr></tr></span></div>",
      "UF3003 tr",
      "<tr> cannot be a child of <span>: it belongs inside <thead>, <tbody> or <tfoot>.",
    ],
    [
      "<div><summary>a</summary></div>",
      "UF3003 summary",
      "<summary> cannot be a child of <div>: it belongs inside <details>.",
    ],
    [
      "<div><figcaption>a</figcaption></div>",
      "UF3003 figcaption",
      "<figcaption> cannot be a child of <div>: it belongs inside <figure>.",
    ],
    ["<p><rt>a</rt></p>", "UF3003 rt", "<rt> cannot be a child of <p>: it belongs inside <ruby>."],
  ])("reports the table, list and select structure in %s", (jsx, problem, message) => {
    expect(problems(jsx)).toEqual([problem]);
    expect(component(jsx).diagnostics[0]!.message).toBe(message);
  });

  it("suggests a <tbody> for rows directly in a table", () => {
    expect(component("<table><tr></tr></table>").diagnostics[0]!.help).toBe(
      "Wrap the rows in a <tbody>.",
    );
  });

  // The parser moves text out of a table.
  it.each([
    ["<table>a<tbody></tbody></table>", "a", "table"],
    ["<table><tbody>x</tbody></table>", "x", "tbody"],
    ["<table><tbody><tr>\u00a0<td>a</td></tr></tbody></table>", "\u00a0", "tr"],
  ])("reports the text in %s", (jsx, text, parent) => {
    const { source, diagnostics } = component(jsx);
    expect(codes(diagnostics)).toEqual(["UF3003"]);
    expect(slices(source, diagnostics)).toEqual([text]);
    expect(diagnostics[0]).toMatchObject({
      message: `Text cannot be inside <${parent}>: the browser moves it out of the table.`,
      help: "Put it in a cell, or in a <caption>.",
    });
    expect(diagnostics[0]!.fixes).toBeUndefined();
  });

  // The parser keeps whitespace in a table where it is (parse5 below); React reports it and
  // Svelte drops it, and it renders nothing, so the fix removes it.
  it.each([
    ["<table> <tbody></tbody></table>", "table"],
    ["<table><tbody><tr> <td>a</td></tr></tbody></table>", "tr"],
    ["<table><tbody><tr><td>a</td>  <td>b</td></tr></tbody></table>", "tr"],
  ])("reports the whitespace in %s, and the fix removes it", (jsx, parent) => {
    const { source, diagnostics } = component(jsx);
    expect(codes(diagnostics)).toEqual(["UF3003"]);
    expect(diagnostics[0]).toMatchObject({
      message: `Text cannot be inside <${parent}>, not even whitespace: React reports it as a hydration error, and Svelte's compiler drops it.`,
      fixes: [{ title: "Remove the whitespace", confidence: "safe" }],
    });
    const fixed = applyAndRecheck(source, diagnostics);
    expect(
      component(fixed.slice(fixed.indexOf("<"), fixed.lastIndexOf(">") + 1)).diagnostics,
    ).toEqual([]);
    const body = defaultTreeAdapter.createElement("body", spec.NS.HTML, []);
    expect(serialize(parseFragment(body, jsx, {}))).toBe(jsx);
  });

  it("offers no removal that would overlap the fix of a reference in the whitespace", () => {
    const { source, diagnostics } = component(
      "<table><tbody><tr>&#9;<td>a</td></tr></tbody></table>",
    );
    expect(codes(diagnostics)).toEqual(["UF3009", "UF3003"]);
    expect(diagnostics[1]!.fixes).toBeUndefined();
    expect(applyAndRecheck(source, diagnostics)).toContain("<tr> <td>");
  });

  it("accepts the whitespace JSX drops between rows on their own lines", () => {
    const jsx = [
      "<table>",
      "  <tbody>",
      "    <tr>",
      "      <td>a</td>",
      "    </tr>",
      "  </tbody>",
      "</table>",
    ].join("\n");
    expect(component(jsx).diagnostics).toEqual([]);
  });

  it.each(["<br>a</br>", '<img src="/a.png" alt=""><span /></img>', "<input> </input>"])(
    "reports the children of the void element in %s",
    (jsx) => {
      const { diagnostics } = component(`<div>${jsx}</div>`);
      expect(codes(diagnostics)).toEqual(["UF3003"]);
      expect(diagnostics[0]!.message).toMatch(/is a void element, so it cannot have children\.$/);
    },
  );

  it("accepts a void element written with an empty pair of tags", () => {
    expect(component("<div><br></br></div>").diagnostics).toEqual([]);
  });

  // The parent's compile checks such a root where the component sits (ADR-0054).
  it.each(["tr", "td", "th", "tbody", "caption", "col", "dd", "summary", "rt"])(
    "accepts a component whose root is <%s>, which its parent places",
    (tag) => {
      expect(problems(`<${tag}></${tag}>`)).toEqual([]);
    },
  );

  // Ordinary HTML must stay accepted: lists, tables, definitions and inline content.
  it.each([
    "<ul><li>a<ul><li>b</li></ul></li></ul>",
    "<ol><li><p>a</p></li></ol>",
    "<dl><div><dt>a</dt><dd>b</dd></div><dt>c</dt><dd><dl><dd>d</dd></dl></dd></dl>",
    "<table><caption>c</caption><colgroup><col /></colgroup><thead><tr><th>h</th></tr></thead><tbody><tr><td>a<table><tbody><tr><td>b</td></tr></tbody></table></td></tr></tbody><tfoot><tr><td>f</td></tr></tfoot></table>",
    '<div><select><optgroup label="g"><option>a</option></optgroup><hr /><option>b</option></select></div>',
    "<details><summary>s</summary><p>d</p></details>",
    '<figure><img src="/a.png" alt="" /><figcaption>c</figcaption></figure>',
    "<p><ruby>漢<rp>(</rp><rt>kan</rt><rp>)</rp></ruby></p>",
    '<p><span><a href="/"><em>a</em></a></span> <button type="button"><img src="/a.png" alt="go" /></button></p>',
    '<a href="/"><div><p>a</p></div></a>',
    '<div><label>Name <input name="n" /></label></div>',
    '<div><map name="m"><area href="/a" alt="a" /></map></div>',
    "<div><textarea>a &lt;b&gt;</textarea></div>",
    "<div><pre>a\n  b</pre></div>",
  ])("accepts %s", (jsx) => {
    expect(component(jsx).diagnostics).toEqual([]);
  });

  it("accepts the markup of the basics corpus cases", () => {
    const profile = `
      <article class="profile" aria-labelledby="profile-name">
        <header class="profile-header">
          <img src="data:image/svg+xml,%3Csvg%3E%3C/svg%3E" alt="Ada's avatar" width="48" height="48" />
          <h2 id="profile-name">Ada Lovelace</h2>
        </header>
        <p>
          Mathematician &amp; writer
          <br />
          of the first published program
        </p>
        <hr />
        <label for="profile-note">Note</label>
        <input id="profile-note" type="text" name="note" placeholder="Say hello" />
      </article>`;
    // Parenthesised, as a multi-line return must be.
    expect(component(`(${profile})`).diagnostics).toEqual([]);
    expect(component('<p class="greeting">Hello, world!</p>').diagnostics).toEqual([]);
  });
});
