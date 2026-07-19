# Semantic & Thematic Analyzer

A full-stack application for deep thematic analysis of text corpora, combining classical NLP (NLTK) with modern LLMs (Fireworks AI).

## Features

- **Multi-format Support**: Upload .txt, .pdf, .docx, .csv files.
- **NLTK Processing**: Tokenization, lemmatization, stop-word removal, POS tagging.
- **Thematic Analysis**: Braun & Clarke inspired theme extraction.
- **Specialist Lens**: Configurable analysis module (Default: Teaching Reflection Quality based on Schön's Double Loop Learning).
- **Visualizations**: Word frequency charts, sentiment analysis, readability scores.

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Recharts
- **Backend API**: Next.js API Routes (TypeScript)
- **NLP Engine**: Python FastAPI, NLTK, pdfplumber, python-docx

## Setup Instructions

### 1. Install Node Dependencies
```bash
bun install
```

### 2. Setup Python Environment
Ensure you have Python 3.9+ installed.
```bash
cd nlp_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python setup_nltk.py
```

### 3. Environment Variables
Copy `.env.example` to `.env.local` and add your Fireworks AI key (optional).

### 4. Run the Application

You need two terminals:

**Terminal 1 (NLP Service):**
```bash
cd nlp_service
source venv/bin/activate
python main.py
```

**Terminal 2 (Next.js Frontend):**
```bash
bun dev
```

Visit `http://localhost:3000`.

## Architecture

1. **User uploads files** via the Next.js frontend.
2. **Next.js API** forwards files to the Python NLP Service (`/api/nlp/process`).
3. **Python Service** parses the document, cleans text using NLTK, calculates stats, and returns JSON.
4. **Next.js API** optionally sends cleaned text to Fireworks AI for semantic theme generation.
5. **Frontend** renders the Dashboard with charts and analysis results.