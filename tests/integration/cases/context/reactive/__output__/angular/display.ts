import { CountKey } from "./counter";
import {
  Component,
  Injector,
  type OnInit,
  computed,
  inject,
  input,
  signal,
  untracked,
} from "@angular/core";

/** A ref as a descendant injects it (ADR-0054): its value through a getter, read as it changes. */
function refObject<T>(ref: () => T): { readonly value: T } {
  return {
    get value() {
      return ref();
    },
  };
}

@Component({
  selector: "uf-display",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let count = this.count();
    <output [class]="this.class()" [style]="this.style()">Count: {{ count.value }}</output>
  `,
})
export default class Display implements OnInit {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  private readonly injector = inject(Injector);
  private readonly none = signal(0);
  protected readonly count = computed(() =>
    untracked(
      () =>
        this.injector.get(CountKey, null, { optional: true, skipSelf: true }) ??
        refObject(this.none),
    ),
  );

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.count();
  }
}
