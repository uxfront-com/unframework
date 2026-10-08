import {
  Component,
  Injector,
  type OnInit,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from "@angular/core";

export interface BallotProps {
  limit: number;
  label?: string;
  choices: string[];
}

@Component({
  selector: "uf-ballot",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let choices = this.choices();
    @let votes = this.votes();
    @let picked = this.picked();
    <section class="ballot" [attr.aria-label]="label">
      <p role="status">{{ votes }} votes left</p>
      <p>Picked: {{ picked }}</p>
      <ul aria-label="Choices">
        @for (choice of choices; track choice) {
          <li>
            <button type="button" (click)="vote(choice)">{{ choice }}</button>
          </li>
        }
      </ul>
      <button type="button" (click)="count()">Count the answers</button>
    </section>
  `,
})
export default class Ballot implements OnInit {
  readonly limit = input.required<number>();
  readonly label = input<string, string | undefined>("Vote", {
    transform: (value) => (value === undefined ? "Vote" : value),
  });
  readonly choices = input.required<string[]>();
  readonly voted = output<[remaining: number, text: string]>();
  readonly moved = output<string>();
  readonly report = output<string>();
  readonly counted = output<number>();
  private readonly injector = inject(Injector);
  protected readonly votes = linkedSignal(() => untracked(() => this.limit()));
  protected readonly picked = signal("none");
  private remaining!: number;
  private text!: string;
  private lastVotes!: number;

  constructor() {
    afterRenderEffect(() => {
      this.report.emit(this.describe());
    });
  }

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.votes();
    this.remaining = this.limit();
    this.text = `${this.label()} (${this.limit()})`;
    this.lastVotes = this.votes();

    const currentValues = computed(
      () => [this.votes(), this.picked()] satisfies [unknown, unknown],
      { equal: (next, last) => next.every((value, index) => Object.is(value, last[index])) },
    );
    let lastValues = currentValues();
    effect(
      () => {
        const current = currentValues();
        if (Object.is(current, lastValues)) return;
        const [nextVotes, nextPicked]: [number, string] = current;
        const [lastCount, lastPick] = lastValues;
        lastValues = current;
        untracked(() => {
          this.moved.emit(`${lastPick}:${lastCount}>${nextPicked}:${nextVotes}`);
        });
      },
      { injector: this.injector },
    );
  }

  private isAnswer(value: string): value is "yes" | "no" {
    return value === "yes" || value === "no";
  }

  private describe(): string {
    const line = `${this.picked()} with ${this.votes()} left`;
    return line;
  }

  protected vote(choice: string) {
    if (this.remaining > 0) this.remaining -= 1;
    this.text = `${this.text}!`;
    this.lastVotes = this.votes();
    this.votes.update((votes) => votes - 1);
    this.picked.set(this.isAnswer(choice) ? choice : "other");
    this.voted.emit([this.remaining, `${this.text} ${this.lastVotes}`]);
  }

  protected count() {
    let answers = 0;
    this.choices().forEach((choice) => this.isAnswer(choice) && answers++);
    this.counted.emit(answers);
  }
}
