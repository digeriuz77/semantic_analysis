import io
import re
import string
from typing import List, Dict, Any
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.stem import WordNetLemmatizer
from nltk.probability import FreqDist
from collections import Counter

from reliability import compute_reliability, embed_texts, get_embedding_backend

# Try importing optional heavy dependencies
try:
    import pdfplumber
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

try:
    from docx import Document
    DOCX_SUPPORT = True
except ImportError:
    DOCX_SUPPORT = False

# Initialize NLTK data (both tagger names: resource renamed in NLTK 3.9).
nltk.download("punkt", quiet=True)
nltk.download("punkt_tab", quiet=True)
nltk.download("stopwords", quiet=True)
nltk.download("wordnet", quiet=True)
nltk.download("averaged_perceptron_tagger", quiet=True)
nltk.download("averaged_perceptron_tagger_eng", quiet=True)
nltk.download("vader_lexicon", quiet=True)

# VADER sentiment analyzer (validated lexicon; degrades to heuristic if absent).
try:
    from nltk.sentiment import SentimentIntensityAnalyzer
    SIA = SentimentIntensityAnalyzer()
    VADER_OK = True
except Exception:
    SIA = None
    VADER_OK = False

app = FastAPI(title="NLP Service for Thematic Analyzer")

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_PDF_PAGES = 300
MAX_DOCX_PARAGRAPHS = 5000
MAX_RELIABILITY_RUNS = 24
MAX_THEMES_PER_RUN = 100
MAX_FLAT_THEMES = 800

STOP_WORDS = set(stopwords.words("english"))
LEMMATIZER = WordNetLemmatizer()

# Lexicon used only when VADER is unavailable (validated lexicon preferred above).
POSITIVE_WORDS = {
    "good", "great", "excellent", "positive", "happy", "success", "successful",
    "well", "better", "best", "love", "wonderful", "fantastic", "impressive",
    "enjoy", "benefit", "helpful", "effective", "improve", "growth", "achieve",
}
NEGATIVE_WORDS = {
    "bad", "poor", "terrible", "negative", "sad", "fail", "failure", "worse",
    "worst", "hate", "awful", "disappointing", "difficult", "problem", "issue",
    "struggle", "wrong", "error", "weak", "lack",
}


def compute_sentiment(text: str, processed_words: List[str]) -> Dict[str, float]:
    """VADER sentiment (validated lexicon); lexical fallback if unavailable."""
    if VADER_OK and SIA is not None:
        scores = SIA.polarity_scores(text)
        return {
            "positive": round(scores["pos"] * 100, 1),
            "neutral": round(scores["neu"] * 100, 1),
            "negative": round(scores["neg"] * 100, 1),
        }
    pos_count = sum(1 for w in processed_words if w in POSITIVE_WORDS)
    neg_count = sum(1 for w in processed_words if w in NEGATIVE_WORDS)
    total = len(processed_words)
    if total > 0:
        neutral_count = max(0, total - pos_count - neg_count)
        return {
            "positive": round(pos_count / total * 100, 1),
            "neutral": round(neutral_count / total * 100, 1),
            "negative": round(neg_count / total * 100, 1),
        }
    return {"positive": 33.3, "neutral": 33.4, "negative": 33.3}

# Additional common filler/placeholder words that add no thematic value
# These are function words or vague references, NOT content verbs
EXTRA_STOP_WORDS = {
    # Vague references / filler
    "thing", "things", "stuff", "way", "ways", "lot", "kind", "sort",
    "bit", "little", "much", "many", "also", "even", "just", "really",
    "quite", "very", "rather", "pretty", "maybe", "perhaps", "actually",
    "basically", "literally", "obviously", "certainly", "definitely",
    "probably", "possibly", "however", "therefore", "although", "though",
    # Common auxiliary/modal overuse
    "got", "get", "got", "getting", "goes", "going", "gone", "went",
    "came", "come", "comes", "coming",
    # Placeholder phrases often used in speech
    "etc", "etc.", "et",
}
STOP_WORDS.update(EXTRA_STOP_WORDS)


