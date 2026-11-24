import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  PLATFORM_ID,
  Renderer2,
  inject,
  input,
  output,
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

@Component({
  selector: "uf-note-editor",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let saves = this.saves();
    @let lastKey = this.lastKey();
    @let tags = this.tags();
    <section
      class="note-editor"
      aria-label="Note"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <button type="button" (click)="save()">Save</button>
      <label>Title<input name="title" (keydown)="recordKey($event)" /></label>
      <label>Body<textarea name="body" (keydown)="recordKey($event)"></textarea></label>
      <p role="status">Saved {{ saves }} times, last key {{ lastKey }}</p>
      <button type="button" (click)="save()">Save and close</button>
      <label>Tag<input
        #tagField
        name="tag"
        (input)="onTagInput($event)"
        (keydown)="onTagKeydown($event)"
      /></label>
      <button type="button" (click)="addTag($event)">Add tag</button>
      <p>Tags: {{ tags.join(", ") }}</p>
    </section>
  `,
})
export default class NoteEditor {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly saved = output<number>();
  readonly tagged = output<[tag: string, via: string]>();
  private readonly tagField = viewChild<ElementRef<HTMLInputElement>>("tagField");
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly saves = signal(0);
  protected readonly lastKey = signal("none");
  protected readonly tags = signal<string[]>([]);
  private readonly tag = signal("");

  protected save() {
    this.saves.update((saves) => saves + 1);
    this.saved.emit(this.saves());
  }

  protected recordKey(event: KeyboardEvent) {
    this.lastKey.set(event.key);
  }

  protected addTag(event: MouseEvent | KeyboardEvent) {
    if (this.tag() === "") return;
    this.tags.set([...this.tags(), this.tag()]);
    this.tagged.emit([this.tag(), event.type]);
    this.tag.set("");
    if (this.tagField()?.nativeElement) this.tagField()!.nativeElement.value = "";
  }

  protected onTagKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") this.addTag(event);
  }

  protected onTagInput(event: InputEvent) {
    this.tag.set((event.currentTarget as HTMLInputElement).value);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
