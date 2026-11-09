import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAlbums, subscribeAlbums } from "../../../api/albums";

export default function ExhibitionStack() {
  const [albums, setAlbums] = useState(listAlbums);

  useEffect(() => subscribeAlbums(() => setAlbums(listAlbums())), []);

  return (
    <section className="shows" aria-label="Albums">
      <h2>Albums</h2>
      {albums.length === 0 ? <p>No albums yet.</p> : null}
      <div className="shows__row">
        {albums.slice(0, 4).map((album) => (
          <Link key={album.id} to={`/albums/${album.id}`}>
            {album.name}
            <span>
              {album.photos.length} {album.photos.length === 1 ? "photo" : "photos"}
            </span>
          </Link>
        ))}
        <Link to="/albums">Open albums</Link>
      </div>
    </section>
  );
}
