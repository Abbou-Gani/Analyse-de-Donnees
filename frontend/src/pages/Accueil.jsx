import { Link } from "react-router-dom";

const SECTIONS_NAV = [
  { href: "#produit", libelle: "Produit" },
  { href: "#fonctionnement", libelle: "Fonctionnement" },
  { href: "#securite", libelle: "Sécurité" },
  { href: "#api", libelle: "API" },
  { href: "#tarifs", libelle: "Tarifs" },
  { href: "#faq", libelle: "FAQ" },
];

const BARRES_MOCK = [
  { h: "45%" },
  { h: "70%" },
  { h: "55%" },
  { h: "85%" },
  { h: "40%", dim: true },
  { h: "95%" },
  { h: "60%" },
  { h: "75%" },
  { h: "50%", dim: true },
  { h: "80%" },
  { h: "65%" },
  { h: "90%" },
];

const FEATURES = [
  {
    classe: "b-carte large",
    ico: "📊",
    titre: "Analyse Excel — de la colonne à la décision",
    texte:
      "Détection automatique des types (numérique, catégoriel, date), stats descriptives par colonne, croisements et corrélations.",
    points: [
      "Moyenne, médiane, écart-type, min/max, quartiles, valeurs manquantes",
      "Anomalies par méthode IQR / z-score",
      "Tendances si une colonne date existe (croissance, saisonnalité)",
      "Top N, moyennes par groupe, corrélations entre colonnes",
    ],
  },
  {
    classe: "b-carte fonce",
    stat: "asynchrone",
    titre: "Pipeline qui ne bloque jamais",
    texte:
      "Upload → API → file d'attente → workers. L'API répond immédiatement ; le traitement lourd tourne en arrière-plan avec retry (3 max) et timeout.",
  },
  {
    classe: "b-carte",
    ico: "🚨",
    titre: "Anomalies & données manquantes",
    texte:
      "Valeurs aberrantes (IQR) et cellules vides signalées automatiquement, avec la ligne et la colonne concernées.",
  },
  {
    classe: "b-carte",
    ico: "📈",
    titre: "Tendances temporelles",
    texte:
      "Si une colonne date est détectée : croissance/décroissance, saisonnalité simple et points de retournement.",
  },
  {
    classe: "b-carte",
    ico: "💡",
    titre: "Recommandations & insights IA",
    texte:
      "Règles locales d'abord, puis insights en langage naturel sur le plan Pro (étape optionnelle du pipeline, avec fallback si l'IA est en échec).",
  },
  {
    classe: "b-carte large",
    ico: "📄",
    titre: "Analyse Word — documents exploitables",
    texte:
      "Extraction paragraphes/tableaux/listes, résumé automatique, mots-clés et entités (dates, montants, noms) pour vos rapports et comptes rendus.",
    points: [
      "Résumé exécutif en quelques secondes",
      "Fréquences et termes importants",
      "Entités détectées : dates, chiffres, noms cités",
      "Points d'action et risques quand ils sont détectables",
    ],
  },
];

const ETAPES = [
  {
    n: 1,
    titre: "Importez votre fichier",
    texte:
      "Glissez-déposez un .xlsx, .xls, .csv, .docx ou .doc. Vérification du vrai format (magic bytes), taille max selon votre plan, quotas contrôlés à l'upload.",
  },
  {
    n: 2,
    titre: "L'analyse tourne en arrière-plan",
    texte:
      "L'API enfile le job immédiatement. Un worker parse (pandas / python-docx), calcule stats, anomalies, tendances et résumé — retry limité, jobs idempotents.",
  },
  {
    n: 3,
    titre: "Consultez & agissez",
    texte:
      "Polling automatique jusqu'au statut « terminé ». Ouvrez le rapport : stats, anomalies, tendances, recommandations et insights IA — export ou partage équipe.",
  },
];

const SECURITE = [
  {
    ico: "🔒",
    titre: "Validation & chiffrement",
    texte:
      "Type vérifié par magic bytes (pas seulement l'extension), HTTPS partout, fichiers chiffrés au repos, secrets hors du code.",
  },
  {
    ico: "🏢",
    titre: "Isolation par tenant",
    texte:
      "Chaque requête est scopée par organisation : aucun accès croisé entre vos données et celles d'un autre client.",
  },
  {
    ico: "🗑",
    titre: "RGPD by design",
    texte:
      "Consentement à l'upload, droit à la suppression (fichier + résultats), rétention définie, hébergement EU privilégié.",
  },
];