def extract_text_from_file(file_content: bytes, filename: str) -> str:
    ext = filename.split(".")[-1].lower()

    if ext == "txt":
        return file_content.decode("utf-8", errors="ignore")
    elif ext == "csv":
        return file_content.decode("utf-8", errors="ignore")
    elif ext == "pdf":
        if not PDF_SUPPORT:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
        if not file_content.startswith(b"%PDF"):
            raise HTTPException(status_code=400, detail="Invalid PDF file (bad magic bytes)")
        text = ""
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            for page in pdf.pages[:MAX_PDF_PAGES]:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text
    elif ext == "docx":
        if not DOCX_SUPPORT:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
        if not file_content.startswith(b"PK\x03\x04"):
            raise HTTPException(status_code=400, detail="Invalid DOCX file (bad magic bytes)")
        doc = Document(io.BytesIO(file_content))
        return "\n".join(
            [para.text for para in doc.paragraphs[:MAX_DOCX_PARAGRAPHS]]
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")


def clean_text(text: str) -> str:
    # Remove URLs
    text = re.sub(r"http\S+|www\S+|https\S+", "", text, flags=re.MULTILINE)
    # Remove mentions and hashtags
    text = re.sub(r"@\w+|#\w+", "", text)
    # Remove special characters and digits, keep letters and spaces
    text = re.sub(r"[^a-zA-Z\s]", "", text)
    # Remove extra whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def process_corpus(text: str) -> Dict[str, Any]:
    # Tokenize
    words = word_tokenize(text.lower())

    # Clean and Lemmatize
    processed_words = []
    for word in words:
        if word not in STOP_WORDS and word not in string.punctuation and len(word) > 2:
            processed_words.append(LEMMATIZER.lemmatize(word))

    # Stats
    total_words = len(processed_words)
    unique_words = len(set(processed_words))
    sentences = sent_tokenize(text)
    sentence_count = len(sentences)
    avg_word_length = sum(len(w) for w in processed_words) / total_words if total_words > 0 else 0

    # Word Frequency
    freq_dist = FreqDist(processed_words)
    top_keywords = [{"word": word, "count": count} for word, count in freq_dist.most_common(20)]

    # POS Tagging (Simplified for performance)
    pos_tags = nltk.pos_tag(processed_words[:1000]) # Limit for speed
    pos_counts = Counter(tag for word, tag in pos_tags)

    # Readability (Flesch-Kincaid)
    # FK = 206.835 - 1.015(total words / total sentences) - 84.6(total syllables / total words)
    def count_syllables(word):
        word = word.lower()
        if len(word) <= 3: return 1
        word = re.sub(r"[^a-z]", "", word)
        count = 0
        vowels = "aeiouy"
        if word[0] in vowels: count += 1
        for index in range(1, len(word)):
            if word[index] in vowels and word[index-1] not in vowels:
                count += 1
        if word.endswith("e"): count -= 1
        if count == 0: count = 1
        return count

    total_syllables = sum(count_syllables(w) for w in processed_words)
    if sentence_count > 0 and total_words > 0:
        flesch_score = 206.835 - 1.015 * (total_words / sentence_count) - 84.6 * (total_syllables / total_words)
    else:
        flesch_score = 0

    # Sentiment (VADER on the original text; lexical fallback handled internally)
    sentiment = compute_sentiment(text, processed_words)

    cleaned_text = clean_text(text)

    return {
        "stats": {
            "totalWords": total_words,
            "uniqueWords": unique_words,
            "sentences": sentence_count,
            "avgWordLength": round(avg_word_length, 2),
            "flesch_reading_ease": round(flesch_score, 2),
            "lexical_density": round((unique_words / total_words) * 100, 2) if total_words > 0 else 0
        },
        "top_keywords": top_keywords,
        "sentiment": sentiment,
        "cleaned_text": cleaned_text,
        "pos_distribution": dict(pos_counts.most_common(10))
    }


@app.post("/process")
async def process_file(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        if len(contents) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File exceeds the 10 MB size limit")
        text = extract_text_from_file(contents, file.filename)

        if not text or len(text.strip()) == 0:
            raise HTTPException(status_code=400, detail="File is empty or could not be read")

        result = process_corpus(text)
        # Punctuation-preserving extraction for sentence-level evidence
        # retrieval downstream (clean_text strips punctuation, which collapses
        # sent_tokenize into one giant span).
        result["extracted_text"] = text[:200_000]
        return result

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal error processing file")


@app.post("/reliability")
async def reliability_endpoint(request: Request):
    """Dual-metric reliability (Cohen's kappa + cosine) + consensus themes.

    Accepts raw JSON: { runs: [ { themes: [ {name, description, keywords} ] } ],
    cosine_threshold?, min_occurrence_ratio? }. Structure-agnostic: any valid
    theme objects are accepted.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Body must be a JSON object")
    runs = body.get("runs", [])
    if not isinstance(runs, list):
        raise HTTPException(status_code=400, detail="'runs' must be a list")
    if len(runs) > MAX_RELIABILITY_RUNS:
        raise HTTPException(status_code=400, detail=f"Too many runs (max {MAX_RELIABILITY_RUNS})")
    for run in runs:
        if not isinstance(run, dict):
            raise HTTPException(status_code=400, detail="Each run must be an object")
        themes = run.get("themes", [])
        if not isinstance(themes, list):
            raise HTTPException(status_code=400, detail="'themes' must be a list")
        if len(themes) > MAX_THEMES_PER_RUN:
            raise HTTPException(status_code=400, detail=f"Too many themes in one run (max {MAX_THEMES_PER_RUN})")
    cosine_threshold = float(body.get("cosine_threshold", 0.70))
    min_occurrence_ratio = float(body.get("min_occurrence_ratio", 0.5))
    return compute_reliability(runs, cosine_threshold, min_occurrence_ratio, max_flat_themes=MAX_FLAT_THEMES)


@app.post("/embed")
async def embed_endpoint(request: Request):
    """Embed a list of texts. Backend is sentence-transformers if installed,
    otherwise TF-IDF. Returned vectors are L2-normalized."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    texts = body.get("texts", [])
    if not isinstance(texts, list):
        raise HTTPException(status_code=400, detail="'texts' must be a list")
    if len(texts) > 500:
        raise HTTPException(status_code=400, detail="Too many texts (max 500)")
    vecs, backend = embed_texts([str(t)[:5000] for t in texts])
    return {
        "vectors": vecs.tolist(),
        "dim": int(vecs.shape[1]) if vecs.size else 0,
        "backend": backend,
        "count": int(vecs.shape[0]),
    }


@app.post("/evidence")
async def evidence_endpoint(request: Request):
    """Retrieve supporting text spans from the source corpus for each theme.

    Splits the source text into sentence-level units, embeds both the units and
    the theme descriptions, and returns the top-k most semantically similar
    source spans per theme. This grounds each theme in traceable evidence even
    when the LLM did not return explicit quotes.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    source = str(body.get("text", ""))
    themes = body.get("themes", [])
    top_k = int(body.get("top_k", 3))
    if not isinstance(themes, list) or not source:
        return {"evidence": []}

    units = [u.strip() for u in sent_tokenize(source) if len(u.strip()) > 25]
    if not units or not themes:
        empty: List[List[Dict[str, Any]]] = [[] for _ in themes] if isinstance(themes, list) else []
        return {"evidence": empty}

    theme_texts = [
        (str(t.get("name", "")) + ". " + str(t.get("description", ""))).strip(". ")
        for t in themes
    ]
    all_texts = units + theme_texts
    vecs, _ = embed_texts(all_texts)
    unit_vecs = vecs[: len(units)]
    theme_vecs = vecs[len(units):]

    evidence: List[List[Dict[str, Any]]] = []
    for ti, theme_obj in enumerate(themes):
        sims = theme_vecs[ti] @ unit_vecs.T
        order = np.argsort(-sims)[:top_k]
        spans = [
            {
                "text": units[idx],
                "cosine": round(float(sims[idx]), 4),
                "unitIndex": int(idx),
            }
            for idx in order
            if float(sims[idx]) > 0
        ]
        evidence.append(spans)
    return {"evidence": evidence}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "nltk_data": "loaded",
        "embedding_backend": get_embedding_backend(),
    }


def _ST_AVAILABLE() -> bool:
    try:
        from reliability import get_embedding_backend
        return get_embedding_backend() == "sentence-transformers"
    except Exception:
        return False


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)