import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  ElementRef,
  Injector,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-draft-panel",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let open = this.open();
    @let currentStatus = this.currentStatus();
    @let log = this.log();
    <section
      class="draft-panel"
      aria-label="Draft"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <button type="button" [attr.aria-expanded]="open" (click)="show()">Options</button>
      @if (open) {
        <div class="options" role="group" aria-label="Draft options">
          <button type="button" (click)="close('button')">Close</button>
        </div>
      }
      <button type="button" (click)="onListen()">Listen</button>
      <button type="button" (click)="onStopListening()">Stop listening</button>
      <button type="button" #handle>Handle</button>
      <button type="button" (click)="onSave()">Save</button>
      <p role="status">{{ open ? "Options open" : "Options closed" }}, {{ currentStatus }}</p>
      <ol aria-label="Log">
        @for (line of log; track index; let index = $index) {
          <li>{{ line }}</li>
        }
      </ol>
    </section>
  `,
})
export default class DraftPanel implements OnInit, OnDestroy {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly save = output<number>();
  readonly status = output<string>();
  readonly closed = output<string>();
  readonly key = output<string>();
  private readonly handle = viewChild<ElementRef<HTMLButtonElement>>("handle");
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly onKey = (event: KeyboardEvent) => {
    this.record(`key ${event.key}`);
    this.key.emit(event.key);
  };
  private readonly onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.close("escape");
  };
  private readonly onHandleClick = () => {
    this.record("handle");
  };
  protected readonly open = signal(false);
  protected readonly currentStatus = signal("draft");
  private readonly saves = signal(0);
  protected readonly log = signal<string[]>([]);
  private handleElement: HTMLButtonElement | null = null;

  constructor() {
    afterNextRender(() => {
      this.handleElement = this.handle()?.nativeElement ?? null;
      this.handleElement?.addEventListener("click", this.onHandleClick);
    });
  }

  ngOnInit(): void {
    const currentStatus = computed(() => this.currentStatus());
    let lastStatus = currentStatus();
    effect(
      () => {
        const value = currentStatus();
        if (Object.is(value, lastStatus)) return;
        lastStatus = value;
        untracked(() => {
          this.status.emit(value);
        });
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.stop();
    }
  }

  private record(line: string) {
    this.log.set([...this.log(), line]);
  }

  protected close(reason: string) {
    this.open.set(false);
    document.removeEventListener("keydown", this.onEscape);
    this.closed.emit(reason);
  }

  protected show() {
    this.open.set(true);
    document.addEventListener("keydown", this.onEscape);
  }

  protected onSave() {
    this.saves.update((saves) => saves + 1);
    this.currentStatus.set("saved");
    this.save.emit(this.saves());
  }

  private stop() {
    document.removeEventListener("keydown", this.onEscape);
    document.removeEventListener("keydown", this.onKey);
    this.handleElement?.removeEventListener("click", this.onHandleClick);
  }

  protected onListen() {
    document.addEventListener("keydown", this.onKey);
  }

  protected onStopListening() {
    document.removeEventListener("keydown", this.onKey);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