const TEMOIGNAGES = [
  {
    init: "SM",
    nom: "Sophie Martin",
    role: "Data Analyst, NovaRetail",
    texte:
      "« On a remplacé trois heures de nettoyage Excel par un drag & drop. Les anomalies IQR remontent toutes seules, avec la ligne exacte. »",
  },
  {
    init: "TL",
    nom: "Thomas Leroy",
    role: "Directeur financier, Groupe Alcor",
    texte:
      "« Le résumé automatique de nos comptes rendus Word et l'extraction des montants nous font gagner une heure par réunion. »",
  },
  {
    init: "NB",
    nom: "Nadia Benali",
    role: "Growth Lead, PulseLab",
    texte:
      "« L'API et le polling s'intègrent en une après-midi. On a branché GestAnalyse sur notre entrepôt de données sans casser l'existant. »",
  },
];

const OFFRES = [
  {
    nom: "Gratuit",
    prix: "0€",
    unite: "/ mois",
    desc: "Pour tester l'analyse de base",
    points: [
      "5 fichiers / mois",
      "Jusqu'à 10 Mo / fichier",
      "Analyse simple (stats, anomalies, tendances)",
      "Colonnes / lignes limitées",
      "Pas d'insights IA",
    ],
    cta: "Commencer",
    populaire: false,
  },
  {
    nom: "Pro",
    prix: "19€",
    unite: "/ mois",
    desc: "Pour les équipes qui analysent chaque jour",
    points: [
      "Fichiers illimités",
      "Jusqu'à 100 Mo / fichier",
      "Analyse simple + Word complète",
      "Insights IA & recommandations",
      "Colonnes / lignes sans limite",
      "Quota IA renouvelé mensuellement",
    ],
    cta: "Essayer 14 jours",
    populaire: true,
  },
  {
    nom: "Entreprise",
    prix: "Sur devis",
    unite: "",
    desc: "Volume, sécurité et support dédié",
    points: [
      "Tout le plan Pro",
      "SSO / SAML",
      "Journal d'audit",
      "SLA 99,9%",
      "Hébergement EU dédié",
      "Account manager dédié",
    ],
    cta: "Contacter les ventes",
    populaire: false,
  },
];

const FAQ = [
  {
    q: "Quels formats de fichiers sont pris en charge ?",
    r: "Excel (.xlsx, .xls, .csv) et Word (.docx, .doc). Le type est vérifié par magic bytes, pas seulement par l'extension. Chaque feuille d'un classeur est analysée séparément.",
    ouvert: true,
  },
  {
    q: "Combien de temps dure une analyse ?",
    r: "L'API répond immédiatement après l'upload. Le traitement tourne en arrière-plan (file d'attente + workers) : la plupart des fichiers sont prêts en quelques secondes. Le client fait un polling toutes les 2–3 secondes jusqu'au statut « terminé ».",
  },
  {
    q: "Comment fonctionnent les insights IA ?",
    r: "C'est une étape optionnelle du pipeline, activée sur le plan Pro. On envoie un résumé structuré des stats (pas le fichier entier) au modèle ; en cas d'échec ou de timeout, on retombe sur l'analyse simple — le job reste terminé. La version du modèle est stockée pour traçabilité.",
  },
  {
    q: "Mes données sont-elles stockées ? Combien de temps ?",
    r: "Les fichiers sont chiffrés au repos et isolés par organisation. Vous pouvez les supprimer à tout moment (fichier + résultats) via l'API ou l'interface. Une rétention automatique purge les fichiers inactifs après la durée contractuelle.",
  },
  {
    q: "Y a-t-il une limite de taille de fichier ?",
    r: "Plan Gratuit : 10 Mo max par fichier, 5 fichiers / mois. Plan Pro : 100 Mo max, fichiers illimités. Les quotas sont vérifiés à l'upload (rejet immédiat) et les quotas IA avant chaque appel modèle.",
  },
  {
    q: "Puis-je intégrer GestAnalyse à mes outils ?",
    r: "Oui. L'API REST expose l'inscription, la connexion JWT, l'upload multipart, le polling de statut et la récupération JSON des résultats — le même contrat que le frontend. Un delete permet la purge RGPD depuis vos systèmes.",
  },
];

