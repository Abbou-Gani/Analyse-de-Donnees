import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { utiliserAuth } from "../contexte/ContexteAuth";

export default function Inscription() {
  const { inscrire } = utiliserAuth();
  const navigation = useNavigate();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [nomOrganisation, setNomOrganisation] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    try {
      await inscrire(email, motDePasse, nomOrganisation || "Mon organisation");
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
          Crééez votre compte.
          <br />
          <em>Analysez en 30 secondes.</em>
        </h2>
        <p>
          5 fichiers offerts chaque mois. Aucune carte bancaire requise pour
          commencer avec l'analyse Excel et Word.
        </p>
        <div className="stats-visuel">
          <div className="stat-visuel">
            <div className="n">5</div>
            <div className="l">Fichiers / mois offerts</div>
          </div>
          <div className="stat-visuel">
            <div className="n">10 Mo</div>
            <div className="l">Par fichier (Gratuit)</div>
          </div>
          <div className="stat-visuel">
            <div className="n">0€</div>
            <div className="l">Pour démarrer</div>
          </div>
        </div>
      </div>
      <div className="form-auth">
        <form className="boite" onSubmit={soumettre}>
          <h1>Créer un compte</h1>
          <p className="sous">
            Commencez gratuitement — passez à Pro quand vous êtes prêt.
          </p>
          {erreur && <div className="alerte">{erreur}</div>}
          <div className="champ">
            <label htmlFor="org-insc">Nom de l'organisation</label>
            <input
              type="text"
              id="org-insc"
              value={nomOrganisation}
              onChange={(e) => setNomOrganisation(e.target.value)}
              placeholder="Ma boîte"
            />
          </div>
          <div className="champ">
            <label htmlFor="email-insc">Adresse e-mail</label>
            <input
              type="email"
              id="email-insc"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@entreprise.fr"
              required
            />
          </div>
          <div className="champ">
            <label htmlFor="mdp-insc">Mot de passe</label>
            <input
              type="password"
              id="mdp-insc"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              minLength={8}
              placeholder="8 caractères minimum"
              required
            />
          </div>
          <button type="submit" className="btn-connexion" disabled={enCours}>
            {enCours ? "Création..." : "Créer mon compte"}
          </button>
          <p className="liens-form">
            Déjà un compte ? <Link to="/connexion">Se connecter</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
