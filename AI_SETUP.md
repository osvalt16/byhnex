# Activer l’Assistant IA Byhnex

L’interface reste sur GitHub Pages. **Le serveur de production choisi est OVHcloud Web Hosting PRO, PHP 8.2**, avec les secrets existants dans `/.secrets/.env`. Transfert sous `/www/iacrypto/`, test gratuit et connexion : **[OVH_SETUP.md](OVH_SETUP.md)**. L’adresse préconfigurée est `https://byhnex.com/iacrypto/ai-chat.php` ; le test public confirme que la configuration PHP est chargée. Le serveur appelle `POST https://api.openai.com/v1/responses`. Le projet existant est en JavaScript natif, sans Vue/Vite ; ses modules de marché, sa sauvegarde et son graphique sont réutilisés.

## Variables serveur

| Variable | Valeur | Stockage |
| --- | --- | --- |
| `OPENAI_API_KEY` | Clé API du projet OpenAI | `.secrets/.env` sur OVH, jamais Git/front |
| `OPENAI_MODEL` | Exemple : `gpt-5.4-mini`, modèle compatible Responses, Structured Outputs et outils | Variable serveur, modifiable sans changer le code |
| `BYHNEX_AI_ACCESS_CODE` | Code privé de 16 caractères minimum, distinct de la clé OpenAI | `.secrets/.env` sur OVH |
| `ALLOWED_ORIGINS` | `https://osvalt16.github.io` et, si besoin, origines locales séparées par virgules | Variable serveur |

Le code d’accès protège l’API publique. CORS ne constitue pas à lui seul une authentification. Sur OVH, un fichier privé avec verrou PHP limite le chat à 6 requêtes/minute. Sur Cloudflare, le binding `AI_RATE_LIMITER` remplit ce rôle. Cette limite n’est pas un plafond de facturation.

## Alternative : Cloudflare Workers

Depuis le clone du dépôt, avec Node 24 et un compte Cloudflare :

```powershell
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put BYHNEX_AI_ACCESS_CODE
npx wrangler deploy
```

Les commandes demandent les secrets dans le terminal. Ne les envoyez pas dans un chat et ne les écrivez pas dans Git. `OPENAI_MODEL` et `ALLOWED_ORIGINS` sont configurables dans `wrangler.jsonc` ou dans les variables du Worker.

Le déploiement indique l’adresse réelle du Worker. Ouvrez **Assistant IA → Connexion**, indiquez l’adresse suivie de `/api/ai-chat`, puis le code d’accès Byhnex. L’adresse est sauvegardée localement ; le code reste en mémoire pendant que la page est ouverte. La clé OpenAI ne doit jamais être saisie dans ces champs.

Pour fixer la même adresse pour tous les utilisateurs, modifiez seulement `endpoint` dans `ai-config.json`, puis redéployez Pages. Forme d’adresse : `https://byhnex-ai.VOTRE-SOUS-DOMAINE.workers.dev/api/ai-chat` (exemple, pas un serveur déjà créé). Les utilisateurs doivent fournir leur code d’accès.

Sans serveur configuré, le panneau indique **OpenAI à connecter**. Il ne simule pas de réponses ChatGPT. L’abonnement ChatGPT et son historique personnel ne sont pas utilisés par cette intégration.

## Local

Copiez `.env.example` vers `.env` uniquement sur votre machine, renseignez les variables et lancez `npm.cmd start`. `.env` est ignoré par Git et le serveur refuse son téléchargement. La même fonction sert `/api/ai-chat`. `GET /api/ai-chat` vérifie la configuration sans afficher de secret.

## Contexte et actions

Au plus 100 bougies de l’actif courant et 60 du second actif BTC/SOL, les derniers messages utiles, les positions virtuelles, la réserve et les frais affichés sont envoyés. Le contexte est capturé à chaque envoi. Les données absentes restent nulles ; les cours périmés sont signalés. `realizedProfit:null` signifie que le résultat réalisé en monnaie n’est pas suivi. Les gains en tokens clôturés proviennent du journal.

Un outil de calcul réutilise la formule de Strategy Lab pour les ventes/rachats après frais et les comparaisons HOLD. Il calcule également Fibonacci et les valeurs hypothétiques du portefeuille BTC/SOL. Les autres actifs sont explicitement exclus de ces calculs BTC/SOL.

Les actions sont retournées dans un schéma JSON strict, validées côté serveur/navigateur, puis appliquées par **Appliquer au graphique**, si l’actif et la période n’ont pas changé. Les repères IA sont dorés et préfixés **IA**. Les suppressions protègent les dessins personnels et verrouillés. Les points Fibonacci doivent correspondre à des bougies observées. Actions : `ADD_HORIZONTAL_LINE`, `REMOVE_HORIZONTAL_LINE`, `CLEAR_AI_LEVELS`, `DRAW_FIBONACCI`, `CHANGE_TIMEFRAME`, `FOCUS_PRICE`. Aucun outil de trading, wallet ou transaction n’existe.

L’historique reste dans `sessionStorage`, même lorsque le panneau est réduit. Seuls les messages récents sont transmis. OpenAI reçoit `store:false` ; aucun serveur de conversations n’est ajouté.

## Validation

`npm.cmd test` vérifie les calculs, les actions, les protections et les erreurs. Les appels OpenAI des tests sont simulés ; une réponse réelle nécessite les variables du propriétaire. Le build refuse les secrets détectés. Pages publie uniquement `dist/`, jamais le serveur, `.env` ni les profils locaux.

Documentation : [Responses](https://developers.openai.com/api/docs/guides/migrate-to-responses), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Secrets Cloudflare](https://developers.cloudflare.com/workers/configuration/secrets/), [Limitation de débit](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
