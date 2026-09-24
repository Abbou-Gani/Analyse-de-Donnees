/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { appelerAPI, deconnecter, definirJetons } from "../api/client";

const ContexteAuth = createContext(null);

async function chargerUtilisateurInitial() {
  const jeton = localStorage.getItem("jeton_acces");
  if (!jeton) return null;
  try {
    return await appelerAPI("/auth/moi");
  } catch {
    deconnecter();
    return null;
  }
}

export function FournisseurAuth({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;
    chargerUtilisateurInitial().then((moi) => {
      if (!actif) return;
      setUtilisateur(moi);
      setChargement(false);
    });
    return () => {
      actif = false;
    };
  }, []);

  const connecter = useCallback(async (email, motDePasse) => {
    const donnees = await appelerAPI("/auth/connexion", {
      method: "POST",
      corps: { email, mot_de_passe: motDePasse },
    });
    definirJetons(donnees.jeton_acces, donnees.jeton_rafraichissement);
    const moi = await appelerAPI("/auth/moi");
    setUtilisateur(moi);
    return moi;
  }, []);

  const inscrire = useCallback(
    async (email, motDePasse, nomOrganisation) => {
      await appelerAPI("/auth/inscription", {
        method: "POST",
        corps: {
          email,
          mot_de_passe: motDePasse,
          nom_organisation: nomOrganisation,
        },
      });
      return connecter(email, motDePasse);
    },
    [connecter]
  );

  const fermerSession = useCallback(() => {
    deconnecter();
    setUtilisateur(null);
  }, []);

  const recharger = useCallback(async () => {
    try {
      const moi = await appelerAPI("/auth/moi");
      setUtilisateur(moi);
      return moi;
    } catch {
      return null;
    }
  }, []);

  return (
    <ContexteAuth.Provider
      value={{
        utilisateur,
        chargement,
        connecter,
        inscrire,
        fermerSession,
        recharger,
      }}
    >
      {children}
    </ContexteAuth.Provider>
  );
}

export function utiliserAuth() {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useContext(ContexteAuth);
}
