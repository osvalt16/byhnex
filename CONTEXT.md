# Contexte de developpement - Byhnex (suivi crypto & signaux)

Ce fichier sert de reference rapide pour le projet. Il doit rester simple, concret et a jour.

## Objectif du projet

Byhnex : un site statique de suivi crypto en temps reel, sans serveur et sans cout.
Cinq outils : dashboard de prix avec quantites personnelles, signaux RSI en direct,
Rainbow Chart, positionnement des contrats a terme, saisonnalite Bitcoin.
En complement, un robot GitHub Actions envoie des notifications push sur telephone
et alimente un widget Android quand une crypto entre en zone d'achat ou de vente.

Le site n'a aucune vocation transactionnelle : il informe, il ne decide pas.

## Regles absolues (non negociables)

- Aucun ordre reel, jamais : le site n'execute aucune transaction.
- Aucune cle API d'exchange dans le code, meme en test.
  Une cle en LECTURE SEULE peut etre stockee dans les secrets GitHub Actions
  (jamais dans le code, jamais publiee sur la branche `data` qui est publique).
  C'est ce qui avait ete fait pour Coinbase le 28/07/2026, puis retire le 08/08/2026 :
  le code dormant subsiste dans `scripts/build-data.mjs` et ne s'active que si les secrets existent.
- Aucune donnee personnelle envoyee ailleurs : quantites du portefeuille, devise choisie
  et etat des alertes restent dans le navigateur. Seules des donnees de marche publiques
  transitent par GitHub Actions et ntfy.
- Toujours afficher l'avertissement « pas un conseil financier » dans l'UI.
- Zero dependance payante : uniquement des APIs publiques gratuites, sans cle.

## Regles de code

- Un fichier HTML = une application complete et autonome (HTML + CSS + JS inline).
  Seule exception : `devises.js`, partage par les cinq pages (voir Structure).
- Pas de build, pas de framework : le fichier doit s'ouvrir par double-clic.
- Si un fichier depasse ~600 lignes ou melange trop de sujets, discuter d'un decoupage.
- Separer clairement dans le script : constantes de config en haut, calculs,
  acces API, rendu UI.
- Les indicateurs ne se calculent que sur des bougies cloturees : ils doivent etre
  deterministes et donner le meme resultat a chaque rechargement de page.
- Preferer du code lisible a une abstraction compliquee.
- Les commentaires expliquent les choix non evidents, pas le code lui-meme.

## Regles CSS

- Le CSS reste dans une balise `<style>` unique en tete de chaque fichier.
- Utiliser les variables CSS du theme (`--bg`, `--card`, `--green`, `--red`, etc.)
  et ne jamais mettre de couleur en dur ailleurs.
- Vert = hausse, rouge = baisse, jaune = avertissement : ne pas devier.
- Reutiliser les classes existantes (`panel`, `card`, `up`, `down`, `warn`, `note`,
  `hide-mobile`, `cur`) avant d'en creer.
- Toute modification visuelle doit etre testee sur desktop et mobile
  (les colonnes `hide-mobile` disparaissent sous 700 px).

## Structure actuelle

- `index.html` : accueil Byhnex, cartes vers les cinq outils.
- `crypto-dashboard.html` : top 20 CoinGecko (refresh 60 s) + quantites personnelles
  saisies a la main. Stockage : `crypto-portfolio-v1`.
- `signaux-crypto.html` : top 20 tradable sur Coinbase, prix temps reel WebSocket
  Binance, RSI 14 sur bougies 15 min, tendance 50/200, zones d'achat (<30) et de
  vente (>70), barre d'analyse du marche Bitcoin, alertes navigateur.
  Stockage : `crypto-bot-alerts` (etat du bouton Alertes).
- `rainbow-crypto.html` : Rainbow Chart des 10 premieres capitalisations (le reste
  du site suit le top 20 ; le Rainbow se limite au top 10, dont l'historique est
  assez long pour que la regression tienne). Historique complet par crypto (CoinCodex)
  + prix live WebSocket Binance, regression log et 9 bandes calculees dans le
  navigateur, onglets resynchronises toutes les 15 min, infobulle au survol.
  Avertissements affiches si moins de 4 ans d'historique, si des prix de lancement
  aberrants ont ete ecartes, ou si la pente de fond est negative (modele inadapte).
