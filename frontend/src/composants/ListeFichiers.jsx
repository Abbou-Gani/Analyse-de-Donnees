import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appelerAPI } from "../api/client";

const LIBELLES_STATUT = {
  en_attente: "En attente",
  en_cours: "En cours",
  termine: "Terminé",
  echoue: "Échoué",
};

const CLASSES_STATUT = {
  en_attente: "en_attente",
  en_cours: "en_cours",
  termine: "termine",
  echoue: "echoue",
};

export default function ListeFichiers({
  fichiers,
  titre = "Fichiers récents",
  sansVoirTout = false,
  onChanger,
}) {
  const [erreurs, setErreurs] = useState({});

  if (!fichiers.length) {
    return (
      <p className="vide">
        Aucun fichier pour le moment. Importez votre premier fichier ci-dessus.
      </p>
    );
  }

  async function relancer(fichierId) {
    setErreurs((p) => ({ ...p, [fichierId]: "" }));
    try {
      await appelerAPI(`/fichiers/${fichierId}/relancer`, { method: "POST" });
      onChanger?.();
    } catch (err) {
      setErreurs((p) => ({ ...p, [fichierId]: err.message }));
    }
  }

  return (
    <div className="bloc-liste">
      <div className="entete-bl">
        <h2>{titre}</h2>
        {!sansVoirTout && (
          <Link to="/fichiers" className="btn-secondaire-app">
            Voir tout
          </Link>
        )}
      </div>
      {fichiers.map((fichier) => (
        <div key={fichier.id} className="ligne-fichier">
          <div className={`ico-type ${fichier.type_fichier}`}>
            {fichier.type_fichier === "docx" ? "W" : "X"}
          </div>
          <div className="meta">
            <div className="nom">{fichier.nom_original}</div>
            <div className="info">
              {(fichier.taille / 1024).toFixed(1)} Ko · importé le{" "}
              {new Date(fichier.cree_le).toLocaleString("fr-FR")}
              {erreurs[fichier.id] && (
                <span className="err-ligne"> · {erreurs[fichier.id]}</span>
              )}
            </div>
          </div>
          <StatutFichier fichierId={fichier.id} />
          <LigneActions
            fichierId={fichier.id}
            onRelancer={() => relancer(fichier.id)}
          />
        </div>
      ))}
    </div>
  );
}

function LigneActions({ fichierId, onRelancer }) {
  const { statut } = useStatutPolling(fichierId);
  const peutRelancer = statut === "echoue" || statut === "en_attente";

  return (
    <div className="actions-ligne">
      {peutRelancer && (
        <button
          className="btn-action btn-relancer"
          onClick={onRelancer}
          title="Relancer l'analyse"
        >
          ↻
        </button>
      )}
      <Link
        className="btn-action"
        to={`/resultats/${fichierId}`}
        title="Voir"
      >
        →
      </Link>
    </div>
  );
}

function StatutFichier({ fichierId }) {
  const { statut } = useStatutPolling(fichierId);
  return (
    <span className={`statut ${CLASSES_STATUT[statut] || "en_attente"}`}>
      <span className="pt" />
      {LIBELLES_STATUT[statut] || statut}
    </span>
  );
}

function useStatutPolling(fichierId) {
  const [statut, setStatut] = useState("en_attente");

  useEffect(() => {
    let actif = true;
    let minuterie;

    async function interroger() {
      try {
        const donnees = await appelerAPI(`/fichiers/${fichierId}/statut`);
        if (!actif) return;
        setStatut(donnees.statut);
        if (donnees.statut === "en_attente" || donnees.statut === "en_cours") {
          minuterie = setTimeout(interroger, 2500);
        }
      } catch {
        if (actif) minuterie = setTimeout(interroger, 5000);
      }
    }

    interroger();
    return () => {
      actif = false;
      clearTimeout(minuterie);
    };
  }, [fichierId]);

  return { statut };
}
