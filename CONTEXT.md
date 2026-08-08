# Contexte de developpement - Byhnex (suivi crypto & signaux)

Ce fichier sert de reference rapide pour le projet. Il doit rester simple, concret et a jour.

## Objectif du projet

Byhnex : un site statique de suivi crypto en temps reel, sans serveur et sans cout.
Dashboard de prix avec suivi de portefeuille, page de signaux RSI en direct,
Rainbow Chart Dogecoin, saisonnalite Bitcoin, plus un robot GitHub Actions qui
envoie des notifications push quand une crypto entre en zone d'achat ou de vente.

Le bot de trading virtuel (paper trading) a ete retire le 08/08/2026 :
la page conserve uniquement la surveillance de marche et les signaux.

## Regles absolues (non negociables)

- Aucun ordre reel, jamais : le site n'execute aucune transaction.
- Aucune cle API d'exchange dans le code, meme en test.
  Exception decidee le 28/07/2026 : une cle Coinbase en LECTURE SEULE peut etre
  stockee dans les secrets GitHub Actions (jamais dans le code, jamais publiee).
  Les positions reelles n'apparaissent que dans les notifications ntfy privees.
- Aucune donnee envoyee vers un serveur : tout reste dans le navigateur.
- Toujours afficher l'avertissement « pas un conseil financier » dans l'UI.
- Zero dependance payante : uniquement des APIs publiques gratuites.

## Regles de code

- Un fichier HTML = une application complete et autonome (HTML + CSS + JS inline).
- Pas de build, pas de framework : le fichier doit s'ouvrir par double-clic.
- Si un fichier depasse ~600 lignes ou melange trop de sujets, discuter d'un decoupage.
- Separer clairement dans le script : constantes de config en haut, moteur de strategie,
  acces API, rendu UI.
