import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FournisseurAuth, utiliserAuth } from "./contexte/ContexteAuth";
import Accueil from "./pages/Accueil";
import Connexion from "./pages/Connexion";
import Inscription from "./pages/Inscription";
import TableauDeBord from "./pages/TableauDeBord";
import Fichiers from "./pages/Fichiers";
import Insights from "./pages/Insights";
import Equipe from "./pages/Equipe";
import Parametres from "./pages/Parametres";
import Resultats from "./pages/Resultats";
import DispositionApp from "./composants/DispositionApp";

function RouteProtegee({ composant: Composant }) {
  const { utilisateur, chargement } = utiliserAuth();
  if (chargement)
    return (
      <div className="chargement-global">
        <div className="roue" />
        <p>Chargement...</p>
      </div>
    );
  return utilisateur ? <Composant /> : <Navigate to="/connexion" replace />;
}

function RouteAuth({ composant: Composant }) {
  const { utilisateur, chargement } = utiliserAuth();
  if (chargement)
    return (
      <div className="chargement-global">
        <div className="roue" />
        <p>Chargement...</p>
      </div>
    );
  return utilisateur ? (
    <Navigate to="/tableau-de-bord" replace />
  ) : (
    <Composant />
  );
}

function PagePlaceholder({ titre, actif }) {
  return (
    <DispositionApp actif={actif}>
      <div className="entete-app">
        <div>
          <h1>{titre}</h1>
          <div className="sous">Cette section arrive bientôt.</div>
        </div>
      </div>
      <div className="bloc-liste">
        <p className="vide">En cours d'implémentation.</p>
      </div>
    </DispositionApp>
  );
}

export default function App() {
  return (
    <FournisseurAuth>
      <BrowserRouter>
        <Routes>
          {/* Site public */}
          <Route path="/" element={<Accueil />} />

          {/* Auth */}
          <Route
            path="/connexion"
            element={<RouteAuth composant={Connexion} />}
          />
          <Route
            path="/inscription"
            element={<RouteAuth composant={Inscription} />}
          />

          {/* Application (protégée) */}
          <Route
            path="/tableau-de-bord"
            element={<RouteProtegee composant={TableauDeBord} />}
          />
          <Route
            path="/resultats/:fichierId"
            element={<RouteProtegee composant={Resultats} />}
          />
          <Route
            path="/fichiers"
            element={<RouteProtegee composant={Fichiers} />}
          />
          <Route
            path="/insights"
            element={<RouteProtegee composant={Insights} />}
          />
          <Route
            path="/equipe"
            element={<RouteProtegee composant={Equipe} />}
          />
          <Route
            path="/abonnement"
            element={
              <RouteProtegee
                composant={() => (
                  <PagePlaceholder titre="Abonnement" actif="/abonnement" />
                )}
              />
            }
          />
          <Route
            path="/parametres"
            element={<RouteProtegee composant={Parametres} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </FournisseurAuth>
  );
}
