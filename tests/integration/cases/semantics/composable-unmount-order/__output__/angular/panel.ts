import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { useTeardown } from "./use-teardown";
import {
  Component,
  ElementRef,
  Injector,
  type OnDestroy,
  type OnInit,
  inject,
  input,
  output,
  runInInjectionContext,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-panel",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.teardown.title();
    <section
      class="panel"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : title"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h2>{{ title }}</h2>
    </section>
  `,
})
export default class Panel implements OnInit, OnDestroy {
  readonly name = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly closed = output<string>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  private readonly teardownInjector = Injector.create({ providers: [], parent: this.injector });
  protected teardown!: ReturnType<typeof this.createTeardown>;

  ngOnInit(): void {
    this.teardown = runInInjectionContext(this.teardownInjector, () => this.createTeardown());
  }

  ngOnDestroy(): void {
    this.teardownInjector.destroy();
  }

  private createTeardown() {
    return useTeardown(
      () => this.name(),
      (entry) => this.closed.emit(entry),
    );
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
