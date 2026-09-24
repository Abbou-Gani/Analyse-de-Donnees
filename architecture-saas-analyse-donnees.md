# Architecture — SaaS d'analyse de données (Excel/Word)

## 1. Vision du produit

Un utilisateur importe un fichier Excel ou Word. Le système extrait les données, les analyse (statistiques simples puis, à terme, insights avancés via IA), et restitue des résultats exploitables pour la prise de décision.

Stack choisie : **FastAPI** (backend) + **React** (frontend), conçue pour scaler dès le départ.

---

## 2. Principe directeur : découpler le rapide du lent

Le traitement de fichiers et l'analyse de données sont des opérations lentes. Elles ne doivent jamais bloquer une requête API. L'architecture repose donc sur une **séparation entre le chemin synchrone (API)** et le **chemin asynchrone (traitement)**, reliés par une file d'attente.

---

## 3. Composants principaux

| Composant | Rôle | Technologie proposée |
|---|---|---|
| **Client** | Interface utilisateur, SPA | React, hébergé sur un CDN |
| **API** | Point d'entrée, stateless, gère l'auth, l'upload, les requêtes | FastAPI, plusieurs instances derrière un load balancer |
| **Stockage objet** | Stocke les fichiers bruts uploadés | S3 (ou équivalent : Cloudflare R2, MinIO) |
| **File d'attente** | Découple l'upload du traitement lourd | Redis + Celery (ou RQ / Dramatiq) |
| **Workers** | Processus séparés qui exécutent le traitement | Python (pandas, openpyxl, python-docx) |
| **Base de données** | Stocke utilisateurs, métadonnées, résultats | PostgreSQL |
| **Cache** | Accélère les lectures fréquentes | Redis |

### Flux général

1. L'utilisateur uploade un fichier via le client React.
2. L'API FastAPI reçoit la requête, valide le fichier, le stocke dans le stockage objet, et pousse un job dans la file d'attente. Elle répond immédiatement (sans attendre le traitement).
3. Un worker disponible récupère le job, télécharge le fichier, le parse, l'analyse, et sauvegarde les résultats en base.
4. Le client interroge l'API (polling) pour savoir quand les résultats sont prêts.

### Pourquoi ça scale

- **API et workers scalent indépendamment** : ajoute des instances API pour plus de trafic de lecture, ajoute des workers pour plus de fichiers à traiter.
- La file d'attente **absorbe les pics de charge** sans faire tomber le système.
- Stockage objet et base de données sont **externes** aux serveurs applicatifs — pas de point unique de défaillance, et les serveurs API/workers restent stateless donc interchangeables.

---

## 4. Pipeline interne d'un worker

1. **Job reçu** — le worker prend en charge le job depuis la file d'attente. Plusieurs workers se répartissent automatiquement les jobs.
2. **Téléchargement** — récupère le fichier brut depuis le stockage objet (seule la référence du fichier transite dans la file, jamais le fichier lui-même).
3. **Parsing** — détecte le type de fichier et extrait les données :
   - Excel → `pandas` + `openpyxl`
   - Word → `python-docx` (texte, tableaux, listes selon le contenu)
   - Doit être tolérant aux fichiers mal formatés : validation qui rejette proprement plutôt que de crasher.
4. **Analyse** — deux niveaux :
   - Simple : stats descriptives via pandas/numpy
   - Avancée : appel à un modèle IA (ex. API Claude) pour générer des insights en langage naturel et des recommandations
5. **Sauvegarde** — résultats en base, statut du job mis à jour à "terminé".

### Résilience à prévoir

- **Jobs idempotents** : relancer un job deux fois ne doit pas dupliquer les résultats.
- **Retry avec limite** : 3 tentatives max, puis le job passe en échec et l'utilisateur est notifié.
- **Timeout par job** : évite qu'un fichier énorme ou un bug bloque un worker indéfiniment.

---

## 5. Module d'analyse (le cœur du produit)

L'analyse dépend du type de fichier : les analyses et les décisions proposées doivent être guidées par ce que le fichier contient réellement.

### Analyse Excel (données tabulaires)

1. **Inspection** — détection automatique des colonnes : numériques, catégorielles, dates.
2. **Stats descriptives** par colonne numérique : moyenne, médiane, écart-type, min/max, quartiles, valeurs manquantes.
3. **Détection de tendance** — si une colonne date existe, analyse temporelle (croissance/ décroissance, saisonnalité simple).
4. **Anomalies** — z-score / méthode IQR pour signaler les valeurs aberrantes.
5. **Relations** — croisement entre colonnes catégorielles et numériques (moyenne par groupe), top N, corrélations entre colonnes numériques.
6. **Recommandations** (via IA ou règles) : "le produit X surperforme de 22 %", "le coût Y a doublé en Q3".

### Analyse Word (texte / documents)

1. **Extraction** — paragraphes, tableaux, listes.
2. **Résumé automatique** du document.
3. **Mots-clés / thèmes** — fréquences, extraction des termes importants.
4. **Entités** — dates, montants/chiffres, noms cités dans le document.
5. **Recommandations** — synthèse des points d'action, détection d'objectifs ou de risques si détectables.

### Format de sortie (structure)

Le résultat d'un job est stocké en JSON dans `analysis_results` et contient :

```json
{
  "resume_statistique": { "...": "par_type_de_fichier" },
  "anomalies": [],
  "tendances": [],
  "recommandations": [],
  "insights_ia": "texte en langage naturel (optionnel)"
}
```

---

## 6. Intégration IA (niveau avancé)

