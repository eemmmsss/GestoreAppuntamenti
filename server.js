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
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Endpoint di test per verificare che il server funzioni
app.get('/', (req, res) => {
  res.send('Server AutoCal AI Online e Funzionante!');
});

// Endpoint per analizzare il testo di un PDF o Email con Gemini API
app.post('/api/parse-document', async (req, res) => {
  try {
    const { testoDocumento } = req.body;

    const prompt = `
      Analizza il seguente testo estratto da un documento o email ed estrai l'evento o appuntamento.
      Rispondi ESCLUSIVAMENTE con un oggetto JSON valido senza formattazione markdown o altro testo:
      {
        "titolo": "Titolo sintetico dell'evento",
        "dataOra": "YYYY-MM-DDTHH:MM",
        "luogo": "Luogo dell'evento o link meeting",
        "categoria": "Didattica|Lavoro|Urgente|Personale"
      }
      Testo:
      ${testoDocumento}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().replace(/```json|```/g, '').trim();
    const eventoEstratto = JSON.parse(responseText);

    res.json({ success: true, evento: eventoEstratto });
  } catch (error) {
    console.error("Errore analisi AI:", error);
    res.status(500).json({ success: false, error: "Errore durante l'analisi AI" });
  }
});

// Endpoint per aggiungere l'evento su Google Calendar
app.post('/api/add-to-google-calendar', async (req, res) => {
  try {
    const { userAccessToken, evento } = req.body;

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: userAccessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const startDateTime = new Date(evento.dataOra);
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
