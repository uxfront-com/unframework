import {
  Component,
  InjectionToken,
  Injector,
  type OnInit,
  computed,
  inject,
  input,
  untracked,
} from "@angular/core";

export const DepthKey = new InjectionToken<number>("uf.depth");

@Component({
  selector: "uf-level",
  providers: [{ provide: DepthKey, useFactory: () => inject(Level).depth() + 1 }],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let depth = this.depth();
    <section [attr.aria-label]="title" [class]="this.class()" [style]="this.style()">
      <h2>{{ title }} at depth {{ depth }}</h2>
      <ng-content />
    </section>
  `,
})
export default class Level implements OnInit {
  readonly title = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  private readonly injector = inject(Injector);
  readonly depth = computed(() =>
    untracked(() => this.injector.get(DepthKey, null, { optional: true, skipSelf: true }) ?? 0),
  );

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.depth();
  }
}
