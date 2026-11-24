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
  input as input_1,
  output,
  signal,
  viewChild,
} from "@angular/core";

export interface CommandMenuProps {
  commands: string[];
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
  selector: "uf-command-menu",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let commands = this.commands();
    @let active = this.active();
    <section
      class="command-menu"
      aria-label="Command menu"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <form role="search" aria-label="Commands">
        <label>Command<input
          name="command"
          (input)="onCommandInput($event)"
          (keydown)="handleKey($event)"
        /></label>
      </form>
      <ul aria-label="Suggestions">
        @for (command of commands; track command; let index = $index) {
          <li [attr.aria-current]="index === active ? 'true' : undefined">{{ command }}</li>
        }
      </ul>
      <label>Shortcut name<input
        name="shortcut"
        #shortcutField
        (keydown)="onShortcutKeydown($event)"
      /></label>
    </section>
  `,
})
export default class CommandMenu {
  readonly commands = input_1.required<string[]>();
  readonly class = input_1<string>();
  readonly style = input_1<Record<string, string | null | undefined>>();
  readonly ufAttributes = input_1<Record<string, unknown>>();
  readonly ufListeners = input_1<Listeners>();
  readonly run = output<string>();
  readonly dismiss = output<void>();
  private readonly shortcutField = viewChild<ElementRef<HTMLInputElement>>("shortcutField");
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly active = signal(0);
  private readonly query = signal("");

  protected handleKey(event: KeyboardEvent) {
    if (event.key === "Enter") event.preventDefault();
    if (event.key === "ArrowDown") {
      this.active.set((this.active() + 1) % this.commands().length);
    } else if (event.key === "ArrowUp") {
      this.active.set((this.active() + this.commands().length - 1) % this.commands().length);
    } else if (event.key === "Enter") {
      this.run.emit(this.commands()[this.active()] ?? this.query());
    } else if (event.key === "Escape") {
      this.active.set(0);
      this.dismiss.emit();
    }
  }

  private clearShortcut() {
    const input = this.shortcutField()?.nativeElement ?? null;
    if (input) input.value = "";
  }

  protected onCommandInput(event: InputEvent) {
    this.query.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onShortcutKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") this.clearShortcut();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