function CarteFeature({ carte }) {
  return (
    <div className={carte.classe}>
      {carte.stat ? (
        <div className="b-stat-chiffre">{carte.stat}</div>
      ) : (
        <div className="b-ico">{carte.ico}</div>
      )}
      <h3>{carte.titre}</h3>
      <p>{carte.texte}</p>
      {carte.points && (
        <ul className="liste-points">
          {carte.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Accueil() {
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="logo-marque">
            <span className="rond-logo">G</span>
            GestAnalyse
          </Link>
          <nav>
            <ul className="liens-nav">
              {SECTIONS_NAV.map((s) => (
                <li key={s.href}>
                  <a href={s.href}>{s.libelle}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="nav-droite">
            <span className="drapeau" title="Burkina Faso" />
            <Link to="/connexion" className="btn-connex-nav">
              Connexion
            </Link>
            <Link to="/connexion" className="btn-cta-nav">
              Commencer gratuitement
            </Link>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <h1>
            Analyse de données Excel &amp; Word — et les{" "}
            <span className="accent">actions pour décider plus vite</span>
          </h1>
          <p className="sous-hero">
            Transformez vos fichiers en insights actionnables : statistiques,
            anomalies, tendances et recommandations.
          </p>
          <div className="pills-formats">
            <span className="pill-inline">
              <span className="ico-pill">📊</span>.xlsx · .xls · .csv
            </span>
            <span className="pill-inline">
              <span className="ico-pill">📄</span>.docx · .doc
            </span>
            <span className="pill-inline">
              <span className="ico-pill">⚡</span>+ API
            </span>
          </div>
          <div className="boutons-hero">
            <Link to="/connexion" className="btn-hero-terracotta">
              Commencer gratuitement
              <span className="rond-fleche">→</span>
            </Link>
            <a href="#tarifs" className="btn-hero-neutre">
              Voir les tarifs
            </a>
          </div>

          <div className="encadrement-mockup">
            <div className="barre-nav-mock">
              <span className="pt-mock r" />
              <span className="pt-mock j" />
              <span className="pt-mock v" />
              <span className="url-mock">app.gestanalyse.fr/tableau-de-bord</span>
            </div>
            <div className="corps-mock">
              <aside className="side-mock">
                <div className="logo-mock">
                  <span className="rond">G</span> GestAnalyse
                </div>
                <div className="nav-mock">
                  <div className="actif">📊 Tableau de bord</div>
                  <div>📁 Fichiers</div>
                  <div>📈 Résultats</div>
                  <div>💡 Insights IA</div>
                  <div className="separateur-mock" />
                  <div>⚙️ Paramètres</div>
                  <div>👥 Équipe</div>
                </div>
                <div className="plan-mock">
                  <div className="t">Plan Pro</div>
                  <div className="i">Insights IA activés · 100 Mo / fichier</div>
                  <div className="jauge-mock">
                    <div />
                  </div>
                </div>
              </aside>
              <div className="main-mock">
                <div className="entete-mock">
                  <div>
                    <h3>Tableau de bord</h3>
                    <div className="sous-mock">
                      Vue d'ensemble de vos analyses
                    </div>
                  </div>
                  <div className="boutons-entete">
                    <button className="btn-import-mock">+ Importer</button>
                    <div className="avatar-mock">A</div>
                  </div>
                </div>
                <div className="kpis-mock">
                  <div className="kpi-mock">
                    <div className="l">Fichiers</div>
                    <div className="v">42</div>
                  </div>
                  <div className="kpi-mock">
                    <div className="l">Jobs</div>
                    <div className="v a">128</div>
                  </div>
                  <div className="kpi-mock">
                    <div className="l">Anomalies</div>
                    <div className="v o">7</div>
                  </div>
                  <div className="kpi-mock">
                    <div className="l">Insights</div>
                    <div className="v">56</div>
                  </div>
                </div>
                <div className="graph-mock">
                  {BARRES_MOCK.map((b, i) => (
                    <div
                      key={i}
                      className={`bar-mock ${b.dim ? "dim" : ""}`}
                      style={{ height: b.h }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="bande-logos">
        <div className="logos-label">Formats pris en charge</div>
        <div className="logos-inner">
          <span>.xlsx</span>
          <span>.xls</span>
          <span>.csv</span>
          <span>.docx</span>
          <span>.doc</span>
          <span>API REST</span>
        </div>
      </div>

      <section className="section" id="produit">
        <div className="section-titre">
          <span className="sur-titre">Produit</span>
          <h2>Un import. Toute la chaîne d'analyse.</h2>
          <p>
            Excel pour les données tabulaires, Word pour les documents :
            inspection, stats, anomalies, tendances et recommandations — sans
            écrire une formule.
          </p>
        </div>
        <div className="bento">
          {FEATURES.map((c) => (
            <CarteFeature key={c.titre} carte={c} />
          ))}
        </div>
      </section>

      <div className="bloc-gris">
        <section className="section" id="fonctionnement">
          <div className="section-titre">
            <span className="sur-titre">Comment ça marche</span>
            <h2>De l'upload au rapport, sans friction</h2>
            <p>
              Validation stricte, traitement découplé, résultats prêts en
              quelques secondes.
            </p>
          </div>
          <div className="etapes">
            {ETAPES.map((e) => (
              <div key={e.n} className="etape">
                <div className="num-etape">{e.n}</div>
                <h3>{e.titre}</h3>
                <p>{e.texte}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="section" id="securite">
        <div className="section-titre">
          <span className="sur-titre">Sécurité & conformité</span>
          <h2>Vos fichiers restent les vôtres</h2>
          <p>
            Conçu pour le RGPD dès le MVP : isolation par organisation,
            chiffrement, suppression à la demande.
          </p>
        </div>
        <div className="bento">
          {SECURITE.map((s) => (
            <div key={s.titre} className="b-carte">
              <div className="b-ico">{s.ico}</div>
              <h3>{s.titre}</h3>
              <p>{s.texte}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="bloc-gris">
        <section className="section" id="api">
          <div className="section-titre">
            <span className="sur-titre">Développeurs</span>
            <h2>API REST pour brancher vos outils</h2>
            <p>
              Auth JWT, upload multipart, polling de statut, résultats JSON — le
              même contrat que le frontend.
            </p>
          </div>
          <div className="bento">
            <div className="b-carte large">
              <div className="b-ico">⚡</div>
              <h3>Endpoints principaux</h3>
              <p>
                Créez un compte, uploadez, suivez le job, récupérez le JSON de
                résultat.
              </p>
              <ul className="liste-points">
                <li>
                  <code>POST /auth/inscription</code> ·{" "}
                  <code>POST /auth/connexion</code>
                </li>
                <li>
                  <code>POST /fichiers</code> — upload → job créé
                </li>
                <li>
                  <code>GET /fichiers/{'{id}'}/statut</code> — polling
                </li>
                <li>
                  <code>GET /fichiers/{'{id}'}/resultat</code> — JSON complet
                </li>
                <li>
                  <code>DELETE /fichiers/{'{id}'}</code> — purge RGPD
                </li>
              </ul>
            </div>
            <div className="b-carte fonce">
              <div className="b-stat-chiffre">JSON</div>
              <h3>Format de sortie stable</h3>
              <p>
                resume_statistique, anomalies[], tendances[], recommandations[],
                insights_ia — versionnable et facile à consommer.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="section">
        <div className="section-titre">
          <span className="sur-titre">Témoignages</span>
          <h2>Ce qu'en disent nos utilisateurs</h2>
          <p>
            Des équipes data, finance et support qui gagnent des heures chaque
            semaine.
          </p>
        </div>
        <div className="temoignages">
          {TEMOIGNAGES.map((t) => (
            <div key={t.nom} className="temoignage">
              <div className="etoiles">★★★★★</div>
              <p>{t.texte}</p>
              <div className="auteur-t">
                <div className="avatar-t">{t.init}</div>
                <div>
                  <div className="nom">{t.nom}</div>
                  <div className="role">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="bloc-gris">
        <section className="section" id="tarifs">
          <div className="section-titre">
            <span className="sur-titre">Tarifs</span>
            <h2>Simple, transparent, sans surprise</h2>
            <p>
              Quotas vérifiés à l'upload et avant chaque appel IA. Passez de
              Gratuit à Pro quand vous en avez besoin.
            </p>
          </div>
          <div className="prix">
            {OFFRES.map((o) => (
              <div
                key={o.nom}
                className={`offre ${o.populaire ? "populaire" : ""}`}
              >
                {o.populaire && (
                  <div className="badge-pop">Le plus choisi</div>
                )}
                <div className="nom-offre">{o.nom}</div>
                <div className="montant-offre">
                  {o.prix} {o.unite && <span>{o.unite}</span>}
                </div>
                <div className="desc-offre">{o.desc}</div>
                <ul>
                  {o.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <Link to="/connexion" className="btn-offre">
                  {o.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="section" id="faq">
        <div className="section-titre">
          <span className="sur-titre">FAQ</span>
          <h2>Questions fréquentes</h2>
          <p>Tout ce que vous devez savoir avant de commencer.</p>
        </div>
        <div className="faq">
          {FAQ.map((item) => (
            <details key={item.q} className="q-faq" open={item.ouvert || false}>
              <summary>{item.q}</summary>
              <div className="rep">{item.r}</div>
            </details>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="cta-finale">
          <h2>Prêt à transformer vos fichiers en décisions ?</h2>
          <p>
            5 fichiers offerts chaque mois. Aucune carte bancaire requise pour
            commencer.
          </p>
          <Link to="/connexion" className="btn-cta-blanc">
            Commencer gratuitement →
          </Link>
        </div>
      </section>

      <footer className="site-footer">
        <div className="pied-inner">
          <div className="pied-haut">
            <div className="pied">
              <div className="marque">
                <span className="rond">G</span> GestAnalyse
              </div>
              <div className="adresse">
                Plateforme d'analyse de données Excel &amp; Word.
                <br />
                Transformez vos fichiers en décisions.
              </div>
            </div>
          </div>
          <div className="pied-bas">
            <div>© 2026 GestAnalyse. Tous droits réservés.</div>
            <div>Français (BF)</div>
          </div>
        </div>
      </footer>
    </>
  );
}
