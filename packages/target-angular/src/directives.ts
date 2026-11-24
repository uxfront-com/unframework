// The listeners with an option (ADR-0047): a template's `(click)` cannot ask for the capture
// phase, a single run or a passive listener, so the file declares a small attribute directive
// for each event and option its template uses, which listens with that option and re-emits the
// event through an output of its selector's name: `<div (ufClickCapture)="record()">`. Being a
// directive, it listens on every element it matches, inside `@if` and `@for` blocks too, and
// stops listening when its element goes.
import {
  exportDeclaration,
  js,
  printExpression,
  TRUSTED_HTML_PIPE,
} from "@unframework.dev/codegen";
import type { ImportSet, Placeholders } from "@unframework.dev/codegen";

/** A directive that listens to one event with one option. */
export interface DirectiveSpec {
  /** The DOM event (`click`). */
  event: string;
  option: "capture" | "once" | "passive";
  /** Its selector's attribute and its output's name: `ufClickCapture`. */
  output: string;
  /** The class's export name, `ClickCapture`, its shared module's too (ADR-0121). */
  name: string;
  /** The class's local name, claimed beside the file's other names. */
  className: string;
  /** The DOM interface of the event (`PointerEvent`), the output's value type. */
  eventType: string;
}

/**
 * A directive's declaration, its decorator apart (printed before the class, see ./index.ts):
 *
 * ```ts
 * @Directive({ selector: "[ufClickCapture]" })
 * class ClickCapture {
 *   readonly ufClickCapture = output<PointerEvent>();
 *
 *   constructor() {
 *     const element: HTMLElement = inject(ElementRef).nativeElement;
 *     const stop = inject(Renderer2).listen(element, "click", (event: PointerEvent) => this.ufClickCapture.emit(event), { capture: true });
 *     inject(DestroyRef).onDestroy(stop);
 *   }
 * }
 * ```
 */
export function directiveCode(
  spec: DirectiveSpec,
  imports: ImportSet,
  placeholders: Placeholders,
): { decorator: string; statements: ReturnType<typeof exportDeclaration> } {
  const core = (name: string) => imports.add("@angular/core", name);
  const decorator = `@${printExpression(
    js.callExpression(js.identifier(core("Directive")), [
      js.objectExpression([["selector", js.stringLiteral(`[${spec.output}]`)]]),
    ]),
  )}`;
  const output = js.propertyDefinition(
    spec.output,
    js.callExpression(js.identifier(core("output")), [], [placeholders.type(spec.eventType)]),
    { readonly: true },
  );
  const body = [
    `const element: HTMLElement = ${core("inject")}(${core("ElementRef")}).nativeElement;`,
    `const stop = ${core("inject")}(${core("Renderer2")}).listen(element, ${JSON.stringify(spec.event)}, (event: ${spec.eventType}) => this.${spec.output}.emit(event), { ${spec.option}: true });`,
    `${core("inject")}(${core("DestroyRef")}).onDestroy(stop);`,
  ].join("\n");
  const constructor = js.methodDefinition("constructor", [], [placeholders.statements(body)], {
    kind: "constructor",
  });
  // Exported: Angular's template type-checker imports every directive a template uses (NG3004).
  const declaration = js.classDeclaration(spec.className, [], [output, constructor]);
  return {
    decorator,
    statements: exportDeclaration(spec.className, declaration, [
      { kind: "named", name: spec.className, local: spec.className, span: { start: 0, end: 0 } },
    ]),
  };
}

/** The names the scope directive's code declares, each claimed beside the file's other names. */
export interface ScopeDirectiveNames {
  /** The directive's class, `ScopeAttributes`. */
  className: string;
  /** The module's map from each host to the scope attributes taken off it, `scopes`. */
  scopes: string;
}

/**
 * `child-root-scope` (ADR-0063): the directive each of a component's root nodes binds to the
 * component's host, `<button [ufScope]="this.host">`. A styled parent writes its scope attribute
 * on the child's tag, which is the host here; the attribute's name is the parent's id, which the
 * child cannot know, so the directive reads the host's `data-uf-*` attributes as its root renders,
 * after the parent's own root directive has set them, and takes them off the host, which then
 * keeps only `display: contents` and is unwrapped (ADR-0056). A root that renders later (another
 * branch) reads them from the module's map.
 */
