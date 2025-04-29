from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from utils.nlp_processor import extract_skills

# Load sentence transformer model
model = SentenceTransformer('paraphrase-MiniLM-L6-v2')

def get_text_embedding(text):
    """Convert text to embedding vector"""
    return model.encode([text])[0]

def calculate_similarity(text1, text2):
    """Calculate cosine similarity between two texts"""
    embedding1 = get_text_embedding(text1)
    embedding2 = get_text_embedding(text2)
    
    # Reshape for sklearn's cosine_similarity
    embedding1 = embedding1.reshape(1, -1)
    embedding2 = embedding2.reshape(1, -1)
    
    similarity = cosine_similarity(embedding1, embedding2)[0][0]
    return float(similarity)

def match_resume_to_job(resume_data, job_data):
    """Match resume to job and calculate score"""
    # Get text similarity
    text_similarity = calculate_similarity(
        resume_data['processed_text'], 
        job_data['processed_text']
    )
    
    # Calculate skill match
    job_skills = set(job_data['skills'])
    resume_skills = set(resume_data['skills'])
    
    matching_skills = resume_skills.intersection(job_skills)
    missing_skills = job_skills - resume_skills
    
    # Calculate skill match score
    if len(job_skills) > 0:
        skill_match_score = len(matching_skills) / len(job_skills)
    else:
        skill_match_score = 0
    
    # Final match score (weighted average)
    match_score = 0.6 * text_similarity + 0.4 * skill_match_score
    
    return {
        'match_score': match_score,
        'text_similarity': text_similarity,
        'skill_match_score': skill_match_score,
        'matching_skills': list(matching_skills),
        'missing_skills': list(missing_skills)
    }