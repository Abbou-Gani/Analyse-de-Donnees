import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { appelerAPI, telechargerFichier } from "../api/client";
import DispositionApp from "../composants/DispositionApp";
import VueMarche from "../composants/VueMarche";

const ONGLETS = [
  { id: "resume", libelle: "Résumé" },
  { id: "liste", libelle: "Liste" },
  { id: "pivot", libelle: "Pivot" },
  { id: "dashboard", libelle: "Dashboard" },
  { id: "anomalies", libelle: "Anomalies" },
  { id: "tendances", libelle: "Tendances" },
  { id: "recommandations", libelle: "Recommandations" },
  { id: "insights", libelle: "Insights IA" },
  { id: "marche", libelle: "Marché" },
  { id: "journal", libelle: "Journal" },
];

const LIBELLES_JOURNAL = {
  televersement: "Fichier importé",
  analyse_terminee: "Analyse terminée",
  analyse_echouee: "Analyse échouée",
  relance_analyse: "Analyse relancée",
  export_xlsx: "Export .xlsx",
  export_pdf: "Export PDF",
  suppression: "Fichier supprimé",
  nouvelle_version: "Nouvelle version importée",
};

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

function AfficherDetaille({ index, titre, priorite, detail, action, children, delai }) {
  return (
    <div
      className="reco-item"
      style={delai != null ? { "--delai": `${delai}s` } : undefined}
    >
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
        {children}
      </div>
    </div>
  );
}

