import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appelerAPI } from "../api/client";
import DispositionApp from "../composants/DispositionApp";

export default function Insights() {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;
    appelerAPI("/insights")
      .then((res) => {
        if (actif) setDonnees(res);
      })
      .catch((err) => {
        if (actif) setErreur(err.message);
      })
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, []);

  if (chargement) {
    return (
      <DispositionApp actif="/insights">
        <div className="entete-app">
          <div>
            <h1>Insights IA</h1>
            <div className="sous">
              Constats agrégés de toutes vos analyses terminées.
            </div>
          </div>
        </div>
        <div className="chargement">
          <div className="roue" />
          <p>Chargement des insights...</p>
        </div>
      </DispositionApp>
    );
  }

  if (erreur) {
    return (
      <DispositionApp actif="/insights">
        <div className="entete-app">
          <div>
            <h1>Insights IA</h1>
            <div className="sous">
              Constats agrégés de toutes vos analyses terminées.
            </div>
          </div>
        </div>
        <div className="alerte">{erreur}</div>
      </DispositionApp>
    );
  }

  const insights = donnees?.insights || [];
  const sansAnalyse = donnees && donnees.total_analyses === 0;

  return (
    <DispositionApp actif="/insights">
      <div className="entete-app">
        <div>
          <h1>Insights IA</h1>
          <div className="sous">
            Constats agrégés de toutes vos analyses terminées.
          </div>
        </div>
      </div>

      <div className="kpis-app">
        <div className="kpi-app">
          <div className="l">Analyses</div>
          <div className="v">{donnees?.total_analyses ?? 0}</div>
          <div className="d">terminées</div>
        </div>
        <div className="kpi-app">
          <div className="l">Anomalies</div>
          <div className="v">{donnees?.total_anomalies ?? 0}</div>
          <div className="d">
            {donnees?.total_valeurs_aberrantes ?? 0} valeur(s) aberrante(s)
          </div>
        </div>
        <div className="kpi-app">
          <div className="l">Tendances</div>
          <div className="v">{donnees?.total_tendances ?? 0}</div>
          <div className="d">
            {donnees?.tendances_hausse ?? 0} ↑ · {donnees?.tendances_baisse ?? 0}{" "}
            ↓
          </div>
        </div>
        <div className="kpi-app">
          <div className="l">Recommandations</div>
          <div className="v">{donnees?.total_recommandations ?? 0}</div>
          <div className="d">générées</div>
        </div>
      </div>

      {sansAnalyse ? (
        <div className="bloc-liste">
          <div className="entete-bl">
            <h2>Aucun insight pour le moment</h2>
          </div>
          <p className="vide">
            Importez un fichier et laissez l'analyse se terminer pour voir ses
            insights ici.{" "}
            <Link to="/fichiers" className="lien-insight">
              Importer un fichier →
            </Link>
          </p>
        </div>
      ) : (
        <div className="liste-insights">
          {insights.map((item) => (
            <article key={item.fichier_id} className="carte-insight">
              <div className="entete-ci">
                <div className={`ico-type ${item.type_fichier}`}>
                  {item.type_fichier === "docx" ? "W" : "X"}
                </div>
                <div className="meta">
                  <div className="nom">{item.nom_fichier}</div>
                  <div className="info">
                    {item.analyse_le
                      ? `analysé le ${new Date(item.analyse_le).toLocaleString(
                          "fr-FR"
                        )}`
                      : ""}
                    {(item.taille / 1024).toFixed(1)} Ko ·{" "}
                    {item.modele_utilise || "analyse_locale"}
                  </div>
                </div>
                <Link
                  className="btn-action"
                  to={`/resultats/${item.fichier_id}`}
                  title="Voir les résultats"
                >
                  →
                </Link>
              </div>

              {item.insights_ia && (
                <div className="insight-box">
                  <span className="tag-ia">
                    ✨ {item.modele_utilise || "analyse_locale"}
                  </span>
                  <strong>Résumé exécutif :</strong> {item.insights_ia}
                </div>
              )}

              <div className="stats-ci">
                <span className={`pill-ci ${item.nombre_anomalies ? "alerte" : ""}`}>
                  {item.nombre_anomalies} anomalie(s)
                </span>
                <span className="pill-ci">
                  {item.tendances_hausse} ↑ · {item.tendances_baisse} ↓
                </span>
                <span className="pill-ci">
                  {item.recommandations?.length || 0} reco(s)
                </span>
              </div>

              {item.tendances?.length > 0 && (
                <ul className="tendances-ci">
                  {item.tendances.slice(0, 3).map((t, i) => (
                    <li key={i}>
                      <strong>{t.colonne}</strong> : {t.sens} de{" "}
                      {t.evolution_pourcentage}%
                    </li>
                  ))}
                </ul>
              )}

              {item.recommandations?.length > 0 && (
                <div className="reco-ci">
                  {typeof item.recommandations[0] === "object" &&
                  item.recommandations[0] !== null
                    ? item.recommandations[0].titre ||
                      item.recommandations[0].detail
                    : item.recommandations[0]}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </DispositionApp>
  );
}
