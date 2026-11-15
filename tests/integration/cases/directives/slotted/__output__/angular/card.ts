import Disclosure from "./disclosure";
import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  afterRenderEffect,
  inject,
  input,
} from "@angular/core";

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
}

/** The hooks of a directive, which `runDirective` runs on its element. */
interface DirectiveHooks<E extends Element, T> {
  mounted?(el: E, value: T): unknown;
  updated?(el: E, value: T, oldValue: T): unknown;
  unmounted?(el: E): unknown;
}

/**
 * Each directive's elements: the value each last received, whether `mounted` ran, how many runs
 * took it up, and the watch on its place in the document.
 */
const directiveStates = new WeakMap<
  object,
  WeakMap<
    Element,
    { value: unknown; mounted: boolean; runs: number; observer: MutationObserver; sync: () => void }
  >
>();

/**
 * Runs a directive's hooks on its element: `mounted` once the element is in the document,
 * `updated` for a value that changed while it is, and `unmounted` once it leaves, which
 * projected content may do and come back. The stop it returns, called when the element's owner
 * goes, unmounts the element a microtask later, unless a later run took it up.
 */
function runDirective<E extends Element, T>(
  directive: DirectiveHooks<E, T>,
  element: E,
  value: T,
): () => void {
  let own = directiveStates.get(directive);
  if (!own) {
    own = new WeakMap();
    directiveStates.set(directive, own);
  }
  const elements = own;
  let state = elements.get(element);
  if (state) {
    state.runs += 1;
    if (!Object.is(value, state.value)) {
      const previous = state.value as T;
      state.value = value;
      if (state.mounted) queueHook(element, () => directive.updated?.(element, value, previous));
    }
  } else {
    const sync = () => {
      const current = elements.get(element);
      if (!current || current.mounted === element.isConnected) return;
      current.mounted = element.isConnected;
      if (current.mounted) {
        const mounted = current.value as T;
        queueHook(element, () => directive.mounted?.(element, mounted));
      } else {
        queueHook(element, () => directive.unmounted?.(element));
      }
    };
    state = { value, mounted: false, runs: 0, observer: new MutationObserver(sync), sync };
    state.observer.observe(document, { childList: true, subtree: true });
    elements.set(element, state);
  }
  state.sync();
  const taken = state;
  const runs = taken.runs;
  return () => {
    queueMicrotask(() => {
      if (elements.get(element) !== taken || taken.runs !== runs) return;
      taken.observer.disconnect();
      elements.delete(element);
      if (taken.mounted) queueHook(element, () => directive.unmounted?.(element));
    });
  };
}

/**
 * Runs a directive's hook once the turn ends, a descendant's before its ancestor's and
 * siblings' in document order, as Vue runs them, with the hooks every other output queued.
 */
function queueHook(element: Element, run: () => void): void {
  const key: unique symbol = Symbol.for("unframework.directive-hooks");
  const scope = globalThis as typeof globalThis & {
    [key]?: { element: Element; run: () => void }[];
  };
  const queued = scope[key];
  if (queued) {
    queued.push({ element, run });
    return;
  }
  scope[key] = [{ element, run }];
  queueMicrotask(() => {
    const hooks = scope[key] ?? [];
    scope[key] = undefined;
    hooks.sort((a, b) => {
      if (a.element === b.element) return 0;
      if (a.element.contains(b.element)) return 1;
      if (b.element.contains(a.element)) return -1;
      return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1;
    });
    for (const hook of hooks) {
      try {
        hook.run();
      } catch (error) {
        reportError(error);
      }
    }
  });
}

@Directive({ selector: "[vTrace]" })
export class VTrace {
  readonly vTrace = input.required<string>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const hooks = {
      mounted(el: HTMLElement, value: string) {
        const call = `mounted ${value}`;
        document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
      },
      unmounted(el: HTMLElement) {
        const call = `unmounted ${el.getAttribute("data-name")}`;
        document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
      },
    };
    const element = this.element.nativeElement;
    let stop: (() => void) | undefined;
    afterRenderEffect(() => {
      stop = runDirective(hooks, element, this.vTrace());
    });
    inject(DestroyRef).onDestroy(() => stop?.());
  }
}

@Component({
  selector: "uf-card",
  imports: [Disclosure, ScopeAttributes, VTrace],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <section
      class="card"
      aria-label="Card"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <uf-disclosure>
        <p data-name="body" [vTrace]="'body'">Body</p>
      </uf-disclosure>
    </section>
  `,
})
export default class Card {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
