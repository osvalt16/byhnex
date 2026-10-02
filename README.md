# Byhnex — cours réels, portefeuille virtuel

Site statique : accueil avec boîte à outils, recherche et favoris ; sept outils dont le graphique d’accumulation SOL/BTC. Les cartes reprennent le fond sombre translucide et les liserés cyan/violet de Byhnex. Le grand bloc graphique a été retiré de l’accueil.

## Démarrer et vérifier
- `npm.cmd start` : http://localhost:5173
- `npm.cmd test` : calculs après frais, agrégation OHLC, ticks, prix manquants, réponse réseau tardive, conversion valeur/quantité et réserve.
- `npm.cmd run build` : export statique des 30 ressources publiques vers `dist`, liens relatifs contrôlés pour GitHub Pages.
- `browser-portfolio-check.mjs` : cours réels, valeurs éditables, capital/réserve, cartes, mobile (Chrome DevTools sur localhost:9224).
- `browser-tools-check.mjs` : vérification des six outils existants avec les données réelles.

## Graphique et dessins
Plein ?cran natif avec secours plein navigateur et raccourci F ; ?chap pour sortir. Le cadrage s?adapte ? la fen?tre. Zoom molette ou boutons, d?placement, dernier cours, volumes optionnels, EMA 20/50 calcul?es sur l?historique r?el.

Les niveaux de strat?gie sont masqu?s par d?faut et activables via Strat?gie. Fibonacci standard par d?faut ; option de niveaux personnalis?s en %, extensions, inversion et couleur dans R?glages. Chaque dessin conserve ses propres r?glages ; sa roue dent?e dans ?l?ments permet de le modifier. Deux clics d?finissent les points, avec aper?u apr?s le premier. Les dessins et pr?f?rences sont sauvegard?s localement ; les anciennes positions SOL/BTC sont conserv?es et DOGE/ZEC commencent ? z?ro.

`browser-chart-check.mjs` v?rifie les quatre cours, les bougies DOGE/ZEC, les EMA, les niveaux personnalis?s, l??dition d?un Fibonacci, les deux modes plein ?cran, la migration du portefeuille et l?affichage mobile.

## Sources et actualisation
- Graphique SOL/BTC/DOGE/ZEC : Coinbase USD, historique REST et ticks WebSocket ; secours Binance USDT avec libellé explicite et valorisation indicative du portefeuille (USDT assimilé au dollar). Contrôle de fraîcheur, reconnexion, bouton Réessayer et rafraîchissement REST toutes les 30 s. Les bougies 30 m/4 h/1 W Coinbase sont agrégées à partir des unités disponibles. Aucune bougie artificielle ne remplit les trous.
- Tableau top 20 : CoinGecko, actualisation 60 s.
- Signaux RSI et prix Rainbow : Binance WebSocket ; RSI sur bougies clôturées.
- Positionnement : Binance Futures, actualisation 5 min.
- Saisonnalité/Rainbow/backtest : historiques réels (CoinCodex/Binance) ; ce sont des analyses historiques, pas des ordres de marché.
- Accueil : prix SOL/BTC par sa propre connexion ; capitalisation et dominance CoinGecko à intervalle 5 min ; indice Bitcoin quotidien attribué à Alternative.me.
- Devises : taux réels open.er-api, cache daté de moins de 48 h en secours. Aucun taux EUR/USD inventé n’est utilisé si le fournisseur et le cache sont indisponibles.

Les fournisseurs peuvent limiter les appels ou être indisponibles. Le site signale les données périmées ; les appels publics Binance ont un secours et des délais maximum. Aucun secret ni compte exchange n’est nécessaire.

## Portefeuilles virtuels
Le portefeuille SOL/BTC/DOGE/ZEC commence à zéro pour un nouvel utilisateur. Les données précédemment enregistrées restent conservées. Le formulaire accepte les quantités, valeurs de positions, prix moyens, réserve et capital total. La conversion valeur/quantité utilise le cours réel au moment de l’ouverture du formulaire. Changer le capital ajuste la réserve ; les positions restent inchangées. Le formulaire propose de remettre à jour la référence HOLD. Les cycles ouverts doivent conserver leur réserve.

Le tableau marché conserve son portefeuille virtuel multi-actifs, distinct du portefeuille d’accumulation SOL/BTC : quantités ou valeurs éditables dans la devise choisie, réserve modifiable et capital cible. Les données de ces portefeuilles sont stockées localement dans le navigateur ; aucun argent réel ne bouge.

Ventes/rachats du journal : écritures de simulation uniquement. Une vente virtuelle exige un cours récent et une position suffisante. Les niveaux et gains sont des scénarios après frais, pas des bénéfices garantis. Pas de wallet ni d’ordre réel.

## Déploiement
https://osvalt16.github.io/byhnex/ — dépôt `osvalt16/byhnex`, branche `main`, workflow existant Deploy Pages. Les pages Byhnex d’origine, le module de devises et les images proviennent du site fourni par l’utilisateur. Les workflows de notifications et la branche de données sont préservés.

`prepare-deployment.js` copie seulement les fichiers publics dans le clone `pages-repository`. Il vérifie que les scripts métier des autres outils n’ont pas changé ; le tableau portefeuille est volontairement modifié pour les valeurs éditables. Le serveur local, profils Chrome, PDF extraits et tests ne sont pas publiés.

## Assistant IA
Assistant BTC/SOL accessible depuis la sidebar ou le bouton flottant. Le chat réutilise les bougies et le portefeuille virtuel, conserve la session et propose des repères graphiques. Le front reste sur GitHub Pages ; l’API PHP 8.2 est prévue pour OVH PRO à https://byhnex.com/api/ai-chat. Les secrets restent dans /.secrets/.env, hors de /www. Transfert et connexion : [OVH_SETUP.md](OVH_SETUP.md). L’API devient active après le transfert du dossier PHP.

Les tests JavaScript et PHP utilisent des réponses OpenAI simulées, sans appel payant. Aucun serveur PHP ni .env n’est publié sur Pages.
