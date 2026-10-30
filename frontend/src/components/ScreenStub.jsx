import { Link } from "react-router-dom";

export default function ScreenStub({ meta }) {
  return (
    <main className="stub">
      <p className="stub__group">{meta.group}</p>
      <h1>{meta.title}</h1>
      <p className="stub__flow">{meta.flow}</p>
      {meta.note ? <p className="stub__note">{meta.note}</p> : null}
      <dl className="stub__facts">
        <div>
          <dt>File</dt>
          <dd>{meta.file}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{meta.path}</dd>
        </div>
        <div>
          <dt>API</dt>
          <dd>{meta.api ?? "None yet. This screen is static."}</dd>
        </div>
        {meta.design ? (
          <div>
            <dt>Design</dt>
            <dd>{meta.design}</dd>
          </div>
        ) : null}
      </dl>
      <p className="stub__back">
        <Link to="/map">All screens</Link>
      </p>
    </main>
  );
}
