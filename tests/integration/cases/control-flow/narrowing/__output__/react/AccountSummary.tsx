interface Team {
  name: string;
}

interface Member {
  name: string;
  email: string;
  admin: boolean;
  team?: Team;
}

interface Seat {
  holder: string;
}

type Plan = { kind: "paid"; renews: string } | { kind: "trial"; daysLeft: number };

export interface AccountSummaryProps {
  loading: boolean;
  member?: Member;
  uptime?: number;
  storage: number | string;
  plan: Plan;
  seats: (Seat | null)[];
}

export default function AccountSummary({
  loading,
  member,
  uptime,
  storage,
  plan,
  seats,
}: AccountSummaryProps) {
  return (
    <section className="account-summary" aria-label="Account">
      {loading ? <p>Loading the account</p> : !member ? <p>Signed out</p> : <h2>{member.name}</h2>}
      {member ? <p>Signed in as {member.email}</p> : null}
      {member ? <p>Role: {member.admin ? "administrator" : "member"}</p> : <p>Role: guest</p>}
      {!member ? <p>No profile</p> : <p>Profile of {member.name}</p>}
      {member && member.team ? <p>Team: {member.team.name}</p> : null}
      {uptime !== undefined ? <p>Uptime {uptime.toFixed(1)}%</p> : null}
      {typeof storage === "number" ? (
        <p>Storage {storage.toFixed(1)} GB</p>
      ) : (
        <p>Storage {storage}</p>
      )}
      {plan.kind === "paid" ? (
        <p>Renews on {plan.renews}</p>
      ) : (
        <p>Trial ends in {plan.daysLeft} days</p>
      )}
      <ul aria-label="Seats">
        {seats.map((seat, index) => (
          <li key={index}>{seat ? <b>{seat.holder}</b> : "Vacant"}</li>
        ))}
      </ul>
    </section>
  );
}
