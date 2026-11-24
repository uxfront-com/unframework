import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { LocaleKey } from "./locale-provider";
import {
  Component,
  ElementRef,
  Injector,
  type OnInit,
  computed,
  inject,
  input,
  untracked,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-greeting",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let locale = this.locale();
    <p
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >{{ locale === "pt" ? "Olá" : "Hello" }}, {{ name }} ({{ locale }})</p>
  `,
})
export default class Greeting implements OnInit {
  readonly name = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLParagraphElement>>("ufElement");
  private readonly injector = inject(Injector);
  protected readonly locale = computed(() =>
    untracked(() => this.injector.get(LocaleKey, null, { optional: true, skipSelf: true }) ?? "en"),
  );

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.locale();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
