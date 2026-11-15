import { VSelectable } from "./v-selectable";
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
  signal,
} from "@angular/core";

interface User {
  name: string;
}

const hooks = "data-hooks";
const element = "data-element";

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

/** Puts a field's caret after its text, as setting the text of an empty field leaves it. */
@Directive({ selector: "textarea[value]" })
export class TextCaret implements OnInit {
  private readonly element = inject<ElementRef<HTMLTextAreaElement>>(ElementRef);

  ngOnInit(): void {
    const field = this.element.nativeElement;
    const text = field.value;
    field.value = "";
    field.value = text;
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
 * Each directive's elements: the value each last received, whether `mounted` ran, how many runs
 * took it up, and the end of its watch on the document.
 */
const directiveStates = new WeakMap<
  object,
  WeakMap<Element, { value: unknown; mounted: boolean; runs: number; unwatch: () => void }>
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
  const sync = () => {
    const current = elements.get(element);
    if (!current || current.mounted === element.isConnected) return;
    current.mounted = element.isConnected;
    if (current.mounted) {
      const mounted = current.value as T;
      queueHook(element, () => directive.mounted?.(element, mounted));
    } else {
      queueHook(element, () => directive.unmounted?.(element), true);
    }
  };
  let state = elements.get(element);
  if (state) {
    state.runs += 1;
    if (!Object.is(value, state.value)) {
      const previous = state.value as T;
      state.value = value;
      if (state.mounted) queueHook(element, () => directive.updated?.(element, value, previous));
    }
  } else {
    state = { value, mounted: false, runs: 0, unwatch: watchDocument(sync) };
    elements.set(element, state);
  }
  sync();
  const taken = state;
  const runs = taken.runs;
  return () => {
    queueMicrotask(() => {
      if (elements.get(element) !== taken || taken.runs !== runs) return;
      taken.unwatch();
      elements.delete(element);
      if (taken.mounted) queueHook(element, () => directive.unmounted?.(element), true);
    });
  };
}

/**
 * Runs a directive's hook once the turn ends, as Vue runs them: every `unmounted` first, then
 * a descendant's before its ancestor's and siblings' in document order, one element's in the
 * order they came, with the hooks every other output queued.
 */
function queueHook(element: Element, run: () => void, leaving = false): void {
  const key: unique symbol = Symbol.for("unframework.directive-hooks@1");
  const scope = globalThis as typeof globalThis & {
    [key]?: { element: Element; run: () => void; leaving: boolean }[];
  };
  const queued = scope[key];
  if (queued) {
    queued.push({ element, run, leaving });
    return;
  }
  scope[key] = [{ element, run, leaving }];
  queueMicrotask(() => {
    const hooks = scope[key] ?? [];
    scope[key] = undefined;
    // Every `unmounted` runs first, but one after its own element's `mounted` this turn, as
    // StrictMode's, which keeps its place among the rest.
    const first = new Set<{ element: Element; run: () => void; leaving: boolean }>();
    const entered = new Set<Element>();
    for (const hook of hooks) {
      if (!hook.leaving) entered.add(hook.element);
      else if (!entered.has(hook.element)) first.add(hook);
    }
    hooks.sort((a, b) => {
      if (first.has(a) !== first.has(b)) return first.has(a) ? -1 : 1;
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

@Directive({ selector: "[vMark]" })
export class VMark {
  readonly vMark = input.required<string>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const hooks_1 = {
      mounted(el: HTMLElement, value: string) {
        el.setAttribute(hooks, value);
        el.setAttribute(element, "mounted");
        return el;
      },
      updated(el: HTMLElement, value: string) {
        const oldValue = "updated";
        el.setAttribute(hooks, `${oldValue} ${value}`);
      },
      unmounted() {},
    };
    const element_1 = this.element.nativeElement;
    let stop: (() => void) | undefined;
    afterRenderEffect(() => {
      stop = runDirective(hooks_1, element_1, this.vMark());
    });
    inject(DestroyRef).onDestroy(() => stop?.());
  }
}

@Component({
  selector: "uf-profile",
  imports: [ScopeAttributes, TextCaret, VSelectable, VMark],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let user = this.user();
    @let note = this.note();
    @let label = this.label();
    @let nick = this.nick();
    @let track = this.track();
    @let cleanup = this.cleanup();
    <section
      class="profile"
      aria-label="Profile"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      @if (user) {
        <p [vMark]="user.name">{{ user.name }}</p>
      }
      @if (typeof label === "string") {
        <b [vMark]="label">{{ label }}</b>
      }
      @if (nick) {
        <i [vMark]="nick">{{ nick }}</i>
      }
      @if (cleanup) {
        <s [vMark]="cleanup + track">{{ cleanup }}</s>
      }
      <textarea
        aria-label="Note"
        #noteField
        [value]="this.note()"
        (input)="this.note.set(noteField.value)"
        [vMark]="note"
        [vSelectable]="true"
      ></textarea>
      <button type="button" (click)="onToggle()">Toggle</button>
      <button type="button" (click)="onCount()">Count</button>
      <button type="button" (click)="onForget()">Forget</button>
    </section>
  `,
})
export default class Profile {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly user = signal<User | null>({ name: "Ada" });
  protected readonly note = signal("Hello");
  protected readonly label = signal<string | number>("Lovelace");
  protected readonly nick = signal<string | undefined>("Al");
  protected readonly track = signal("Trail");
  protected readonly cleanup = signal<string | null>("Tidy");

  protected onToggle() {
    this.user.set(this.user() ? null : { name: "Grace" });
  }

  protected onCount() {
    this.label.set(1);
  }

  protected onForget() {
    this.nick.set(undefined);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
