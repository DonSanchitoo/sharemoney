# ShareMoney

Partage du loyer et dépenses de groupe, pensé pour l'iPhone (installable sur l'écran d'accueil).
Publié sur GitHub Pages, données synchronisées via Supabase.

## Ce que fait l'app

**Loyer** : loyer, charges et aides (APL…) d'un logement, entre autant de colocataires que voulu.
Qui paie quoi, qui reçoit quoi, parts en % (ou au prorata des revenus), lignes réservées à certaines
personnes, virements minimaux à cocher, un état par mois et un historique avec graphique.
L'app suggère qui devrait virer le loyer pour limiter les virements entre vous.

**Projets** : un « Tricount » avec logo (emoji ou photo), lien d'invitation et types préréglés :

| Type | Outils activés par défaut |
|---|---|
| Vacances / voyage | billets (avion, train…), hébergements, programme jour par jour, check-list valise, budget, devises, carburant |
| Week-end | hébergements, programme, « à emporter », carburant |
| Repas / soirée | « qui apporte quoi » |
| Colocation / maison | dépenses récurrentes, liste de courses, budget |
| Événement (EVG, anniversaire…) | personne fêtée exclue des frais, cagnotte, tâches, budget |
| Cadeau commun | cagnotte avec objectif, idées cadeau |
| Voiture / covoiturage | calcul du plein, récurrentes, budget |
| Sport / activité régulière | récurrentes, matériel |

Chaque outil s'active ou se désactive dans les réglages du projet. Partout : répartition égale, par parts,
par montants ou en %, parts par défaut (couple = 2), remboursements minimaux, photos de tickets,
multi-devises avec taux automatique, budget avec alertes, export CSV (Excel) et PDF, mode hors ligne.

## Publier une version

Chaque tag `v*` déclenche le workflow `Déploiement GitHub Pages` :

```bash
git tag v1.1.0
git push origin v1.1.0
```

La version s'affiche en bas des Réglages. Les iPhone qui ont l'app proposent « Mettre à jour » au lancement suivant.

### Réglages GitHub à faire une fois

1. **Settings → Pages → Build and deployment → Source : GitHub Actions.**
2. **Settings → Environments → github-pages → Deployment branches and tags** : ajouter une règle de tag `v*`
   (sinon GitHub refuse de déployer depuis un tag).
3. Relancer le dernier run du workflow (ou pousser un nouveau tag).

L'app est ensuite sur `https://donsanchitoo.github.io/sharemoney/`.

## Données et sécurité

- Supabase (projet `qpoahqpfuliozoxbwvat`, schéma dans `supabase/migrations/`). Tables préfixées `sm_`.
- Les tables ne sont pas lisibles directement : tout passe par des fonctions SQL (`sm_pull`, `sm_push`, `sm_receipt_*`)
  qui n'exposent un projet qu'à qui fournit son jeton secret (128 bits, dans le lien d'invitation).
- Conséquence assumée : **toute personne qui a le lien d'un projet peut le lire et le modifier**. Ne le poste pas publiquement.
- La « clé personnelle » (Réglages → Mes appareils) relie tes appareils : elle donne accès à tous tes projets, garde-la pour toi.
- Sur iPhone, l'app installée sur l'écran d'accueil ne partage pas les données de Safari : colle ta clé dans l'app installée.
- `supabase.config.json` contient l'URL et la clé *publishable* (publique par conception).
- Le workflow `Supabase keepalive` appelle l'API tous les 3 jours pour éviter la mise en pause du plan gratuit.

## Développement

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # calculs, loyer, synchro multi-appareils
npm run build
```

Stack : Vite, Preact + signals, TypeScript, supabase-js, idb-keyval (stockage local), jsPDF (chargé à la demande).
Les icônes se régénèrent avec `node scripts/icons.mjs` (Playwright).
