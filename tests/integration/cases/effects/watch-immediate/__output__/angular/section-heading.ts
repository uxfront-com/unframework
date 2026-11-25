import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  ElementRef,
  Injector,
  type OnInit,
  PLATFORM_ID,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from "@angular/core";

export interface SectionHeadingProps {
  title: string;
}

@Component({
  selector: "uf-section-heading",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    <h2
      class="section-heading"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >{{ title }}</h2>
  `,
})
export default class SectionHeading implements OnInit {
  readonly title = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufChange = output<[title: string, previous?: string]>();
  readonly ready = output<void>();
  readonly ufElement = viewChild<ElementRef<HTMLHeadingElement>>("ufElement");
  private readonly injector = inject(Injector);
  private readonly platformId = inject(PLATFORM_ID);

  constructor() {
    afterNextRender(() => {
      this.ready.emit();
    });
  }

  ngOnInit(): void {
    let lastTitle = this.title();
    let first = true;
    effect(
      () => {
        const value = this.title();
        const previous = first ? undefined : lastTitle;
        first = false;
        lastTitle = value;
        if (!isPlatformBrowser(this.platformId)) return;
        untracked(() => {
          this.ufChange.emit([value, previous]);
        });
      },
      { injector: this.injector },
    );
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
