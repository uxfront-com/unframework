import {
  ApplicationRef,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-shipping-details",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let open = this.open();
    <section
      class="shipping-details"
      aria-label="Shipping"
      [class]="this.class()"
      [style]="this.style()"
    >
      <button type="button" [attr.aria-expanded]="open" (click)="toggle()">Shipping details</button>
      @if (open) {
        <ul #details>
          <li>Ships in two days</li>
          <li>Free returns</li>
          <li>Tracked delivery</li>
        </ul>
      }
    </section>
  `,
})
export default class ShippingDetails {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly toggled = output<number>();
  private readonly details = viewChild<ElementRef<HTMLUListElement>>("details");
  private readonly appRef = inject(ApplicationRef);
  protected readonly open = signal(false);

  protected async toggle() {
    this.open.set(!this.open());
    await this.nextTick();
    this.toggled.emit(this.details()?.nativeElement.childElementCount ?? 0);
  }

  private async nextTick(): Promise<void> {
    await Promise.resolve();
    this.appRef.tick();
  }
}
