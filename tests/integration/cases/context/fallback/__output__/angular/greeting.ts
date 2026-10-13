import { LocaleKey } from "./locale-provider";
import {
  Component,
  Injector,
  type OnInit,
  computed,
  inject,
  input,
  untracked,
} from "@angular/core";

@Component({
  selector: "uf-greeting",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let locale = this.locale();
    <p
      [class]="this.class()"
      [style]="this.style()"
    >{{ locale === "pt" ? "Olá" : "Hello" }}, {{ name }} ({{ locale }})</p>
  `,
})
export default class Greeting implements OnInit {
  readonly name = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  private readonly injector = inject(Injector);
  protected readonly locale = computed(() =>
    untracked(() => this.injector.get(LocaleKey, null, { optional: true, skipSelf: true }) ?? "en"),
  );

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.locale();
  }
}