export function scopeDirectiveCode(names: ScopeDirectiveNames, imports: ImportSet): string {
  const core = (name: string, type = false) => imports.add("@angular/core", name, { type });
  const { className, scopes } = names;
  return [
    "/** The scope attributes taken off each host, for the roots its component renders later. */",
    `const ${scopes} = new WeakMap<Element, string[]>();`,
    "",
    "/**",
    " * Gives a root node of its component the scope attributes the component's styled parents put on",
    " * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.",
    " */",
    `@${core("Directive")}({ selector: "[ufScope]" })`,
    `export class ${className} implements ${core("OnInit", true)} {`,
    `  readonly ufScope = ${core("input")}.required<HTMLElement>();`,
    `  private readonly element = ${core("inject")}<${core("ElementRef")}<Element>>(${core("ElementRef")});`,
    `  private readonly renderer = ${core("inject")}(${core("Renderer2")});`,
    "",
    "  ngOnInit(): void {",
    "    const host = this.ufScope();",
    `    let names = ${scopes}.get(host);`,
    "    if (!names) {",
    '      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));',
    "      for (const name of names) this.renderer.removeAttribute(host, name);",
    `      ${scopes}.set(host, names);`,
    "    }",
    '    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");',
    "  }",
    "}",
    "",
  ].join("\n");
}

/**
 * The directive that puts a bound `<textarea>`'s caret after its text once it is rendered
 * (ADR-0095): once hydrated, the field keeps the server's text with the caret before it, where a
 * client render sets the text of an empty field and leaves the caret after it. It empties the
 * field and sets its text again, as ADR-0060 has React do, which fires no event
 * (`setSelectionRange` would fire `select`). Angular runs a node's `ngOnInit` after its bindings,
 * so in a client render the field already holds its text, and setting it again moves only the
 * caret. It selects a field by that binding, which
 * Angular matches as it does an attribute, so it adds no attribute to the DOM, and only the
 * components that bind a `<textarea>` import it.
 */
export function textCaretDirectiveCode(className: string, imports: ImportSet): string {
  const core = (name: string, type = false) => imports.add("@angular/core", name, { type });
  return `/** Puts a field's caret after its text, as setting the text of an empty field leaves it. */
@${core("Directive")}({ selector: "textarea[value]" })
export class ${className} implements ${core("OnInit", true)} {
  private readonly element = ${core("inject")}<${core("ElementRef", true)}<HTMLTextAreaElement>>(${core("ElementRef")});

  ngOnInit(): void {
    const field = this.element.nativeElement;
    const text = field.value;
    field.value = "";
    field.value = text;
  }
}
`;
}

/** The attribute that selects the teleport directive (ADR-0098). */
export const TELEPORT_ATTRIBUTE = "ufTeleport";

/** The input that hands the teleport directive its component's host, where it is the root. */
export const TELEPORT_HOST_INPUT = "ufTeleportHost";

/**
 * The directive that mounts a `<Teleport>`'s content into the element `to` selects (ADR-0098):
 * `<ng-template ufTeleport="body">`. After a render that left its anchor in the document, so that
 * neither the server nor the hydrating client renders it, it creates the template's view,
 * attaches it to the application and appends its nodes to `to`, and it refreshes the view after
 * every render, since the view reads the component's `@let` values, which mark it dirty in no
 * signal. The view is in no view container, so neither an insertion nor a slot's projection
 * moves a node it moved. A template projected into a slot that isn't rendered has no anchor in
 * the document: it mounts when the slot renders, and unmounts when the slot goes. Destroying a
 * view removes none of its nodes, so it removes them. At the root of its component, it takes the
 * host's scope attributes off, which its styled parents put there and a teleport root takes
 * nowhere, as Vue drops them. It is exported, as ngtsc's type-check imports every directive a
 * template uses.
 */
