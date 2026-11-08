# Integrazione Hummingbot in Miracolo Lab

## Stato

Adapter read-only implementato su branch dedicato e coperto da test automatici. **Non attivo in produzione**: nessun servizio Hummingbot è stato installato o collegato, nessun ordine viene inviato a Hummingbot e il motore Alpaca PAPER resta invariato.

Repository di riferimento:
- Hummingbot Client: https://github.com/hummingbot/hummingbot
- Hummingbot API: https://github.com/hummingbot/hummingbot-api
- Documentazione strategie: https://hummingbot.org/strategies/
- Documentazione Strategy V2: https://hummingbot.org/strategies/v2-strategies/

## Decisione architetturale

Hummingbot va integrato come **servizio esterno specializzato**, non copiato dentro il Worker Cloudflare e non usato per sostituire Miracolo Bot.

Cloudflare Workers esegue JavaScript e non può ospitare il runtime Python/Docker di Hummingbot. Il servizio Hummingbot deve quindi girare separatamente su una macchina/VPS con Docker. Miracolo resta il livello di intelligence, supervisione e risk governance.

### Ruoli

| Componente | Responsabilità |
|---|---|
| Miracolo Data/Context Engine | News, FRED, macro, sentiment, prezzi e feature |
| Miracolo Quant/AI/Consensus | Segnali, scoring, strategie e spiegazioni |
| Miracolo Risk Engine | Autorizzazione finale, limiti giornalieri, esposizione e veto |
| Hummingbot | Connettori crypto, order book, market data, executor e ciclo di vita ordini |
| Alpaca PAPER | Esecutore attuale per il percorso già esistente |
| Miracolo Journal/Learning | Registro unificato di segnali, ordini, fill, fee, PnL e valutazioni |

Miracolo deve rimanere l'unico decisore autorizzativo. Hummingbot non deve poter aggirare il veto del Risk Engine.

## Perché è utile

Il framework Hummingbot offre:
- connettori standardizzati REST/WebSocket per exchange CEX e DEX;
- order book, ticker, candele e dati di mercato;
- Strategy V2 con Scripts, Controllers ed Executors;
- Position Executor con stop-loss, take-profit e time limit (triple barrier);
- executor per DCA, grid, TWAP, arbitraggio e market making;
- API REST per creare, monitorare, fermare e analizzare executor;
- backtesting e report di performance.

Il valore maggiore per Miracolo è la gestione strutturata del ciclo di vita delle posizioni e la copertura dei mercati crypto. Non serve importare tutto il framework.

## Architettura proposta

```text
Fonti / FRED / News / Market
            |
            v
   Miracolo Data + Quant + AI
            |
            v
    Consensus + Risk Engine
            |
            v
    Execution Router (Miracolo)
       /                 \
      v                   v
Alpaca PAPER       Hummingbot Service
(azioni/ETF)        (crypto PAPER)
      \                   /
       v                 v
       Order Reconciliation
                |
                v
       Unified Journal / Learning
```

### Integrazione di rete

- Hummingbot API va eseguita su VPS/Docker, non dentro `bot-live-router.js`.
- Non esporre la porta API 8000 su Internet.
- Il progetto Hummingbot raccomanda rete privata Tailscale e autenticazione HTTP Basic; per la chiamata dal Cloudflare Worker serve però un collegamento HTTPS server-to-server compatibile, ad esempio un Cloudflare Tunnel protetto da Access con Service Token custodito nei Worker Secrets.
- Non inserire URL privati, username, password, token o chiavi exchange nel frontend, nel repository o nei log.
- Il Worker deve fallire in modalità chiusa se il servizio non risponde, se l'autenticazione fallisce o se lo stato non è verificabile.

## Piano di integrazione per fasi

### Fase 1 — Osservabilità read-only

Implementato `hummingbot-adapter.js` con timeout, validazione JSON, limite alla dimensione delle risposte, autenticazione Basic e supporto opzionale Cloudflare Access. Il Worker espone `GET /api/hummingbot/overview`. Il modulo interroga soltanto:
- stato/health del servizio;
- elenco connettori e account disponibili;
- market data, order book e candele;
- riepilogo e ricerca degli executor già esistenti;
- report performance e backtest.

Nessuna route di creazione o stop executor deve essere esposta da Miracolo in questa fase.

### Fase 2 — Paper trading isolato

Avviare Hummingbot con il connettore `binance_paper_trade` e uno script di prova senza chiavi exchange. Verificare prima sul runtime installato che il paper connector sia supportato anche dal percorso API/executor scelto: la presenza del comando paper nel client non dimostra da sola che ogni endpoint API operi in simulazione.

Eseguire test di:
- apertura, fill parziale e fill completo;
- stop-loss, take-profit e time limit;
- cancellazione e arresto;
- riavvio del servizio con ordini/posizioni aperti;
- riconciliazione senza duplicati;
- fee, slippage, PnL realizzato e non realizzato.

### Fase 3 — Router controllato

