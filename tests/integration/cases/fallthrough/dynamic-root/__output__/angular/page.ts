import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Base from "./base";
import Primary from "./primary";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  PLATFORM_ID,
  Renderer2,
  ViewEncapsulation,
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

@Component({
  selector: "uf-page",
  imports: [Primary, Base, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let linked = this.linked();
    @let tone = this.tone();
    @let pressed = this.pressed();
    @let items = this.items();
    <section
      class="page"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      data-uf-64cf7c28=""
      [ufScope]="this.host"
      #ufElement
    >
      <uf-primary
        [href]="linked ? '#docs' : undefined"
        [disabled]="true"
        [text]="'Docs'"
        [class]="'wide'"
        [style]="{ color: tone }"
        (press)="onPress()"
        data-uf-64cf7c28=""
      />
      <uf-base
        [disabled]="true"
        [text]="'Off'"
        [class]="['off', !linked ? 'muted' : null].join(' ')"
        (press)="onPress_1()"
        data-uf-64cf7c28=""
      />
      <uf-base [text]="'Save'" [class]="'save'" (press)="onPress_2()" data-uf-64cf7c28="" />
      <ul aria-label="Items" data-uf-64cf7c28="">
        @for (item of items; track item.id) {
          <li data-uf-64cf7c28="">
            @switch (item.href ? "a" : "button") {
              @case ("a") {
                <a [attr.href]="item.href" class="item" data-uf-64cf7c28="">{{ item.label }}</a>
              } @case ("button") {
                <button
                  [attr.disabled]="item.disabled ? '' : null"
                  class="item"
                  data-uf-64cf7c28=""
                >{{ item.label }}</button>
              }
            }
          </li>
        }
      </ul>
      <button type="button" (click)="onToggle()" data-uf-64cf7c28="">Toggle</button>
      <output data-uf-64cf7c28="">{{ pressed }}</output>
    </section>
  `,
  styleUrl: "./Page.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Page {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly linked = signal(true);
  protected readonly tone = signal("rgb(29, 78, 216)");
  protected readonly pressed = signal("none");
  protected readonly items = signal([
    { id: 1, href: "#one", disabled: true, label: "One" },
    { id: 2, href: "", disabled: true, label: "Two" },
  ]);

  protected onPress() {
    this.pressed.set("docs");
  }

  protected onPress_1() {
    this.pressed.set("off");
  }

  protected onPress_2() {
    this.pressed.set("save");
  }

  protected onToggle() {
    this.linked.set(!this.linked());
    this.tone.set(this.linked() ? "rgb(29, 78, 216)" : "rgb(21, 128, 61)");
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
