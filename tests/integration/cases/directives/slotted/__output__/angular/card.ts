import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { queueHook } from "./_unframework/queueHook";
import Disclosure from "./disclosure";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  PLATFORM_ID,
  Renderer2,
  afterRenderEffect,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */
type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

/**
 * Puts what a consumer passes the component, and the component does not declare, on the element
 * that takes it (ADR-0118): the attributes, the consumer's winning over the element's own, and
 * the native listeners, which run after the element's own.
 */
@Directive({ selector: "[ufFallthrough]" })
export class Fallthrough implements OnChanges, OnDestroy {
  readonly ufFallthrough = input.required<{
    attributes: Record<string, unknown> | undefined;
    listeners: Listeners | undefined;
  }>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly listening = new Map<string, { handler: unknown; stop: () => void }>();
  private written: Record<string, unknown> = {};

  ngOnChanges(): void {
    const element = this.element.nativeElement;
    const { attributes = {}, listeners = {} } = this.ufFallthrough();
    for (const name of Object.keys(this.written)) {
      if (!(name in attributes)) this.renderer.removeAttribute(element, name);
    }
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null || value === undefined) this.renderer.removeAttribute(element, name);
      else this.renderer.setAttribute(element, name, String(value));
    }
    this.written = attributes;
    if (!this.browser) return;
    const handlers = new Map(Object.entries(listeners));
    for (const [event, { handler, stop }] of this.listening) {
      if (handlers.get(event) === handler) continue;
      stop();
      this.listening.delete(event);
    }
    for (const [event, handler] of handlers) {
      if (handler === undefined || this.listening.has(event)) continue;
      this.listening.set(event, { handler, stop: this.renderer.listen(element, event, handler) });
    }
  }

  ngOnDestroy(): void {
    for (const { stop } of this.listening.values()) stop();
  }
}

/** The hooks of a directive, which `runDirective` runs on its element. */
interface DirectiveHooks<E extends Element, T> {
  mounted?(el: E, value: T): unknown;
  updated?(el: E, value: T, oldValue: T): unknown;
  unmounted?(el: E): unknown;
}

/** The checks `watchDocument` calls, and its observer while it has any. */
const documentWatches: { checks: Set<() => void>; observer?: MutationObserver } = {
  checks: new Set(),
};

/**
 * Calls `check` after each change to the document's tree, through one `MutationObserver` for
 * every watch, and returns the end of the watch.
 */
function watchDocument(check: () => void): () => void {
  const { checks } = documentWatches;
  if (!documentWatches.observer) {
    documentWatches.observer = new MutationObserver(() => {
      for (const each of [...checks]) each();
    });
    documentWatches.observer.observe(document, { childList: true, subtree: true });
  }
  checks.add(check);
  return () => {
    checks.delete(check);
    if (!checks.size) {
      documentWatches.observer?.disconnect();
      documentWatches.observer = undefined;
    }
  };
}

/**
 * Each directive's elements: the value each last received, whether `mounted` ran, whether it
 * left its caller's list, how many runs took it up, and the end of its watch on the document.
 */
const directiveStates = new WeakMap<
  object,
  WeakMap<
    Element,
    { value: unknown; mounted: boolean; left: boolean; runs: number; unwatch: () => void }
  >
>();

/**
 * The check of a directive's elements: `mounted` once an element is in the document, and
 * `unmounted` once it leaves. A caller that lists its elements passes `follow`, which takes an
 * element out of the list as it leaves and back in if it returns, for the caller's next run to
 * mount it with the value of then; meanwhile the element belongs to a weak watch alone
 * (`watchLeft`). Declared apart from `runDirective`, whose scope holds
 * the element, so nothing it makes keeps a left element alive.
 */
function directiveCheck<E extends Element, T>(
  directive: DirectiveHooks<E, T>,
  elements: WeakMap<
    Element,
    { value: unknown; mounted: boolean; left: boolean; runs: number; unwatch: () => void }
  >,
  follow: { leave(element: E): void; back(element: E): void } | undefined,
): (target: E) => void {
  const check = (target: E): void => {
    const current = elements.get(target);
    if (!current || current.mounted === target.isConnected) return;
    if (current.left) {
      // Back in the document, it rejoins the list, and the caller's next run mounts it with the
      // value of then.
      if (target.isConnected) follow?.back(target);
      return;
    }
    current.mounted = target.isConnected;
    if (current.mounted) {
      const mounted = current.value as T;
      queueHook(target, () => directive.mounted?.(target, mounted), "mounted");
      return;
    }
    queueHook(target, () => directive.unmounted?.(target), "unmounted");
    if (!follow) return;
    current.left = true;
    current.unwatch();
    current.unwatch = watchLeft(target, check);
    follow.leave(target);
  };
  return check;
}

/**
 * Watches an element that left its caller's list through a `WeakRef`: `check` runs on it
 * after each change of the document while it lives, and the watch ends once it is collected.
 */
function watchLeft<E extends Element>(element: E, check: (target: E) => void): () => void {
  const left = new WeakRef(element);
  const unwatch = watchDocument(() => {
    const kept = left.deref();
    if (kept) check(kept);
    else unwatch();
  });
  return unwatch;
}

/**
 * Runs a directive's hooks on its element: `mounted` once the element is in the document,
 * `updated` for a value that changed while it is, and `unmounted` once it leaves, which
 * projected content may do and come back. A caller that lists its elements passes `follow`
 * (`directiveCheck`): an element that left the list stays with its weak watch, and one that is gone
 * for good is collected, which ends its watch at the next change of the document. The stop it
 * returns, called when the element's owner goes, unmounts the element a microtask later, unless a
 * later run took it up or it left a list.
 */
function runDirective<E extends Element, T>(
  directive: DirectiveHooks<E, T>,
  element: E,
  value: T,
  follow?: { leave(element: E): void; back(element: E): void },
): () => void {
  let own = directiveStates.get(directive);
  if (!own) {
    own = new WeakMap();
    directiveStates.set(directive, own);
  }
  const elements = own;
  const check = directiveCheck(directive, elements, follow);
  let state = elements.get(element);
  if (state?.left) {
    // A left element its caller lists again: it is followed as any other.
    state.left = false;
    state.unwatch();
    state.unwatch = watchDocument(() => check(element));
  }
  if (state) {
    state.runs += 1;
    if (!Object.is(value, state.value)) {
      const previous = state.value as T;
      state.value = value;
      if (state.mounted) {
        queueHook(element, () => directive.updated?.(element, value, previous), "updated");
      }
    }
  } else {
    state = {
      value,
      mounted: false,
      left: false,
      runs: 0,
      unwatch: watchDocument(() => check(element)),
    };
    elements.set(element, state);
  }
  check(element);
  const taken = state;
  const runs = taken.runs;
  return () => {
    queueMicrotask(() => {
      if (elements.get(element) !== taken || taken.runs !== runs || taken.left) return;
      taken.unwatch();
      elements.delete(element);
      if (taken.mounted) queueHook(element, () => directive.unmounted?.(element), "unmounted");
    });
  };
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
  imports: [Disclosure, ScopeAttributes, Fallthrough, VTrace],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let note = this.note();
    <section
      class="card"
      aria-label="Card"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-disclosure>
        <p data-name="body" [vTrace]="'body'">Body</p>
        @if (note) {
          <p data-name="note" [vTrace]="note.name">Note</p>
        }
      </uf-disclosure>
      <button type="button" (click)="onRename()">Rename</button>
    </section>
  `,
})
export default class Card {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly note = signal<{ name: string } | null>({ name: "note" });

  protected onRename() {
    this.note.set({ name: "renamed" });
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
