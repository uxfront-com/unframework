import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { useTotal } from "./use-total";
import {
  Component,
  ElementRef,
  Injector,
  type OnInit,
  inject,
  input,
  runInInjectionContext,
  signal,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-basket",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let total = this.total_1.total();
    @let label = this.total_1.label();
    <section
      class="basket"
      aria-label="Basket"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p role="status">Total: {{ total }}</p>
      <p>{{ label }}</p>
      <button type="button" (click)="onAddOne()">Add one</button>
    </section>
  `,
})
export default class Basket implements OnInit {
  readonly price = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  private readonly quantity = signal(1);
  protected total_1!: ReturnType<typeof this.createTotal1>;

  ngOnInit(): void {
    this.total_1 = runInInjectionContext(this.injector, () => this.createTotal1());
  }

  private createTotal1() {
    return useTotal(
      () => this.price(),
      () => this.quantity(),
    );
  }

  protected onAddOne() {
    this.quantity.update((quantity) => quantity + 1);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
