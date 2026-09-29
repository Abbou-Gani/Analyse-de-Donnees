import { useEffect, useState } from "react";
import { appelerAPI } from "../api/client";

const ICONES = { croissance: "↗", marge: "%", manquants: "?", aberrants: "!" };

export default function VueMarche({ fichierId }) {
  const [referentiels, setReferentiels] = useState([]);
  const [secteur, setSecteur] = useState("detail");
  const [marche, setMarche] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    appelerAPI("/fichiers/referentiels")
      .then(setReferentiels)
      .catch(() => setReferentiels([]));
  }, []);

  useEffect(() => {
    let actif = true;
    setMarche(null);
    setErreur("");
    appelerAPI(`/fichiers/${fichierId}/marche?secteur=${encodeURIComponent(secteur)}`)
      .then((res) => {
        if (actif) setMarche(res);
      })
      .catch((err) => {
        if (actif) setErreur(err.message);
      });
    return () => {
      actif = false;
    };
  }, [fichierId, secteur]);

  const reperes = marche?.reperes || [];

  return (
    <>
      <section className="carte-resultat large">
        <h2>
          Repères marché <span className="badge">donnée externe</span>
          {marche?.disponible && (
            <span className={`badge domaine-${marche.domaine}`}>
              {marche.domaine === "commercial" ? "commerce" : "qualité seule"}
            </span>
          )}
        </h2>
        <div className="ligne-filtre">
          <label htmlFor="sel-secteur">Référentiel</label>
          <select
            id="sel-secteur"
            value={secteur}
            onChange={(e) => setSecteur(e.target.value)}
          >
            {referentiels.map((r) => (
              <option key={r.id} value={r.id}>
                {r.source} — {r.libelle}
              </option>
            ))}
            {!referentiels.length && <option value="detail">Référentiel</option>}
          </select>
          <span className="explication-ligne">
            Tes chiffres confrontés à une référence publique, par ordre de grandeur.
          </span>
        </div>

        {marche?.note && marche.disponible && (
          <div className="note-marche">
            <span className="ico-note">i</span> {marche.note}
          </div>
        )}

        {erreur && <p className="vide">{erreur}</p>}

        {!erreur && !marche && (
          <div className="squelette-liste" aria-hidden="true">
            <div className="sq tete" />
            {[0, 1, 2, 3, 4].map((n) => (
              <div key={n} className={`sq w${n + 1}`} />
            ))}
          </div>
        )}

        {marche && !marche.disponible && (
          <div className="etat-vide-marche">
            <div className="rond-vide">?</div>
            <h3>Aucune référence externe pour ce fichier</h3>
            <p>
              {marche.raison === "referentiel_inconnu"
                ? "Référentiel inconnu — choisissez-en un autre."
                : "Type de données non reconnu, ou aucun indicateur comparable. Tes " +
                  "analyses internes restent valables."}
            </p>
          </div>
        )}

        {marche?.disponible && (
          <>
            <div className="bandeau-source">
              <span className="pastille-source">
                <span className="pt" /> {marche.source.source}
              </span>
              <span className="source-meta">
                {marche.source.libelle} · réf. du {marche.source.publication} ·{" "}
                {marche.source.perimetre} · fréquence {marche.source.frequence.toLowerCase()}
              </span>
            </div>

            <div className="pistes-repere">
              {reperes.map((r, i) => (
                <div
                  key={r.id}
                  className={`repere ${r.position === "aligne" ? "neutre" : r.favorable ? "favorable" : "defavorable"}`}
                  style={{ "--delai": `${0.25 + i * 0.08}s` }}
                >
                  <div className="libelle">
                    <span className="ico-repere">{ICONES[r.id] || "·"}</span>
                    {r.libelle}
                  </div>
                  <div className="valeur">
                    {formatValeur(r.valeur_fichier, r.unite)}
                    <span className="etiq">ton fichier</span>
                  </div>
                  <div className="reference">
                    Référence : <strong>{formatValeur(r.valeur_reference, r.unite)}</strong>
                  </div>
                  <div className="jauge-repere">
                    <span
                      className="remplissage"
                      style={{ "--w": `${pourcentageJauge(r)}%` }}
                    />
                    <span className="mire" style={{ left: `${positionMire(r)}%` }} />
                  </div>
                  <span className={`verdict ${r.position === "aligne" ? "neutre" : r.favorable ? "favorable" : "defavorable"}`}>
                    {verdictTexte(r)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {marche?.disponible && marche.lectures?.length > 0 && (
        <section className="carte-resultat large">
          <h2>
            Ce que ça change pour toi{" "}
            <span className="badge">{marche.lectures.length} lecture(s)</span>
          </h2>
          <div className="liste-lectures">
            {marche.lectures.map((texte, i) => (
              <div
                key={texte.slice(0, 40)}
                className="lecture-marche"
                style={{ "--delai": `${0.45 + i * 0.1}s` }}
              >
                <span className="ico-lecture">{i === 0 ? "↗" : i === 1 ? "↓" : "!"}</span>
                <div>
                  <div className="txt">{texte}</div>
                  <div className="meta">
                    <span className="chip-source">{marche.source.source} · {marche.source.publication}</span>
                    {marche.colonne_mesure && (
                      <span className="chip-source">
                        colonne « {marche.colonne_mesure} »
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {marche?.disponible && (
        <section className="carte-resultat large">
          <h2>Provenance de la donnée</h2>
          <div className="provenance">
            <div>
              <div className="k">Source</div>
              <div className="v">{marche.source.source}</div>
            </div>
            <div>
              <div className="k">Publication</div>
              <div className="v">{marche.source.publication}</div>
            </div>
            <div>
              <div className="k">Périmètre</div>
              <div className="v">{marche.source.perimetre}</div>
            </div>
            <div>
              <div className="k">Fréquence</div>
              <div className="v">{marche.source.frequence}</div>
            </div>
          </div>
          <div className="mentions-marche">
            <b>À garder en tête :</b> {marche.avertissement}
          </div>
        </section>
      )}
    </>
  );
}

function formatValeur(valeur, unite) {
  const texte = Number(valeur).toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${texte} ${unite === "%" ? "%" : unite}`;
}

function echelleJauge(r) {
  const valeurs = [r.valeur_fichier, r.valeur_reference];
  const bas = Math.min(...valeurs, 0);
  const haut = Math.max(...valeurs, 1);
  const marge = (haut - bas) * 0.15 || 1;
  return { bas: bas - marge, haut: haut + marge };
}

function positionMire(r) {
  const { bas, haut } = echelleJauge(r);
  return Math.min(Math.max(((r.valeur_reference - bas) / (haut - bas)) * 100, 4), 96);
}

function pourcentageJauge(r) {
  const { bas, haut } = echelleJauge(r);
  return Math.min(Math.max(((r.valeur_fichier - bas) / (haut - bas)) * 100, 4), 100);
}

function verdictTexte(r) {
  if (r.position === "aligne") return `≈ aligné (écart ${r.ecart > 0 ? "+" : ""}${r.ecart.toFixed(1)} pts)`;
  const sens = r.ecart > 0 ? "au-dessus" : "en-dessous";
  const fleche = r.ecart > 0 ? "↑" : "↓";
  return `${fleche} ${Math.abs(r.ecart).toFixed(1)} pts ${sens} de la référence`;
}
