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
    let last: { value: string } | undefined;
    afterRenderEffect(() => {
      const value_1 = this.vMark();
      const previous = last;
      last = { value: value_1 };
      if (!previous) queueHook(element_1, () => hooks_1.mounted(element_1, value_1));
      else if (!Object.is(value_1, previous.value)) {
        queueHook(element_1, () => hooks_1.updated(element_1, value_1));
      }
    });
    inject(DestroyRef).onDestroy(() => {
      if (last) queueHook(element_1, () => hooks_1.unmounted());
    });
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
      <textarea
        aria-label="Note"
        #noteField
        [value]="this.note()"
        (input)="this.note.set(noteField.value)"
        [vMark]="note"
        [vSelectable]="true"
      ></textarea>
      <button type="button" (click)="onToggle()">Toggle</button>
    </section>
  `,
})
export default class Profile {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly user = signal<User | null>({ name: "Ada" });
  protected readonly note = signal("Hello");

  protected onToggle() {
    this.user.set(this.user() ? null : { name: "Grace" });
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