export function teleportDirectiveCode(className: string, imports: ImportSet): string {
  const core = (name: string, type = false) => imports.add("@angular/core", name, { type });
  return `/** The teleports a render created, which mount in the document's order. */
const ${className}Queue: { anchor: Node; mount: () => void }[] = [];

/** Mounts its template's content into the element \`${TELEPORT_ATTRIBUTE}\` selects once rendered, and removes it on destroy. */
@${core("Directive")}({ selector: "ng-template[${TELEPORT_ATTRIBUTE}]" })
export class ${className} implements ${core("OnInit", true)} {
  readonly ${TELEPORT_ATTRIBUTE} = ${core("input")}.required<string>();
  readonly ${TELEPORT_HOST_INPUT} = ${core("input")}<HTMLElement>();
  private readonly renderer = ${core("inject")}(${core("Renderer2")});

  ngOnInit(): void {
    const host = this.${TELEPORT_HOST_INPUT}();
    for (const name of host?.getAttributeNames() ?? []) {
      if (name.startsWith("data-uf-")) this.renderer.removeAttribute(host, name);
    }
  }

  constructor() {
    const template = ${core("inject")}<${core("TemplateRef", true)}<unknown>>(${core("TemplateRef")});
    const application = ${core("inject")}(${core("ApplicationRef")});
    const document = ${core("inject")}(${core("DOCUMENT")});
    const anchor: Node = ${core("inject")}<${core("ElementRef", true)}<Comment>>(${core("ElementRef")}).nativeElement;
    let view: ${core("EmbeddedViewRef", true)}<unknown> | undefined;
    const mount = () => {
      const target = document.querySelector(this.${TELEPORT_ATTRIBUTE}());
      if (!target) return;
      view = template.createEmbeddedView({});
      application.attachView(view);
      view.detectChanges();
      target.append(...view.rootNodes);
    };
    const unmount = () => {
      const nodes: Node[] = view?.rootNodes ?? [];
      view?.destroy();
      view = undefined;
      for (const node of nodes) node.parentNode?.removeChild(node);
    };
    // Angular runs a render's callbacks in no source order: each teleport queues itself, and the
    // first to write mounts them all in the order of their anchors. A template projected into a
    // slot that isn't rendered has no anchor in the document, so it waits for one.
    ${core("afterEveryRender")}({
      earlyRead: () => {
        if (!view && anchor.isConnected) ${className}Queue.push({ anchor, mount });
      },
      write: () => {
        const due = ${className}Queue.splice(0).sort((a, b) =>
          a.anchor.compareDocumentPosition(b.anchor) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
        );
        for (const each of due) each.mount();
        // The view reads the component's state, which this render may have changed.
        if (view && !anchor.isConnected) unmount();
        else view?.detectChanges();
      },
    });
    ${core("inject")}(${core("DestroyRef")}).onDestroy(unmount);
  }
}
`;
}

/** The attribute that selects the transition directive, and the name it is exported as (ADR-0100). */
export const TRANSITION_ATTRIBUTE = "ufTransition";

/** The input that runs the enter on the element's first render too (`appear`). */
export const TRANSITION_APPEAR_INPUT = "ufTransitionAppear";

/** The input that names the element's branch of the transition's conditional. */
export const TRANSITION_BRANCH_INPUT = "ufTransitionBranch";

/** The attribute that selects a transition's region, around its conditional. */
export const TRANSITION_REGION_ATTRIBUTE = "ufTransitionRegion";

/**
 * The region of a `<Transition>` whose child is a conditional (ADR-0100):
 * `<ng-container [ufTransitionRegion]="(open) ? 0 : -1">`, created with the transition, whose input
 * is the branch shown. Angular sets it before it renders the conditional inside, so the branch is
 * the new one as Angular removes an element. `ready` turns true once the region has rendered, so an
 * element the conditional creates later enters, and one of the region's first render, as when a
 * condition around the transition shows it again, enters only with `appear`, as on Vue.
 * `afterNextRender` never runs on the server.
 */
export function transitionRegionCode(className: string, imports: ImportSet): string {
  const core = (name: string) => imports.add("@angular/core", name);
  return `/** A transition's conditional: the branch it shows, and whether it has rendered once. */
@${core("Directive")}({ selector: "ng-container[${TRANSITION_REGION_ATTRIBUTE}]" })
export class ${className} {
  readonly ${TRANSITION_REGION_ATTRIBUTE} = ${core("input")}.required<number>();
  ready = false;

  constructor() {
    ${core("afterNextRender")}(() => {
      this.ready = true;
    });
  }
}
`;
}

/**
 * The directive that runs Vue's transition classes on its element (ADR-0100):
 * `<p [ufTransition]="'fade'" [ufTransitionBranch]="0">`. After the render that created the
 * element, it runs the enter if its transition's region had rendered before, or with `appear`.
 * Angular's `(animate.leave)` holds the element's removal until `animationComplete()`. Angular
 * also runs the leave of every element in a view that something around it removes, or that goes
 * with its component, where Vue removes the element at once, so the leave runs only when the
 * region shows another branch than the element's, and completes at once otherwise. Each phase adds
 * its `-from` and `-active` classes, swaps `-from` for `-to` two frames later, as Vue does, and
 * removes them at the end: the element's own `transitionend` or `animationend`, or its longest
 * duration and delay, whichever comes first. Angular also completes a leave on any `animationend`
 * that reaches the element, a child's included. It is exported, as ngtsc's type-check imports
 * every directive a template uses.
 */
