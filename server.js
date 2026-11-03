const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Inizializzazione Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Test endpoint per verificare il funzionamento del server
app.get('/', (req, res) => {
  res.send('Server AutoCal AI Online e Funzionante!');
});

// Endpoint per analizzare il testo di un PDF o Email con Gemini API
app.post('/api/parse-document', async (req, res) => {
  try {
    const { testoDocumento } = req.body;

    if (!testoDocumento) {
      return res.status(400).json({ success: false, error: "Testo mancante" });
    }

    // Usiamo il modello gemini-1.5-flash imponendo la risposta in formato JSON nativo
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      Sei un assistente per la gestione del calendario. Analizza il seguente testo ed estrai le informazioni sull'evento o appuntamento.
      Rispondi esclusivamente con questo schema JSON:
      {
        "titolo": "Titolo sintetico ed esplicito dell'evento",
        "dataOra": "YYYY-MM-DDTHH:MM",
        "luogo": "Luogo dell'evento, link meeting oppure 'Non specificato'",
        "categoria": "Didattica|Lavoro|Urgente|Personale"
      }
      
      Se l'anno non è specificato nel testo, usa l'anno 2026.
      
      Testo da analizzare:
      ${testoDocumento}
    `;

    const result = await model.generateContent(prompt);
    let rawText = result.response.text();

    // Pulizia di sicurezza per rimuovere eventuali tag markdown residuali
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const eventoEstratto = JSON.parse(rawText);

    res.json({ success: true, evento: eventoEstratto });
  } catch (error) {
    console.error("Errore analisi AI:", error);
    res.status(500).json({ success: false, error: error.message || "Errore durante l'analisi AI" });
  }
});

// Endpoint per aggiungere l'evento su Google Calendar
app.post('/api/add-to-google-calendar', async (req, res) => {
  try {
    const { userAccessToken, evento } = req.body;

    if (!userAccessToken || !evento) {
      return res.status(400).json({ success: false, error: "Parametri mancanti" });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: userAccessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const startDateTime = new Date(evento.dataOra);
    // Imposta una durata predefinita di 1 ora
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: evento.titolo,
        location: evento.luogo || '',
        description: `Inserito automaticamente da AutoCal AI (${evento.categoria})`,
        start: { dateTime: startDateTime.toISOString() },
        end: { dateTime: endDateTime.toISOString() }
      }
    });

    res.json({ success: true, calendarLink: response.data.htmlLink });
  } catch (error) {
    console.error("Errore Google Calendar API:", error);
    res.status(500).json({ success: false, error: "Impossibile salvare su Google Calendar" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server AutoCal AI attivo sulla porta ${PORT}`));
