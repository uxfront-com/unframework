import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { useControllableState } from "./use-controllable-state";
import {
  Component,
  ElementRef,
  Injector,
  type OnInit,
  inject,
  input,
  output,
  runInInjectionContext,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-rating",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let current = this.controllableState.current();
    <section
      class="rating"
      aria-label="Rating"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p role="status">Rated {{ current }} of 3</p>
      <button type="button" (click)="void controllableState.set(2)">Two</button>
      <button type="button" (click)="void controllableState.set(3)">Three</button>
    </section>
  `,
})
export default class Rating implements OnInit {
  readonly value = input<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufChange = output<number>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  protected controllableState!: ReturnType<typeof this.createControllableState>;

  ngOnInit(): void {
    this.controllableState = runInInjectionContext(this.injector, () =>
      this.createControllableState(),
    );
  }

  private createControllableState() {
    return useControllableState(
      () => this.value(),
      1,
      (next) => this.ufChange.emit(next),
    );
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