export function transitionDirectiveCode(
  className: string,
  region: string,
  imports: ImportSet,
): string {
  const core = (name: string, type = false) => imports.add("@angular/core", name, { type });
  return `/** Runs Vue's transition classes of \`${TRANSITION_ATTRIBUTE}\` on its element as it enters and leaves. */
@${core("Directive")}({ selector: "[${TRANSITION_ATTRIBUTE}]", exportAs: "${TRANSITION_ATTRIBUTE}" })
export class ${className} implements ${core("OnInit", true)} {
  readonly ${TRANSITION_ATTRIBUTE} = ${core("input")}.required<string>();
  readonly ${TRANSITION_APPEAR_INPUT} = ${core("input")}(false);
  readonly ${TRANSITION_BRANCH_INPUT} = ${core("input")}<number>();
  private readonly region = ${core("inject")}(${region}, { optional: true });
  private readonly element: Element = ${core("inject")}<${core("ElementRef", true)}<Element>>(${core("ElementRef")}).nativeElement;
  private entering = false;
  private stopEnter: (() => void) | undefined;

  constructor() {
    ${core("afterNextRender")}({
      write: () => {
        if (this.entering) this.stopEnter = this.run("enter");
      },
    });
    ${core("inject")}(${core("DestroyRef")}).onDestroy(() => this.stopEnter?.());
  }

  ngOnInit(): void {
    // Only an element with a branch of its own reads the region: one of a transition without a
    // conditional finds the region of a transition around it, which says nothing of its own.
    this.entering =
      (this.${TRANSITION_BRANCH_INPUT}() !== undefined && Boolean(this.region?.ready)) ||
      this.${TRANSITION_APPEAR_INPUT}();
  }

  /**
   * \`(animate.leave)\`: runs the leave when the region shows another branch than the element's,
   * and lets the element go at once when it still shows it: something around it removed it.
   */
  leave(event: ${core("AnimationCallbackEvent", true)}): void {
    this.stopEnter?.();
    if (!this.region || this.region.${TRANSITION_REGION_ATTRIBUTE}() === this.${TRANSITION_BRANCH_INPUT}()) {
      event.animationComplete();
      return;
    }
    this.run("leave", () => event.animationComplete());
  }

  private run(phase: "enter" | "leave", done?: () => void): () => void {
    const { element } = this;
    const from = \`\${this.${TRANSITION_ATTRIBUTE}()}-\${phase}-from\`;
    const active = \`\${this.${TRANSITION_ATTRIBUTE}()}-\${phase}-active\`;
    const to = \`\${this.${TRANSITION_ATTRIBUTE}()}-\${phase}-to\`;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      element.removeEventListener("transitionend", end);
      element.removeEventListener("animationend", end);
      element.classList.remove(from, active, to);
    };
    const end = (event?: Event) => {
      if (event && event.target !== element) return;
      stop();
      done?.();
    };
    element.classList.add(from, active);
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        element.classList.remove(from);
        element.classList.add(to);
        const style = getComputedStyle(element);
        const longest = (delays: string, durations: string) => {
          const each = (list: string) => list.split(", ").map((time) => Number(time.slice(0, -1)) * 1000);
          const delay = each(delays);
          return Math.max(0, ...each(durations).map((duration, index) => duration + (delay[index % delay.length] ?? 0)));
        };
        const time = Math.max(
          longest(style.transitionDelay, style.transitionDuration),
          longest(style.animationDelay, style.animationDuration),
        );
        if (!time) {
          end();
          return;
        }
        element.addEventListener("transitionend", end);
        element.addEventListener("animationend", end);
        timer = setTimeout(end, time + 1);
      });
    });
    return stop;
  }
}
`;
}

/**
 * The pure pipe `[innerHTML]` reads its markup through (ADR-0097). Angular sanitises a bound
 * `innerHTML`, dropping `id`, `data-*` and `style` attributes, form controls and SVG, and marking
 * the markup trusted renders it as written, as the other targets do. A pure pipe runs again only
 * when the markup changes, so change detection sees one trusted value per string.
 */
export function trustedHtmlPipeCode(className: string, imports: ImportSet): string {
  const core = (name: string, type = false) => imports.add("@angular/core", name, { type });
  const browser = (name: string, type = false) =>
    imports.add("@angular/platform-browser", name, { type });
  return `/** Marks markup trusted, so that \`[innerHTML]\` renders it as written. */
@${core("Pipe")}({ name: "${TRUSTED_HTML_PIPE}" })
class ${className} implements ${core("PipeTransform", true)} {
  private readonly sanitizer = ${core("inject")}(${browser("DomSanitizer")});

  transform(html: string): ${browser("SafeHtml", true)} {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
`;
}
