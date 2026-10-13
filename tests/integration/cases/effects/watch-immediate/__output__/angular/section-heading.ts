import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Injector,
  type OnInit,
  PLATFORM_ID,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  untracked,
} from "@angular/core";

export interface SectionHeadingProps {
  title: string;
}

@Component({
  selector: "uf-section-heading",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    <h2 class="section-heading" [class]="this.class()" [style]="this.style()">{{ title }}</h2>
  `,
})
export default class SectionHeading implements OnInit {
  readonly title = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufChange = output<[title: string, previous?: string]>();
  readonly ready = output<void>();
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
}
