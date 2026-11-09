import { useEffect, useId, useMemo, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Album, Check, ImageIcon, Search, Upload } from "lucide-react";
import Picker from "../../components/Picker";
import { listMyAlbumsWithCounts, listMyPhotos } from "../../api/strips";
import { groupByMonth, shortDay } from "./stripMonth";

function Tile({ photo, slotNumber, disabled, uploading, replaceBlock, onToggle }) {
  const selected = slotNumber > 0;
  const blocked = Boolean(replaceBlock && selected);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `picker:${photo.id}`,
    data: { type: "picker", photoId: photo.id },
    disabled: disabled || uploading || blocked,
  });
  const day = shortDay(photo.taken);
  const label = selected
    ? `Photo from ${day}${photo.albumName ? `, in ${photo.albumName}` : ""}, in strip slot ${slotNumber}`
    : `Photo from ${day}${photo.albumName ? `, in ${photo.albumName}` : ""}`;

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={[
        "strip-pick__tile",
        selected ? "is-on" : "",
        (disabled || blocked) && !selected ? "is-dim" : "",
        blocked ? "is-blocked" : "",
        isDragging ? "is-dragging" : "",
      ].filter(Boolean).join(" ")}
      aria-pressed={selected}
      aria-label={label}
      title={blocked ? "In strip" : (photo.albumName || "Not in an album")}
      disabled={uploading || blocked}
      onClick={() => {
        if (blocked) return;
        onToggle(photo.id);
      }}
      {...(blocked ? {} : { ...listeners, ...attributes })}
    >
      <img src={photo.thumb || photo.src} alt="" draggable={false} />
      {selected ? (
        <span className="strip-pick__check" aria-hidden="true">
          <Check size={14} strokeWidth={2.5} />
          {replaceBlock ? "In strip" : slotNumber}
        </span>
      ) : null}
      {photo.albumName ? <span className="strip-pick__album">{photo.albumName}</span> : null}
    </button>
  );
}

