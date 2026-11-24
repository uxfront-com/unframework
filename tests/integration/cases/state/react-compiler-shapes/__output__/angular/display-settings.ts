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

export interface Settings {
  theme: string;
  size: number;
}

interface SaveReply {
  id?: number;
  error?: string;
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
  selector: "uf-display-settings",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let settings = this.settings();
    @let saving = this.saving();
    @let label = this.label();
    @let failure = this.failure();
    <section
      class="display-settings"
      aria-label="Display"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p role="status">Theme {{ settings.theme }}, size {{ settings.size }}</p>
      <button type="button" (click)="onDark()">Dark</button>
      <button type="button" (click)="grow()">Larger</button>
      <button type="button" (click)="onAllowUpTo30()">Allow up to 30</button>
      <button type="button" (click)="save()">Save</button>
      <p>{{ saving ? "Saving" : failure === "" ? label : "Failed: " + failure }}</p>
      <div role="group" aria-label="Server">
        <button type="button" (click)="onReplyWithAnId()">Reply with an id</button>
        <button type="button" (click)="onReplyAsADraft()">Reply as a draft</button>
        <button type="button" (click)="onReplyWithAnError()">Reply with an error</button>
      </div>
    </section>
  `,
})
export default class DisplaySettings {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly applied = output<[theme: string, size: number]>();
  readonly saved = output<number>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly settings = signal<Settings>({ theme: "light", size: 14 });
  private readonly maxSize = signal(20);
  protected readonly saving = signal(false);
  protected readonly label = signal("Never saved");
  protected readonly failure = signal("");
  private finish: ((reply: SaveReply) => void) | undefined;

  private apply(patch: Partial<Settings>) {
    const { theme = this.settings().theme, size = this.settings().size } = patch;
    this.settings.set({ theme, size });
    this.applied.emit([theme, size]);
  }

  protected grow() {
    const clamp = (value: number, max = this.maxSize()) => Math.min(value, max);
    this.apply({ size: clamp(this.settings().size + 4) });
  }

  protected async save() {
    this.saving.set(true);
    this.failure.set("");
    try {
      const reply = await new Promise<SaveReply>((resolve) => {
        this.finish = resolve;
      });
      if (reply.error) throw new Error(reply.error);
      const id = reply.id ?? 0;
      this.label.set(id === 0 ? "Saved as a draft" : `Saved as #${id}`);
      this.saved.emit(id);
    } catch (error) {
      this.failure.set(error instanceof Error ? error.message : "Saving failed");
    } finally {
      this.saving.set(false);
    }
  }

  protected onDark() {
    this.apply({ theme: "dark" });
  }

  protected onAllowUpTo30() {
    this.maxSize.set(30);
  }

  protected onReplyWithAnId() {
    this.finish?.({ id: 7 });
  }

  protected onReplyAsADraft() {
    this.finish?.({});
  }

  protected onReplyWithAnError() {
    this.finish?.({ error: "Disk full" });
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
