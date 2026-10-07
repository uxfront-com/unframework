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
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    <h2 class="section-heading">{{ title }}</h2>
  `,
})
export default class SectionHeading implements OnInit {
  readonly title = input.required<string>();
  readonly change = output<[title: string, previous?: string]>();
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
          this.change.emit([value, previous]);
        });
      },
      { injector: this.injector },
    );
  }
}
