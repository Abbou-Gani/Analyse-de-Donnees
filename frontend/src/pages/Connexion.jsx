import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { utiliserAuth } from "../contexte/ContexteAuth";

export default function Connexion() {
  const { connecter } = utiliserAuth();
  const navigation = useNavigate();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    try {
      await connecter(email, motDePasse);
      navigation("/tableau-de-bord");
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="page-auth">
      <div className="visuel-auth">
        <h2>
          Analysez vos données.
          <br />
          <em>Décidez plus vite.</em>
        </h2>
        <p>
          Rejoignez les équipes qui transforment leurs fichiers Excel et Word en
          décisions éclairées avec GestAnalyse : statistiques, anomalies,
          tendances et insights.
        </p>
        <div className="stats-visuel">
          <div className="stat-visuel">
            <div className="n">Excel</div>
            <div className="l">.xlsx · .xls · .csv</div>
          </div>
          <div className="stat-visuel">
            <div className="n">Word</div>
            <div className="l">.docx · .doc</div>
          </div>
          <div className="stat-visuel">
            <div className="n">IQR</div>
            <div className="l">Détection anomalies</div>
          </div>
        </div>
      </div>
      <div className="form-auth">
        <form className="boite" onSubmit={soumettre}>
          <h1>Bon retour parmi nous</h1>
          <p className="sous">Connectez-vous pour accéder à vos analyses.</p>
          {erreur && <div className="alerte">{erreur}</div>}
          <div className="champ">
            <label htmlFor="email-conn">Adresse e-mail</label>
            <input
              type="email"
              id="email-conn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@entreprise.fr"
              required
            />
          </div>
          <div className="champ">
            <label htmlFor="mdp-conn">Mot de passe</label>
            <input
              type="password"
              id="mdp-conn"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="btn-connexion" disabled={enCours}>
            {enCours ? "Connexion..." : "Se connecter"}
          </button>
          <p className="liens-form">
            Pas encore de compte ?{" "}
            <Link to="/inscription">Commencer gratuitement</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