- Conçue comme une **étape optionnelle du pipeline**, déclenchée si le plan utilisateur l'inclut.
- **Coûts** : chaque appel est facturé, il faut compter les tokens consommés par job et les exposer pour facturation/limitation.
- **Robustesse** : si l'API IA est en échec ou timeout → fallback sur l'analyse simple (le job reste terminé, l'IA est signalée comme indisponible).
- **Sécurité des sorties** : le payload envoyé au modèle doit être **tronqué/extrait** (résumé des stats plutôt que le fichier entier), et les données sensibles filtrées avant l'appel.
- **Versionnage** : stocker le nom/version du modèle utilisé dans le résultat pour traçabilité.

---

## 7. Schéma de base de données (simplifié)

- **organizations** — id, nom, plan d'abonnement
- **users** — id, organization_id, email, mot de passe hashé, rôle (propriétaire / membre)
- **files** — id, organization_id, user_id, nom original, chemin stockage objet, type (xlsx/docx), taille, date d'upload
- **analysis_jobs** — id, file_id, statut (en_attente / en_cours / terminé / échoué), créé_le, terminé_le, tentative_count
- **analysis_results** — id, job_id, résumé stats (JSON), insights IA (texte, avec version du modèle), recommandations (JSON)

Le champ JSON pour les résultats laisse de la flexibilité tant que la logique d'analyse évolue.

---

## 8. Contrat API (v1)

### Endpoints

| Méthode | Chemin | Rôle |
|---|---|---|
| POST | `/auth/register` | Création de compte |
| POST | `/auth/login` | Authentification → JWT |
| POST | `/auth/refresh` | Renouvellement du token |
| POST | `/files` | Upload du fichier (multipart) → job créé |
| GET | `/files` | Liste des fichiers de l'organisation |
| GET | `/files/{id}` | Métadonnées + statut du job |
| GET | `/jobs/{id}` | Statut du job (polling) |
| GET | `/results/{job_id}` | Résultats d'analyse complets |
| DELETE | `/files/{id}` | Suppression du fichier et de ses résultats |

### Notification client : polling (choix MVP)

- Le client interroge `GET /jobs/{id}` toutes les 2-3 secondes tant que le statut est `en_cours`.
- Simple, stateless, fonctionne avec un simple load balancer.
- WebSocket/SSE peuvent être ajoutés plus tard pour le temps réel, sans casser le contrat actuel.

### Authentification

- **JWT** comme jeton d'accès court (15-30 min) + **refresh token** long stocké en cookie sécurisé (httpOnly) ou en base.
- Les routes `/files` et `/results` vérifient que le fichier/job appartient bien à l'organisation de l'utilisateur (**règle d'accès par tenant**).

---

## 9. Plans d'abonnement et quotas

| Capacité | Gratuit | Pro (exemple) |
|---|---|---|
| Fichiers / mois | 5 | Illimité |
| Taille max / fichier | 10 Mo | 100 Mo |
| Analyse simple (stats) | Oui | Oui |
| Insights IA | Non | Oui |
| Nombre de colonnes / lignes traitées | Limité | Sans limite |

- Les limites sont vérifiées à l'upload (rejet immédiat si dépassement) **et** avant l'analyse IA dans le worker (coût).
- Compter la consommation IA pour éviter l'abus : max par plan, quota renouvelé mensuellement.

---

## 10. Sécurité, conformité et protection des données

- **Validation des uploads** : type de fichier vérifié par le vrai format (magic bytes) et pas seulement l'extension, extension `.xlsx`/`.docx` uniquement, taille max imposée, scan antivirus/malware sur les fichiers reçus.
- **Chiffrement** : fichiers chiffrés au repos dans le stockage objet, HTTPS partout, données en transit chiffrées (TLS).
- **Secrets** : clés API (S3, IA, base de données) jamais dans le code — gérées via un secret manager / variables d'environnement chiffrées.
- **Isolation des données** : chaque requête est scopée par `organization_id` pour empêcher tout accès entre organisations.
- **RGPD** :
  - Consentement explicite à l'upload (les fichiers peuvent contenir des données personnelles).
  - Droit à la suppression : `DELETE /files/{id}` supprime fichier + résultats.
  - Rétention : contrat de conservation (ex. suppression automatique après X mois sans utilisation).
  - Hébergement : régions EU si possible, et informations claires envers les utilisateurs.

---

## 11. Déploiement

- **Conteneurisation** : chaque composant (API, workers) dans son propre conteneur Docker.
- **Au démarrage** : un PaaS simple (Railway, Render, Fly.io) qui gère déjà le load balancing et le scaling horizontal, sans configuration Kubernetes.
- **Quand le trafic grossit** : migration vers Kubernetes ou AWS ECS pour un contrôle plus fin.
- **Observabilité dès le début** : logs centralisés + un outil comme Sentry pour les erreurs — indispensable pour déboguer des workers asynchrones.
- **CI/CD** dès le MVP : tests unitaires validés avant déploiement automatique.

---

## 12. Prochaines étapes suggérées

- [ ] Définir le **modèle de données exact** du résultat d'analyse (fichier JSON de référence)
- [ ] Prototyper le **module de parsing + stats** (étape pilotable sans IA)
- [ ] Valider le comportement **Word** (résumé + mots-clés) comme POC séparé
- [ ] Implémenter l'auth JWT + refresh tokens
- [ ] Implémenter l'upload + polling de bout en bout
- [ ] Brancher l'IA en option derrière le plan Pro
- [ ] Mettre en place la CI/CD et l'observabilité