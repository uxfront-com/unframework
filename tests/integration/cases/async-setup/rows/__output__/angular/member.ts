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
  signal,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-member",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @if (resolved()) {
      <li
        class="member"
        [class]="this.class()"
        [style]="this.style()"
        [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
        [ufScope]="this.host"
        #ufElement
      >{{ user.name }}</li>
    }
  `,
})
export default class Member implements OnInit {
  readonly id = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLLIElement>>("ufElement");
  private readonly pendingTasks = inject(PendingTasks);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly resolved = signal(false);
  protected user!: Awaited<ReturnType<typeof this.initialUser>>;

  ngOnInit(): void {
    this.pendingTasks.run(async () => {
      this.user = await this.initialUser();

      // Destroyed while it waited: the rest of the setup never runs.
      if (this.destroyRef.destroyed) return;

      this.resolved.set(true);
    });
  }

  private initialUser() {
    return loadUser(this.id());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
