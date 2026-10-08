import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  type OnDestroy,
  PLATFORM_ID,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

export interface Member {
  id: number;
  name: string;
}

export interface Inviter {
  name: string;
}

interface Draft {
  email?: string;
  tags: string[] | null;
}

export interface TeamInviteProps {
  inviter?: Inviter;
  members: Member[];
}

@Component({
  selector: "uf-team-invite",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let greeting = this.greeting();
    @let selected = this.selected();
    @let page = this.page();
    @let pageCount = this.pageCount();
    @let visible = this.visible();
    @let byPassword = this.byPassword();
    @let seconds = this.seconds();
    <section class="team-invite" aria-label="Invite">
      <h2>{{ greeting }}</h2>
      <ul aria-label="Members">
        @for (member of visible; track member.id) {
          <li>
            <button
              type="button"
              [attr.aria-pressed]="selected !== null && selected.id === member.id"
              (click)="pick(member)"
            >{{ member.name }}</button>
          </li>
        }
      </ul>
      <div class="pager" role="group" aria-label="Pages">
        @if (page > 1) {
          <button type="button" (click)="onPrevious()">Previous</button>
        }
        <span>Page {{ page }} of {{ pageCount }}</span>
        @if (page < pageCount) {
          <button type="button" (click)="onNext()">Next</button>
        }
      </div>
      <p role="status">{{ selected ? "Selected: " + selected.name : "Nobody selected" }}</p>
      <button type="button" (click)="invite()">Invite</button>
      <button type="button" (click)="remove()">Remove</button>
      <form aria-label="Email invite" (submit)="submit($event)">
        <label>Email<input type="email" name="email" (input)="onEmailInput($event)" /></label>
        <button type="submit">Send</button>
      </form>
      <button type="button" (click)="tag()">Tag as team</button>
      <button
        type="button"
        (click)="onClick()"
      >{{ byPassword ? "Use a link" : "Use a password" }}</button>
      <div class="field">
        @if (byPassword) {
          <input type="password" aria-label="Password" />
        } @else {
          <input type="text" aria-label="Sign-in email" />
          <small>We send you a link.</small>
        }
      </div>
      <button type="button" (click)="start()">Start the clock</button>
      <button type="button" (click)="stop()">Stop the clock</button>
      <p>Seconds: {{ seconds }}</p>
    </section>
  `,
})
export default class TeamInvite implements OnDestroy {
  readonly inviter = input<Inviter>();
  readonly members = input.required<Member[]>();
  readonly select = output<Member>();
  readonly removed = output<string>();
  readonly submitted = output<string>();
  readonly tagged = output<number>();
  readonly moved = output<number>();
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly greeting = computed(() =>
    this.inviter() ? `Invite as ${this.inviter()!.name}` : "Invite as a guest",
  );
  protected readonly selected = signal<Member | null>(null);
  private readonly draft = signal<Draft>({ tags: null });
  protected readonly page = signal(1);
  protected readonly pageCount = computed(() => Math.ceil(this.members().length / 2));
  protected readonly visible = computed(() =>
    this.members().slice((this.page() - 1) * 2, this.page() * 2),
  );
  protected readonly byPassword = signal(true);
  protected readonly seconds = signal(0);
  private readonly timer = signal<ReturnType<typeof setInterval> | undefined>(undefined);

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      clearInterval(this.timer());
    }
  }

  protected pick(member: Member) {
    this.selected.set(member);
  }

  protected invite() {
    if (this.selected()) this.select.emit(this.selected()!);
  }

  protected remove() {
    if (!this.selected()) return;
    const member = this.selected()!;
    this.selected.set(null);
    this.removed.emit(member.name);
  }

  protected submit(event: SubmitEvent) {
    event.preventDefault();
    if (!this.draft().email) return;
    this.submitted.emit(this.draft().email!);
  }

  protected tag() {
    if (this.draft().tags) {
      this.draft.set({ ...this.draft(), tags: [...this.draft().tags!, "team"] });
    } else {
      this.draft.set({ ...this.draft(), tags: ["team"] });
    }
    if (this.draft().tags) this.tagged.emit(this.draft().tags!.length);
  }

  protected start() {
    clearInterval(this.timer());
    this.timer.set(
      setInterval(() => {
        this.seconds.update((seconds) => seconds + 1);
      }, 1000),
    );
  }

  protected stop() {
    clearInterval(this.timer());
    this.timer.set(undefined);
  }

  protected onPrevious() {
    this.page.update((page) => page - 1);
    this.moved.emit(this.page());
  }

  protected onNext() {
    this.page.update((page) => page + 1);
    this.moved.emit(this.page());
  }

  protected onEmailInput(event: InputEvent) {
    this.draft.set({ ...this.draft(), email: (event.currentTarget as HTMLInputElement).value });
  }

  protected onClick() {
    this.byPassword.set(!this.byPassword());
  }
}
