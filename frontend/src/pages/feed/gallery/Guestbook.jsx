const friends = ["Mimi", "Minx", "Cleo", "Jasper"];

export default function Guestbook({ notes }) {
  const latest = notes.slice(-4).reverse();
  return (
    <>
      <section className="guest" aria-label="Guestbook">
        <h2>Guestbook</h2>
        {latest.length === 0 ? <p className="guest__empty">No notes yet.</p> : null}
        <ul>
          {latest.map((note) => (
            <li key={note.id}>
              <span className="guest__avatar" aria-hidden="true">
                {note.name.slice(0, 1)}
              </span>
              <span className="guest__body">
                <strong>{note.name}</strong>
                <em>{note.text}</em>
                <time>{note.time}</time>
              </span>
              <img src={note.src} alt="" width="40" height="40" />
            </li>
          ))}
        </ul>
      </section>
      <section className="friends" aria-label="Friends">
        <h2>Friends</h2>
        <ul>
          {friends.map((name) => (
            <li key={name}>
              <span title={name}>{name.slice(0, 1)}</span>
              <span className="sr">{name}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
