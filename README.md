# Calma

Instagram a tutto schermo come un'app, senza reels, con pausa all'ingresso e limite giornaliero.
È una finestra su instagram.com con lo script `Resources/noreels.js` già attivo: niente barre di Safari, niente banner "Apri nell'app".

Funziona da **Ubuntu**, senza Mac e senza account sviluppatore a pagamento:

1. **GitHub** compila l'app su un Mac virtuale gratuito.
2. **iloader** (da Ubuntu) la installa sull'iPhone con il tuo Apple ID normale.
3. **SideStore** (facoltativo) la rinnova da solo ogni 7 giorni, senza PC.

---

## 1. Compilare l'app con GitHub

Ti serve un account GitHub (gratuito). Dalla cartella `Calma`:

```bash
git init
git add .
git commit -m "Calma"
git branch -M main
# crea un repository vuoto su github.com (anche privato), poi:
git remote add origin https://github.com/TUO-UTENTE/calma.git
git push -u origin main
```

> Usa `git`, non il caricamento dal sito: dal browser la cartella nascosta `.github` spesso non viene caricata, e senza quella la compilazione non parte.

Poi:

1. Su GitHub apri il repository → scheda **Actions** → la compilazione "Compila IPA" parte da sola (circa 5 minuti).
2. Quando ha la spunta verde, aprila e in fondo, sotto **Artifacts**, scarica `Calma-ipa`.
3. Estrai lo zip: dentro c'è **`Calma.ipa`**.

Se la compilazione fallisce, apri il passaggio in rosso e copia l'errore: si sistema.

## 2. Preparare Ubuntu

```bash
sudo apt install usbmuxd
```

Scarica **iloader** dalla pagina ufficiale: <https://github.com/nab138/iloader/releases> (versione Linux).

Collega l'iPhone con il cavo, sbloccalo e tocca **Autorizza** quando chiede se fidarti del computer.

## 3. Installare l'app

Apri iloader e accedi con il tuo Apple ID (puoi anche crearne uno secondario apposta).

**Opzione A – semplice:** scegli di importare un'IPA e seleziona `Calma.ipa`.
L'app dura **7 giorni**: poi va reinstallata ricollegando l'iPhone al PC.

**Opzione B – consigliata:** con iloader installa **SideStore**, poi da SideStore sull'iPhone installa `Calma.ipa`
(per portare il file sull'iPhone puoi usare Google Drive, iCloud Drive dal browser, o scaricarlo da GitHub direttamente col telefono).
SideStore rinnova le app da solo dal telefono, senza PC. Segui la guida ufficiale per la parte VPN: <https://docs.sidestore.io>

Con un Apple ID gratuito puoi avere al massimo **3 app** installate così (SideStore conta come una).

## 4. Primo avvio sull'iPhone

Se l'app non si apre:

- **Impostazioni → Privacy e sicurezza → Modalità sviluppatore** → attiva e riavvia.
- **Impostazioni → Generali → VPN e gestione dispositivi** → tocca il tuo Apple ID → **Autorizza**.

Poi fai il login a Instagram dentro l'app (resta salvato). Dopo, **elimina l'app ufficiale di Instagram**.

## Cosa fa l'app

- Si apre sempre sui **messaggi**.
- **Niente reels**: tab nascosta, reel tolti dal feed, e dei reel che ti mandano vedi solo quello, senza poter scorrere ad altri.
- **Cerca** mostra solo i profili.
- **Pausa** di 10 secondi prima di uscire dalle chat ("Cosa sei venuto a fare?").
- **Limite** di 20 minuti al giorno fuori dalle chat. Finito il tempo restano solo i messaggi.
- Se esci dall'app per più di 5 minuti, al ritorno si riparte dai messaggi, con nuova pausa.
- Swipe dal bordo sinistro = indietro. Tira giù in cima alla pagina = ricarica.
- I link esterni si aprono in Safari.

## Cambiare le impostazioni

Minuti, secondi di pausa ecc. sono in cima a `Resources/noreels.js`. Dopo una modifica:

```bash
git commit -am "nuove impostazioni" && git push
```

GitHub ricompila; scarichi la nuova `Calma.ipa` e la reinstalli (con SideStore: aggiorna l'app importando la nuova IPA).

## Blocco più serio

Lo script è un ostacolo, non un lucchetto. Per un limite vero:
**Impostazioni → Tempo di utilizzo → Limiti app** → aggiungi **Calma**, con un codice che non conosci tu.
