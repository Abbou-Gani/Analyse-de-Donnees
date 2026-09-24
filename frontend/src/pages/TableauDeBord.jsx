import { useEffect, useState } from "react";
import { utiliserAuth } from "../contexte/ContexteAuth";
import { appelerAPI } from "../api/client";
import DispositionApp from "../composants/DispositionApp";
import Televersement from "../composants/Televersement";
import ListeFichiers from "../composants/ListeFichiers";

export default function TableauDeBord() {
  const { utilisateur } = utiliserAuth();
  const [fichiers, setFichiers] = useState([]);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let actif = true;
    appelerAPI("/fichiers")
      .then((donnees) => {
        if (actif) setFichiers(donnees);
      })
      .catch(() => {
        if (actif) setFichiers([]);
      })
      .finally(() => {
        if (actif) setPret(true);
      });
    return () => {
      actif = false;
    };
  }, []);

  function ajouterFichier(f) {
    setFichiers((precedents) => [f, ...precedents]);
  }

  async function recharger() {
    try {
      const donnees = await appelerAPI("/fichiers");
      setFichiers(donnees);
    } catch {
      /* ignore */
    }
  }

  const analyses = fichiers.filter((f) => f.statut === "termine").length;
  const enCours = fichiers.filter(
    (f) => f.statut === "en_cours" || f.statut === "en_attente"
  ).length;

  return (
    <DispositionApp>
      <div className="entete-app">
        <div>
          <h1>Tableau de bord</h1>
          <div className="sous">
            Bonjour {utilisateur?.email?.split("@")[0] || "utilisateur"} —
            voici l'activité de votre organisation.
          </div>
        </div>
      </div>

      <div className="kpis-app">
        <div className="kpi-app">
          <div className="l">Fichiers</div>
          <div className="v">{fichiers.length}</div>
          <div className="d">importés</div>
        </div>
        <div className="kpi-app">
          <div className="l">Analyses</div>
          <div className="v">{analyses}</div>
          <div className="d">terminées</div>
        </div>
        <div className="kpi-app">
          <div className="l">En cours</div>
          <div className="v">{enCours}</div>
          <div className="d">en file</div>
        </div>
        <div className="kpi-app">
          <div className="l">Insights IA</div>
          <div className="v">{analyses}</div>
          <div className="d">disponibles</div>
        </div>
      </div>

      <Televersement onNouveauFichier={ajouterFichier} />

      {pret ? (
        <ListeFichiers fichiers={fichiers} onChanger={recharger} />
      ) : (
        <div className="chargement">
          <div className="roue" />
          <p>Chargement des fichiers...</p>
        </div>
      )}
    </DispositionApp>
  );
}
