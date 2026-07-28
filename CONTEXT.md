# Contexte de developpement - Crypto Suivi & Bot Virtuel

Ce fichier sert de reference rapide pour le projet. Il doit rester simple, concret et a jour.

## Objectif du projet

Un site statique de suivi crypto en temps reel, sans serveur et sans cout :
un dashboard de prix avec suivi de portefeuille, et un bot de trading 100 % virtuel
qui teste une strategie automatiquement (paper trading).

Priorite actuelle : valider la strategie du bot en virtuel sur plusieurs semaines
avant toute discussion d'argent reel.

## Regles absolues (non negociables)

- Aucun ordre reel, jamais : le bot ne touche que de l'argent virtuel.
- Aucune cle API d'exchange dans le code, meme en test.
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

- `crypto-dashboard.html` : suivi de prix top 20 (API CoinGecko, refresh 60 s) +
  portefeuille personnel (quantites, prix d'achat, P&L). Stockage : `crypto-portfolio-v1`.
- `crypto-bot-virtuel.html` : bot paper trading. Prix temps reel via WebSocket Binance
  (miniTicker), strategie RSI 14 sur bougies 15 min (achat < 30 avec 10 % du cash,
  vente > 70), frais virtuels de 0,60 % par ordre (comme Coinbase Advanced),
  rattrapage des bougies manquees a l'ouverture. Univers : top 10 par capitalisation
  hors stablecoins, filtre aux cryptos tradables sur Coinbase, reclasse toutes les 15 min.
  Colonne tendance via moyennes 50/200 (bougies 15 min) + barre marche Bitcoin (50/200 jours).
  Les bougies ne sont retelechargees qu'apres chaque cloture 15 min.
  Stockage : `crypto-bot-v3` (+ `crypto-bot-alerts` pour l'etat des alertes).
- `CONTEXT.md` : ce fichier.

## Regles APIs et donnees

- CoinGecko (dashboard) : API gratuite sans cle, limitee (~10-30 req/min).
  Ne jamais descendre le refresh sous 60 s.
- Binance (bot) : REST `/api/v3/klines` pour les bougies, WebSocket `stream.binance.com`
  pour le direct. Toujours filtrer les bougies non cloturees (`closeTime <= now`).
- Toujours gerer l'echec reseau : afficher un etat « hors ligne », reessayer, ne jamais
  planter ni corrompre l'etat sauvegarde.
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
