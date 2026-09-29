import { useEffect, useMemo, useState } from "react";
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
  const [aConfirmer, setAConfirmer] = useState(null);
  const [enSuppression, setEnSuppression] = useState(null);
  const [versionsOuvertes, setVersionsOuvertes] = useState(() => new Set());

  useEffect(() => {
    if (!aConfirmer) return undefined;
    const minuterie = setTimeout(() => setAConfirmer(null), 4000);
    return () => clearTimeout(minuterie);
  }, [aConfirmer]);

  const groupes = useMemo(() => {
    const parNom = new Map();
    for (const fichier of fichiers) {
      const cle = fichier.nom_original || "sans_nom";
      if (!parNom.has(cle)) parNom.set(cle, []);
      parNom.get(cle).push(fichier);
    }
    return [...parNom.entries()].map(([nom, membres]) => {
      const tries = [...membres].sort(
        (a, b) => new Date(b.cree_le) - new Date(a.cree_le)
      );
      return { nom, membres: tries, principal: tries[0] };
    });
  }, [fichiers]);

  if (!fichiers.length) {
    return (
      <p className="vide">
        Aucun fichier pour le moment. Importez votre premier fichier ci-dessus.
      </p>
    );
  }

  function basculerVersions(nom) {
    setVersionsOuvertes((ensemble) => {
      const suivant = new Set(ensemble);
      if (suivant.has(nom)) suivant.delete(nom);
      else suivant.add(nom);
      return suivant;
    });
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

  async function supprimer(fichierId) {
    if (aConfirmer !== fichierId) {
      setAConfirmer(fichierId);
      return;
    }
    setAConfirmer(null);
    setEnSuppression(fichierId);
    setErreurs((p) => ({ ...p, [fichierId]: "" }));
    try {
      await appelerAPI(`/fichiers/${fichierId}`, { method: "DELETE" });
      onChanger?.();
    } catch (err) {
      setErreurs((p) => ({ ...p, [fichierId]: err.message }));
    } finally {
      setEnSuppression(null);
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
      {groupes.map((groupe) => {
        const ouvert = versionsOuvertes.has(groupe.nom);
        const fichier = groupe.principal;
        return (
          <div key={groupe.nom} className="bloc-groupe-fichier">
            <div className="ligne-fichier">
              <div className={`ico-type ${fichier.type_fichier}`}>
                {fichier.type_fichier === "docx" ? "W" : "X"}
              </div>
              <div className="meta">
                <div className="nom">
                  {fichier.nom_original}
                  {(fichier.version || 1) > 1 && (
                    <span className="version-fichier">v{fichier.version}</span>
                  )}
                </div>
                <div className="info">
                  {(fichier.taille / 1024).toFixed(1)} Ko · importé le{" "}
                  {new Date(fichier.cree_le).toLocaleString("fr-FR")}
                  {groupe.membres.length > 1 && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="lien-versions"
                        onClick={() => basculerVersions(groupe.nom)}
                      >
                        {ouvert
                          ? "masquer les versions"
                          : `${groupe.membres.length} versions`}
                      </button>
                    </>
                  )}
                  {fichier.disponible === false && (
                    <span className="err-ligne">
                      {" "}
                      · Le fichier n'existe plus sur le serveur. Réimportez-le
                      depuis « Importer » pour réactiver le dashboard.
                    </span>
                  )}
                  {erreurs[fichier.id] && (
                    <span className="err-ligne"> · {erreurs[fichier.id]}</span>
                  )}
                </div>
              </div>
              <StatutFichier fichierId={fichier.id} />
              <LigneActions
                fichierId={fichier.id}
                onRelancer={() => relancer(fichier.id)}
                onSupprimer={() => supprimer(fichier.id)}
                confirmation={aConfirmer === fichier.id}
                enSuppression={enSuppression === fichier.id}
              />
            </div>

            {ouvert && (
              <div className="versions-fichier">
                {groupe.membres.map((membre, index) => (
                  <div
                    key={membre.id}
                    className={`ligne-fichier secondaire${
                      index === 0 ? " courante" : ""
                    }`}
                  >
                    <span className="version-fichier contour">
                      v{membre.version || 1}
                      {index === 0 ? " · courante" : ""}
                    </span>
                    <div className="meta">
                      <div className="info">
                        {(membre.taille / 1024).toFixed(1)} Ko · importé le{" "}
                        {new Date(membre.cree_le).toLocaleString("fr-FR")}
                        {membre.id === fichier.id && " · version affichée"}
                        {erreurs[membre.id] && (
                          <span className="err-ligne"> · {erreurs[membre.id]}</span>
                        )}
                      </div>
                    </div>
                    <StatutFichier fichierId={membre.id} />
                    <LigneActions
                      fichierId={membre.id}
                      onRelancer={() => relancer(membre.id)}
                      onSupprimer={() => supprimer(membre.id)}
                      confirmation={aConfirmer === membre.id}
                      enSuppression={enSuppression === membre.id}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LigneActions({ fichierId, onRelancer, onSupprimer, confirmation, enSuppression }) {
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
      <button
        className={`btn-action btn-supprimer${confirmation ? " confirmer" : ""}`}
        onClick={onSupprimer}
        disabled={enSuppression}
        title={
          confirmation
            ? "Cliquer à nouveau pour supprimer définitivement"
            : "Supprimer ce fichier et son analyse"
        }
      >
        {enSuppression ? "…" : confirmation ? "Confirmer" : "✕"}
      </button>
    </div>
  );
}

function StatutFichier({ fichierId }) {
  const { statut, disponible } = useStatutPolling(fichierId);
  if (disponible === false) {
    return <span className="statut echoue">Fichier absent</span>;
  }
  return (
    <span className={`statut ${CLASSES_STATUT[statut] || "en_attente"}`}>
      <span className="pt" />
      {LIBELLES_STATUT[statut] || statut}
    </span>
  );
}

function useStatutPolling(fichierId) {
  const [statut, setStatut] = useState("en_attente");
  const [disponible, setDisponible] = useState(true);

  useEffect(() => {
    let actif = true;
    let minuterie;

    async function interroger() {
      try {
        const donnees = await appelerAPI(`/fichiers/${fichierId}/statut`);
        if (!actif) return;
        setStatut(donnees.statut);
        setDisponible(donnees.fichier_disponible !== false);
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

  return { statut, disponible };
}
