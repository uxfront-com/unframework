import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  type OnDestroy,
  PLATFORM_ID,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

export interface AutoRefreshProps {
  /** Milliseconds between two refreshes. */
  interval: number;
}

@Component({
  selector: "uf-auto-refresh",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let enabled = this.enabled();
    <section class="auto-refresh" aria-label="Auto-refresh">
      <button type="button" [attr.aria-pressed]="enabled" (click)="toggle()">Auto-refresh</button>
      <p role="status">{{ enabled ? "Refreshing" : "Paused" }}</p>
    </section>
  `,
})
export default class AutoRefresh implements OnDestroy {
  readonly interval = input.required<number>();
  readonly refresh = output<number>();
  private readonly platformId = inject(PLATFORM_ID);
  private readonly tick = () => {
    this.refreshes += 1;
    this.refresh.emit(this.refreshes);
  };
  protected readonly enabled = signal(false);
  private timer: ReturnType<typeof setInterval> | undefined;
  private refreshes = 0;

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      clearInterval(this.timer);
    }
  }

  protected toggle() {
    if (this.enabled()) {
      clearInterval(this.timer);
      this.enabled.set(false);
    } else {
      this.timer = setInterval(this.tick, this.interval());
      this.enabled.set(true);
    }
  }
}
