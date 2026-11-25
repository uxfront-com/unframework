import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  type OnInit,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  untracked,
  viewChild,
} from "@angular/core";

export interface CounterProps {
  initial?: number;
  step?: number;
}

@Component({
  selector: "uf-counter",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let step = this.step();
    @let count = this.count();
    @let doubled = this.doubled();
    <div
      class="counter"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <output>{{ count }}</output>
      @if (doubled > 10) {
        <span>Big</span>
      }
      <button type="button" (click)="increment()">+{{ step }}</button>
    </div>
  `,
})
export default class Counter implements OnInit {
  readonly initial = input<number, number | undefined>(0, {
    transform: (value) => (value === undefined ? 0 : value),
  });
  readonly step = input<number, number | undefined>(1, {
    transform: (value) => (value === undefined ? 1 : value),
  });
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufChange = output<number>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly count = linkedSignal(() => untracked(() => this.initial()));
  protected readonly doubled = computed(() => this.count() * 2);

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.count();
  }

  protected increment() {
    this.count.update((count) => count + this.step());
    this.ufChange.emit(this.count());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
