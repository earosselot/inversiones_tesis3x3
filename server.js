const express = require('express');
const path = require('path');
const fs = require('fs');
const YahooFinance = require('yahoo-finance2').default;
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize YahooFinance
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure tesis directory exists
const tesisDir = path.join(__dirname, 'tesis');
if (!fs.existsSync(tesisDir)) {
  fs.mkdirSync(tesisDir, { recursive: true });
}

// Endpoint to list generated theses
app.get('/api/tesis', (req, res) => {
  try {
    const files = fs.readdirSync(tesisDir)
      .filter(file => file.endsWith('.md'))
      .map(file => {
        const filePath = path.join(tesisDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          ticker: file.replace('.md', ''),
          createdAt: stats.mtime,
          path: `/tesis/${file}`
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Error reading tesis directory: ' + error.message });
  }
});

// Endpoint to read a specific thesis file
app.get('/api/tesis/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(tesisDir, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Thesis not found' });
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: 'Error reading file: ' + error.message });
  }
});

// Endpoint to get historical chart data with moving averages
app.get('/api/chart/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase().trim();
  try {
    // Pedir 16 meses para tener datos suficientes para MA200
    // MA200 necesita ~200 días de trading, más 6 meses (~126 días) para mostrar = ~326 días (~16 meses)
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 16);

    const chartData = await yf.chart(ticker, {
      period1: startDate,
      interval: '1d',
      return: 'array'
    });

    const quotes = chartData.quotes.filter(q => q.close !== null);
    const closes = quotes.map(q => q.close);
    const dates  = quotes.map(q => q.date);

    // Calcular media móvil simple
    function calcMA(arr, window) {
      return arr.map((_, i) => {
        if (i < window - 1) return null;
        const slice = arr.slice(i - window + 1, i + 1);
        return slice.reduce((a, b) => a + b, 0) / window;
      });
    }

    const ma50  = calcMA(closes, 50);
    const ma200 = calcMA(closes, 200);

    // Recortar a los últimos 6 meses para el gráfico
    // Ahora la MA200 estará completamente calculada para todo el período mostrado
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startIdx = dates.findIndex(d => new Date(d) >= sixMonthsAgo);
    const idx = startIdx === -1 ? 0 : startIdx;

    res.json({
      dates:  dates.slice(idx).map(d => new Date(d).toISOString().split('T')[0]),
      closes: closes.slice(idx),
      ma50:   ma50.slice(idx),
      ma200:  ma200.slice(idx)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to generate thesis
app.post('/api/generate-thesis', async (req, res) => {
  const { ticker, geminiApiKey, model: requestedModel } = req.body;

  if (!ticker) {
    return res.status(400).json({ error: 'El ticker es requerido.' });
  }

  const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: 'Se requiere una API Key de Gemini.' });
  }

  try {
    const cleanTicker = ticker.toUpperCase().trim();
    console.log(`[Thesis Generator] Iniciando análisis para: ${cleanTicker}`);

    // 1. Fetch data from Yahoo Finance
    let financialData = {};
    let summaryProfile = {};
    let defaultKeyStatistics = {};
    
    try {
      const yfResult = await yf.quoteSummary(cleanTicker, {
        modules: ['summaryProfile', 'financialData', 'defaultKeyStatistics']
      });
      financialData = yfResult.financialData || {};
      summaryProfile = yfResult.summaryProfile || {};
      defaultKeyStatistics = yfResult.defaultKeyStatistics || {};
      console.log(`[Yahoo Finance] Datos obtenidos para ${cleanTicker}. Precio actual: ${financialData.currentPrice}`);
    } catch (yfError) {
      console.warn(`[Yahoo Finance Warning] No se pudieron obtener todos los datos de Yahoo Finance para ${cleanTicker}: ${yfError.message}`);
    }

    const currentPrice = financialData.currentPrice || null;
    const targetMeanPrice = financialData.targetMeanPrice || null;
    
    // 2. Prepare the prompt for Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = requestedModel || 'gemini-2.5-flash';
    console.log(`[Gemini] Usando modelo: ${modelName}`);
    const model = genAI.getGenerativeModel({
      model: modelName,
      tools: [{ googleSearch: {} }],
    });

    const marketInfoPrompt = `
Estás analizando la empresa con ticker "${cleanTicker}".
Datos financieros actuales de Yahoo Finance:
- Precio Actual: ${currentPrice ? `$${currentPrice}` : 'No disponible'}
- Precio Objetivo Promedio de Analistas (Target Mean Price): ${targetMeanPrice ? `$${targetMeanPrice}` : 'No disponible'}
- Margen Operativo: ${financialData.operatingMargins ? `${(financialData.operatingMargins * 100).toFixed(2)}%` : 'No disponible'}
- Relación Deuda/Capital (Debt to Equity): ${financialData.debtToEquity || 'No disponible'}
- Resumen del Negocio: ${summaryProfile.longBusinessSummary || 'No disponible'}

Tu tarea es armar una **Tesis 3x3** siguiendo estrictamente estas instrucciones:
1. **Tesis Central**: Resume en una sola oración qué estás comprando y por qué ahora (máximo 30 palabras).
2. **3 Razones a Favor (¿Por qué sube?)**: Explicita los fundamentos o drivers más importantes que respaldan la inversión basándote en datos recientes. Busca catalizadores reales (ej. crecimiento de flujo de caja, ventajas competitivas o nuevos lanzamientos).
3. **2 Razones en Contra (¿Qué puede salir mal?)**: Busca activamente la contra-tesis y riesgos reales para evitar el sesgo de confirmación (ej. aumento de deuda, competencia agresiva, caída de márgenes, presiones regulatorias).
4. **1 Evento de Invalidación (El Kill Switch)**: Define un evento observable y concreto, compuesto por:
   - Una **componente de métricas** (ej. "el margen operativo cae por debajo del 12%" o "la deuda/EBITDA supera 3.5x").
   - Una **componente de contexto** específica de la empresa (ej. "si el CEO renuncia", "si se cancela el proyecto de IA principal" o "si la FDA rechaza el medicamento").
5. **Precios de Entrada, Salida y Relación Riesgo:Retorno (R:R)**:
   - Toma el precio actual de la acción y define un **Objetivo de Ganancia (Target Price)** y un **Punto de Invalidación (Stop Loss)**.
   - **REGLA MATEMÁTICA OBLIGATORIA**: Debes estructurar la operación para que el ratio de Riesgo:Retorno sea de al menos **1:2** o mayor.
   - Es decir, la Ganancia Potencial (Target - Actual) debe ser como mínimo el DOBLE de la Pérdida Potencial (Actual - Stop Loss).
   - Ejemplo válido: Si compras a $100, el Stop Loss puede estar en $90 (riesgo $10) y el Target debe ser mínimo $120 (recompensa $20).

Debes responder en formato JSON que cumpla exactamente con el siguiente esquema:
{
  "companyName": "Nombre de la empresa",
  "centralThesis": "Tesis central en una sola oración.",
  "reasonsInFavor": [
    { "title": "Título corto de la razón 1", "description": "Detalle de la razón 1 explicando los fundamentos." },
    { "title": "Título corto de la razón 2", "description": "Detalle de la razón 2 explicando los fundamentos." },
    { "title": "Título corto de la razón 3", "description": "Detalle de la razón 3 explicando los fundamentos." }
  ],
  "reasonsAgainst": [
    { "title": "Título corto del riesgo 1", "description": "Detalle del riesgo 1 (contra-tesis)." },
    { "title": "Título corto del riesgo 2", "description": "Detalle del riesgo 2 (contra-tesis)." }
  ],
  "killSwitch": {
    "metricComponent": "Descripción del evento de invalidación por métricas (ej. caída de márgenes por debajo de X%).",
    "contextComponent": "Descripción del evento de invalidación por contexto empresarial."
  },
  "suggestedTargetPrice": 123.45,
  "suggestedInvalidationPrice": 85.00
}

Realiza búsquedas en internet para encontrar la contra-tesis más reciente de analistas contrarios y noticias de riesgos reales de la compañía. Cita las fuentes dentro de las descripciones si es posible.
Responde ÚNICAMENTE con el objeto JSON válido.
`;

    console.log('[Gemini] Enviando solicitud con Google Search Grounding...');
    
    // Retry logic for Gemini API (handles 429, 503, transient errors)
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 15000; // 15 seconds between retries
    let result;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Gemini] Intento ${attempt}/${MAX_RETRIES}...`);
        result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: marketInfoPrompt }] }],
        });
        break; // Success, exit retry loop
      } catch (geminiError) {
        const status = geminiError.status || 0;
        const isRetryable = status === 429 || status === 503 || status === 500;
        
        if (isRetryable && attempt < MAX_RETRIES) {
          console.warn(`[Gemini] Error ${status} en intento ${attempt}. Reintentando en ${RETRY_DELAY_MS / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          throw geminiError; // Non-retryable or last attempt
        }
      }
    }

    const responseText = result.response.text();
    console.log('[Gemini] Respuesta recibida.');
    
    // Parse JSON - extract from possible markdown code fences or raw text
    let thesisData;
    try {
      // Try direct parse first
      thesisData = JSON.parse(responseText);
    } catch (parseError) {
      // Try extracting JSON from markdown code block (```json ... ``` or ``` ... ```)
      const jsonMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          thesisData = JSON.parse(jsonMatch[1].trim());
        } catch (innerError) {
          console.error('[JSON Parse Error] Could not parse extracted block:', jsonMatch[1]);
          throw new Error('La IA no devolvió un JSON válido.');
        }
      } else {
        // Last resort: find first { and last }
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          try {
            thesisData = JSON.parse(responseText.substring(firstBrace, lastBrace + 1));
          } catch (bruteError) {
            console.error('[JSON Parse Error] All parse attempts failed:', responseText);
            throw new Error('La IA no devolvió un JSON válido.');
          }
        } else {
          console.error('[JSON Parse Error] No JSON structure found:', responseText);
          throw new Error('La IA no devolvió un JSON válido.');
        }
      }
    }

    // Extract citations from grounding metadata if present
    const candidate = result.response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;
    const searchChunks = groundingMetadata?.groundingChunks || [];
    const citations = searchChunks
      .filter(chunk => chunk.web)
      .map(chunk => ({
        title: chunk.web.title,
        url: chunk.web.uri
      }));

    thesisData.citations = citations;
    thesisData.currentPrice = currentPrice;

    // Calculate Risk:Reward
    // Reward = Target - Current
    // Risk = Current - Invalidation
    // R:R = Reward / Risk
    let riskRewardRatio = null;
    let rrVerdict = 'No aplicable';
    
    if (currentPrice && thesisData.suggestedTargetPrice && thesisData.suggestedInvalidationPrice) {
      const reward = thesisData.suggestedTargetPrice - currentPrice;
      const risk = currentPrice - thesisData.suggestedInvalidationPrice;
      
      if (risk > 0) {
        riskRewardRatio = reward / risk;
        rrVerdict = riskRewardRatio >= 2.0 ? 'APROBADO (R:R ≥ 1:2)' : 'RECHAZADO (R:R < 1:2)';
      } else {
        rrVerdict = 'RECHAZADO (Punto de invalidación incoherente)';
      }
    }

    thesisData.riskRewardRatio = riskRewardRatio;
    thesisData.rrVerdict = rrVerdict;

    // 3. Generate Markdown and JSON Files
    const mdContent = generateMarkdown(cleanTicker, thesisData);
    const mdFilename = `${cleanTicker}.md`;
    const mdFilePath = path.join(tesisDir, mdFilename);
    fs.writeFileSync(mdFilePath, mdContent, 'utf8');

    const jsonFilename = `${cleanTicker}.json`;
    const jsonFilePath = path.join(tesisDir, jsonFilename);
    const fullThesisData = {
      ...thesisData,
      ticker: cleanTicker,
      savedPath: mdFilePath,
      filename: mdFilename
    };
    fs.writeFileSync(jsonFilePath, JSON.stringify(fullThesisData, null, 2), 'utf8');

    console.log(`[Thesis Generator] Tesis guardada en: ${mdFilePath} y ${jsonFilePath}`);

    // Return thesis data and path to frontend
    res.json(fullThesisData);

  } catch (error) {
    console.error('[Error generating thesis]', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to serve markdown files directly as raw text (or we handle in endpoint)
app.use('/tesis', express.static(tesisDir));

// Helper function to generate Markdown content
function generateMarkdown(ticker, data) {
  const dateStr = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const currentPriceFormatted = data.currentPrice ? `$${data.currentPrice.toFixed(2)}` : 'No disponible';
  const targetFormatted = data.suggestedTargetPrice ? `$${data.suggestedTargetPrice.toFixed(2)}` : 'No disponible';
  const invalidationFormatted = data.suggestedInvalidationPrice ? `$${data.suggestedInvalidationPrice.toFixed(2)}` : 'No disponible';
  const rrFormatted = data.riskRewardRatio ? `1:${data.riskRewardRatio.toFixed(2)}` : 'No disponible';

  let md = `# Tesis de Inversión 3x3: ${ticker} (${data.companyName || 'N/A'})\n`;
  md += `**Fecha de Generación:** ${dateStr}\n\n`;
  md += `> **Tesis Central:** ${data.centralThesis}\n\n`;
  
  md += `## 🟢 3 Razones a Favor (¿Por qué sube?)\n`;
  data.reasonsInFavor.forEach((reason, index) => {
    md += `### ${index + 1}. ${reason.title}\n`;
    md += `${reason.description}\n\n`;
  });

  md += `## 🔴 2 Razones en Contra (¿Qué puede salir mal?)\n`;
  data.reasonsAgainst.forEach((reason, index) => {
    md += `### ${index + 1}. ${reason.title}\n`;
    md += `${reason.description}\n\n`;
  });

  md += `## ⚠️ 1 Evento de Invalidación (El Kill Switch)\n`;
  md += `* **Métricas Financieras:** ${data.killSwitch.metricComponent}\n`;
  md += `* **Contexto Empresarial:** ${data.killSwitch.contextComponent}\n\n`;

  md += `## 📊 Métricas de Operación & Checklist\n`;
  md += `| Parámetro | Valor |\n`;
  md += `| :--- | :--- |\n`;
  md += `| Precio de Entrada (Actual) | ${currentPriceFormatted} |\n`;
  md += `| Objetivo de Ganancia (Target) | ${targetFormatted} |\n`;
  md += `| Nivel de Invalidación (Stop) | ${invalidationFormatted} |\n`;
  md += `| Relación Riesgo:Retorno (R:R) | ${rrFormatted} |\n`;
  md += `| **Veredicto R:R (Mín. 1:2)** | **${data.rrVerdict}** |\n\n`;

  if (data.riskRewardRatio && data.riskRewardRatio >= 2.0) {
    md += `### ✅ Checklist de Validación: **OPERACIÓN APTA**\n`;
    md += `La operación cumple con la relación de riesgo/retorno mínima de 1:2 y se han completado los casilleros correspondientes del 3x3.\n\n`;
  } else {
    md += `### ❌ Checklist de Validación: **NO OPERAR**\n`;
    md += `La operación **NO** cumple con la relación de riesgo/retorno mínima de 1:2 o no se han podido definir todas las condiciones del 3x3.\n\n`;
  }

  if (data.citations && data.citations.length > 0) {
    md += `## 🔗 Fuentes y Citas Consultadas\n`;
    data.citations.forEach(citation => {
      md += `- [${citation.title}](${citation.url})\n`;
    });
  }

  return md;
}

app.listen(PORT, () => {
  console.log(`[Server] Corriendo en http://localhost:${PORT}`);
});
