import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  type EffectRef,
  ElementRef,
  Injector,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
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
  selector: "uf-channel-picker",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let channel = this.channel();
    <section
      class="channel-picker"
      aria-label="Channels"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p role="status">Channel: #{{ channel }}</p>
      <button type="button" (click)="onJoinRandom()">Join #random</button>
      <button type="button" (click)="onJoinGeneral()">Join #General</button>
    </section>
  `,
})
export default class ChannelPicker implements OnInit, OnDestroy {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly join = output<string>();
  readonly leave = output<string>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly channel = signal("general");
  private nameWatcher?: EffectRef;

  ngOnInit(): void {
    const currentName = computed(() => this.channel().toLowerCase());
    this.nameWatcher = effect(
      (onCleanup) => {
        const name = currentName();
        if (!isPlatformBrowser(this.platformId)) return;
        untracked(() => {
          this.join.emit(name);
          onCleanup(() => {
            this.leave.emit(name);
          });
        });
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    // Before Angular stops the outputs: a cleanup may still emit, as on every target.
    this.nameWatcher?.destroy();
  }

  protected onJoinRandom() {
    this.channel.set("random");
  }

  protected onJoinGeneral() {
    this.channel.set("General");
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
