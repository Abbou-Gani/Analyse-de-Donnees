import { useEffect, useState } from "react";
import { appelerAPI } from "../api/client";
import DispositionApp from "../composants/DispositionApp";
import { utiliserAuth } from "../contexte/ContexteAuth";

const LIBELLES_ROLE = {
  proprietaire: "Propriétaire",
  admin: "Admin",
  utilisateur: "Utilisateur",
  membre: "Membre",
};

export default function Equipe() {
  const { utilisateur } = utiliserAuth();
  const [membres, setMembres] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  const [emailInvit, setEmailInvit] = useState("");
  const [mdpInvit, setMdpInvit] = useState("");
  const [roleInvit, setRoleInvit] = useState("utilisateur");
  const [enCours, setEnCours] = useState(false);

  const estAdmin =
    utilisateur?.role === "admin" || utilisateur?.role === "proprietaire";

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    try {
      const donnees = await appelerAPI("/equipe");
      setMembres(donnees);
      setErreur("");
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  async function inviter(e) {
    e.preventDefault();
    setErreur("");
    setMessage("");
    setEnCours(true);
    try {
      await appelerAPI("/equipe", {
        method: "POST",
        corps: {
          email: emailInvit.trim(),
          mot_de_passe: mdpInvit,
          role: roleInvit,
        },
      });
      setEmailInvit("");
      setMdpInvit("");
      setRoleInvit("utilisateur");
      setMessage("Membre ajouté à l'équipe.");
      await charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  async function changerRole(membre, role) {
    setErreur("");
    setMessage("");
    try {
      await appelerAPI(`/equipe/${membre.id}`, {
        method: "PATCH",
        corps: { role },
      });
      await charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function retirer(membre) {
    setErreur("");
    setMessage("");
    try {
      await appelerAPI(`/equipe/${membre.id}`, { method: "DELETE" });
      await charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  if (chargement) {
    return (
      <DispositionApp actif="/equipe">
        <div className="entete-app">
          <div>
            <h1>Équipe</h1>
            <div className="sous">Membres et rôles de votre organisation.</div>
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
    <DispositionApp actif="/equipe">
      <div className="entete-app">
        <div>
          <h1>Équipe</h1>
          <div className="sous">Membres et rôles de votre organisation.</div>
        </div>
      </div>

      {message && <div className="succes">{message}</div>}
      {erreur && <div className="alerte">{erreur}</div>}

      {estAdmin && (
        <section className="carte-parametre carte-invitation">
          <h2>Ajouter un membre</h2>
          <p className="sous-carte">
            L'invitation crée immédiatement un compte dans votre organisation.
          </p>
          <form className="form-invitation" onSubmit={inviter}>
            <div className="champ">
              <label htmlFor="email-inv">Adresse e-mail</label>
              <input
                type="email"
                id="email-inv"
                value={emailInvit}
                onChange={(e) => setEmailInvit(e.target.value)}
                placeholder="collaborateur@entreprise.fr"
                required
              />
            </div>
            <div className="champ">
              <label htmlFor="mdp-inv">Mot de passe temporaire</label>
              <input
                type="password"
                id="mdp-inv"
                value={mdpInvit}
                onChange={(e) => setMdpInvit(e.target.value)}
                minLength={8}
                placeholder="8 caractères minimum"
                required
              />
            </div>
            <div className="champ">
              <label htmlFor="role-inv">Rôle</label>
              <select
                id="role-inv"
                value={roleInvit}
                onChange={(e) => setRoleInvit(e.target.value)}
              >
                <option value="utilisateur">Utilisateur</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" className="btn-primaire-app" disabled={enCours}>
              {enCours ? "Ajout..." : "Ajouter"}
            </button>
          </form>
        </section>
      )}

      <div className="bloc-liste">
        <div className="entete-bl">
          <h2>{membres.length} membre(s)</h2>
        </div>
        {membres.map((membre) => {
          const moi = membre.id === utilisateur?.id;
          return (
            <div key={membre.id} className="ligne-membre">
              <div className="av-membre">{membre.email.charAt(0).toUpperCase()}</div>
              <div className="meta">
                <div className="nom">
                  {membre.email}
                  {moi && <span className="badge-moi">vous</span>}
                </div>
                <div className="info">
                  inscrit le{" "}
                  {new Date(membre.cree_le).toLocaleDateString("fr-FR")}
                </div>
              </div>
              {estAdmin && !moi ? (
                <select
                  className="select-role"
                  value={
                    membre.role === "proprietaire" ? "admin" : membre.role
                  }
                  onChange={(e) => changerRole(membre, e.target.value)}
                >
                  <option value="utilisateur">Utilisateur</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span className="statut role-membre">
                  <span className="pt" />
                  {LIBELLES_ROLE[membre.role] || membre.role}
                </span>
              )}
              {estAdmin && !moi && (
                <button
                  className="btn-action"
                  onClick={() => retirer(membre)}
                  title="Retirer"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </DispositionApp>
  );
}