- La logique de strategie ne doit dependre que des bougies cloturees : elle doit etre
  deterministe et rejouable (c'est ce qui permet le rattrapage a la reouverture).
- Preferer du code lisible a une abstraction compliquee.
- Les commentaires expliquent les choix non evidents, pas le code lui-meme.

## Regles CSS

- Le CSS reste dans une balise `<style>` unique en tete de fichier (site mono-fichier).
- Utiliser les variables CSS du theme (`--bg`, `--card`, `--green`, `--red`, etc.)
  et ne jamais mettre de couleur en dur ailleurs.
- Vert = hausse/achat, rouge = baisse/vente, jaune = avertissement : ne pas devier.
- Reutiliser les classes existantes (`card`, `sig`, `up`, `down`) avant d'en creer.
- Toute modification visuelle doit etre testee sur desktop et mobile
  (les colonnes `hide-mobile` disparaissent sous 700 px).

## Structure actuelle

- `index.html` : accueil Byhnex, cartes vers les quatre outils.
- `crypto-dashboard.html` : suivi de prix top 20 (API CoinGecko, refresh 60 s) +
  quantites personnelles. Stockage : `crypto-portfolio-v1`.
- `signaux-crypto.html` : top 20 tradable sur Coinbase, prix temps reel WebSocket
  Binance, RSI 14 sur bougies 15 min, tendance 50/200, zones d'achat (<30) et de
  vente (>70), alertes navigateur. Aucune simulation de trading.
- `rainbow-crypto.html` : Rainbow Chart des 10 premieres capitalisations (le reste
  du site suit le top 20 ; le Rainbow se limite au top 10, historique plus long). Historique complet par crypto (CoinCodex) + prix live WebSocket Binance,
  regression log et 9 bandes calculees dans le navigateur pour chaque crypto,
  onglets synchronises avec le top 10 (resynchronisation toutes les 15 min),
  infobulle $/EUR au survol. Avertissement si moins de 4 ans d'historique.
- `positionnement.html` : donnees de contrats perpetuels Binance Futures pour le
  meme top 20 : funding rate (8 h et annualise), open interest et sa variation 24 h,
  ratio long/short des comptes, et lecture croisee prix/OI. Refresh 5 min.
- `saisonnalite-btc.html` : rendements mensuels BTC depuis 2014 en heatmap,
  mois en cours au prix live.
- `scripts/build-data.mjs` + `.github/workflows/robot-signaux.yml` : toutes les 5 min,
  GitHub Actions recalcule les signaux et publie `data.json`, `widget*.txt` et les
  colonnes sur la branche `data` (widget KWGT), et envoie une notification ntfy a
  chaque entree en zone (canal secret dans le secret Actions `NTFY_TOPIC`).
- `CONTEXT.md` : ce fichier.

## Regles APIs et donnees

- CoinGecko (dashboard) : API gratuite sans cle, limitee (~10-30 req/min).
  Ne jamais descendre le refresh sous 60 s.
- Binance (bot) : REST `/api/v3/klines` pour les bougies, WebSocket `stream.binance.com`
  pour le direct. Toujours filtrer les bougies non cloturees (`closeTime <= now`).
- Toujours gerer l'echec reseau : afficher un etat « hors ligne », reessayer, ne jamais
  planter ni corrompre l'etat sauvegarde.
- L'univers commun aux pages et au robot : top 20 par capitalisation, hors
  stablecoins ET actifs adosses (or : PAXG, XAUT ; staking liquide : stETH...),
  limite aux cryptos tradables sur Coinbase. Le classement CoinGecko est demande
  sur 60 lignes car les filtres en eliminent beaucoup.
- Ne jamais changer le nom d'une cle localStorage sans migration : ca effacerait
  le portefeuille ou l'historique du bot de l'utilisateur.

## Workflow Git

- Travailler sur une branche par sujet.
- Faire des commits petits, lisibles et testables.
- Un commit = une intention claire.
- Ne pas melanger refactor, fix bug et nouvelle feature dans le meme commit.
- Avant commit : ouvrir le fichier, verifier la console navigateur sans erreur,
  verifier que le WebSocket se connecte et que l'etat sauvegarde est intact.

## Format des commits

```text
type(scope): resume court

Details utiles si necessaire :
- ce qui a change
- pourquoi
- comment tester
```

Types recommandes : `feat`, `fix`, `refactor`, `style`, `docs`, `test`, `chore`.

Scopes recommandes : `dashboard`, `bot`, `strategie`, `ws`, `ui`, `storage`, `docs`.

Exemples :

```text
feat(strategie): ajoute un stop-loss virtuel a -5 %

- vend la position si le prix cloture 5 % sous le prix d'achat
- parametre STOP_LOSS en haut du script
- test manuel : rejouer 500 bougies apres reset et verifier le journal
```

```text
fix(ws): reconnecte proprement apres une coupure reseau

- backoff de 3 s, pas de reconnexions en rafale
- test manuel : couper le wifi 30 s, verifier le retour du point vert
```

## Tests manuels minimum

Pour une modification UI :

- Ouvrir le fichier, verifier desktop et mobile.
- Verifier qu'aucun montant ne deborde ou ne s'affiche « NaN ».

Pour une modification strategie/bot :

- Cliquer « Reinitialiser », laisser le rattrapage rejouer les 500 bougies.
- Verifier que le journal est coherent (achats sous RSI 30, ventes au-dessus de 70).
- Verifier que cash + positions = valeur totale.
- Fermer et rouvrir la page : l'etat doit etre identique, sans trades dupliques.

Pour une modification reseau :

- Verifier la connexion WebSocket (point vert « EN DIRECT »).
- Couper le reseau, verifier le message d'erreur, retablir, verifier la reprise.

## Decisions techniques importantes

- Le bot est et reste virtuel : passer a l'argent reel n'est pas un objectif du projet
  tant que la strategie n'a pas prouve sa valeur sur 4-6 semaines minimum.
- Le rattrapage a la reouverture remplace un serveur : pas de Firebase, pas de backend,
  pas de cout, pas de cle a proteger.
- La strategie s'evalue uniquement a la cloture des bougies 15 min : simple, deterministe,
  et insensible au bruit tick par tick.
- Le projet doit rester compatible GitHub Pages (statique pur).
- Toute nouvelle dependance externe doit etre justifiee.
