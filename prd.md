# Product Requirements Document (PRD): Live Speech-to-Text & Teleprompter

## 1. Introduzione e Obiettivo del Prodotto
L'obiettivo è sviluppare un'applicazione strutturata come **Progressive Web App (PWA)** in grado di trascrivere in tempo reale l'audio (dal microfono o dall'audio di sistema). L'app sarà installabile sia su smartphone che su desktop, senza dover passare dagli app store.

## 2. Modalità di Visualizzazione (UI Modes)
L'applicazione offrirà due interfacce principali intercambiabili:

### 2.1 Modalità "Top-Text" (Videochiamate)
- Il testo trascritto appare esclusivamente nella **porzione superiore del monitor**, centrato o allineato sotto l'obiettivo della webcam.
- Permette all'utente di leggere senza distogliere lo sguardo dalla telecamera.

### 2.2 Modalità "True Teleprompter" (Gobbo)
- Il testo riempie lo schermo con un corpo carattere generoso, fungendo da vero e proprio gobbo elettronico.
- Implementa uno **scorrimento morbido e dinamico** (o manuale) che si adatta al flusso di testo in arrivo e alla velocità del discorso.
- Ottimizzata per la lettura a distanza (es. registrazioni video con lo smartphone o presentazioni su palco).

### 2.3 Controlli Real-Time e Accessibilità
- Controlli utente visibili ma non invasivi (pulsanti rapidi, shortcut da tastiera o gesture tap su mobile) per **aumentare e diminuire la dimensione del carattere** interattivamente in entrambe le modalità, senza interrompere la registrazione.
- Scelta di font chiari ad alta leggibilità e supporto per una "Dark Mode" confortevole.

## 3. Trascrizione Audio e Traduzione In Tempo Reale
- **Rilevamento Lingua Input**: Riconoscimento automatico (auto-detect) della lingua che l'utente sta parlando.
- **Traduzione (Opzionale)**: Supporto per la traduzione in tempo reale. L'utente può scegliere, dal menu, se avere la semplice trascrizione (stessa lingua dell'audio) o se impostare una **lingua target** per ricevere la traduzione (es. parlo in Italiano, ma il teleprompter mostra Inglese).
- **Doppia Fonte di Acquisizione**:
  - **Microfono**: Per trascrivere la voce dell'utente.
  - **Audio di Sistema (Tab/Screen Audio)**: Opzione per trascrivere l'audio degli altri partecipanti durante riunioni virtuali.

## 4. Gestione delle Trascrizioni (File & History Management)
- Ogni sessione di registrazione deve poter essere salvata in un database locale del browser (`IndexedDB` / `localStorage`), garantendo massima privacy.
- Un **menù a tendina** per accedere agilmente allo storico delle registrazioni.
- Operazioni supportate su ogni singolo record:
  - **Rinomina**: Assegnazione di un titolo personalizzato.
  - **Elimina**: Cancellazione dal database.
  - **Esporta**: Esportazione nei formati Testo Semplice (`.txt`), Markdown (`.md`), Documento PDF (`.pdf`), Documento Word (`.docx`).

## 5. Requisiti Tecnici & Stack Consigliato

### 5.1 AI Transcription Engine & API Key
- **Modello Selezionato**: `gemini-3.1-flash-lite-preview` ottimizzato per compiti a bassa latenza e streaming.
- **Implementazione**: Utilizzo del protocollo Multimodal Live API (via WebSocket) di Gemini per avere output testuale con latenze minime rispetto a richieste REST classiche.
- **Gestione API Key**: Per questioni di sicurezza, l'API Key fornita (`AIzaSyCRXDt...`) NON deve essere hardcodata nel codice sorgente pubblico. La PWA richiederà l'inserimento della chiave all'avvio, salvandola esclusivamente nel dispositivo dell'utente (`localStorage`). L'ambiente locale userà un file `.env`.

### 5.2 Frontend & PWA
- **Framework**: Applicazione Web Singola (SPA) come **Vite + React** oppure **Next.js**.
- **Progressive Web App**: Implementazione di un Service Worker e file `manifest.json` abilitare l'installazione nativa.
- **Design System**: CSS personalizzato e dinamico per la gestione dello stretching e dei layout (Vanilla CSS o Tailwind CSS).

### 5.3 Web APIs
- `navigator.mediaDevices.getUserMedia()` per l'accesso al microfono del dispositivo.
- `navigator.mediaDevices.getDisplayMedia({ audio: true, video: false })` (dove supportato) per il loopback dell'audio di sistema durante chiamate in browser o app desktop.

### 5.4 Export Libraries
- PDF: `html2pdf.js` oppure `jspdf`.
- Word: `docx`.

## 6. Fasi di Sviluppo (Roadmap)
- **Fase 1: Inizializzazione** - Setup struttura PWA, Framework e connessione di test a Gemini.
- **Fase 2: Gestione Input** - Acquisizione audio da Microfono e da Schermo (per audio interno).
- **Fase 3: Core AI** - Connessione asincrona a Gemini API, restituzione real-time della trascrizione.
- **Fase 4: Modalità UI (Top-Text & Teleprompter)** - Realizzazione delle due viste, logica di scorrimento, e controlli size +/- font.
- **Fase 5: Storage & History** - Salvataggio locale e implementazione menu storico.
- **Fase 6: Export & Testing** - Moduli download file (.txt, .md, .pdf, .docx) e test finali su latenza.