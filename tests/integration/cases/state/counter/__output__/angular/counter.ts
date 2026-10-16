import {
  Component,
  type OnInit,
  computed,
  input,
  linkedSignal,
  output,
  untracked,
} from "@angular/core";

export interface CounterProps {
  initial?: number;
  step?: number;
}

@Component({
  selector: "uf-counter",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let step = this.step();
    @let count = this.count();
    @let doubled = this.doubled();
    <div class="counter" [class]="this.class()" [style]="this.style()">
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
  readonly ufChange = output<number>();
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
}
