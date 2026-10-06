export interface DraftNoticeProps {
  author: string;
  saved: boolean;
}

export default function DraftNotice({ author, saved }: DraftNoticeProps) {
  return (
    <section class="draft-notice" aria-label="Draft">
      <img
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23345'/%3E%3C/svg%3E"
        alt={`${author}'s avatar`}
        width="32"
        height="32"
      />
      <p title={saved ? "Saved" : "Don't forget to save"}>{saved ? "Saved" : 'Not "saved" yet'}</p>
      <p title={saved ? "Nothing to save" : `Press "Save" to keep ${author}'s changes`}>
        {saved ? `${author}'s draft is safe.` : `${author} says: "I'll save it later."`}
      </p>
    </section>
  );
}
