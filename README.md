# Blackjack Multiplayer Istituzionale

Applicazione web statica che offre un tavolo da blackjack multiplayer con autenticazione tramite Google Identity Services.

## Funzionalità principali
- Accesso consentito solo con email istituzionale (domini `.edu`, `@studenti.` o `@istituto.`).
- Tavolo multiplayer con gestione del turno tra i giocatori e il dealer.
- Classifica aggiornata in tempo reale con vittorie e denaro complessivo vinto.
- Generazione automatica di $10 per ogni giocatore ogni minuto.
- Salvataggio dello stato della partita nel `localStorage` del browser.

## Configurazione dell'accesso Google
1. Crea un progetto su [Google Cloud Console](https://console.cloud.google.com/).
2. Abilita l'API "Google Identity Services" e genera un Client ID OAuth 2.0 per applicazioni web.
3. Sostituisci `YOUR_GOOGLE_CLIENT_ID` in `index.html` con il tuo Client ID.
4. Configura gli URL autorizzati di origine e di reindirizzamento secondo l'ambiente di deploy.

## Avvio locale
Trattandosi di un progetto statico puoi utilizzare un server HTTP qualunque, ad esempio:

```bash
python -m http.server 8080
```

Successivamente apri [http://localhost:8080](http://localhost:8080) nel browser.
