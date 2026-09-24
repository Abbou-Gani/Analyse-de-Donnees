import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { appelerAPI } from "../api/client";
import DispositionApp from "../composants/DispositionApp";

const ONGLETS = [
  { id: "resume", libelle: "Résumé" },
  { id: "anomalies", libelle: "Anomalies" },
  { id: "tendances", libelle: "Tendances" },
  { id: "recommandations", libelle: "Recommandations" },
  { id: "insights", libelle: "Insights IA" },
];

const LIBELLES_STATS = {
  count: "Nombre de valeurs",
  mean: "Moyenne",
  std: "Écart-type",
  min: "Minimum",
  "25%": "25 % des valeurs",
  "50%": "Médiane",
  "75%": "75 % des valeurs",
  max: "Maximum",
};

function formaterNombre(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const n = Number(v);
  if (Number.isInteger(n)) return n.toLocaleString("fr-FR");
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function AfficherDetaille({ index, titre, priorite, detail, action }) {
  return (
    <div className="reco-item">
      {index != null && <span className="n">{index}</span>}
      <div className="txt reco-detaillee">
        <div className="reco-titre">
          <strong>{titre}</strong>
          {priorite && (
            <span className={`reco-priorite ${priorite}`}>{priorite}</span>
          )}
        </div>
        {detail && <p className="reco-corps">{detail}</p>}
        {action && (
          <p className="reco-action">
            <span aria-hidden="true">→ </span>
            {action}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Resultats() {
  const { fichierId } = useParams();
  const [statut, setStatut] = useState("en_attente");
  const [resultat, setResultat] = useState(null);
  const [fichier, setFichier] = useState(null);
  const [erreur, setErreur] = useState("");
  const [erreurVide, setErreurVide] = useState(false);
  const [ongletActif, setOngletActif] = useState("resume");
  const [enRelance, setEnRelance] = useState(false);
  const [voirJSON, setVoirJSON] = useState(false);

  const chargerResultat = useCallback(async () => {
    try {
      const res = await appelerAPI(`/fichiers/${fichierId}/resultat`);
      setResultat(res);
      setErreur("");
      setErreurVide(false);
      setStatut("termine");
    } catch (err) {
      if (err.message.includes("Résultat vide")) {
        setErreurVide(true);
        setErreur("");
      } else {
        setErreur(err.message);
      }
    }
  }, [fichierId]);

  useEffect(() => {
    let actif = true;
    let minuterie;

    async function interroger() {
      try {
        const donnees = await appelerAPI(`/fichiers/${fichierId}/statut`);
        if (!actif) return;
        setStatut(donnees.statut);

        if (donnees.statut === "termine") {
          try {
            const meta = await appelerAPI(`/fichiers/${fichierId}`);
            if (actif) setFichier(meta);
          } catch {
            /* métadonnées optionnelles */
          }
          await chargerResultat();
        } else if (donnees.statut === "echoue") {
          setErreur("L'analyse a échoué. Vous pouvez la relancer.");
        } else {
          minuterie = setTimeout(interroger, 2500);
        }
      } catch (err) {
        if (actif) setErreur(err.message);
      }
    }

    interroger();
    return () => {
      actif = false;
      clearTimeout(minuterie);
    };
  }, [fichierId, chargerResultat]);

  async function relancer() {
    setEnRelance(true);
    setErreur("");
    setErreurVide(false);
    setResultat(null);
    try {
      await appelerAPI(`/fichiers/${fichierId}/relancer`, { method: "POST" });
      setStatut("en_attente");
      async function interroger() {
        try {
          const donnees = await appelerAPI(`/fichiers/${fichierId}/statut`);
          setStatut(donnees.statut);
          if (donnees.statut === "termine") {
            await chargerResultat();
            setEnRelance(false);
          } else if (donnees.statut === "echoue") {
            setErreur("L'analyse a échoué. Vous pouvez la relancer.");
            setEnRelance(false);
          } else {
            setTimeout(interroger, 2500);
          }
        } catch (err) {
          setErreur(err.message);
          setEnRelance(false);
        }
      }
      interroger();
    } catch (err) {
      setErreur(err.message);
      setEnRelance(false);
    }
  }

  if ((statut !== "termine" && !erreur && !erreurVide) || enRelance) {
    return (
      <DispositionApp actif="/fichiers">
        <Link to="/fichiers" className="lien-retour">
          ← Retour
        </Link>
        <div className="chargement">
          <div className="roue" />
          <p>Analyse en cours…</p>
        </div>
      </DispositionApp>
    );
  }

  if (erreur || erreurVide) {
    return (
      <DispositionApp actif="/fichiers">
        <Link to="/fichiers" className="lien-retour">
          ← Retour
        </Link>
        <div className="alerte">
          {erreurVide
            ? "Le résultat est vide — l'analyse a échoué. Vous pouvez la relancer."
            : erreur}
        </div>
        <div className="bloc-actions-erreur">
          <button
            className="btn-primaire-app"
            onClick={relancer}
            disabled={enRelance}
          >
            {enRelance ? "Relance en cours…" : "Relancer l'analyse"}
          </button>
        </div>
      </DispositionApp>
    );
  }

  if (!resultat) return null;

  const anomalies = resultat.anomalies || [];
  const tendances = resultat.tendances || [];
  const recommandations = resultat.recommandations || [];
  const insights = resultat.insights_ia;
  const resume = resultat.resume_statistique || {};

  return (
    <DispositionApp actif="/fichiers">
      <Link to="/fichiers" className="lien-retour">
        ← Retour
      </Link>

      <div className="resultats-header">
        <div>
          <h1>{fichier?.nom_original || `Fichier #${fichierId}`}</h1>
          <div className="sous">
            Analyse terminée
            {fichier ? ` · ${(fichier.taille / 1024).toFixed(1)} Ko` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn-secondaire-app"
            onClick={relancer}
            disabled={enRelance}
          >
            ↻ Relancer
          </button>
          <button
            className="btn-secondaire-app"
            onClick={() => setVoirJSON((v) => !v)}
          >
            {voirJSON ? "Masquer le JSON" : "Voir le JSON"}
          </button>
        </div>
      </div>

      <div className="onglets-resultats">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            className={`onglet-resultats ${
              ongletActif === o.id ? "actif" : ""
            }`}
            onClick={() => setOngletActif(o.id)}
          >
            {o.libelle}
          </button>
        ))}
      </div>

      {voirJSON && (
        <section className="carte-resultat large" style={{ marginBottom: 16 }}>
          <h2>Données techniques (JSON)</h2>
          <pre className="pre-contenu">{JSON.stringify(resultat, null, 2)}</pre>
        </section>
      )}

      <div className="grille-resultats">
        {ongletActif === "resume" && (
          <ResumeLisible resume={resume} fichier={fichier} />
        )}

        {ongletActif === "anomalies" && (
          <section className="carte-resultat large">
            <h2>
              Anomalies détectées{" "}
              <span className="badge">{anomalies.length}</span>
            </h2>
            {anomalies.length === 0 ? (
              <p className="vide">
                Aucune valeur bizarre détectée — vos données semblent
                cohérentes.
              </p>
            ) : (
              <>
                <p className="explication">
                  Ce sont des valeurs qui sortent clairement de la norme et
                  qui peuvent fausser vos chiffres.
                </p>
                {anomalies.map((a, i) => {
                  const exemples = (a.valeurs || [])
                    .slice(0, 3)
                    .map(formaterNombre)
                    .join(", ");
                  const pourcent =
                    a.pourcentage ??
                    (a.nombre_valeurs_aberrantes && a.moyenne != null
                      ? null
                      : null);
                  return (
                    <AfficherDetaille
                      key={i}
                      index={i + 1}
                      titre={`Valeur atypique dans « ${a.colonne} »`}
                      priorite="haute"
                      detail={
                        <>
                          {a.nombre_valeurs_aberrantes} valeur(s) hors de la
                          fourchette habituelle (
                          {formaterNombre(a.borne_basse)} →{" "}
                          {formaterNombre(a.borne_haute)})
                          {a.feuille ? ` dans la feuille « ${a.feuille} »` : ""}
                          {pourcent != null ? `, soit ${pourcent} % de la colonne` : ""}
                          {exemples ? `. Exemples : ${exemples}` : ""}.
                          {a.moyenne != null &&
                            ` Moyenne de la colonne : ${formaterNombre(a.moyenne)}.`}
                        </>
                      }
                      action="Comparez ces valeurs à la source d'origine : saisie incorrecte, unité différente, ou cas réel à isoler avant de conclure."
                    />
                  );
                })}
              </>
            )}
          </section>
        )}

        {ongletActif === "tendances" && (
          <section className="carte-resultat large">
            <h2>
              Tendances{" "}
              <span className="badge">{tendances.length}</span>
            </h2>
            {tendances.length === 0 ? (
              <p className="vide">
                Pas de tendance détectée — il faut une colonne de dates dans le
                fichier pour mesurer l'évolution dans le temps.
              </p>
            ) : (
              <>
                <p className="explication">
                  Évolution entre le début et la fin de vos données.
                </p>
                {tendances.map((t, i) => {
                  const sensLabel =
                    t.sens === "hausse"
                      ? "en hausse ↑"
                      : t.sens === "baisse"
                        ? "en baisse ↓"
                        : "stable →";
                  const action =
                    t.sens === "baisse"
                      ? "Priorisez cette baisse : croisez-la avec les autres colonnes pour trouver la cause."
                      : t.sens === "hausse"
                        ? "Si cette hausse est souhaitable, identifiez ce qui a marché et pérennisez-le."
                        : "Surveillez cette colonne aux prochains imports pour confirmer la stabilité.";
                  const priorite =
                    t.sens === "baisse" ? "haute" : t.sens === "hausse" ? "moyenne" : "info";
                  return (
                    <AfficherDetaille
                      key={i}
                      index={i + 1}
                      titre={`Évolution de « ${t.colonne} »`}
                      priorite={priorite}
                      detail={
                        <>
                          {sensLabel} de {formaterNombre(t.valeur_premiere)} à{" "}
                          {formaterNombre(t.valeur_derniere)} (
                          {t.evolution_pourcentage > 0 ? "+" : ""}
                          {formaterNombre(t.evolution_pourcentage)} %)
                          {t.colonne_date
                            ? ` selon « ${t.colonne_date} »`
                            : ""}
                          {t.feuille ? ` (feuille « ${t.feuille} »)` : ""}.
                          {t.valeur_min != null &&
                            ` Min ${formaterNombre(t.valeur_min)}, max ${formaterNombre(t.valeur_max)}, moyenne ${formaterNombre(t.valeur_moyenne)} sur ${t.nombre_points ?? "?"} point(s).`}
                        </>
                      }
                      action={action}
                    />
                  );
                })}
              </>
            )}
          </section>
        )}

        {ongletActif === "recommandations" && (
          <section className="carte-resultat large">
            <h2>
              Que faire ensuite{" "}
              <span className="badge">{recommandations.length}</span>
            </h2>
            {recommandations.length === 0 ? (
              <p className="vide">Aucune recommandation particulière.</p>
            ) : (
              <>
                <p className="explication">
                  Conseils concrets tirés de l'analyse de votre fichier.
                </p>
                {recommandations.map((r, i) =>
                  typeof r === "object" && r !== null ? (
                    <AfficherDetaille
                      key={i}
                      index={i + 1}
                      titre={r.titre}
                      priorite={r.priorite}
                      detail={r.detail}
                      action={r.action}
                    />
                  ) : (
                    <AfficherDetaille key={i} index={i + 1} titre={String(r)} />
                  )
                )}
              </>
            )}
          </section>
        )}

        {ongletActif === "insights" && (
          <section className="carte-resultat large">
            <h2>Résumé exécutif</h2>
            <p className="explication">
              En une lecture : ce que contient le fichier, ce qui cloche, et
              quoi retenir pour décider.
            </p>
            {insights ? (
              <div className="insight-box">
                <span className="tag-ia">✨ Analyse automatique</span>
                {insights}
              </div>
            ) : (
              <p className="vide">Pas de résumé disponible pour ce fichier.</p>
            )}

            <div className="blocs-insights">
              <AfficherDetaille
                titre="Ce que contient le fichier"
                priorite="info"
                detail={
                  resume.nombre_feuilles != null
                    ? `${formaterNombre(resume.nombre_feuilles)} feuille(s), ${formaterNombre(resume.nombre_lignes_total)} ligne(s), ${Object.keys(resume.statistiques || {}).length} colonne(s) chiffrée(s).`
                    : `${formaterNombre(resume.nombre_paragraphes)} paragraphe(s), ${formaterNombre(resume.nombre_mots)} mot(s), ${formaterNombre(resume.nombre_tableaux)} tableau(x).`
                }
                action="Utilisez ce cadrage en tête de rapport ou de présentation."
              />
              <AfficherDetaille
                titre="Points d'attention"
                priorite={
                  anomalies.length > 0
                    ? "haute"
                    : Object.values(resume.valeurs_manquantes || {}).some((n) => n > 0)
                      ? "moyenne"
                      : "info"
                }
                detail={
                  anomalies.length > 0 || Object.values(resume.valeurs_manquantes || {}).some((n) => n > 0)
                    ? `${anomalies.length} anomalie(s), ${Object.values(resume.valeurs_manquantes || {}).reduce((s, n) => s + n, 0)} valeur(s) manquante(s). Corrigez avant de diffuser les chiffres.`
                    : "Aucune anomalie marquée ni valeur manquante détectée : les indicateurs sont exploitables en l'état."
                }
                action={
                  anomalies.length > 0
                    ? "Ouvrez les onglets Anomalies et Recommandations pour traiter chaque point."
                    : "Vous pouvez reprendre les statistiques du Résumé sans filtre."
                }
              />
              <AfficherDetaille
                titre="Ce qu'il faut retenir"
                priorite={
                  tendances.some((t) => t.sens === "baisse")
                    ? "haute"
                    : tendances.length
                      ? "moyenne"
                      : "info"
                }
                detail={
                  tendances.length
                    ? tendances
                        .slice(0, 3)
                        .map(
                          (t) =>
                            `${t.colonne} ${t.sens === "hausse" ? "↑" : t.sens === "baisse" ? "↓" : "→"} ${t.evolution_pourcentage > 0 ? "+" : ""}${formaterNombre(t.evolution_pourcentage)} %`
                        )
                        .join(" · ")
                    : "Pas de tendance temporelle mesurable (colonne de date absente ou trop courte)."
                }
                action={
                  tendances.some((t) => t.sens === "baisse")
                    ? "Priorisez les baisses avant de communiquer une belle moyenne globale."
                    : "Croisez ce résumé avec les recommandations pour décider de la suite."
                }
              />
            </div>
          </section>
        )}
      </div>
    </DispositionApp>
  );
}

function ResumeLisible({ resume, fichier }) {
  const stats = resume.statistiques || {};
  const manquantes = resume.valeurs_manquantes || {};
  const colsNum = resume.colonnes_numeriques || [];
  const colsTexte = resume.colonnes_texte || [];
  const colsDates = resume.colonnes_dates || [];
  const totalManquantes = Object.values(manquantes).reduce(
    (s, n) => s + n,
    0
  );
  const nFeuilles = resume.nombre_feuilles;
  const nLignes = resume.nombre_lignes_total;
  const nParagraphes = resume.nombre_paragraphes;
  const nMots = resume.nombre_mots;

  const estExcel = nFeuilles !== undefined;
  const estWord = nParagraphes !== undefined;

  const cartes = [];
  if (estExcel) {
    cartes.push(
      { l: "Feuilles", v: formaterNombre(nFeuilles), d: "dans le classeur" },
      { l: "Lignes", v: formaterNombre(nLignes), d: "au total" },
      {
        l: "Colonnes",
        v: formaterNombre(colsNum.length + colsTexte.length + colsDates.length),
        d: "détectées",
      },
      {
        l: "Valeurs manquantes",
        v: formaterNombre(totalManquantes),
        d: totalManquantes ? "à traiter" : "aucune",
        alerte: totalManquantes > 0,
      }
    );
  } else if (estWord) {
    cartes.push(
      { l: "Paragraphes", v: formaterNombre(nParagraphes), d: "dans le document" },
      { l: "Mots", v: formaterNombre(nMots), d: "au total" },
      {
        l: "Tableaux",
        v: formaterNombre(resume.nombre_tableaux || 0),
        d: "détectés",
      },
      {
        l: "Mots / paragraphe",
        v: formaterNombre(resume.longueur_moyenne_paragraphe || 0),
        d: "en moyenne",
      }
    );
  }

  const nomsColonnes = Object.keys(stats);

  return (
    <>
      <section className="carte-resultat large">
        <h2>
          Vue d'ensemble{" "}
          {fichier ? (
            <span className="badge">{fichier.type_fichier}</span>
          ) : null}
        </h2>
        <div className="kpis-app resume-kpis">
          {cartes.map((c) => (
            <div key={c.l} className={`kpi-app${c.alerte ? " kpi-alerte" : ""}`}>
              <div className="l">{c.l}</div>
              <div className="v">{c.v}</div>
              <div className="d">{c.d}</div>
            </div>
          ))}
        </div>

        {estExcel && (colsNum.length > 0 || colsTexte.length > 0 || colsDates.length > 0) && (
          <div className="blocs-colonnes">
            <div className="bloc-colonne">
              <h3>Colonnes numériques</h3>
              {colsNum.length ? (
                <ul className="liste-puces">
                  {colsNum.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="vide">Aucune</p>
              )}
            </div>
            <div className="bloc-colonne">
              <h3>Colonnes de texte</h3>
              {colsTexte.length ? (
                <ul className="liste-puces">
                  {[...new Set(colsTexte)].map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="vide">Aucune</p>
              )}
            </div>
            <div className="bloc-colonne">
              <h3>Colonnes de dates</h3>
              {colsDates.length ? (
                <ul className="liste-puces">
                  {colsDates.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="vide">Aucune</p>
              )}
            </div>
          </div>
        )}
      </section>

      {nomsColonnes.length > 0 && (
        <section className="carte-resultat large">
          <h2>
            Statistiques par colonne{" "}
            <span className="badge">{nomsColonnes.length}</span>
          </h2>
          <p className="explication">
            Pour chaque colonne chiffrée : les valeurs moyennes, minimales et
            maximales de votre fichier.
          </p>
          <div className="scroll-tableau">
            <table className="tableau-stats">
              <thead>
                <tr>
                  <th>Colonne</th>
                  <th>Moyenne</th>
                  <th>Minimum</th>
                  <th>Médiane</th>
                  <th>Maximum</th>
                </tr>
              </thead>
              <tbody>
                {nomsColonnes.map((col) => {
                  const s = stats[col] || {};
                  return (
                    <tr key={col}>
                      <td>
                        <strong>{col}</strong>
                      </td>
                      <td className="val">{formaterNombre(s.mean)}</td>
                      <td className="val">{formaterNombre(s.min)}</td>
                      <td className="val">{formaterNombre(s["50%"])}</td>
                      <td className="val">{formaterNombre(s.max)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <details className="details-stats">
            <summary>Toutes les statistiques (détail)</summary>
            <div className="scroll-tableau">
              <table className="tableau-stats">
                <thead>
                  <tr>
                    <th>Colonne</th>
                    {Object.keys(LIBELLES_STATS).map((k) => (
                      <th key={k}>{LIBELLES_STATS[k]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nomsColonnes.map((col) => {
                    const s = stats[col] || {};
                    return (
                      <tr key={col}>
                        <td>
                          <strong>{col}</strong>
                        </td>
                        {Object.keys(LIBELLES_STATS).map((k) => (
                          <td key={k} className="val">
                            {formaterNombre(s[k])}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}

      {Object.keys(manquantes).length > 0 && (
        <section className="carte-resultat large">
          <h2>
            Données manquantes{" "}
            <span className="badge">{totalManquantes}</span>
          </h2>
          <p className="explication">
            Cellules vides détectées — à compléter si ces informations sont
            importantes.
          </p>
          <ul className="liste-puces">
            {Object.entries(manquantes).map(([cle, n]) => (
              <li key={cle}>
                <strong>{cle}</strong> : {n} cellule(s) vide(s)
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
