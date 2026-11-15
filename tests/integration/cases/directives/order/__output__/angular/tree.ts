import Note from "./note";
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

const TRACE = "directive-trace";

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
        document.dispatchEvent(
          new CustomEvent(TRACE, { detail: { call: `mounted ${value}`, el } }),
        );
      },
      unmounted(el: HTMLElement) {
        const call = `unmounted ${el.getAttribute("data-name")}`;
        document.dispatchEvent(new CustomEvent(TRACE, { detail: { call, el } }));
      },
    };
    const element = this.element.nativeElement;
    let last: { value: string } | undefined;
    afterRenderEffect(() => {
      const value_1 = this.vTrace();
      const previous = last;
      last = { value: value_1 };
      if (!previous) queueHook(element, () => hooks.mounted(element, value_1));
    });
    inject(DestroyRef).onDestroy(() => {
      if (last) queueHook(element, () => hooks.unmounted(element));
    });
  }
}

@Component({
  selector: "uf-tree",
  imports: [Note, ScopeAttributes, VTrace],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let shown = this.shown();
    <section
      class="tree"
      aria-label="Tree"
      data-name="outer"
      [vTrace]="'outer'"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p data-name="first" [vTrace]="'first'">First</p>
      <uf-note />
      @if (shown) {
        <div class="branch" data-name="branch" [vTrace]="'branch'">
          <span data-name="leaf" [vTrace]="'leaf'">Leaf</span>
        </div>
      }
      <p data-name="last" [vTrace]="'last'">Last</p>
      <button type="button" (click)="onToggle()">Toggle</button>
    </section>
  `,
})
export default class Tree {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly shown = signal(true);

  protected onToggle() {
    this.shown.set(!this.shown());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
