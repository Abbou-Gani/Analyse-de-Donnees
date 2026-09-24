import { NavLink, useNavigate } from "react-router-dom";
import { utiliserAuth } from "../contexte/ContexteAuth";

const LIENS = [
  { vers: "/tableau-de-bord", libelle: "Tableau de bord", ico: "⌂" },
  { vers: "/fichiers", libelle: "Fichiers", ico: "▤" },
  { vers: "/insights", libelle: "Insights IA", ico: "✦" },
];

const LIENS_ORG = [
  { vers: "/equipe", libelle: "Équipe", ico: "☰" },
  { vers: "/abonnement", libelle: "Abonnement", ico: "◫" },
  { vers: "/parametres", libelle: "Paramètres", ico: "⚙" },
];

export default function DispositionApp({ actif, children }) {
  const { utilisateur, fermerSession } = utiliserAuth();
  const navigation = useNavigate();

  const email = utilisateur?.email || "utilisateur";
  const initiale = email.charAt(0).toUpperCase();

  async function deconnecter() {
    await fermerSession();
    navigation("/connexion");
  }

  return (
    <div className="layout-app">
      <aside className="sidebar-app">
        <div className="logo-sidebar">
          <span className="rond">G</span>
          <span>GestAnalyse</span>
        </div>

        <nav className="nav-sidebar">
          <div className="section-label">Navigation</div>
          {LIENS.map((lien) => (
            <NavLink
              key={lien.vers}
              to={lien.vers}
              className={({ isActive }) =>
                `item ${
                  isActive || (actif && actif === lien.vers) ? "actif" : ""
                }`
              }
            >
              <span className="ico-item">{lien.ico}</span>
              {lien.libelle}
            </NavLink>
          ))}

          <div className="sep" />
          <div className="section-label">Organisation</div>

          {LIENS_ORG.map((lien) => (
            <NavLink
              key={lien.vers}
              to={lien.vers}
              className={({ isActive }) =>
                `item ${isActive || actif === lien.vers ? "actif" : ""}`
              }
            >
              <span className="ico-item">{lien.ico}</span>
              {lien.libelle}
            </NavLink>
          ))}
        </nav>

        <div className="compte-bas">
          <div className="av">{initiale}</div>
          <div className="info">
            <div className="n">{email.split("@")[0]}</div>
            <div className="e">{email}</div>
          </div>
          <button
            className="btn-deco"
            onClick={deconnecter}
            title="Déconnexion"
          >
            →
          </button>
        </div>
      </aside>

      <main className="principale">{children}</main>
    </div>
  );
}
