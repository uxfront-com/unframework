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
  viewChild,
} from "@angular/core";

interface LabelAttributes {
  id: string;
  title?: string;
}

interface Parcel {
  label: string;
  tag?: LabelAttributes;
  seal?: LabelAttributes;
}

export interface ShipmentCardProps {
  reference: string;
  carrier: LabelAttributes | null;
  eta?: LabelAttributes | null;
  parcel: Parcel;
  tracked: boolean;
  tracking: LabelAttributes;
  stops: (LabelAttributes | undefined)[];
  signature?: LabelAttributes;
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
  selector: "uf-shipment-card",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let reference = this.reference();
    @let carrier = this.carrier();
    @let eta = this.eta();
    @let parcel = this.parcel();
    @let tracked = this.tracked();
    @let tracking = this.tracking();
    @let stops = this.stops();
    @let signature = this.signature();
    <section
      class="shipment-card"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : reference"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p [attr.id]="carrier?.id" [attr.title]="carrier?.title">Carrier</p>
      <p [attr.id]="eta?.id" [attr.title]="eta?.title">Estimated delivery</p>
      <p [attr.id]="parcel.tag?.id" [attr.title]="parcel.tag?.title">{{ parcel.label }}</p>
      <p
        [attr.id]="(tracked ? tracking : undefined)?.id"
        [attr.title]="(tracked ? tracking : undefined)?.title"
      >Live tracking</p>
      <ol>
        @for (stop of stops; track index; let index = $index) {
          <li [attr.id]="stop?.id" [attr.title]="stop?.title">Stop {{ index + 1 }}</li>
        }
      </ol>
      @if (signature) {
        <p [attr.id]="signature.id" [attr.title]="signature.title">Signed on delivery</p>
      }
      @if (!parcel.seal) {
        <p>Not sealed</p>
      } @else {
        <p [attr.id]="parcel.seal.id" [attr.title]="parcel.seal.title">Sealed</p>
      }
    </section>
  `,
})
export default class ShipmentCard {
  readonly reference = input.required<string>();
  readonly carrier = input.required<LabelAttributes | null>();
  readonly eta = input<LabelAttributes | null, LabelAttributes | null | undefined>(null, {
    transform: (value) => (value === undefined ? null : value),
  });
  readonly parcel = input.required<Parcel>();
  readonly tracked = input.required<boolean>();
  readonly tracking = input.required<LabelAttributes>();
  readonly stops = input.required<(LabelAttributes | undefined)[]>();
  readonly signature = input<LabelAttributes>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
