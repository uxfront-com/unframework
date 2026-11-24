import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  inject,
  input as input_1,
  output,
  signal,
  viewChild,
} from "@angular/core";

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input_1.required<HTMLElement>();
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

/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */
type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

/**
 * Puts what a consumer passes the component, and the component does not declare, on the element
 * that takes it (ADR-0118): the attributes, the consumer's winning over the element's own, and
 * the native listeners, which run after the element's own.
 */
@Directive({ selector: "[ufFallthrough]" })
export class Fallthrough implements OnChanges, OnDestroy {
  readonly ufFallthrough = input_1.required<{
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

@Component({
  selector: "uf-tag-form",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let tags = this.tags();
    @let helpOpen = this.helpOpen();
    <form
      class="tag-form"
      aria-label="Tags"
      (submit)="addTag($event)"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <label>New tag<input
        name="tag"
        #field
        (keydown)="blockComma($event)"
        (input)="updateDraft($event)"
      /></label>
      <button type="submit">Add tag</button>
      <a href="/help/tags" (click)="toggleHelp($event)">How tags work</a>
      @if (helpOpen) {
        <p>A tag is one word: commas are not allowed.</p>
      }
      <ul aria-label="Added tags">
        @for (tag of tags; track tag) {
          <li>{{ tag }}</li>
        }
      </ul>
    </form>
  `,
})
export default class TagForm {
  readonly class = input_1<string>();
  readonly style = input_1<Record<string, string | null | undefined>>();
  readonly ufAttributes = input_1<Record<string, unknown>>();
  readonly ufListeners = input_1<Listeners>();
  readonly tagsChange = output<string[]>();
  private readonly field = viewChild<ElementRef<HTMLInputElement>>("field");
  readonly ufElement = viewChild<ElementRef<HTMLFormElement>>("ufElement");
  protected readonly tags = signal<string[]>([]);
  private readonly draft = signal("");
  protected readonly helpOpen = signal(false);

  protected blockComma(event: KeyboardEvent) {
    if (event.key === ",") event.preventDefault();
  }

  protected updateDraft(event: InputEvent) {
    this.draft.set((event.currentTarget as HTMLInputElement).value);
  }

  protected addTag(event: SubmitEvent) {
    event.preventDefault();
    if (this.draft() !== "" && !this.tags().includes(this.draft())) {
      this.tags.set([...this.tags(), this.draft()]);
      this.tagsChange.emit(this.tags());
    }
    this.draft.set("");
    const input = this.field()?.nativeElement ?? null;
    if (input) input.value = "";
  }

  protected toggleHelp(event: MouseEvent) {
    event.preventDefault();
    this.helpOpen.set(!this.helpOpen());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
