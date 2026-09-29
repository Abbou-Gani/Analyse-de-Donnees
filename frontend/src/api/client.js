const BASE_URL = "http://localhost:8000";

function obtenirJeton() {
  return localStorage.getItem("jeton_acces");
}

export function definirJetons(jetonAcces, jetonRafraichissement) {
  localStorage.setItem("jeton_acces", jetonAcces);
  localStorage.setItem("jeton_rafraichissement", jetonRafraichissement);
}

export function deconnecter() {
  localStorage.removeItem("jeton_acces");
  localStorage.removeItem("jeton_rafraichissement");
}

export async function appelerAPI(chemin, options = {}) {
  const entetes = { ...(options.entetes || {}) };
  const jeton = obtenirJeton();
  if (jeton) entetes["Authorization"] = `Bearer ${jeton}`;

  let corps = options.corps;
  if (corps && !(corps instanceof FormData)) {
    entetes["Content-Type"] = "application/json";
    corps = JSON.stringify(corps);
  }

  const reponse = await fetch(`${BASE_URL}${chemin}`, {
    method: options.method || "GET",
    headers: entetes,
    body: corps,
  });

  if (reponse.status === 401) {
    deconnecter();
    window.location.href = "/connexion";
    throw new Error("Session expirée");
  }
  if (!reponse.ok) {
    const erreur = await reponse.json().catch(() => ({}));
    let message = `Erreur ${reponse.status}`;
    if (typeof erreur.detail === "string") {
      message = erreur.detail;
    } else if (Array.isArray(erreur.detail)) {
      message = erreur.detail.map((d) => d.msg || JSON.stringify(d)).join(" / ");
    } else if (erreur.detail) {
      message = JSON.stringify(erreur.detail);
    }
    throw new Error(message);
  }
  if (reponse.status === 204) return null;
  return reponse.json();
}

export async function telechargerFichier(chemin, nomSortie) {
  const entetes = {};
  const jeton = obtenirJeton();
  if (jeton) entetes["Authorization"] = `Bearer ${jeton}`;

  const reponse = await fetch(`${BASE_URL}${chemin}`, { headers: entetes });
  if (reponse.status === 401) {
    deconnecter();
    window.location.href = "/connexion";
    throw new Error("Session expirée");
  }
  if (!reponse.ok) {
    const erreur = await reponse.json().catch(() => ({}));
    throw new Error(
      typeof erreur.detail === "string" ? erreur.detail : `Erreur ${reponse.status}`
    );
  }

  const blob = await reponse.blob();
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomSortie;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}
