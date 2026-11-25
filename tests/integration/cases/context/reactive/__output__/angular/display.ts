import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { CountKey } from "./counter";
import {
  Component,
  ElementRef,
  Injector,
  type OnInit,
  computed,
  inject,
  input,
  signal,
  untracked,
  viewChild,
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
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let count = this.count();
    <output
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >Count: {{ count.value }}</output>
  `,
})
export default class Display implements OnInit {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLOutputElement>>("ufElement");
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
