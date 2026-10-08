import {
  ApplicationRef,
  Component,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-shipping-details",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let open = this.open();
    <section class="shipping-details" aria-label="Shipping">
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
