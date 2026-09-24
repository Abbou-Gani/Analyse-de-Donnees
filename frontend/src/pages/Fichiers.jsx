import { useEffect, useState } from "react";
import DispositionApp from "../composants/DispositionApp";
import Televersement from "../composants/Televersement";
import ListeFichiers from "../composants/ListeFichiers";
import { appelerAPI } from "../api/client";

export default function Fichiers() {
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

  return (
    <DispositionApp actif="/fichiers">
      <div className="entete-app">
        <div>
          <h1>Fichiers</h1>
          <div className="sous">
            Importez et gérez tous vos fichiers Excel et Word.
          </div>
        </div>
      </div>

      <Televersement onNouveauFichier={ajouterFichier} />

      {pret ? (
        <ListeFichiers
          fichiers={fichiers}
          titre="Tous les fichiers"
          sansVoirTout
          onChanger={recharger}
        />
      ) : (
        <div className="chargement">
          <div className="roue" />
          <p>Chargement des fichiers...</p>
        </div>
      )}
    </DispositionApp>
  );
}
