import { Link } from "react-router-dom";
import { screens } from "../../app/catalog";

export default function MapPage() {
  const groups = [];

  for (const screen of screens) {
    let group = groups.find((item) => item.name === screen.group);
    if (!group) {
      group = { name: screen.group, screens: [] };
      groups.push(group);
    }
    group.screens.push(screen);
  }

  return (
    <main className="map">
      <p className="stub__group">Builder index</p>
      <h1>Where each screen lives</h1>
      <p className="stub__flow">
        The product flow is in sys arc.txt. This page is only the index. Open a
        screen, then open the file named on it.
      </p>
      {groups.map((group) => (
        <section key={group.name} className="map__group">
          <h2>{group.name}</h2>
          <ul>
            {group.screens.map((screen) => (
              <li key={screen.path}>
                <Link to={screen.href}>{screen.title}</Link>
                <span>{screen.path}</span>
                <code>{screen.file}</code>
                <span>{screen.api ?? "Static screen"}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
