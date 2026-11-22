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
  input,
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
  selector: "uf-comment-composer",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let tags = this.tags();
    @let query = this.query();
    @let panelOpen = this.panelOpen();
    @let confirming = this.confirming();
    @let tipShown = this.tipShown();
    @let log = this.log();
    <section
      class="comment-composer"
      aria-label="Composer"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <label>Comment<textarea name="comment" (keydown)="send($event)"></textarea></label>
      <form aria-label="Tags" (submit)="onTagsSubmit($event)">
        <label>Tag<input name="tag" (keydown)="onTagKeydown($event)" /></label>
        <button type="submit">Save tags</button>
      </form>
      <ul aria-label="Tag list">
        @for (tag of tags; track tag) {
          <li>{{ tag }}</li>
        }
      </ul>
      <label>Code<input name="code" (keydown)="onCodeKeydown($event)" /></label>
      <div class="panel" role="presentation" (keydown)="onKeydown($event)">
        <label>Search<input
          name="search"
          (input)="onSearchInput($event)"
          (keydown)="onSearchKeydown($event)"
        /></label>
        <p>{{ panelOpen ? "Searching for: " + query : "Panel closed" }}</p>
      </div>
      <div class="page" role="presentation" (click)="record('page')">
        @if (tipShown) {
          <div
            class="tip"
            role="presentation"
            style="padding: 12px"
            (click)="onClick($event)"
          >Click here to hide this tip.<button
            type="button"
            (click)="record('tip button')"
          >More tips</button></div>
        }
        @if (confirming) {
          <div
            class="backdrop"
            role="presentation"
            data-testid="backdrop"
            style="padding: 24px"
            (click)="onClick_1($event)"
          >
            <div role="dialog" aria-label="Discard draft">
              <p>Discard this draft?</p>
              <button type="button" (click)="record('kept')">Keep</button>
            </div>
          </div>
        } @else {
          <p>Draft dismissed</p>
        }
      </div>
      <button
        type="button"
        (click)="onSave(); void (once(clickOnce, $event) && firstSave.emit())"
      >Save</button>
      <button
        type="button"
        (click)="onUpload(); void (once(clickOnce, $event) && record('first upload'))"
      >Upload</button>
      <button type="button" (click)="onFinishUpload()">Finish upload</button>
      <ol aria-label="Log">
        @for (line of log; track index; let index = $index) {
          <li>{{ line }}</li>
        }
      </ol>
    </section>
  `,
})
export default class CommentComposer {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly sent = output<string>();
  readonly saved = output<number>();
  readonly firstSave = output<void>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly tags = signal<string[]>([]);
  protected readonly query = signal("");
  protected readonly panelOpen = signal(true);
  protected readonly confirming = signal(true);
  protected readonly tipShown = signal(true);
  private readonly saves = signal(0);
  protected readonly log = signal<string[]>([]);
  private finishUpload: (() => void) | undefined;
  protected readonly clickOnce = new WeakSet<EventTarget>();

  protected record(line: string) {
    this.log.set([...this.log(), line]);
  }

  protected send(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    this.sent.emit((event.target as HTMLTextAreaElement).value);
  }

  private addTag(event: KeyboardEvent) {
    event.preventDefault();
    const field = event.target as HTMLInputElement;
    if (field.value === "" || this.tags().includes(field.value)) return;
    this.tags.set([...this.tags(), field.value]);
    field.value = "";
  }

  private clearSearch(event: KeyboardEvent) {
    event.stopPropagation();
    this.query.set("");
    (event.target as HTMLInputElement).value = "";
  }

  private dismiss(event: MouseEvent) {
    event.stopPropagation();
    this.confirming.set(false);
    this.record("dismissed");
  }

  protected onTagsSubmit(event: SubmitEvent) {
    event.preventDefault();
    this.record("tags submitted");
  }

  protected onTagKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    this.addTag(event);
  }

  protected onCodeKeydown(event: KeyboardEvent) {
    if (event.key.length === 1 && (event.target as HTMLInputElement).value.length >= 4)
      event.preventDefault();
  }

  protected onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") this.panelOpen.set(false);
  }

  protected onSearchInput(event: InputEvent) {
    this.query.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onSearchKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && (event.target as HTMLInputElement).value !== "")
      this.clearSearch(event);
  }

  protected onClick(event: PointerEvent) {
    if (event.target !== event.currentTarget) return;
    event.stopPropagation();
    this.tipShown.set(false);
  }

  protected onClick_1(event: PointerEvent) {
    if (event.target === event.currentTarget) this.dismiss(event);
  }

  protected onSave() {
    if (this.tags().length === 0) return;
    this.saves.update((saves) => saves + 1);
    this.saved.emit(this.saves());
  }

  protected async onUpload() {
    this.record("upload started");
    await new Promise<void>((resolve) => {
      this.finishUpload = resolve;
    });
    this.record("upload finished");
  }

  protected onFinishUpload() {
    this.finishUpload?.();
  }

  protected once(elements: WeakSet<EventTarget>, event: Event): boolean {
    const element = event.currentTarget;
    if (element === null || elements.has(element)) return false;
    elements.add(element);
    return true;
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
