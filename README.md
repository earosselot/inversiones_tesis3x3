# Inversiones - Investment Analysis with Gemini AI

An intelligent investment analysis application that uses Google's Generative AI (Gemini) to generate comprehensive investment theses for stock tickers. The app fetches real-time financial data from Yahoo Finance and uses AI to analyze and provide insights for various stocks.

## Features

- Generate AI-powered investment analyses (theses) for any stock ticker
- Real-time stock data integration via Yahoo Finance
- Store and retrieve generated analyses
- Web-based interface for easy interaction
- Support for multiple stock tickers (AAPL, MSFT, NVDA, AMZN, INTC, JNJ, KO, LLY, MELI, SPX, etc.)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 14 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- A **Google Generative AI API key** (Gemini) - See instructions below

## Getting Your Gemini API Key

Follow these steps to obtain your Gemini API key:

### Step 1: Go to Google AI Studio
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account (create one if you don't have it)

### Step 2: Create a New API Key
1. Click on **"Create API Key"** button
2. Select **"Create API Key in new project"** (or choose an existing project if you have one)
3. Your API key will be generated and displayed

### Step 3: Copy Your API Key
1. Click the copy icon next to your API key to copy it to the clipboard
2. Save it somewhere safe - you'll need it to run the application

### Important Notes
- Keep your API key **private** and never commit it to version control
- The `.env` file is already in `.gitignore` to prevent accidental exposure
- If your API key is accidentally exposed, regenerate it immediately in Google AI Studio

## Installation

### 1. Clone or Download the Project
```bash
cd inversiones_tesis3x3
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Create Environment Configuration
Create a `.env` file in the project root directory and add your Gemini API key:

```bash
echo "GEMINI_API_KEY=your_api_key_here" > .env
```

Or manually create a `.env` file with the following content:
```
GEMINI_API_KEY=your_api_key_here
PORT=3000
```

Replace `your_api_key_here` with the actual API key you obtained from Google AI Studio.

**Note:** The `.env` file is in `.gitignore`, so it won't be committed to version control.

## Running the Application

### Start the Server
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

### Access the Web Interface
Open your browser and navigate to:
```
http://localhost:3000
```

### Using the Application
1. Enter a stock ticker (e.g., AAPL, MSFT, GOOGL)
2. Optionally provide a Gemini API key (or it will use the one from `.env`)
3. Click the "Generate Thesis" button
4. The AI will analyze the stock and generate a comprehensive investment thesis
5. View previously generated analyses in the theses list

## Project Structure

```
inversiones_tesis3x3/
├── public/                 # Frontend files (HTML, CSS, JavaScript)
├── tesis/                  # Generated thesis files (markdown format)
├── server.js               # Express server and API endpoints
├── package.json            # Project dependencies and scripts
├── .env                    # Environment variables (not tracked in git)
├── .gitignore              # Git ignore rules
└── README.md              # This file
```

## API Endpoints

### GET `/api/tesis`
Get a list of all generated theses

**Response:**
```json
[
  {
    "filename": "AAPL.md",
    "ticker": "AAPL",
    "createdAt": "2024-01-15T10:30:00Z",
    "path": "/tesis/AAPL.md"
  }
]
```

### GET `/api/tesis/:filename`
Get the content of a specific thesis file

**Response:**
```json
{
  "content": "# Investment Thesis for AAPL\n\n..."
}
```

### POST `/api/generate-thesis`
Generate a new investment thesis for a stock ticker

**Request Body:**
```json
{
  "ticker": "AAPL",
  "geminiApiKey": "optional_api_key_override",
  "model": "optional_model_name"
}
```

**Response:**
```json
{
  "thesis": "Generated markdown thesis content...",
  "filename": "AAPL.md",
  "ticker": "AAPL"
}
```

## Troubleshooting

### "Se requiere una API Key de Gemini" Error
This means your Gemini API key is not configured. Make sure:
1. You've created a `.env` file in the project root
2. The `GEMINI_API_KEY` is set correctly
3. The API key is valid and active in your Google Cloud project

### Port Already in Use
If port 3000 is already in use, specify a different port:
```bash
PORT=3001 npm start
```

### Stock Ticker Not Found
Yahoo Finance may not have data for certain tickers. Try with a major ticker like AAPL, MSFT, or GOOGL to test the application.

### Installation Issues
Clear npm cache and reinstall:
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

## Dependencies

- **express** - Web framework for Node.js
- **@google/generative-ai** - Google's Generative AI SDK (Gemini)
- **yahoo-finance2** - Real-time stock data from Yahoo Finance
- **dotenv** - Environment variable management

## Environment Variables

Create a `.env` file with the following variables:

```
GEMINI_API_KEY=your_gemini_api_key
PORT=3000
```

## Security Notes

- Never commit your `.env` file to version control
- Keep your Gemini API key private
- The `.gitignore` file already excludes `.env`
- If your API key is exposed, regenerate it immediately

## License

ISC

## Author

Created as a thesis project for investment analysis using AI.

---

For more information about Google's Generative AI, visit: https://ai.google.dev/
