import { useState, useRef } from "react";
import { appelerAPI } from "../api/client";

export default function Televersement({ onNouveauFichier }) {
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [survol, setSurvol] = useState(false);
  const inputRef = useRef();

  async function envoyer(fichier) {
    if (!fichier) return;
    setErreur("");
    setEnCours(true);
    try {
      const donnees = new FormData();
      donnees.append("fichier", fichier);
      const resultat = await appelerAPI("/fichiers", {
        method: "POST",
        corps: donnees,
      });
      onNouveauFichier(resultat);
      inputRef.current.value = "";
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setSurvol(false);
    envoyer(e.dataTransfer.files[0]);
  }

  return (
    <div className="televersement">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.docx,.doc"
        onChange={(e) => envoyer(e.target.files[0])}
        id="champ-fichier"
      />
      <label
        htmlFor="champ-fichier"
        className={`zone-televersement ${enCours ? "actif" : ""} ${
          survol ? "survol" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={onDrop}
      >
        <div className="cadre-upload">
          <div className="ico-upload">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 16V4M12 4L7 9M12 4L17 9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 16V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V16"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="txt-upload">
            <div className="t">
              {enCours
                ? "Envoi en cours…"
                : "Glissez un fichier ici pour l'analyser"}
            </div>
            <div className="s">
              .xlsx · .xls · .csv · .docx · .doc — ou{" "}
              <strong>parcourir</strong>
            </div>
          </div>
        </div>
      </label>
      {erreur && <div className="alerte">{erreur}</div>}
    </div>
  );
}
