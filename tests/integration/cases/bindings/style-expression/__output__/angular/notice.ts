import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { styleObject } from "./_unframework/styleObject";
import Badge from "./badge";
import Tag from "./tag";
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
  signal,
  viewChild,
} from "@angular/core";

type NoticeLook = {
  color?: string;
  backgroundColor?: string;
  borderLeft?: string;
  "--notice-accent"?: string;
};

type NoticeVars = { "--notice-gap"?: string };

export interface NoticeProps {
  title: string;
  look?: NoticeLook;
  declarations?: string;
  vars?: NoticeVars;
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
  selector: "uf-notice",
  imports: [Badge, Tag, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let look = this.look();
    @let declarations = this.declarations();
    @let vars = this.vars();
    @let quiet = this.quiet();
    <div
      class="notice"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p [style]="look">{{ title }}</p>
      <uf-badge
        [label]="'Permanent'"
        [tone]="'padding: 2px 6px; color: rgb(120, 30, 30); outline: 1px solid'"
        [style]="styleObject(look)"
      />
      <p [style]="declarations">Read the details before you continue.</p>
      @switch (quiet ? "Tag" : "Badge") {
        @case ("Tag") {
          <uf-tag
            [label]="'Optional'"
            [tone]="'font-weight: 700'"
            [style]="styleObject(declarations)"
          />
        } @case ("Badge") {
          <uf-badge
            [label]="'Optional'"
            [tone]="'font-weight: 700'"
            [style]="styleObject(declarations)"
          />
        }
      }
      <p
        [style]="quiet
          ? { color: 'rgb(90, 90, 90)' }
          : { color: 'var(--notice-accent, rgb(160, 40, 40))', fontWeight: '700' }"
      >This cannot be undone.</p>
      <button
        type="button"
        [style]="vars"
        (click)="toggle()"
      >{{ quiet ? "Emphasise" : "Quieten" }}</button>
    </div>
  `,
})
export default class Notice {
  readonly title = input.required<string>();
  readonly look = input<NoticeLook>();
  readonly declarations = input<string>();
  readonly vars = input<NoticeVars>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly quiet = signal(false);
  protected readonly styleObject = styleObject;

  protected toggle() {
    this.quiet.set(!this.quiet());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