- `positionnement.html` : contrats perpetuels Binance Futures pour le meme top 20 :
  funding rate (8 h et annualise), open interest et sa variation 24 h, ratio
  long/short des comptes, lecture croisee prix/OI. Refresh 5 min.
  Gere les contrats cotes par lots (SHIB = `1000SHIBUSDT`, prix ramene a l'unite).
- `saisonnalite-btc.html` : rendements mensuels BTC depuis 2014 en heatmap,
  mois en cours calcule au prix live.
- `devises.js` : module partage par les cinq pages. Taux quotidiens depuis l'euro
  (open.er-api, 166 devises, sans cle). Les pages fournissent des montants en euros
  (`fmt`/`conv`) ou en dollars (`fmtUsd`/`convUsd`/`fmtBigUsd`), le module convertit
  et formate. Choix memorise dans `byhnex-devise`, donc partage entre toutes les pages.
  Seule entorse a la regle mono-fichier : dupliquer ce module cinq fois aurait ete pire.
- `scripts/build-data.mjs` + `.github/workflows/robot-signaux.yml` : toutes les 5 min,
  GitHub Actions recalcule les signaux (meme logique que `signaux-crypto.html`),
  publie `data.json`, `widget.txt`, `widget-color.txt` et les colonnes `col-*.txt`
  sur la branche `data` (consommee par le widget KWGT du telephone), et envoie une
  notification ntfy a chaque *entree* en zone (canal secret dans `NTFY_TOPIC`).
- `.github/workflows/pages.yml` : deploiement GitHub Pages a chaque push sur `main`.
- `crypto-bot-virtuel.html` et `rainbow-doge.html` : redirections vers les pages
  renommees, conservees pour les anciens liens et notifications deja envoyees.
- `CONTEXT.md` : ce fichier.

## Regles APIs et donnees

- L'univers commun aux pages et au robot : top 20 par capitalisation, hors
  stablecoins ET actifs adosses (or : PAXG, XAUT ; staking liquide : stETH, wstETH...),
  limite aux cryptos tradables sur Coinbase. Le classement CoinGecko est demande
  sur 60 lignes car les filtres en eliminent beaucoup (sur 30, on n'obtenait que 13).
- CoinGecko : API gratuite sans cle, limitee (~10-30 req/min).
  Ne jamais descendre le refresh sous 60 s.
- Binance : REST `/api/v3/klines` pour les bougies, WebSocket `stream.binance.com`
  pour le direct. Toujours filtrer les bougies non cloturees (`closeTime <= now`).
  Depuis les runners GitHub, `api.binance.com` renvoie HTTP 451 : le robot utilise
  le miroir `data-api.binance.vision` (memes chemins). Les pages, elles, tournent
  dans le navigateur de l'utilisateur et gardent `api.binance.com`.
- Binance Futures (`fapi.binance.com`) : funding, open interest, ratio long/short.
- CoinCodex : historiques longs du Rainbow Chart. Ecarter les prix de lancement
  aberrants (liquidite quasi nulle les premiers jours).
- Toujours gerer l'echec reseau : afficher un etat « hors ligne » ou un message
  d'erreur, reessayer, ne jamais planter ni corrompre les donnees sauvegardees.
- Ne jamais changer le nom d'une cle localStorage sans migration.
  Cles en service : `crypto-portfolio-v1` (quantites du dashboard),
  `crypto-bot-alerts` (alertes navigateur), `byhnex-devise` (devise d'affichage).

## Workflow Git

- Faire des commits petits, lisibles et testables.
- Un commit = une intention claire.
- Ne pas melanger refactor, correction de bug et nouvelle fonctionnalite.
- Avant commit : verifier la syntaxe du JS, que tous les `getElementById` du script
  existent bien dans le HTML, que les liens internes pointent vers des fichiers
  existants, et ouvrir la page pour controler la console.

## Format des commits

```text
type(scope): resume court

Details utiles si necessaire :
- ce qui a change
- pourquoi
- comment tester
```

Types recommandes : `feat`, `fix`, `refactor`, `style`, `docs`, `test`, `chore`.

Scopes recommandes : `signaux`, `dashboard`, `rainbow`, `positionnement`,
`saisonnalite`, `devises`, `mobile` (robot, widget, notifications), `ws`, `ui`, `docs`.

Exemple :

```text
fix(positionnement): le selecteur de devise disparaissait au changement

- le <select> etait detruit par le remplacement innerHTML du tableau
- reference stable + detachement avant reconstruction
- test : 5 reconstructions sous jsdom, selecteur et ecouteur intacts
```

## Tests manuels minimum

Pour une modification UI :

- Ouvrir la page, verifier desktop et mobile (moins de 700 px).
- Verifier qu'aucun montant ne deborde ni ne s'affiche « NaN » ou « 0,0000 »
  (les cryptos a tres bas prix comme SHIB sont le bon cas de test).
- Changer de devise et verifier que tout suit, selecteur compris.

Pour une modification des indicateurs :

- Comparer une valeur avec une source externe (RSI, funding, prix).
- Recharger la page : les valeurs doivent etre identiques, sans derive.

Pour une modification reseau :

- Verifier la connexion WebSocket (point vert « EN DIRECT »).
- Couper le reseau, verifier le message d'erreur, retablir, verifier la reprise.

Pour une modification du robot :

- `node scripts/build-data.mjs` en local, verifier le nombre de cryptos et
  le contenu de `out/widget.txt`.
- Declencher le workflow a la main, lire les logs, verifier la branche `data`.

## Decisions techniques importantes

- Le site informe, il ne conseille pas : chaque indicateur s'accompagne de ses
  limites (le Rainbow Chart repeint son histoire, la saisonnalite repose sur
  12 valeurs par mois, le positionnement dit ou est le risque et non ou va le prix).
- Le projet reste compatible GitHub Pages (statique pur) : aucun serveur a payer.
  GitHub Actions n'est pas un backend, c'est un declencheur periodique gratuit.
- Le RSI ne s'evalue qu'a la cloture des bougies 15 min : simple, deterministe,
  insensible au bruit tick par tick.
- Les pages partagent le meme univers de cryptos pour rester coherentes entre elles.
- Toute nouvelle dependance externe doit etre justifiee et gratuite, sans cle.

## Points ouverts

- Le planificateur GitHub Actions n'a jamais demarre tout seul : le robot n'a tourne
  que sur declenchement manuel. Solution de secours envisagee : un service externe
  gratuit (cron-job.org) appelant l'API `workflow_dispatch` avec un token a droits
  minimaux. A verifier avant de considerer les alertes comme autonomes.
- Idees non realisees, par ordre d'interet : RSI multi-echelles (15 min / 1 h / 4 h / 1 j),
  calculateur de taille de position, contexte de marche (Fear & Greed, dominance BTC,
  correlations).
