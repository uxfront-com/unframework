import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { loadUser } from "./api";
import {
  Component,
  DestroyRef,
  ElementRef,
  type OnInit,
  PendingTasks,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-profile",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @if (resolved()) {
      @let visits = this.visits();
      <p
        class="profile"
        [class]="this.class()"
        [style]="this.style()"
        [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
        [ufScope]="this.host"
        #ufElement
      >{{ user.name }}&ngsp;<button type="button" (click)="onClick()">Visits: {{ visits }}</button></p>
    }
  `,
})
export default class Profile implements OnInit {
  readonly id = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLParagraphElement>>("ufElement");
  private readonly pendingTasks = inject(PendingTasks);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly resolved = signal(false);
  protected user!: Awaited<ReturnType<typeof this.initialUser>>;
  protected readonly visits = linkedSignal(() => untracked(() => this.user.visits));

  ngOnInit(): void {
    this.pendingTasks.run(async () => {
      this.user = await this.initialUser();

      // Destroyed while it waited: the rest of the setup never runs.
      if (this.destroyRef.destroyed) return;

      // Read once the inputs are set: these keep the values they start with.
      this.visits();

      this.resolved.set(true);
    });
  }

  private initialUser() {
    return loadUser(this.id());
  }

  protected onClick() {
    this.visits.update((visits) => visits + 1);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