Solo dopo la fase 2:
- introdurre un'interfaccia comune `ExecutionProvider`;
- mantenere Alpaca come provider per equity;
- usare Hummingbot per crypto soltanto su simboli esplicitamente abilitati;
- generare un `clientOrderId`/correlation ID Miracolo per ogni intenzione;
- registrare ID executor, ordini, fill, fee e close reason nel journal comune;
- riconciliare periodicamente lo stato Hummingbot con il journal;
- impedire doppie posizioni tra provider e retry duplicati.

### Fase 4 — Ricerca quantitativa

Valutare Hummingbot Strategy V2 e i suoi backtest per:
- confrontare strategie con dati storici;
- validare stop/target e time limit;
- misurare fee, slippage, drawdown e Sharpe;
- esportare risultati nel Quant/Strategy Lab di Miracolo.

I risultati Hummingbot non devono essere confusi con quelli del backtest Miracolo: salvare sempre motore, versione, dataset, intervallo e parametri.

## Configurazione adapter read-only\n\nImpostare esclusivamente nei Worker Secrets/Variables, mai nel frontend o nel repository:\n\n- `HUMMINGBOT_API_URL`: URL HTTPS dell'API, idealmente Cloudflare Tunnel protetto da Access.\n- `HUMMINGBOT_API_USERNAME` e `HUMMINGBOT_API_PASSWORD`: credenziali HTTP Basic dedicate all'API.\n- `CF_ACCESS_CLIENT_ID` e `CF_ACCESS_CLIENT_SECRET`: opzionali, per Cloudflare Access Service Auth.\n\nSenza URL o credenziali l'adapter restituisce `configured=false` e non effettua chiamate. Rifiuta URL HTTP, credenziali incorporate nell'URL e redirect. L'endpoint pubblico Miracolo è `GET /api/hummingbot/overview`; richieste diverse da GET vengono rifiutate.\n\n## Guardrail non negoziabili

- Modalità PAPER only in tutte le prime fasi.
- Nessuna chiave exchange live e nessun wallet reale.
- Nessuna esecuzione se il Risk Engine non restituisce un'approvazione esplicita.
- Limite massimo di 3 nuove operazioni al giorno, condiviso tra provider, non 3 per ciascun motore.
- Limite di capitale e perdita per operazione applicato prima dell'invio e verificato dopo il fill.
- Idempotenza: un segnale non può generare due executor/ordini.
- Circuit breaker su dati vecchi, disconnessione, mismatch di posizioni, errori API o journal non aggiornato.
- Kill switch globale che blocca nuove aperture; la chiusura di emergenza deve essere una procedura separata, testata e tracciata.
- Mai interpretare un timeout come prova che l'ordine non sia stato eseguito: prima riconciliare per ID.

## Verifiche eseguite\n\n- Test dedicati `tests/hummingbot-adapter.test.mjs`: configurazione assente, rifiuto HTTP, autenticazione, sole richieste GET, normalizzazione, errori parziali e JSON non valido.\n- Il test usa risposte simulate: verifica il contratto del modulo, non la disponibilità di un server Hummingbot reale.\n- Nessun deploy eseguito e nessun segreto Hummingbot configurato.\n\n## Criteri di accettazione

L'integrazione non è pronta finché:
1. Hummingbot è raggiungibile solo attraverso un canale autenticato e privato.
2. I test dimostrano che il connector selezionato è davvero PAPER.
3. Le posizioni aperte e gli ordini sono riconciliati dopo riavvio e timeout.
4. Non esistono duplicati in caso di retry.
5. Il limite giornaliero è condiviso tra Alpaca e Hummingbot.
6. Fee, slippage, fill parziali e PnL confluiscono nel journal.
7. Tutti i test automatici passano e una prova end-to-end resta in PAPER.
8. Il deploy viene verificato con health check e log, senza abilitare il trading live.

## Riferimenti tecnici verificati

- Il README Hummingbot descrive Scripts, Controllers, Executors e il connettore `binance_paper_trade`.
- La Hummingbot API espone `POST /executors/`, `POST /executors/search`, `GET /executors/summary`, `GET /executors/{executor_id}` e `POST /executors/{executor_id}/stop`. La creazione di un executor può generare ordini reali se collegata a un connettore live: non chiamare questi endpoint prima di aver dimostrato il comportamento PAPER.
- La Hummingbot API usa HTTP Basic Auth e gestisce credenziali dei connector; la documentazione raccomanda di non esporre pubblicamente la porta 8000.
- Miracolo attualmente usa `bot-live-router.js`, `bot-paper-auto.js`, `bot-paper-executor.js` e `bot-risk-engine.js`. L'esecutore Alpaca esistente è già vincolato all'endpoint `https://paper-api.alpaca.markets/v2`.

## Nota sullo stato attuale di Miracolo

Il cron in `wrangler.toml` è impostato a 30 minuti. La configurazione attuale dichiara `BOT_MODE=PAPER`, `PAPER_AUTO_EXECUTION=true`, `PAPER_NOTIONAL=100` e `PAPER_MAX_BUYS_PER_DAY=3`. Prima di integrare un secondo provider va centralizzato il limite giornaliero: oggi non va assunto che il conteggio sia automaticamente condiviso tra Alpaca e Hummingbot.