function AllPhotosTab({
  version,
  slots,
  query,
  looseOnly,
  sort,
  page,
  uploadingIds,
  onQuery,
  onLoose,
  onSort,
  onMore,
  onToggle,
  full,
  replaceIndex = null,
}) {
  const result = useMemo(() => listMyPhotos({
    query,
    albumId: looseOnly ? "none" : undefined,
    sort,
    cursor: 0,
    limit: page * 60,
  }), [version, query, looseOnly, sort, page]);

  const groups = groupByMonth(result.photos);
  const slotOf = new Map();
  slots.forEach((id, index) => { if (id) slotOf.set(id, index + 1); });
  const replacing = replaceIndex != null;

  if (!result.total && !query && !looseOnly) {
    return <p className="strip-pick__empty">You don&apos;t have any photos yet. Upload some to start.</p>;
  }

  return (
    <>
      <div className="strip-pick__tools">
        <label className="strip-pick__search">
          <span className="maker__file">Search your photos</span>
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder="Search your photos"
            onChange={(event) => onQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          className={looseOnly ? "strip-pick__chip is-on" : "strip-pick__chip"}
          aria-pressed={looseOnly}
          onClick={() => onLoose(!looseOnly)}
        >
          Not in an album
        </button>
        <Picker
          label="Sort"
          value={sort}
          onChange={onSort}
          options={[
            { value: "newest", label: "Newest" },
            { value: "oldest", label: "Oldest" },
          ]}
        />
      </div>
      <p className="strip-pick__count">Showing {result.photos.length} of {result.total} photos</p>
      <div className="strip-pick__groups">
        {groups.map((group) => (
          <section key={group.key}>
            <h3 className="strip-pick__month">{group.label}</h3>
            <div className="strip-pick__grid">
              {group.photos.map((photo) => (
                <Tile
                  key={photo.id}
                  photo={photo}
                  slotNumber={slotOf.get(photo.id) || 0}
                  disabled={(full && !slotOf.has(photo.id)) || (replacing && slotOf.has(photo.id) && slotOf.get(photo.id) !== replaceIndex + 1)}
                  replaceBlock={replacing && slotOf.has(photo.id) && slotOf.get(photo.id) !== replaceIndex + 1}
                  uploading={uploadingIds.has(photo.id)}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      {result.nextCursor != null ? (
        <button type="button" className="maker__back" onClick={onMore}>Show more</button>
      ) : null}
      {!result.photos.length ? <p className="strip-pick__empty">No photos match that search.</p> : null}
    </>
  );
}

function AlbumsTab({ version, slots, albumId, query, page, uploadingIds, onAlbum, onQuery, onMore, onToggle, full, replaceIndex = null }) {
  const albums = useMemo(() => listMyAlbumsWithCounts(), [version]);
  const result = useMemo(() => {
    if (!albumId) return null;
    return listMyPhotos({
      query,
      albumId,
      sort: "newest",
      cursor: 0,
      limit: page * 60,
    });
  }, [version, albumId, query, page]);
  const slotOf = new Map();
  slots.forEach((id, index) => { if (id) slotOf.set(id, index + 1); });
  const replacing = replaceIndex != null;

  if (!albumId) {
    return (
      <div className="strip-pick__albums">
        {albums.map((album) => (
          <button key={album.id} type="button" className="strip-pick__album-card" onClick={() => onAlbum(album.id)}>
            {album.cover ? <img src={album.cover} alt="" /> : <span className="strip-pick__album-blank" />}
            <span>
              <strong>{album.name}</strong>
              <em>{album.count === 1 ? "1 photo" : `${album.count} photos`}</em>
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="strip-pick__crumb">
        <button type="button" className="maker__change" onClick={() => onAlbum("")}>&lt; All albums</button>
      </div>
      <label className="strip-pick__search">
        <span className="maker__file">Search album photos</span>
        <Search size={16} strokeWidth={1.75} aria-hidden="true" />
        <input type="search" value={query} placeholder="Search your photos" onChange={(event) => onQuery(event.target.value)} />
      </label>
      <p className="strip-pick__count">Showing {result.photos.length} of {result.total} photos</p>
      <div className="strip-pick__grid">
        {result.photos.map((photo) => (
          <Tile
            key={photo.id}
            photo={photo}
            slotNumber={slotOf.get(photo.id) || 0}
            disabled={(full && !slotOf.has(photo.id)) || (replacing && slotOf.has(photo.id) && slotOf.get(photo.id) !== replaceIndex + 1)}
            replaceBlock={replacing && slotOf.has(photo.id) && slotOf.get(photo.id) !== replaceIndex + 1}
            uploading={uploadingIds.has(photo.id)}
            onToggle={onToggle}
          />
        ))}
      </div>
      {result.nextCursor != null ? (
        <button type="button" className="maker__back" onClick={onMore}>Show more</button>
      ) : null}
    </>
  );
}

function UploadTab({ onFiles, busy }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={over ? "strip-pick__drop is-over" : "strip-pick__drop"}
      onDragEnter={(event) => { event.preventDefault(); setOver(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onFiles(event.dataTransfer.files);
      }}
    >
      <Upload size={28} strokeWidth={1.75} aria-hidden="true" />
      <p>Drop photos here or choose photos</p>
      <p className="strip-pick__help">JPG, PNG or WebP, up to 10 MB each.</p>
      <label className="strips__primary strip-pick__choose">
        Choose photos
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          disabled={busy}
          onChange={(event) => {
            onFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      <p className="strip-pick__privacy">Uploaded photos are saved to your gallery and are only visible to you.</p>
    </div>
  );
}

export default function StripPickerPane({
  version,
  slots,
  tab,
  onTab,
  onToggle,
  onUpload,
  full,
  uploadingIds = new Set(),
  busy = false,
  replaceIndex = null,
}) {
  const tabsId = useId();
  const [query, setQuery] = useState("");
  const [looseOnly, setLoose] = useState(false);
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [albumId, setAlbumId] = useState("");
  const [albumQuery, setAlbumQuery] = useState("");
  const [albumPage, setAlbumPage] = useState(1);
  const zone = useDroppable({ id: "picker-zone", data: { type: "picker-zone" } });

  useEffect(() => { setPage(1); }, [query, looseOnly, sort, tab]);
  useEffect(() => { setAlbumPage(1); }, [albumId, albumQuery]);

  const tabs = [
    { id: "all", label: "All photos", icon: ImageIcon },
    { id: "albums", label: "Albums", icon: Album },
    { id: "upload", label: "Upload", icon: Upload },
  ];

  return (
    <div ref={zone.setNodeRef} className="strip-pick">
      <div className="strip-pick__tabs" role="tablist" aria-label="Photo sources">
        {tabs.map((item) => {
          const Icon = item.icon;
          const on = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${tabsId}-${item.id}`}
              aria-selected={on}
              aria-controls={`${tabsId}-panel`}
              className={on ? "is-on" : undefined}
              onClick={() => onTab(item.id)}
            >
              <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        id={`${tabsId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-${tab}`}
        className="strip-pick__panel"
      >
        {tab === "all" ? (
          <AllPhotosTab
            version={version}
            slots={slots}
            query={query}
            looseOnly={looseOnly}
            sort={sort}
            page={page}
            uploadingIds={uploadingIds}
            onQuery={setQuery}
            onLoose={setLoose}
            onSort={setSort}
            onMore={() => setPage((value) => value + 1)}
            onToggle={onToggle}
            full={full}
            replaceIndex={replaceIndex}
          />
        ) : null}
        {tab === "albums" ? (
          <AlbumsTab
            version={version}
            slots={slots}
            albumId={albumId}
            query={albumQuery}
            page={albumPage}
            uploadingIds={uploadingIds}
            onAlbum={setAlbumId}
            onQuery={setAlbumQuery}
            onMore={() => setAlbumPage((value) => value + 1)}
            onToggle={onToggle}
            full={full}
            replaceIndex={replaceIndex}
          />
        ) : null}
        {tab === "upload" ? <UploadTab onFiles={onUpload} busy={busy} /> : null}
      </div>
    </div>
  );
}
