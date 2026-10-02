# API PHP Byhnex sur OVH PRO

Le front reste sur **https://osvalt16.github.io/byhnex/**. OVH héberge uniquement l’API PHP 8.2, à **https://byhnex.com/iacrypto/ai-chat.php**. Les fichiers transférés par le propriétaire sont dans `/www/iacrypto`. Le test public du 3 octobre 2026 a confirmé `ready:true` et CORS pour GitHub Pages ; il ne vérifie pas le quota ni la validité de la clé auprès d’OpenAI. Aucun processus Node, Composer, base de données ni installation OpenAI SDK n’est nécessaire sur OVH. L’extension PHP cURL doit être active.

## Transfert FileZilla

1. Décompressez `byhnex-ovh-api.zip` sur votre ordinateur, ou utilisez le dossier local `ovh-upload`.
2. Dans FileZilla, ouvrez **`/www/iacrypto` côté serveur**. Envoyez le **contenu** du dossier `ovh-upload/api` : `ai-chat.php`, `.htaccess` et le dossier `lib` complet, y compris son `.htaccess`. Le chemin final doit être `/www/iacrypto/ai-chat.php`, sans sous-dossier `api` supplémentaire. Le dossier local et l’archive conservent le nom `api` pour le code source.
3. Conservez votre `.env` existant dans **`/.secrets/.env`**, hors de `/www`. N’envoyez pas le `.env` local dans `/www`.

```text
/                         ← racine FTP du compte OVH
├── .secrets/
│   ├── .env               ← déjà présent, privé
│   └── byhnex-ai-rate.json ← créé automatiquement par PHP
└── www/
    └── iacrypto/
        ├── .htaccess
        ├── ai-chat.php
        └── lib/
            ├── .htaccess
            ├── backend.php
            ├── calculations.php
            ├── context.php
            ├── contract.php
            └── settings.php
```

L’archive contient seulement ces huit fichiers de l’API. Elle ne remplace pas le site GitHub ni les autres dossiers du compte OVH. Si un `/www/iacrypto/.htaccess` existe déjà et sert une autre application, fusionnez ses règles avec celles fournies avant de remplacer ce fichier. Le dossier `/api` visible à la racine FTP est distinct de `/www/iacrypto`.

## Configuration privée

Les quatre variables doivent être présentes dans `/.secrets/.env` :

```dotenv
OPENAI_API_KEY=VOTRE_CLE_API_OPENAI
OPENAI_MODEL=gpt-5.4-mini
BYHNEX_AI_ACCESS_CODE=VOTRE_CODE_PRIVE_DE_16_CARACTERES_MINIMUM
ALLOWED_ORIGINS=https://osvalt16.github.io
```

Réutilisez les valeurs déjà renseignées. Le code Byhnex est distinct de la clé OpenAI. Si un jour le front est aussi servi sur le domaine OVH, ajoutez `https://byhnex.com,https://www.byhnex.com` à `ALLOWED_ORIGINS`. Une origine est un domaine avec protocole, sans `/byhnex/` ni slash final.

Dans FileZilla, le propriétaire PHP doit pouvoir lire `.env` et écrire dans `.secrets` pour le limiteur : normalement **`.env` : `0600`**, **`.secrets` : `0700`** lorsque PHP fonctionne sous le propriétaire du compte. Le limiteur crée un fichier privé, verrouillé entre les processus PHP, limitant l’ensemble du chat à six messages par minute. Aucun message ni secret n’est enregistré dans ce fichier.

Le chargeur retrouve le dossier `.secrets` à partir de l’emplacement réel `/www/iacrypto/ai-chat.php`. Sur OVH, la racine FTP `/` peut correspondre à `/home/nom-du-compte` sur le système : il ne suppose donc pas que `/.secrets` est nécessairement un chemin absolu système.

## Vérification et connexion

Ouvrez **https://byhnex.com/iacrypto/ai-chat.php** dans votre navigateur. Ce GET est gratuit et n’appelle pas OpenAI. Le résultat attendu :

```json
{"ready":true,"accessRequired":true,"supportedAssets":["BTC","SOL"]}
```

Sur GitHub Pages : **Assistant IA → Connexion**. L’adresse préconfigurée est `https://byhnex.com/iacrypto/ai-chat.php`. Les anciennes adresses Byhnex `/api/ai-chat` sauvegardées dans le navigateur sont corrigées automatiquement. Entrez uniquement la valeur de `BYHNEX_AI_ACCESS_CODE`, jamais la clé OpenAI. Cliquez sur **Vérifier la connexion** puis envoyez un message. La vérification reste gratuite ; l’envoi d’un message utilise l’API OpenAI du propriétaire.

## Si cela ne répond pas

- **404 sur `/iacrypto/ai-chat.php`** : vérifiez les fichiers sous `/www/iacrypto` et la cible `/www` du domaine dans OVH → Hébergements → Multisite. Les anciennes adresses `/api/ai-chat` peuvent rester en 404 : elles ne sont plus utilisées.
- **La réécriture `/iacrypto/ai-chat` ne répond pas** : l’adresse configurée utilise directement `ai-chat.php`, sans dépendre de la réécriture. Conservez les `.htaccess` pour protéger le dossier `lib` et transmettre Authorization à PHP-FPM.
- **`ready:false`** : vérifiez les quatre variables, la lecture du fichier privé, l’extension cURL, les droits d’écriture du dossier `.secrets` et PHP 8.2 dans le panneau OVH. Le GET n’affiche jamais les valeurs privées.
- **Code incorrect / 401** : utilisez `BYHNEX_AI_ACCESS_CODE`. `.htaccess` transmet le header Authorization à PHP-FPM.
- **Connexion bloquée depuis GitHub** : l’origine doit être exactement `https://osvalt16.github.io`. La réponse doit contenir `Access-Control-Allow-Origin` correspondant. Vérifiez également le certificat HTTPS du domaine.
- **Quota / 429** : distinguez la limite locale de six messages/minute du quota du projet OpenAI ; les messages du chat précisent la cause.
- **Timeout** : la boucle Responses a un délai global de 45 s. L’hébergement peut appliquer un délai inférieur ; essayez une question plus ciblée.

Les réponses OpenAI suivent le même contrat et les mêmes calculs que le serveur JavaScript existant. Les actions visuelles restent validées dans le navigateur, avec confirmation par bouton, sans ordre ni transaction.

## Développement

`npm run build:ovh` reconstruit l’archive et le dossier `ovh-upload`. Le prompt et les schémas PHP sont générés à partir du contrat partagé pour éviter les divergences. `npm run test:php` vérifie PHP 8.2 avec des réponses OpenAI simulées, sans clé réelle. Sur Windows, utilisez `BYHNEX_PHP_BIN` si `php` n’est pas dans le PATH. GitHub Pages publie uniquement `dist/`, sans PHP ni `.env`.

Documentation : [configuration PHP OVH](https://docs.ovhcloud.com/en/guides/web-cloud/web-hosting/configure-your-web-hosting), [Structured Outputs OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs), [outils Responses](https://developers.openai.com/api/docs/guides/function-calling).
