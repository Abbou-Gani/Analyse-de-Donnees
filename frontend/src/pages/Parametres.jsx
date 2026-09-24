import { useEffect, useState } from "react";
import { appelerAPI } from "../api/client";
import DispositionApp from "../composants/DispositionApp";
import { utiliserAuth } from "../contexte/ContexteAuth";

export default function Parametres() {
  const { utilisateur, recharger } = utiliserAuth();
  const [nomOrganisation, setNomOrganisation] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [motDePasseActuel, setMotDePasseActuel] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [chargement, setChargement] = useState(true);

  const estAdmin = role === "admin" || role === "proprietaire";

  useEffect(() => {
    let actif = true;
    appelerAPI("/parametres")
      .then((res) => {
        if (!actif) return;
        setNomOrganisation(res.organisation?.nom || "");
        setEmail(res.utilisateur?.email || "");
        setRole(res.utilisateur?.role || "");
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

  async function soumettre(e) {
    e.preventDefault();
    setErreur("");
    setMessage("");
    setEnCours(true);
    try {
      const corps = {};
      if (estAdmin && nomOrganisation.trim()) {
        corps.nom_organisation = nomOrganisation.trim();
      }
      if (email.trim() && email.trim() !== utilisateur?.email) {
        corps.email = email.trim();
      }
      if (nouveauMotDePasse) {
        corps.mot_de_passe_actuel = motDePasseActuel;
        corps.nouveau_mot_de_passe = nouveauMotDePasse;
      }
      if (Object.keys(corps).length === 0) {
        setMessage("Aucune modification à enregistrer.");
        setEnCours(false);
        return;
      }
      const res = await appelerAPI("/parametres", {
        method: "PATCH",
        corps,
      });
      setNomOrganisation(res.organisation?.nom || nomOrganisation);
      setEmail(res.utilisateur?.email || email);
      setRole(res.utilisateur?.role || role);
      setMotDePasseActuel("");
      setNouveauMotDePasse("");
      setMessage("Paramètres enregistrés.");
      await recharger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  if (chargement) {
    return (
      <DispositionApp actif="/parametres">
        <div className="entete-app">
          <div>
            <h1>Paramètres</h1>
            <div className="sous">Profil et organisation.</div>
          </div>
        </div>
        <div className="chargement">
          <div className="roue" />
          <p>Chargement...</p>
        </div>
      </DispositionApp>
    );
  }

  return (
    <DispositionApp actif="/parametres">
      <div className="entete-app">
        <div>
          <h1>Paramètres</h1>
          <div className="sous">Profil et organisation.</div>
        </div>
      </div>

      <div className="grille-parametres">
        <section className="carte-parametre">
          <h2>Organisation</h2>
          <p className="sous-carte">
            {estAdmin
              ? "Nom visible par toute l'équipe."
              : "Seul l'administrateur peut modifier le nom."}
          </p>
          <form onSubmit={soumettre}>
            <div className="champ">
              <label htmlFor="nom-org">Nom de l'organisation</label>
              <input
                type="text"
                id="nom-org"
                value={nomOrganisation}
                onChange={(e) => setNomOrganisation(e.target.value)}
                disabled={!estAdmin}
                required={estAdmin}
              />
            </div>
            <div className="champ">
              <label htmlFor="role-org">Votre rôle</label>
              <input type="text" id="role-org" value={role} disabled />
            </div>
            <button type="submit" className="btn-primaire-app" disabled={enCours}>
              {enCours ? "Enregistrement..." : "Enregistrer"}
            </button>
          </form>
        </section>

        <section className="carte-parametre">
          <h2>Profil</h2>
          <p className="sous-carte">Votre email de connexion.</p>
          <form onSubmit={soumettre}>
            <div className="champ">
              <label htmlFor="email-par">Adresse e-mail</label>
              <input
                type="email"
                id="email-par"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-secondaire-app" disabled={enCours}>
              Mettre à jour
            </button>
          </form>
        </section>

        <section className="carte-parametre">
          <h2>Mot de passe</h2>
          <p className="sous-carte">Minimum 8 caractères.</p>
          <form onSubmit={soumettre}>
            <div className="champ">
              <label htmlFor="mdp-act">Mot de passe actuel</label>
              <input
                type="password"
                id="mdp-act"
                value={motDePasseActuel}
                onChange={(e) => setMotDePasseActuel(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="champ">
              <label htmlFor="mdp-nouv">Nouveau mot de passe</label>
              <input
                type="password"
                id="mdp-nouv"
                value={nouveauMotDePasse}
                onChange={(e) => setNouveauMotDePasse(e.target.value)}
                minLength={8}
                placeholder="8 caractères minimum"
              />
            </div>
            <button type="submit" className="btn-secondaire-app" disabled={enCours}>
              Changer le mot de passe
            </button>
          </form>
        </section>
      </div>

      {message && <div className="succes">{message}</div>}
      {erreur && <div className="alerte">{erreur}</div>}
    </DispositionApp>
  );
}
