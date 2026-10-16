import { ThemeKey } from "./theme-provider";
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
  selector: "uf-badge",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    @let theme = this.theme();
    <span
      class="badge"
      [class]="[theme?.accent, this.class()].join(' ')"
      [style]="this.style()"
    >{{ text }} in {{ theme?.label ?? "no theme" }}</span>
  `,
})
export default class Badge implements OnInit {
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  private readonly injector = inject(Injector);
  protected readonly theme = computed(() =>
    untracked(
      () => this.injector.get(ThemeKey, null, { optional: true, skipSelf: true }) ?? undefined,
    ),
  );

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.theme();
  }
}
