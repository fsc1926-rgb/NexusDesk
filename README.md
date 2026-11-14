# NexusDesk P2P - Remote Desktop

NexusDesk è una soluzione di controllo remoto desktop peer-to-peer (P2P) ultra-leggera, veloce e sicura basata su **WebRTC** ed **Electron**.

Consente il controllo remoto da browser a PC o da PC a PC senza server intermediari per lo stream video, garantendo massima privacy e latenza minima.

---

## 🚀 Funzionalità Principali

- **Connessione Diretta P2P WebRTC**: Video e comandi transitano direttamente tra i due dispositivi.
- **Supporto NAT & Firewall Esteso**: Server STUN e TURN (OpenRelay) integrati per collegare dispositivi anche sotto reti 4G/5G o firewall restrittivi.
- **Controllo Nativo Ultra-Fast**: Helper nativo C# (`NexusInput.exe`) compilato per gestire mouse e tastiera a 60 FPS senza lag.
- **Nessuna dipendenza da PowerShell in memoria**: Zero falsi positivi AMSI / Defender durante l'esecuzione del controllo remoto.
- **Streaming Schermo & Audio**: Condivisione schermo in alta definizione con audio di sistema.
- **Modalità Web & Desktop**: Chi riceve assistenza può usare l'app nativa; chi offre supporto può connettersi anche direttamente da browser web.

---

## 🛡️ Guida all'Installazione & Avviso Windows SmartScreen

Al primo avvio o installazione su Windows, potrebbe comparire la schermata blu di **Microsoft Defender SmartScreen**:

> **"Windows ha protetto il PC"**  
> *Microsoft Defender SmartScreen ha impedito l'avvio di un'app non riconosciuta.*

### Perché compare questo avviso?
NexusDesk è un software **open source e gratuito**. Per non mostrare questo avviso all'avvio, Microsoft richiede alle aziende l'acquisto di certificati digitali commerciali (Authenticode EV) dal costo di centinaia di euro all'anno. In assenza di tale licenza commerciale a pagamento, Windows segnala l'autore come non riconosciuto.

### Come procedere (2 semplici passaggi):
1. Nella schermata blu, clicca sul link **"Ulteriori informazioni"** (*More info*).
2. Clicca sul pulsante **"Esegui comunque"** (*Run anyway*) in basso a destra.

L'avviso compare soltanto alla prima esecuzione; i successivi avvii saranno immediati.

---

## 📦 Sviluppo & Build Locale

### Requisiti
- [Node.js](https://nodejs.org/) (versione 18 o 20 raccomandata)
- Windows 10/11 (per la compilazione dell'helper di input nativo C#)

### Installazione Dipendenze
```bash
npm install
```

### Compilazione Helper Nativo
```bash
npm run compile:helper
```

### Avvio in modalità Sviluppo
```bash
npm start
```

### Generazione Pacchetti di Distribuzione (Setup NSIS & Portable)
```bash
npm run build
```
I file `.exe` generati saranno disponibili nella cartella `dist/`:
- `NexusDesk-Setup-1.2.0.exe`: Installer completo NSIS (raccomandato per installazione su Windows).
- `NexusDesk-Portable-1.2.0.exe`: Eseguibile portatile senza installazione.

---

## 📄 Licenza

Distribuito sotto licenza **MIT**. Consulta il file `LICENSE` per ulteriori informazioni.