function ClassementSegments({ metrique }) {
  const lignes = metrique.classement || [];
  if (!lignes.length) return null;
  const total = lignes.reduce((somme, l) => somme + (l.total || 0), 0) || 1;
  return (
    <div className="classement-segments">
      <div className="titre-classement">
        Classement par «&nbsp;{metrique.mesure}&nbsp;» — dimension «&nbsp;
        {metrique.dimension}&nbsp;»
      </div>
      <div className="scroll-tableau">
        <table className="tableau-stats tableau-classement">
          <thead>
            <tr>
              <th>#</th>
              <th>Segment</th>
              <th>{metrique.mesure}</th>
              <th>Part</th>
              <th>Évolution</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={l.segment}>
                <td className="rang">{i + 1}</td>
                <td className="seg">{l.segment}</td>
                <td className="val">{formaterNombre(l.total)}</td>
                <td className="val">
                  <div className="barre-part">
                    <span
                      className="remplissage"
                      style={{
                        "--w": `${Math.min(
                          100,
                          ((l.total || 0) / total) * 100
                        )}%`,
                        animationDelay: `${0.8 + i * 0.07}s`,
                      }}
                    />
                    <span className="etiquette">
                      {l.part != null ? `${l.part} %` : "—"}
                    </span>
                  </div>
                </td>
                <td
                  className={`val evolution ${
                    l.evolution == null
                      ? ""
                      : l.evolution > 0
                      ? "haussiere"
                      : l.evolution < 0
                      ? "baissiere"
                      : ""
                  }`}
                >
                  {l.evolution == null
                    ? "—"
                    : `${l.evolution > 0 ? "+" : ""}${l.evolution} %`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCellule(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return formaterNombre(v);
  return String(v);
}

function DrillDownAnomalie({ anomalie }) {
  const [ouvert, setOuvert] = useState(false);
  const lignes = anomalie.lignes || [];
  if (lignes.length === 0) return null;

  const colonnes = Object.keys(lignes[0]).filter((c) => c !== "ligne");
  const horsBornes = (v) =>
    typeof v === "number" &&
    (v < anomalie.borne_basse || v > anomalie.borne_haute);
  const complet =
    anomalie.nombre_valeurs_aberrantes != null &&
    anomalie.nombre_valeurs_aberrantes <= lignes.length;

  return (
    <div className="drilldown">
      <button
        type="button"
        className="btn-drilldown"
        onClick={() => setOuvert((o) => !o)}
      >
        {ouvert ? "▾ Masquer les lignes" : "▸ Voir les lignes concernées"}
        {!ouvert && ` (${lignes.length})`}
      </button>

      {ouvert && (
        <>
          <div className="scroll-tableau">
            <table className="tableau-stats">
              <thead>
                <tr>
                  <th>Ligne</th>
                  {colonnes.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={i}>
                    <td className="val">{l.ligne}</td>
                    {colonnes.map((c) => (
                      <td
                        key={c}
                        className={`val ${horsBornes(l[c]) ? "hors-bornes" : ""}`}
                      >
                        {formatCellule(l[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note-drilldown">
            {complet
              ? `Les ${lignes.length} ligne(s) concernées sont toutes affichées — la ligne indique la position dans le fichier.`
              : `Extrait : ${lignes.length} ligne(s) affichées sur ${anomalie.nombre_valeurs_aberrantes} concernées.`}
          </p>
        </>
      )}
    </div>
  );
}

export default function Resultats() {
  const { fichierId } = useParams();
  const navigate = useNavigate();
  const [statut, setStatut] = useState("en_attente");
  const [resultat, setResultat] = useState(null);
  const [fichier, setFichier] = useState(null);
  const [erreur, setErreur] = useState("");
  const [erreurVide, setErreurVide] = useState(false);
  const [ongletActif, setOngletActif] = useState("resume");
  const [enRelance, setEnRelance] = useState(false);
  const [voirJSON, setVoirJSON] = useState(false);
  const [enExport, setEnExport] = useState(false);
  const [erreurExport, setErreurExport] = useState("");
  const [disponible, setDisponible] = useState(true);
  const [enExportPdf, setEnExportPdf] = useState(false);
  const [comparaison, setComparaison] = useState(null);
  const [erreurComparaison, setErreurComparaison] = useState("");
  const [aConfirmerSuppression, setAConfirmerSuppression] = useState(false);
  const [enSuppression, setEnSuppression] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState("");

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
    if (!aConfirmerSuppression) return undefined;
    const minuterie = setTimeout(() => setAConfirmerSuppression(false), 4000);
    return () => clearTimeout(minuterie);
  }, [aConfirmerSuppression]);

  useEffect(() => {
    if (!fichier || (fichier.version || 1) < 2) return undefined;
    let actif = true;
    setComparaison(null);
    setErreurComparaison("");
    appelerAPI(`/fichiers/${fichierId}/comparaison`)
      .then((res) => {
        if (actif) setComparaison(res);
      })
      .catch((err) => {
        if (actif) {
          setComparaison(null);
          setErreurComparaison(err.message);
        }
      });
    return () => {
      actif = false;
    };
  }, [fichierId, fichier]);

  useEffect(() => {
    let actif = true;
    let minuterie;

    async function interroger() {
      try {
        const donnees = await appelerAPI(`/fichiers/${fichierId}/statut`);
        if (!actif) return;
        setStatut(donnees.statut);
        setDisponible(donnees.fichier_disponible !== false);

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

  async function exporter() {
    setEnExport(true);
    setErreurExport("");
    try {
      const nom = fichier?.nom_original || "analyse";
      const base = nom.replace(/\.(xlsx|xls|csv|docx|doc)$/i, "");
      await telechargerFichier(
        `/fichiers/${fichierId}/export`,
        `${base}_analyse.xlsx`
      );
    } catch (err) {
      setErreurExport(err.message);
    } finally {
      setEnExport(false);
    }
  }

  async function supprimerFichier() {
    if (!aConfirmerSuppression) {
      setAConfirmerSuppression(true);
      return;
    }
    setAConfirmerSuppression(false);
    setEnSuppression(true);
    try {
      await appelerAPI(`/fichiers/${fichierId}`, { method: "DELETE" });
      navigate("/fichiers");
    } catch (err) {
      setErreurSuppression(err.message);
      setEnSuppression(false);
    }
  }

  async function exporterPdf() {
    setEnExportPdf(true);
    setErreurExport("");
    try {
      const nom = fichier?.nom_original || "analyse";
      const base = nom.replace(/\.(xlsx|xls|csv|docx|doc)$/i, "");
      await telechargerFichier(
        `/fichiers/${fichierId}/export/pdf`,
        `${base}_analyse.pdf`
      );
    } catch (err) {
      setErreurExport(err.message);
    } finally {
      setEnExportPdf(false);
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
  const strategiques = recommandations.filter(
    (r) => typeof r === "object" && r?.categorie === "strategique"
  );
  const qualite = recommandations.filter(
    (r) => typeof r !== "object" || r?.categorie !== "strategique"
  );
  const insights = resultat.insights_ia;
  const resume = resultat.resume_statistique || {};

  const version = fichier?.version || 1;
  const ongletsAffiches = [...ONGLETS];
  if (version > 1) {
    const nbEcarts = comparaison?.diff ? nombreEcarts(comparaison.diff) : null;
    const position = ongletsAffiches.findIndex((o) => o.id === "journal");
    ongletsAffiches.splice(position < 0 ? ongletsAffiches.length : position, 0, {
      id: "evolution",
      libelle: "Évolution",
      pastille: nbEcarts || null,
    });
  }

  return (
    <DispositionApp actif="/fichiers">
      <Link to="/fichiers" className="lien-retour">
        ← Retour
      </Link>

      <div className="resultats-header">
        <div>
          <h1>
            {fichier?.nom_original || `Fichier #${fichierId}`}
            {version > 1 && <span className="version-chip">v{version}</span>}
          </h1>
          <div className="sous">
            Analyse terminée
            {fichier ? ` · ${(fichier.taille / 1024).toFixed(1)} Ko` : ""}
            {version > 1 ? ` · version ${version}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn-primaire-app"
            onClick={exporter}
            disabled={enExport}
          >
            {enExport ? "Export en cours…" : "⤓ Exporter .xlsx"}
          </button>
          <button
            className="btn-secondaire-app"
            onClick={exporterPdf}
            disabled={enExportPdf}
          >
            {enExportPdf ? "Génération…" : "⎙ Exporter PDF"}
          </button>
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
          <button
            className={`btn-secondaire-app btn-supprimer-entete${
              aConfirmerSuppression ? " confirmer" : ""
            }`}
            onClick={supprimerFichier}
            disabled={enSuppression}
            title="Supprimer ce fichier et son analyse"
          >
            {enSuppression
              ? "Suppression…"
              : aConfirmerSuppression
                ? "Confirmer la suppression"
                : "🗑 Supprimer"}
          </button>
        </div>
      </div>

      {!disponible && (
        <div className="alerte bandeau-absent" role="alert">
          Le fichier n'existe plus sur le serveur. Réimportez-le depuis
          «&nbsp;Importer&nbsp;» pour réactiver le dashboard et les analyses.
        </div>
      )}

      {erreurExport && (
        <div className="alerte" style={{ marginBottom: 16 }}>
          Export impossible : {erreurExport}
        </div>
      )}

      {erreurSuppression && (
        <div className="alerte" style={{ marginBottom: 16 }}>
          Suppression impossible : {erreurSuppression}
        </div>
      )}

      <div className="onglets-resultats">
        {ongletsAffiches.map((o) => (
          <button
            key={o.id}
            className={`onglet-resultats ${
              ongletActif === o.id ? "actif" : ""
            }`}
            onClick={() => setOngletActif(o.id)}
          >
            {o.libelle}
            {o.pastille != null && <span className="pastille-onglet">{o.pastille}</span>}
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
          <ResumeLisible resume={resume} fichier={fichier} fichierId={fichierId} />
        )}

        {ongletActif === "pivot" && (
          <section className="carte-resultat large">
            <h2>
              Vue pivôt <span className="badge">croisement</span>
            </h2>
            <VuePivot fichierId={fichierId} />
          </section>
        )}

        {ongletActif === "liste" && (
          <section className="carte-resultat large">
            <h2>
              Liste <span className="badge">recherche · tri · groupement</span>
            </h2>
            <VueListe fichierId={fichierId} />
          </section>
        )}

        {ongletActif === "marche" && <VueMarche fichierId={fichierId} />}

        {ongletActif === "journal" && (
          <section className="carte-resultat large">
            <h2>
              Journal d'activité <span className="badge">historique</span>
            </h2>
            <JournalFichier fichierId={fichierId} />
          </section>
        )}

        {ongletActif === "evolution" && (
          <VueEvolution
            comparaison={comparaison}
            erreurComparaison={erreurComparaison}
          />
        )}

        {ongletActif === "dashboard" && (
          <section className="carte-resultat large">
            <h2>
              Dashboard <span className="badge">interactif</span>
            </h2>
            <TableauDeBordFichier fichierId={fichierId} />
          </section>
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
                  const delaiItem = 0.3 + i * 0.1;
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
                      delai={delaiItem}
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
                    >
                      <DrillDownAnomalie anomalie={a} />
                    </AfficherDetaille>
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
                  const delaiItem = 0.3 + i * 0.1;
                  const sensLabel = (
                    <span className={`sens ${t.sens}`}>
                      {t.sens === "hausse"
                        ? "en hausse"
                        : t.sens === "baisse"
                          ? "en baisse"
                          : "stable"}{" "}
                      <span className="ico-sens">
                        {t.sens === "hausse" ? "↑" : t.sens === "baisse" ? "↓" : "→"}
                      </span>
                    </span>
                  );
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
                      delai={delaiItem}
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
                {strategiques.length > 0 && (
                  <div className="bloc-strategie">
                    <h3>
                      Où investir <span className="badge">lecture business</span>
                    </h3>
                    <p className="explication">
                      Classements calculés sur vos propres chiffres : quels
                      segments pèsent le plus, lesquels montent ou baissent.
                    </p>
                    {strategiques.map((r, i) => (
                      <AfficherDetaille
                        key={`s-${i}`}
                        index={i + 1}
                        delai={0.4 + i * 0.1}
                        titre={r.titre}
                        priorite={r.priorite}
                        detail={r.detail}
                        action={r.action}
                      >
                        {r.metrique && (
                          <ClassementSegments metrique={r.metrique} />
                        )}
                      </AfficherDetaille>
                    ))}
                  </div>
                )}
                {qualite.length > 0 && (
                  <div className="bloc-qualite">
                    <h3>
                      Fiabilité des données{" "}
                      <span className="badge">{qualite.length}</span>
                    </h3>
                    <p className="explication">
                      Conseils concrets tirés de l'analyse de votre fichier.
                    </p>
                    {qualite.map((r, i) =>
                      typeof r === "object" && r !== null ? (
                        <AfficherDetaille
                          key={`q-${i}`}
                          index={i + 1}
                          delai={0.5 + i * 0.1}
                          titre={r.titre}
                          priorite={r.priorite}
                          detail={r.detail}
                          action={r.action}
                        />
                      ) : (
                        <AfficherDetaille
                          key={`q-${i}`}
                          index={i + 1}
                          delai={0.5 + i * 0.1}
                          titre={String(r)}
                        />
                      )
                    )}
                  </div>
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
                {insights.split(/\s+/).map((mot, i) => (
                  <span
                    key={`${i}-${mot}`}
                    className="mot"
                    style={{ "--m": Math.min(i, 70) }}
                  >
                    {mot}
                  </span>
                ))}
              </div>
            ) : (
              <p className="vide">Pas de résumé disponible pour ce fichier.</p>
            )}

            <div className="blocs-insights">
              <AfficherDetaille
                delai={1.5}
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
                delai={1.6}
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
                delai={1.7}
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

const PALETTE_DASH = [
  "#c15f3c",
  "#a64e2a",
  "#da8c79",
  "#e3a99b",
  "#78716c",
  "#57534e",
  "#1d4ed8",
  "#15803d",
  "#b45309",
  "#6b21a8",
  "#0f766e",
  "#be123c",
];

function trancher(texte, n) {
  const t = String(texte);
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function arrondi(v) {
  return Math.round(v * 100) / 100;
}

function agregerLignes(lignes, colonneX, mesure, agregation, estDate) {
  const groupes = new Map();
  for (const ligne of lignes) {
    let cle = ligne[colonneX];
    if (cle === null || cle === undefined || cle === "") cle = "(vide)";
    else cle = String(cle);
    if (estDate && cle !== "(vide)") cle = cle.slice(0, 7);

    let g = groupes.get(cle);
    if (!g) {
      g = { cle, somme: 0, valeurs: [], n: 0 };
      groupes.set(cle, g);
    }
    g.n += 1;
    const brute = mesure ? ligne[mesure] : null;
    const v = brute === null || brute === undefined || brute === "" ? NaN : Number(brute);
    if (!Number.isNaN(v)) {
      g.somme += v;
      g.valeurs.push(v);
    }
  }

  const serie = [];
  for (const g of groupes.values()) {
    let valeur = g.n;
    if (agregation === "somme") valeur = g.somme;
    else if (agregation === "moyenne")
      valeur = g.valeurs.length ? g.somme / g.valeurs.length : 0;
    else if (agregation === "distinct")
      valeur = new Set(g.valeurs.map((v) => arrondi(v))).size;
    serie.push({ cle: g.cle, valeur, n: g.n });
  }
  serie.sort((a, b) => b.valeur - a.valeur);
  return serie.slice(0, 12);
}

function Compteur({ valeur }) {
  const [affiche, setAffiche] = useState(0);
  useEffect(() => {
    if (typeof valeur !== "number" || Number.isNaN(valeur)) {
      setAffiche(valeur);
      return undefined;
    }
    const doux = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (doux) {
      setAffiche(valeur);
      return undefined;
    }
    let brut = 0;
    const debut = performance.now();
    const duree = 1100;
    const pas = (t) => {
      const p = Math.min(1, (t - debut) / duree);
      const e = 1 - Math.pow(1 - p, 3);
      setAffiche(valeur * e);
      if (p < 1) brut = requestAnimationFrame(pas);
      else setAffiche(valeur);
    };
    brut = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(brut);
  }, [valeur]);
  if (valeur == null || Number.isNaN(valeur)) return <>{valeur == null ? "—" : valeur}</>;
  if (typeof valeur !== "number") return <>{valeur}</>;
  const entier = Number.isInteger(valeur);
  return <>{formaterNombre(entier ? Math.round(affiche) : arrondi(affiche))}</>;
}

function GraphiqueBarres({ series }) {
  const max = Math.max(...series.map((d) => Math.abs(d.valeur)), 1);
  return (
    <div className="barres-dash">
      {series.map((d, i) => (
        <div
          className={`barre-dash${i === 0 ? " premier" : ""}`}
          key={d.cle}
          style={{ "--delai": `${0.3 + i * 0.07}s` }}
        >
          <span className="etiq-barre" title={d.cle}>
            <span className="rang">{i + 1}</span>
            {trancher(d.cle, 26)}
          </span>
          <div className="piste-barre">
            <div
              className="remplissage-barre"
              style={{
                "--w": `${Math.max(1.5, (Math.abs(d.valeur) / max) * 100)}%`,
                "--c": PALETTE_DASH[i % PALETTE_DASH.length],
                animationDelay: `${0.3 + i * 0.07}s`,
              }}
            />
          </div>
          <span className="val-barre">{formaterNombre(arrondi(d.valeur))}</span>
        </div>
      ))}
    </div>
  );
}

function GraphiqueLigne({ series }) {
  const largeur = 720;
  const hauteur = 240;
  const marge = 34;
  const valeurs = series.map((d) => d.valeur);
  const min = Math.min(...valeurs, 0);
  const max = Math.max(...valeurs, 1);
  const amplitude = max - min || 1;
  const points = series.map((d, i) => {
    const x =
      marge +
      (i * (largeur - 2 * marge)) / Math.max(series.length - 1, 1);
    const y = hauteur - marge - ((d.valeur - min) / amplitude) * (hauteur - 2 * marge);
    return { ...d, x, y };
  });
  const chemin = points.map((p) => `${p.x},${p.y}`).join(" ");
  const trace = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`)
    .join(" ");
  const base = hauteur - marge;
  const aire = points.length
    ? `${trace} L ${points[points.length - 1].x},${base} L ${points[0].x},${base} Z`
    : "";
  const dernier = points[points.length - 1];
  return (
    <div className="ligne-dash">
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} className="svg-dash">
        <defs>
          <linearGradient id="gradAireDash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE_DASH[0]} stopOpacity="0.26" />
            <stop offset="100%" stopColor={PALETTE_DASH[0]} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            className="grille-dash"
            x1={marge}
            y1={marge + (base - marge) * f}
            x2={largeur - marge}
            y2={marge + (base - marge) * f}
          />
        ))}
        <line x1={marge} y1={base} x2={largeur - marge} y2={base} stroke="#e7e5e4" />
        <line x1={marge} y1={marge} x2={marge} y2={base} stroke="#e7e5e4" />
        <path className="aire-dash" d={aire} fill="url(#gradAireDash)" />
        <path
          className="trace-dash"
          d={trace}
          pathLength="1"
          fill="none"
          stroke={PALETTE_DASH[0]}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={p.cle}
            className="pt-dash"
            cx={p.x}
            cy={p.y}
            r="4.5"
            fill="#fff"
            stroke={PALETTE_DASH[0]}
            strokeWidth="2.4"
            style={{ animationDelay: `${1.15 + i * 0.12}s` }}
          >
            <title>{`${p.cle} : ${formaterNombre(arrondi(p.valeur))}`}</title>
          </circle>
        ))}
        {dernier && (
          <circle
            className="halo-dash"
            cx={dernier.x}
            cy={dernier.y}
            r="5"
            fill={PALETTE_DASH[0]}
            style={{ animationDelay: "2s" }}
          />
        )}
        {points.map((p) => (
          <text
            key={`t-${p.cle}`}
            x={p.x}
            y={base + 16}
            textAnchor="middle"
            fontSize="10"
            fill="#78716c"
          >
            {trancher(p.cle, 9)}
          </text>
        ))}
        <text x={marge - 6} y={marge + 4} textAnchor="end" fontSize="10" fill="#78716c">
          {formaterNombre(arrondi(max))}
        </text>
        <text x={marge - 6} y={base} textAnchor="end" fontSize="10" fill="#78716c">
          {formaterNombre(arrondi(min))}
        </text>
      </svg>
    </div>
  );
}

function GraphiqueDonut({ series }) {
  const total = series.reduce((s, d) => s + Math.abs(d.valeur), 0) || 1;
  const rayon = 70;
  const circonference = 2 * Math.PI * rayon;
  let cumul = 0;
  const segments = series.map((d, i) => {
    const fraction = Math.abs(d.valeur) / total;
    const segment = {
      ...d,
      couleur: PALETTE_DASH[i % PALETTE_DASH.length],
      longueur: fraction * circonference,
      decalage: cumul * circonference,
      part: fraction * 100,
    };
    cumul += fraction;
    return segment;
  });
  const [montre, setMontre] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMontre(true));
    return () => cancelAnimationFrame(id);
  }, [circonference]);
  return (
    <div className="donut-dash">
      <svg viewBox="0 0 200 200" width="230" height="230">
        <circle cx="100" cy="100" r={rayon} fill="none" stroke="#f5f5f4" strokeWidth="30" />
        {segments.map((s, i) => (
          <circle
            key={s.cle}
            className="seg-dash"
            cx="100"
            cy="100"
            r={rayon}
            fill="none"
            stroke={s.couleur}
            strokeWidth="30"
            strokeDasharray={
              montre
                ? `${s.longueur} ${circonference - s.longueur}`
                : `0 ${circonference}`
            }
            strokeDashoffset={-s.decalage}
            transform="rotate(-90 100 100)"
            style={{ transitionDelay: `${i * 0.12}s` }}
          >
            <title>{`${s.cle} : ${formaterNombre(arrondi(s.valeur))} (${arrondi(s.part)} %)`}</title>
          </circle>
        ))}
      </svg>
      <ul className="legende-dash">
        {segments.map((s, i) => (
          <li key={s.cle} style={{ animationDelay: `${0.5 + i * 0.1}s` }}>
            <span className="pastille" style={{ background: s.couleur }} />
            <span className="nom-legende" title={s.cle}>
              {trancher(s.cle, 24)}
            </span>
            <b>
              {formaterNombre(arrondi(s.valeur))} · {arrondi(s.part)} %
            </b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TableauDeBordFichier({ fichierId }) {
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [feuilleChoisie, setFeuilleChoisie] = useState("");
  const [colonneX, setColonneX] = useState("");
  const [mesure, setMesure] = useState("");
  const [agregation, setAgregation] = useState("somme");
  const [typeGraphique, setTypeGraphique] = useState("barres");

  useEffect(() => {
    let actif = true;
    setChargement(true);
    const params = feuilleChoisie
      ? `?feuille=${encodeURIComponent(feuilleChoisie)}`
      : "";
    appelerAPI(`/fichiers/${fichierId}/donnees${params}`)
      .then((res) => {
        if (!actif) return;
        setDonnees(res);
        setErreur("");
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
  }, [fichierId, feuilleChoisie]);

  if (chargement && !donnees)
    return (
      <div className="chargement">
        <div className="roue" />
        <p>Chargement des données…</p>
      </div>
    );

  if (erreur) return <p className="alerte">{erreur}</p>;
  if (!donnees) return null;

  const colonnes = donnees.colonnes || [];
  const numeriques = colonnes.filter((c) => c.type === "numerique");
  const groupables = colonnes.filter((c) => c.type !== "numerique");
  const axes = groupables.length ? groupables : colonnes;

  const colonneActive =
    colonneX && colonnes.some((c) => c.nom === colonneX)
      ? colonneX
      : axes[0]?.nom || "";
  const mesureActive =
    mesure && colonnes.some((c) => c.nom === mesure) && colonnes.find((c) => c.nom === mesure)?.type === "numerique"
      ? mesure
      : numeriques[0]?.nom || "";
  const agregationActive = mesureActive ? agregation : "comptage";
  const estDate =
    colonnes.find((c) => c.nom === colonneActive)?.type === "date";

  const series = colonneActive
    ? agregerLignes(
        donnees.lignes || [],
        colonneActive,
        mesureActive,
        agregationActive,
        estDate
      )
    : [];

  const valeursMesure = mesureActive
    ? (donnees.lignes || [])
        .map((l) => l[mesureActive])
        .filter((v) => v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v)))
        .map(Number)
    : [];
  const moyenne = valeursMesure.length
    ? valeursMesure.reduce((s, v) => s + v, 0) / valeursMesure.length
    : null;
  const min = valeursMesure.length ? Math.min(...valeursMesure) : null;
  const max = valeursMesure.length ? Math.max(...valeursMesure) : null;

  const libelleAgregation = {
    somme: "Somme",
    moyenne: "Moyenne",
    comptage: "Nombre de lignes",
    distinct: "Valeurs distinctes",
  }[agregationActive];

  return (
    <div className="dashboard-fichier">
      <div className="controles-dash">
        {donnees.feuilles?.length > 1 && (
          <div className="ctrl-dash">
            <label htmlFor="dash-feuille">Feuille</label>
            <select
              id="dash-feuille"
              value={donnees.feuille}
              onChange={(e) => {
                setFeuilleChoisie(e.target.value);
                setColonneX("");
                setMesure("");
              }}
            >
              {donnees.feuilles.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="ctrl-dash">
          <label htmlFor="dash-axe">Axe</label>
          <select
            id="dash-axe"
            value={colonneActive}
            onChange={(e) => setColonneX(e.target.value)}
          >
            {axes.map((c) => (
              <option key={c.nom} value={c.nom}>
                {c.nom}
                {c.type === "date" ? " (date)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="ctrl-dash">
          <label htmlFor="dash-mesure">Mesure</label>
          <select
            id="dash-mesure"
            value={mesureActive}
            onChange={(e) => setMesure(e.target.value)}
            disabled={numeriques.length === 0}
          >
            {numeriques.length === 0 && <option>Aucune colonne chiffrée</option>}
            {numeriques.map((c) => (
              <option key={c.nom} value={c.nom}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="ctrl-dash">
          <label htmlFor="dash-agg">Agrégation</label>
          <select
            id="dash-agg"
            value={agregationActive}
            onChange={(e) => setAgregation(e.target.value)}
            disabled={!mesureActive}
          >
            <option value="somme">Somme</option>
            <option value="moyenne">Moyenne</option>
            <option value="distinct">Valeurs distinctes</option>
            <option value="comptage">Nombre de lignes</option>
          </select>
        </div>

      </div>

      <div className="kpis-dash">
        <div className="kpi-dash">
          <div className="l">Lignes analysées</div>
          <div className="v"><Compteur valeur={donnees.nombre_lignes} /></div>
          <div className="mini">
            <i
              style={{
                "--w": `${Math.max(
                  4,
                  Math.min(
                    100,
                    (donnees.nombre_lignes / Math.max(donnees.nombre_lignes, 5000)) * 100
                  )
                )}%`,
              }}
            />
          </div>
        </div>
        <div className="kpi-dash">
          <div className="l">{mesureActive ? `Moyenne · ${mesureActive}` : "Mesure"}</div>
          <div className="v">
            {moyenne != null ? <Compteur valeur={arrondi(moyenne)} /> : "—"}
          </div>
          <div className="mini">
            <i
              style={{
                "--w": `${
                  moyenne != null && max != null && min != null && max !== min
                    ? Math.max(4, ((moyenne - min) / (max - min)) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
        <div className="kpi-dash">
          <div className="l">Minimum</div>
          <div className="v">{min != null ? <Compteur valeur={arrondi(min)} /> : "—"}</div>
          <div className="mini"><i style={{ "--w": min != null ? "4%" : "0%" }} /></div>
        </div>
        <div className="kpi-dash">
          <div className="l">Maximum</div>
          <div className="v">{max != null ? <Compteur valeur={arrondi(max)} /> : "—"}</div>
          <div className="mini"><i style={{ "--w": max != null ? "100%" : "0%" }} /></div>
        </div>
      </div>

      <p className="explication-dash">
        {libelleAgregation}
        {mesureActive ? ` de « ${mesureActive} »` : ""}
        {colonneActive ? ` par « ${colonneActive} »` : ""}
        {estDate ? " (regroupé par mois)" : ""} — {series.length} groupe(s) affiché(s).
      </p>

      <div className="bascule-dash" role="group" aria-label="Type de graphique">
        {[
          { id: "barres", icone: "▦", libelle: "Barres" },
          { id: "ligne", icone: "⌁", libelle: "Ligne" },
          { id: "donut", icone: "◍", libelle: "Camembert" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={typeGraphique === t.id ? "on" : ""}
            aria-pressed={typeGraphique === t.id}
            onClick={() => setTypeGraphique(t.id)}
          >
            <span aria-hidden="true">{t.icone}</span> {t.libelle}
          </button>
        ))}
      </div>

      <div
        className="zone-graphique"
        key={`${typeGraphique}-${colonneActive}-${mesureActive}-${agregationActive}`}
      >
        {chargement && (
          <div className="skeleton-dash">
            <span>⏳ Chargement des données…</span>
          </div>
        )}
        {series.length === 0 ? (
          <p className="vide">Aucune donnée à afficher pour cette sélection.</p>
        ) : typeGraphique === "barres" ? (
          <GraphiqueBarres series={series} />
        ) : typeGraphique === "ligne" ? (
          <GraphiqueLigne series={[...series].reverse()} />
        ) : (
          <GraphiqueDonut series={series} />
        )}

        {series.length > 0 && (
          <div className="scroll-tableau" style={{ marginTop: 18 }}>
            <table className="tableau-stats">
              <thead>
                <tr>
                  <th>{colonneActive}</th>
                  <th>{libelleAgregation}</th>
                  <th>Part</th>
                  <th>Lignes</th>
                </tr>
              </thead>
              <tbody>
                {series.map((d, i) => {
                  const total = series.reduce((s, x) => s + Math.abs(x.valeur), 0) || 1;
                  return (
                    <tr
                      key={d.cle}
                      className="ligne-animee"
                      style={{ animationDelay: `${0.35 + Math.min(i, 11) * 0.055}s` }}
                    >
                      <td>{d.cle}</td>
                      <td className="val">{formaterNombre(arrondi(d.valeur))}</td>
                      <td className="val">{arrondi((Math.abs(d.valeur) / total) * 100)} %</td>
                      <td className="val">{formaterNombre(d.n)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {donnees.tronque && (
        <p className="note-drilldown">
          Aperçu limité aux 2 000 premières lignes du fichier pour rester réactif.
        </p>
      )}
    </div>
  );
}


async function chargerDonneesFichier(fichierId, feuille) {
  const params = new URLSearchParams({ limite: "5000" });
  if (feuille) params.set("feuille", feuille);
  return appelerAPI(`/fichiers/${fichierId}/donnees?${params}`);
}

function celluleVide(v) {
  return v === null || v === undefined || v === "";
}

function TableauDeLignes({ lignes, colonnes }) {
  if (!lignes.length) return <p className="vide">Aucune ligne correspondante.</p>;
  const vues = lignes.slice(0, 100);
  return (
    <div className="scroll-tableau">
      <table className="tableau-stats">
        <thead>
          <tr>
            <th>Ligne</th>
            {colonnes.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vues.map((l, i) => (
            <tr
              key={`${l.ligne}-${i}`}
              className="ligne-animee"
              style={{ "--delai": `${0.15 + Math.min(i, 14) * 0.05}s` }}
            >
              <td className="val">{l.ligne}</td>
              {colonnes.map((c) => (
                <td key={c} className={`val ${celluleVide(l[c]) ? "hors-bornes" : ""}`}>
                  {formatCellule(l[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DrillDownManquante({ fichierId, cle, attendues }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, setEtat] = useState(null);

  const basculer = async () => {
    if (ouvert) {
      setOuvert(false);
      return;
    }
    setOuvert(true);
    if (etat) return;

    setEtat({ enCours: true });
    try {
      let donnees = await chargerDonneesFichier(fichierId);
      const feuilles = [...(donnees.feuilles || [])].sort((a, b) => b.length - a.length);
      const feuille = feuilles.find((f) => cle.startsWith(`${f}.`));
      const colonne = feuille ? cle.slice(feuille.length + 1) : cle;
      if (feuille && feuille !== donnees.feuille) {
        donnees = await chargerDonneesFichier(fichierId, feuille);
      }
      const nomsColonnes = (donnees.colonnes || []).map((c) => c.nom);
      const lignes = (donnees.lignes || [])
        .map((l, i) => ({ ligne: i + 2, ...l }))
        .filter((l) => celluleVide(l[colonne]));
      setEtat({
        enCours: false,
        erreur: "",
        lignes,
        colonnes: nomsColonnes,
        attendues,
        tronque: donnees.tronque,
      });
    } catch (err) {
      setEtat({ enCours: false, erreur: err.message, lignes: [], colonnes: [] });
    }
  };

  return (
    <div className="drilldown">
      <button type="button" className="btn-drilldown" onClick={basculer}>
        {ouvert ? "▾ Masquer les lignes" : "▸ Voir les lignes concernées"}
        {!ouvert && attendues ? ` (${attendues})` : ""}
      </button>

      {ouvert && (
        <>
          {etat?.enCours && <p className="note-drilldown">Chargement des lignes…</p>}
          {etat?.erreur && <p className="alerte">{etat.erreur}</p>}
          {!etat?.enCours && !etat?.erreur && (
            <>
              <TableauDeLignes lignes={etat.lignes} colonnes={etat.colonnes} />
              <p className="note-drilldown">
                {etat.tronque || (attendues && etat.lignes.length < attendues)
                  ? `${etat.lignes.length} des ${attendues ?? "?"} ligne(s) vides affichées — aperçu limité aux 5 000 premières lignes du fichier.`
                  : `Les ${etat.lignes.length} ligne(s) concernées sont toutes affichées — la ligne indique la position dans le fichier.`}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

function DrillDownDoublons({ fichierId }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, setEtat] = useState(null);

  const basculer = async () => {
    if (ouvert) {
      setOuvert(false);
      return;
    }
    setOuvert(true);
    if (etat) return;

    setEtat({ enCours: true });
    try {
      const donnees = await chargerDonneesFichier(fichierId);
      const colonnes = (donnees.colonnes || []).map((c) => c.nom);
      const groupes = new Map();
      (donnees.lignes || []).forEach((l, i) => {
        const cle = JSON.stringify(colonnes.map((c) => l[c] ?? null));
        if (!groupes.has(cle)) groupes.set(cle, []);
        groupes.get(cle).push({ ligne: i + 2, ...l });
      });
      const series = [...groupes.values()]
        .filter((g) => g.length > 1)
        .sort((a, b) => b.length - a.length)
        .slice(0, 8);
      setEtat({
        enCours: false,
        erreur: "",
        series,
        colonnes,
        tronque: donnees.tronque,
      });
    } catch (err) {
      setEtat({ enCours: false, erreur: err.message, series: [], colonnes: [] });
    }
  };

  return (
    <div className="drilldown">
      <button type="button" className="btn-drilldown" onClick={basculer}>
        {ouvert ? "▾ Masquer les groupes" : "▸ Voir les groupes de doublons"}
      </button>

      {ouvert && (
        <>
          {etat?.enCours && <p className="note-drilldown">Chargement des lignes…</p>}
          {etat?.erreur && <p className="alerte">{etat.erreur}</p>}
          {!etat?.enCours && !etat?.erreur && (
            <>
              {etat.series.length === 0 ? (
                <p className="vide">Aucun doublon trouvé dans cet aperçu.</p>
              ) : (
                etat.series.map((g, i) => (
                  <div className="groupe-doublon" key={i}>
                    <h4>
                      Groupe {i + 1} — {g.length} lignes :{" "}
                      {g.map((l) => l.ligne).join(", ")}
                    </h4>
                    <TableauDeLignes lignes={g} colonnes={etat.colonnes} />
                  </div>
                ))
              )}
              <p className="note-drilldown">
                {etat.tronque
                  ? "Aperçu limité aux 5 000 premières lignes : des doublons peuvent exister au-delà."
                  : "Groupes de lignes strictement identiques, du plus fréquent au moins fréquent."}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}



const LIBELLES_AGGREGATION = {
  somme: "Somme",
  moyenne: "Moyenne",
  comptage: "Nombre de lignes",
  distinct: "Valeurs distinctes",
};

const NB_COLONNES_PIVOT = 12;
const NB_LIGNES_PIVOT = 40;
const SEPAR_PIVOT = "||";

function clePivot(v, estDate) {
  if (v === null || v === undefined || v === "") return "(vide)";
  const t = String(v);
  if (estDate && /^\d{4}-\d{2}/.test(t)) return t.slice(0, 7);
  return t;
}

function construirePivot(
  lignes,
  colLigne,
  colPivot,
  mesure,
  agregation,
  dateL,
  dateC
) {
  const cellules = new Map();
  const totauxL = new Map();
  const totauxC = new Map();
  const vide = () => ({ somme: 0, n: 0, valeurs: [] });

  const accum = (acc, ligne) => {
    acc.n += 1;
    const brute = mesure ? ligne[mesure] : null;
    const v =
      brute === null || brute === undefined || brute === ""
        ? NaN
        : Number(brute);
    if (!Number.isNaN(v)) {
      acc.somme += v;
      acc.valeurs.push(v);
    }
  };

  const valeurDe = (acc) => {
    if (!acc) return 0;
    if (agregation === "comptage") return acc.n;
    if (agregation === "moyenne")
      return acc.valeurs.length ? acc.somme / acc.valeurs.length : 0;
    if (agregation === "distinct") return new Set(acc.valeurs.map(arrondi)).size;
    return acc.somme;
  };

  for (const ligne of lignes) {
    const cl = clePivot(ligne[colLigne], dateL);
    const cc = clePivot(ligne[colPivot], dateC);
    const cle = `${cl}${SEPAR_PIVOT}${cc}`;
    if (!cellules.has(cle)) cellules.set(cle, vide());
    accum(cellules.get(cle), ligne);
    if (!totauxL.has(cl)) totauxL.set(cl, vide());
    accum(totauxL.get(cl), ligne);
    if (!totauxC.has(cc)) totauxC.set(cc, vide());
    accum(totauxC.get(cc), ligne);
  }

  const trier = (map) =>
    [...map.entries()].sort((a, b) => valeurDe(b[1]) - valeurDe(a[1]));
  const colonnesPivot = trier(totauxC).slice(0, NB_COLONNES_PIVOT).map(([c]) => c);
  const lignesPivot = trier(totauxL).slice(0, NB_LIGNES_PIVOT).map(([l]) => l);

  let max = 0;
  for (const l of lignesPivot)
    for (const c of colonnesPivot)
      max = Math.max(
        max,
        Math.abs(valeurDe(cellules.get(`${l}${SEPAR_PIVOT}${c}`)))
      );

  const totaux = [...totauxC.values()];

  return {
    colonnes: colonnesPivot,
    lignes: lignesPivot,
    cellules,
    totauxL,
    totauxC,
    valeurDe,
    max,
    totalGeneral: valeurDe({
      somme: totaux.reduce((s, a) => s + a.somme, 0),
      n: totaux.reduce((s, a) => s + a.n, 0),
      valeurs: totaux.flatMap((a) => a.valeurs),
    }),
    nombreColonnes: totauxC.size,
    nombreLignes: totauxL.size,
  };
}

function VuePivot({ fichierId }) {
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [colLigne, setColLigne] = useState("");
  const [colPivot, setColPivot] = useState("");
  const [mesure, setMesure] = useState("");
  const [agregation, setAgregation] = useState("somme");
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    appelerAPI(`/fichiers/${fichierId}/donnees?limite=5000`)
      .then((res) => {
        if (!actif) return;
        setDonnees(res);
        setErreur("");
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
  }, [fichierId]);

  if (chargement && !donnees)
    return (
      <div className="chargement">
        <div className="roue" />
        <p>Chargement des données…</p>
      </div>
    );
  if (erreur) return <p className="alerte">{erreur}</p>;
  if (!donnees) return null;

  const colonnes = donnees.colonnes || [];
  const groupables = colonnes.filter((c) => c.type !== "numerique");
  const axes = groupables.length ? groupables : colonnes;
  const numeriques = colonnes.filter((c) => c.type === "numerique");
  const nomValide = (n) => Boolean(n) && colonnes.some((c) => c.nom === n);

  const y = nomValide(colLigne) ? colLigne : axes[0]?.nom || "";
  const optionsPivot = axes.filter((c) => c.nom !== y);
  const x =
    nomValide(colPivot) && colPivot !== y
      ? colPivot
      : optionsPivot[0]?.nom || y;
  const m =
    nomValide(mesure) &&
    colonnes.find((c) => c.nom === mesure)?.type === "numerique"
      ? mesure
      : numeriques[0]?.nom || "";
  const agg = m ? agregation : "comptage";

  const estDate = (n) => colonnes.find((c) => c.nom === n)?.type === "date";
  const pivot = construirePivot(
    donnees.lignes || [],
    y,
    x,
    m,
    agg,
    estDate(y),
    estDate(x)
  );

  const basculerDetail = (cleL, cleC) => {
    if (detail && detail.l === cleL && detail.c === cleC) {
      setDetail(null);
      return;
    }
    const lignes = (donnees.lignes || [])
      .map((l, i) => ({ ligne: i + 2, ...l }))
      .filter(
        (l) =>
          clePivot(l[y], estDate(y)) === cleL &&
          clePivot(l[x], estDate(x)) === cleC
      );
    setDetail({ l: cleL, c: cleC, lignes, noms: colonnes.map((c) => c.nom) });
  };

  const libelleAgg = LIBELLES_AGGREGATION[agg] || "Valeur";
  const styleCellule = (valeur) => {
    const pct = pivot.max > 0 ? (Math.abs(valeur) / pivot.max) * 100 : 0;
    return {
      backgroundImage: `linear-gradient(90deg, rgba(193, 95, 60, 0.22) ${pct}%, transparent ${pct}%)`,
    };
  };

  return (
    <div className="vue-pivot">
      <div className="controles-dash">
        <div className="ctrl-dash">
          <label htmlFor="pivot-lignes">Lignes</label>
          <select
            id="pivot-lignes"
            value={y}
            onChange={(e) => {
              setColLigne(e.target.value);
              setDetail(null);
              if (e.target.value === colPivot) setColPivot("");
            }}
          >
            {axes.map((c) => (
              <option key={c.nom} value={c.nom}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="ctrl-dash">
          <label htmlFor="pivot-colonnes">Colonnes</label>
          <select
            id="pivot-colonnes"
            value={x}
            onChange={(e) => {
              setColPivot(e.target.value);
              setDetail(null);
            }}
          >
            {axes
              .filter((c) => c.nom !== y)
              .map((c) => (
                <option key={c.nom} value={c.nom}>
                  {c.nom}
                </option>
              ))}
          </select>
        </div>

        <div className="ctrl-dash">
          <label htmlFor="pivot-mesure">Valeur</label>
          <select
            id="pivot-mesure"
            value={m}
            onChange={(e) => setMesure(e.target.value)}
            disabled={numeriques.length === 0}
          >
            {numeriques.length === 0 && <option>Aucune colonne chiffrée</option>}
            {numeriques.map((c) => (
              <option key={c.nom} value={c.nom}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="ctrl-dash">
          <label htmlFor="pivot-agg">Agrégation</label>
          <select
            id="pivot-agg"
            value={agg}
            onChange={(e) => setAgregation(e.target.value)}
            disabled={!m}
          >
            <option value="somme">Somme</option>
            <option value="moyenne">Moyenne</option>
            <option value="distinct">Valeurs distinctes</option>
            <option value="comptage">Nombre de lignes</option>
          </select>
        </div>
      </div>

      <p className="explication-dash">
        {libelleAgg}
        {m ? ` de « ${m} »` : ""} — {y} × {x} · {pivot.lignes.length} ligne(s) ×{" "}
        {pivot.colonnes.length} colonne(s)
        {pivot.nombreLignes > pivot.lignes.length ||
        pivot.nombreColonnes > pivot.colonnes.length
          ? ` (top affichés, ${pivot.nombreLignes} × ${pivot.nombreColonnes} au total)`
          : ""}
        . Cliquez une cellule pour voir les lignes source.
      </p>

      <div className="scroll-tableau" key={`${y}|${x}|${m}|${agg}`}>
        <table className="tableau-pivot">
          <thead>
            <tr>
              <th className="coin">
                {y} ↓ / {x} →
              </th>
              {pivot.colonnes.map((c) => (
                <th key={c} title={c}>
                  {trancher(c, 16)}
                </th>
              ))}
              <th className="total">Total</th>
            </tr>
          </thead>
          <tbody>
            {pivot.lignes.map((l, ri) => (
              <tr key={l}>
                <th className="entete-ligne" title={l}>
                  {trancher(l, 24)}
                </th>
                {pivot.colonnes.map((c, ci) => {
                  const cle = `${l}${SEPAR_PIVOT}${c}`;
                  const acc = pivot.cellules.get(cle);
                  if (!acc)
                    return (
                      <td key={c} className="cellule-vide">
                        —
                      </td>
                    );
                  const v = pivot.valeurDe(acc);
                  const actif = detail && detail.l === l && detail.c === c;
                  return (
                    <td key={c} className={actif ? "cellule-active" : undefined}>
                      <button
                        type="button"
                        className="cellule-pivot"
                        style={{
                          ...styleCellule(v),
                          "--delai": `${0.35 + (ri + ci) * 0.06}s`,
                        }}
                        onClick={() => basculerDetail(l, c)}
                        title={`${libelleAgg} : ${formaterNombre(arrondi(v))}`}
                      >
                        {formaterNombre(arrondi(v))}
                      </button>
                    </td>
                  );
                })}
                <td className="total">
                  {formaterNombre(arrondi(pivot.valeurDe(pivot.totauxL.get(l))))}
                </td>
              </tr>
            ))}
            <tr className="ligne-total">
              <th>Total</th>
              {pivot.colonnes.map((c) => (
                <td key={c}>
                  {formaterNombre(arrondi(pivot.valeurDe(pivot.totauxC.get(c))))}
                </td>
              ))}
              <td className="total">
                {formaterNombre(arrondi(pivot.totalGeneral))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="drilldown pivot-detail">
          <p className="note-drilldown">
            <strong>
              {detail.l} × {detail.c}
            </strong>{" "}
            — {detail.lignes.length} ligne(s) source(s) :
          </p>
          <TableauDeLignes lignes={detail.lignes} colonnes={detail.noms} />
        </div>
      )}

      {donnees.tronque && (
        <p className="note-drilldown">
          Aperçu limité aux 5 000 premières lignes du fichier.
        </p>
      )}
    </div>
  );
}


const PAR_PAGE = 50;

function VueListe({ fichierId }) {
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState({ colonne: "", sens: 1 });
  const [groupage, setGroupage] = useState("");
  const [selection, setSelection] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const [groupesOuverts, setGroupesOuverts] = useState(() => new Set());

  useEffect(() => {
    let actif = true;
    setChargement(true);
    appelerAPI(`/fichiers/${fichierId}/donnees?limite=5000`)
      .then((res) => {
        if (!actif) return;
        setDonnees(res);
        setErreur("");
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
  }, [fichierId]);

  if (chargement && !donnees)
    return (
      <div className="squelette-liste" aria-hidden="true">
        <div className="sq tete" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
          <div key={n} className={`sq w${(n % 5) + 1}`} />
        ))}
      </div>
    );
  if (erreur) return <p className="alerte">{erreur}</p>;
  if (!donnees) return null;

  const colonnes = donnees.colonnes || [];
  const noms = colonnes.map((c) => c.nom);
  const brut = (donnees.lignes || []).map((l, i) => ({ ...l, _i: i, _ligne: i + 2 }));

  const q = recherche.trim().toLowerCase();
  const filtres = q
    ? brut.filter((l) =>
        noms.some((n) => String(l[n] ?? "").toLowerCase().includes(q))
      )
    : brut;

  let triees = filtres;
  if (tri.colonne) {
    const col = tri.colonne;
    const type = colonnes.find((c) => c.nom === col)?.type;
    triees = [...filtres].sort((a, b) => {
      const va = a[col];
      const vb = b[col];
      let r;
      if (type === "numerique") r = (Number(va) || 0) - (Number(vb) || 0);
      else r = String(va ?? "").localeCompare(String(vb ?? ""), "fr");
      return r * tri.sens;
    });
  }

  const basculerTri = (col) => {
    setPage(0);
    setTri((t) =>
      t.colonne === col ? { colonne: col, sens: -t.sens } : { colonne: col, sens: 1 }
    );
  };
  const basculerSelection = (i) =>
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  const cocherTout = () =>
    setSelection((s) =>
      s.size === triees.length ? new Set() : new Set(triees.map((l) => l._i))
    );

  const pages = Math.max(1, Math.ceil(triees.length / PAR_PAGE));
  const pageSure = Math.min(page, pages - 1);
  const visibles = triees.slice(pageSure * PAR_PAGE, (pageSure + 1) * PAR_PAGE);

  let groupes = [];
  if (groupage) {
    const map = new Map();
    for (const l of triees) {
      const v = l[groupage];
      const cle =
        v === null || v === undefined || v === "" ? "(vide)" : String(v);
      if (!map.has(cle)) map.set(cle, []);
      map.get(cle).push(l);
    }
    groupes = [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }

  const tableau = (lignesTableau) => (
    <div className="scroll-tableau">
      <table className="tableau-stats tableau-liste">
        <thead>
          <tr>
            <th className="col-check">
              <input
                type="checkbox"
                aria-label="Tout sélectionner"
                checked={triees.length > 0 && selection.size === triees.length}
                onChange={cocherTout}
              />
            </th>
            {noms.map((n) => (
              <th
                key={n}
                className={`tri-colonne${tri.colonne === n ? " tri-actif" : ""}`}
                onClick={() => basculerTri(n)}
                title="Cliquer pour trier"
              >
                {n} {tri.colonne === n ? (tri.sens === 1 ? "▲" : "▼") : "↕"}
              </th>
            ))}
            <th>Ligne</th>
          </tr>
        </thead>
        <tbody>
          {lignesTableau.map((l, idx) => (
            <tr
              key={l._i}
              className={`ligne-animee${
                selection.has(l._i) ? " ligne-selectionnee" : ""
              }`}
              style={{ "--delai": `${0.3 + Math.min(idx, 11) * 0.05}s` }}
            >
              <td className="col-check">
                <input
                  type="checkbox"
                  checked={selection.has(l._i)}
                  onChange={() => basculerSelection(l._i)}
                  aria-label={`Sélectionner la ligne ${l._ligne}`}
                />
              </td>
              {noms.map((n) => (
                <td key={n} className="val">
                  {formatCellule(l[n])}
                </td>
              ))}
              <td className="val num-ligne">{l._ligne}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const basculerGroupe = (cle) =>
    setGroupesOuverts((s) => {
      const n = new Set(s);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });

  return (
    <div className="vue-liste">
      <div className="controles-dash">
        <div className="ctrl-dash">
          <label htmlFor="liste-recherche">Recherche</label>
          <input
            id="liste-recherche"
            type="search"
            placeholder="Rechercher dans toutes les colonnes…"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="ctrl-dash">
          <label htmlFor="liste-groupage">Grouper par</label>
          <select
            id="liste-groupage"
            value={groupage}
            onChange={(e) => {
              setGroupage(e.target.value);
              setPage(0);
              setSelection(new Set());
            }}
          >
            <option value="">Aucun groupement</option>
            {noms.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="ctrl-dash">
          <label>Sélection</label>
          <div className="compteurs-liste">
            <b>{formaterNombre(triees.length)}</b> ligne(s)
            {selection.size > 0 && (
              <>
                {" "}
                · <b>{formaterNombre(selection.size)}</b> sélectionnée(s)
              </>
            )}
            {donnees.tronque && " · aperçu 5 000"}
          </div>
        </div>
      </div>

      {triees.length === 0 ? (
        <p className="vide">Aucune ligne ne correspond à la recherche.</p>
      ) : groupage ? (
        <div className="groupes-liste">
          {groupes.map(([cle, membres]) => {
            const ouvert = groupesOuverts.has(cle);
            return (
              <div className="groupe-liste" key={cle}>
                <button
                  type="button"
                  className="entete-groupe"
                  onClick={() => basculerGroupe(cle)}
                >
                  <span className="fleche">{ouvert ? "▾" : "▸"}</span>
                  <span className="cle" title={cle}>
                    {trancher(cle, 40)}
                  </span>
                  <span className="compte">{membres.length} ligne(s)</span>
                </button>
                {ouvert && tableau(membres.slice(0, PAR_PAGE))}
                {ouvert && membres.length > PAR_PAGE && (
                  <p className="note-drilldown">
                    {PAR_PAGE} ligne(s) affichées sur {membres.length} dans ce
                    groupe.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {tableau(visibles)}
          {pages > 1 && (
            <div className="pagination-liste">
              <button
                type="button"
                className="btn-secondaire-app"
                disabled={pageSure === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ← Précédent
              </button>
              <span>
                Page {pageSure + 1} / {pages}
              </span>
              <button
                type="button"
                className="btn-secondaire-app"
                disabled={pageSure >= pages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function JournalFichier({ fichierId }) {
  const [entrees, setEntrees] = useState(null);
  const [erreur, setErreur] = useState("");
  const [enChargement, setEnChargement] = useState(false);
  const [version, setVersion] = useState(0);

  const charger = useCallback(async () => {
    setEnChargement(true);
    try {
      const res = await appelerAPI(`/fichiers/${fichierId}/journal`);
      setEntrees(res);
      setErreur("");
      setVersion((v) => v + 1);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnChargement(false);
    }
  }, [fichierId]);

  useEffect(() => {
    charger();
  }, [charger]);

  if (erreur) return <p className="alerte">{erreur}</p>;
  if (!entrees)
    return (
      <div className="chargement">
        <div className="roue" />
        <p>Chargement du journal…</p>
      </div>
    );

  return (
    <div className="journal-fichier">
      <div className="entete-journal">
        <p className="explication">
          Historique horodaté des actions réalisées sur ce fichier.
        </p>
        <button
          type="button"
          className="btn-secondaire-app"
          onClick={charger}
          disabled={enChargement}
        >
          {enChargement ? "Actualisation…" : "↻ Actualiser"}
        </button>
      </div>

      {entrees.length === 0 ? (
        <p className="vide">Aucune activité enregistrée pour ce fichier.</p>
      ) : (
        <ul className="liste-journal" key={version}>
          {entrees.map((e, i) => (
            <li key={e.id} style={{ "--delai": `${0.35 + i * 0.08}s` }}>
              <span className="pastille-journal" />
              <span className="action">
                {LIBELLES_JOURNAL[e.action] || e.action}
              </span>
              {e.details && <span className="details">{e.details}</span>}
              <span className="date">
                {new Date(e.cree_le).toLocaleString("fr-FR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


function formatCourt(valeur) {
  if (!valeur) return "—";
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function dateHeure(valeur) {
  if (!valeur) return "—";
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function libelleSens(sens) {
  if (sens === "hausse") return "en hausse";
  if (sens === "baisse") return "en baisse";
  return "stable";
}

function flecheSens(sens) {
  if (sens === "hausse") return "↗";
  if (sens === "baisse") return "↘";
  return "→";
}

function cartesEvolution(volume, colonnes) {
  const cartes = [];
  const ajouter = (label, avant, apres, hausseMauvaise, note) => {
    if (avant == null || apres == null || avant === apres) return;
    const delta = apres - avant;
    let ton = "neutre";
    if (delta !== 0 && hausseMauvaise != null) {
      ton = delta > 0 ? (hausseMauvaise ? "pire" : "mieux") : hausseMauvaise ? "mieux" : "pire";
    }
    cartes.push({
      label,
      avant,
      apres,
      ton,
      note,
      deltaLabel: `${delta > 0 ? "+" : "\u2212"}${formaterNombre(Math.abs(delta))}`,
    });
  };

  ajouter("Lignes", volume.lignes_avant, volume.lignes_apres, null, "volume de données");
  ajouter(
    "Paragraphes",
    volume.paragraphes_avant,
    volume.paragraphes_apres,
    null,
    "longueur du document"
  );
  ajouter(
    "Valeurs manquantes",
    volume.manquantes_avant?.total,
    volume.manquantes_apres?.total,
    true,
    volume.manquantes_apres?.colonnes
      ? `${formaterNombre(volume.manquantes_apres.colonnes)} colonne(s) concernée(s)`
      : "cellules vides"
  );
  ajouter(
    "Doublons",
    volume.doublons_avant?.lignes_concernees,
    volume.doublons_apres?.lignes_concernees,
    true,
    "lignes strictement identiques"
  );

  const ajoutees = colonnes?.ajoutees || [];
  const retirees = colonnes?.retirees || [];
  if (ajoutees.length || retirees.length) {
    cartes.push({
      label: "Colonnes",
      avant: null,
      apres: ajoutees.length
        ? `+${formaterNombre(ajoutees.length)}`
        : `\u2212${formaterNombre(retirees.length)}`,
      ton: "neutre",
      sansAvant: true,
      deltaLabel: ajoutees.length
        ? `ajoutées : ${ajoutees.join(", ")}`
        : `retirées : ${retirees.join(", ")}`,
      note: retirees.length
        ? `aussi retirée(s) : ${retirees.join(", ")}`
        : "aucune colonne retirée",
    });
  }
  return cartes;
}

function nombreEcarts(diff) {
  const a = diff.anomalies || {};
  return (
    (a.nouvelles || []).length +
    (a.resolues || []).length +
    (a.aggravees || []).length +
    (diff.tendances || []).length +
    ((diff.colonnes || {}).ajoutees || []).length +
    ((diff.colonnes || {}).retirees || []).length
  );
}

function contientDesEcarts(diff) {
  const vol = diff.volume || {};
  return (
    nombreEcarts(diff) > 0 ||
    (diff.statistiques || []).length > 0 ||
    (vol.lignes_avant ?? null) !== (vol.lignes_apres ?? null) ||
    (vol.manquantes_avant?.total ?? null) !== (vol.manquantes_apres?.total ?? null) ||
    (vol.doublons_avant?.lignes_concernees ?? null) !==
      (vol.doublons_apres?.lignes_concernees ?? null)
  );
}

function resumeEvolution(diff, cartes) {
  const morceaux = [];
  const vol = diff.volume || {};
  const colonnes = diff.colonnes || {};
  const anomalies = diff.anomalies || {};

  if (colonnes.ajoutees?.length) {
    morceaux.push(
      <span key="col">
        une nouvelle colonne <strong>« {colonnes.ajoutees.join(", ")} »</strong>
      </span>
    );
  }
  const dm = (vol.manquantes_avant?.total ?? 0) - (vol.manquantes_apres?.total ?? 0);
  if (dm > 0) {
    morceaux.push(<span key="manq">{formaterNombre(dm)} valeurs manquantes en plus</span>);
  } else if (dm < 0) {
    morceaux.push(
      <span key="manq">{formaterNombre(Math.abs(dm))} valeurs manquantes en moins</span>
    );
  }
  const nbNouvelles = (anomalies.nouvelles || []).length;
  const nbAggravees = (anomalies.aggravees || []).length;
  const total = nbNouvelles + nbAggravees;
  if (total) {
    morceaux.push(
      <span key="anom">
        {formaterNombre(total)} anomalie{total > 1 ? "s" : ""} à traiter
      </span>
    );
  }
  const lignesCarte = cartes.find((c) => c.label === "Lignes");
  if (lignesCarte) {
    morceaux.push(
      <span key="lignes">
        volume {formaterNombre(lignesCarte.avant)} → {formaterNombre(lignesCarte.apres)} lignes
      </span>
    );
  }
  return morceaux;
}

function resumePhrase(morceaux, i) {
  if (i === 0) return null;
  if (i === morceaux.length - 1) return " et ";
  return ", ";
}

function VueEvolution({ comparaison, erreurComparaison }) {
  if (erreurComparaison) {
    return (
      <section className="carte-resultat large">
        <h2>Évolution</h2>
        <p className="vide">{erreurComparaison}</p>
      </section>
    );
  }
  if (!comparaison) {
    return (
      <section className="carte-resultat large">
        <h2>Évolution</h2>
        <div className="squelette-liste" aria-hidden="true">
          <div className="sq tete" />
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n} className={`sq w${n + 1}`} />
          ))}
        </div>
      </section>
    );
  }

  const { precedent, courant, diff } = comparaison;
  const cartes = cartesEvolution(diff.volume || {}, diff.colonnes || {});
  const anomalies = diff.anomalies || {};
  const tendances = diff.tendances || [];
  const stats = diff.statistiques || [];
  const morceaux = resumeEvolution(diff, cartes);

  const entreesAnomalies = [
    ...(anomalies.nouvelles || []).map((a) => ({ ...a, ton: "nouvelle" })),
    ...(anomalies.aggravees || []).map((a) => ({ ...a, ton: "aggravee" })),
    ...(anomalies.resolues || []).map((a) => ({ ...a, ton: "resolue" })),
  ];

  const bandeau = (
    <section className="carte-resultat large bandeau-evolution">
      <div className="fiches-version">
        <span className="fiche-version ancien">
          v{precedent.version} · {formatCourt(precedent.cree_le)}
        </span>
        <span className="fleche-version">→</span>
        <span className="fiche-version nouveau">
          v{courant.version} · {formatCourt(courant.cree_le)}
        </span>
      </div>
      <span className="note-version">
        Importé le {dateHeure(courant.cree_le)} — comparaison automatique avec la version du{" "}
        {dateHeure(precedent.cree_le)}.
      </span>
      <Link to={`/resultats/${precedent.id}`} className="lien-version-precedente">
        Ouvrir la version précédente
      </Link>
    </section>
  );

  if (!contientDesEcarts(diff)) {
    return (
      <>
        {bandeau}
        <div className="etat-vide-evolution carte-resultat">
          <div className="rond">✓</div>
          <h3>Aucun écart détecté</h3>
          <p>
            Cette version est identique à la précédente : mêmes lignes, mêmes colonnes, mêmes
            statistiques. Rien à revérifier avant de rejouer vos rapports.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {bandeau}

      <div className="evolution-kpis">
        {cartes.map((c) => (
          <div key={c.label} className={`kpi-evolution ${c.ton}`}>
            <div className="l">{c.label}</div>
            <div className="piste">
              {!c.sansAvant && <span className="avant">{formaterNombre(c.avant)}</span>}
              <span className="apres">{formaterNombre(c.apres)}</span>
            </div>
            <span className="delta chip-evolution">{c.deltaLabel}</span>
            <div className="d">{c.note}</div>
          </div>
        ))}
      </div>

      {morceaux.length > 0 && (
        <section className="carte-resultat banniere-evolution">
          <div className="resume-evolution">
            En résumé :{" "}
            {morceaux.map((m, i) => (
              <span key={i}>
                {resumePhrase(morceaux, i)}
                {m}
              </span>
            ))}
            . Les chiffres du fichier ont bougé : vérifiez avant de rejouer vos rapports.
          </div>
        </section>
      )}

      <section className="carte-resultat">
        <h2>
          Anomalies <span className="badge">{formaterNombre(entreesAnomalies.length)}</span>
        </h2>
        <p className="explication">
          Nouvelles, aggravées ou résolues depuis la version précédente.
        </p>
        {entreesAnomalies.length === 0 ? (
          <p className="vide-evolution">
            Aucune anomalie ajoutée ni résolue : la qualité est stable.
          </p>
        ) : (
          entreesAnomalies.map((a, i) => (
            <div key={`${a.colonne}-${a.ton}-${i}`} className={`entree-evolution ${a.ton}`}>
              <span className="ico-evolution">
                {a.ton === "resolue" ? "✓" : a.ton === "aggravee" ? "!" : "+"}
              </span>
              <div>
                <div className="txt">
                  <strong>Valeur atypique dans « {a.colonne} »</strong>
                </div>
                <div className="meta">
                  <span
                    className={`chip-evolution ${
                      a.ton === "resolue" ? "vert" : a.ton === "aggravee" ? "pierre" : "rouge"
                    }`}
                  >
                    {a.ton === "resolue"
                      ? "résolue"
                      : a.ton === "aggravee"
                        ? "aggravée"
                        : "nouvelle"}
                  </span>
                  {a.ton === "aggravee"
                    ? `${formaterNombre(a.avant)} → ${formaterNombre(a.apres)} valeurs aberrantes`
                    : `${formaterNombre(a.nombre_valeurs_aberrantes)} valeur(s) aberrante(s)`}
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="carte-resultat">
        <h2>
          Tendances <span className="badge">{formaterNombre(tendances.length)}</span>
        </h2>
        <p className="explication">
          Évolutions dont le sens ou l’ampleur a changé entre les deux versions.
        </p>
        {tendances.length === 0 ? (
          <p className="vide-evolution">Aucune tendance modifiée : les courbes sont identiques.</p>
        ) : (
          tendances.map((t, i) => (
            <div key={`${t.colonne}-${i}`} className="tendance-evolution">
              <span className="nom">{t.colonne}</span>
              <span className="etat avant">
                {flecheSens(t.sens_avant)} {libelleSens(t.sens_avant)}
                {t.evolution_avant != null ? ` ${formaterNombre(t.evolution_avant)} %` : ""}
              </span>
              <span className="fleche-sens">→</span>
              <span className={`etat apres ${t.sens_apres === "hausse" ? "hausse" : ""}`}>
                {flecheSens(t.sens_apres)} {libelleSens(t.sens_apres)}
                {t.evolution_apres != null ? ` ${formaterNombre(t.evolution_apres)} %` : ""}
              </span>
              <div className="comment">
                {t.inversee
                  ? "Sens inversé : ce qui montait descend maintenant (ou l’inverse). À croiser avec les autres colonnes."
                  : "Amplitude modifiée sur la même direction."}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="carte-resultat large">
        <h2>
          Statistiques qui ont bougé{" "}
          <span className="badge">{formaterNombre(stats.length)} indicateur(s)</span>
        </h2>
        <p className="explication">
          Moyenne, minimum, maximum et médiane comparés colonne par colonne. Seules les valeurs
          réellement modifiées apparaissent.
        </p>
        {stats.length === 0 ? (
          <p className="vide-evolution">Aucun indicateur chiffré n’a bougé.</p>
        ) : (
          <div className="scroll-tableau">
            <table className="tableau-stats">
              <thead>
                <tr>
                  <th>Colonne</th>
                  <th>Indicateur</th>
                  <th>Avant</th>
                  <th>Après</th>
                  <th>Écart</th>
                  <th>Amplitude</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((st, i) => {
                  const variation = st.variation_pct;
                  const largeur = variation == null ? 100 : Math.min(100, Math.abs(variation));
                  return (
                    <tr
                      key={`${st.colonne}-${st.mesure}`}
                      className="ligne-animee"
                      style={{ "--delai": `${0.5 + Math.min(i, 12) * 0.06}s` }}
                    >
                      <td>
                        <strong>{st.colonne}</strong>
                      </td>
                      <td>{LIBELLES_STATS[st.mesure] || st.mesure}</td>
                      <td className="val">
                        {st.avant == null ? "—" : formaterNombre(st.avant)}
                      </td>
                      <td className="val">{st.apres == null ? "—" : formaterNombre(st.apres)}</td>
                      <td className="val">
                        {st.statut === "nouvelle" ? (
                          <span className="chip-evolution bleu">nouvelle colonne</span>
                        ) : st.statut === "disparue" ? (
                          <span className="chip-evolution pierre">colonne retirée</span>
                        ) : (
                          <span className={`chip-evolution ${st.delta >= 0 ? "vert" : "rouge"}`}>
                            {st.delta > 0 ? "+" : "−"}
                            {formaterNombre(Math.abs(st.delta))}
                            {variation != null
                              ? ` · ${variation > 0 ? "+" : "−"}${formaterNombre(Math.abs(variation))} %`
                              : ""}
                          </span>
                        )}
                      </td>
                      <td className="val">
                        <div className="barre-mini-evolution">
                          <i
                            className={st.delta == null ? "" : st.delta >= 0 ? "monte" : "chut"}
                            style={{ "--w": `${largeur}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function ResumeLisible({ resume, fichier, fichierId }) {
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
      { l: "Feuilles", num: nFeuilles, d: "dans le classeur" },
      { l: "Lignes", num: nLignes, d: "au total" },
      {
        l: "Colonnes",
        num: colsNum.length + colsTexte.length + colsDates.length,
        d: "détectées",
      },
      {
        l: "Valeurs manquantes",
        num: totalManquantes,
        d: totalManquantes ? "à traiter" : "aucune",
        alerte: totalManquantes > 0,
      }
    );
    const doublons = resume.doublons || {};
    if ((doublons.lignes_concernees || 0) > 0) {
      cartes.push({
        l: "Lignes dupliquées",
        num: doublons.lignes_concernees,
        d: `${formaterNombre(doublons.groupes || 0)} groupe(s)`,
        alerte: true,
      });
    }
  } else if (estWord) {
    cartes.push(
      { l: "Paragraphes", num: nParagraphes, d: "dans le document" },
      { l: "Mots", num: nMots, d: "au total" },
      {
        l: "Tableaux",
        num: resume.nombre_tableaux || 0,
        d: "détectés",
      },
      {
        l: "Mots / paragraphe",
        num: resume.longueur_moyenne_paragraphe || 0,
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
            <div
              key={c.l}
              className={`kpi-app${c.alerte ? " kpi-alerte" : ""}`}
            >
              <div className="l">{c.l}</div>
              <div className="v">
                <Compteur valeur={arrondi(c.num)} />
              </div>
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
                {nomsColonnes.map((col, i) => {
                  const s = stats[col] || {};
                  return (
                    <tr
                      key={col}
                      className="ligne-animee"
                      style={{ "--delai": `${0.4 + Math.min(i, 12) * 0.06}s` }}
                    >
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
                {fichierId && (
                  <DrillDownManquante fichierId={fichierId} cle={cle} attendues={n} />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {estExcel &&
        fichierId &&
        (resume.doublons?.lignes_concernees || 0) > 0 && (
          <section className="carte-resultat large">
            <h2>
              Lignes dupliquées{" "}
              <span className="badge">{resume.doublons.lignes_concernees}</span>
            </h2>
            <p className="explication">
              {formaterNombre(resume.doublons.lignes_concernees)} ligne(s)
              strictement identique(s) réparties en{" "}
              {formaterNombre(resume.doublons.groupes || 0)} groupe(s) — à
              vérifier avant toute sommation, sinon les totaux seront comptés
              plusieurs fois.
            </p>
            <DrillDownDoublons fichierId={fichierId} />
          </section>
        )}
    </>
  );
}
