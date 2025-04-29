import re
import spacy
import nltk
from nltk.corpus import stopwords

# Download required resources
nltk.download('stopwords', quiet=True)
nltk.download('punkt', quiet=True)

# Load spaCy model
try:
    nlp = spacy.load("en_core_web_sm")
except:
    import spacy.cli
    spacy.cli.download("en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")

# Get stopwords
stop_words = set(stopwords.words("english"))

def clean_text(text):
    """Basic text cleaning"""
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r'\n+', ' ', text)
    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def preprocess_text(text):
    """Advanced NLP preprocessing with lemmatization"""
    if not isinstance(text, str):
        return ""
    
    # Basic cleaning
    text = clean_text(text)
    
    # Process with spaCy
    doc = nlp(text)
    tokens = [token.lemma_ for token in doc if token.is_alpha and token.text not in stop_words]
    
    # Join tokens back into text
    processed_text = " ".join(tokens)
    return processed_text

def extract_skills(text, skill_set):
    """Extract skills from text based on a predefined skill set"""
    skills_found = []
    text = text.lower()
    
    # Process with spaCy for better phrase matching
    doc = nlp(text)
    
    # Check for single-word skills
    for skill in skill_set:
        skill_lower = skill.lower()
        # Direct match
        if skill_lower in text:
            skills_found.append(skill)
            continue
            
        # Check for skill phrases
        if len(skill_lower.split()) > 1:
            if skill_lower in text:
                skills_found.append(skill)
    
    return list(set(skills_found))  # Remove duplicates