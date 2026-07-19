import os
import io
import re
import math
import string
from typing import List, Dict, Any
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.stem import WordNetLemmatizer
from nltk.probability import FreqDist
from collections import Counter

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

# Initialize NLTK data
nltk.download("punkt", quiet=True)
nltk.download("punkt_tab", quiet=True)
nltk.download("stopwords", quiet=True)
nltk.download("wordnet", quiet=True)
nltk.download("averaged_perceptron_tagger", quiet=True)

app = FastAPI(title="NLP Service for Thematic Analyzer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STOP_WORDS = set(stopwords.words("english"))
LEMMATIZER = WordNetLemmatizer()

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
    elif ext == "pdf" and PDF_SUPPORT:
        text = ""
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text
    elif ext == "docx" and DOCX_SUPPORT:
        doc = Document(io.BytesIO(file_content))
        return "\n".join([para.text for para in doc.paragraphs])
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

    # Simple Sentiment (Heuristic based on positive/negative word lists)
    positive_words = {"good", "great", "excellent", "positive", "happy", "success", "successful", "well", "better", "best", "love", "wonderful", "fantastic", "impressive", "enjoy", "benefit", "helpful", "effective", "improve", "growth", "achieve"}
    negative_words = {"bad", "poor", "terrible", "negative", "sad", "fail", "failure", "worse", "worst", "hate", "awful", "disappointing", "difficult", "problem", "issue", "struggle", "wrong", "error", "weak", "lack"}

    pos_count = sum(1 for w in processed_words if w in positive_words)
    neg_count = sum(1 for w in processed_words if w in negative_words)
    total_sentiment_words = pos_count + neg_count

    if total_sentiment_words > 0:
        sentiment = {
            "positive": round((pos_count / total_sentiment_words) * 100, 1),
            "neutral": round(max(0, 100 - (pos_count + neg_count) * 5), 1), # Rough estimate
            "negative": round((neg_count / total_sentiment_words) * 100, 1)
        }
        # Normalize sentiment to 100
        total_sent = sentiment["positive"] + sentiment["neutral"] + sentiment["negative"]
        if total_sent > 0:
            sentiment = {k: round((v/total_sent)*100, 1) for k, v in sentiment.items()}
    else:
        sentiment = {"positive": 33.3, "neutral": 33.4, "negative": 33.3}

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
        text = extract_text_from_file(contents, file.filename)

        if not text or len(text.strip()) == 0:
            raise HTTPException(status_code=400, detail="File is empty or could not be read")

        result = process_corpus(text)
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    return {"status": "healthy", "nltk_data": "loaded"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)