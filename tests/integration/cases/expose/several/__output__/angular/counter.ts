import { Component, type OnInit, input, linkedSignal, untracked } from "@angular/core";

@Component({
  selector: "uf-counter",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let count = this.count();
    <output class="count" [class]="this.class()" [style]="this.style()">{{ count }}</output>
  `,
})
export default class Counter implements OnInit {
  readonly start = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly count = linkedSignal(() => untracked(() => this.start()));

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.count();
  }

  increment() {
    this.count.update((count) => count + 1);
  }

  reset() {
    this.count.set(this.start());
  }
}
