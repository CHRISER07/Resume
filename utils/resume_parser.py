import os
import re
import PyPDF2
import docx
from utils.nlp_processor import clean_text, preprocess_text, extract_skills

# Common tech skills for extraction
COMMON_SKILLS = [
    # Programming Languages
    "python", "java", "javascript", "c++", "c#", "ruby", "php", "swift", "kotlin", "golang", "typescript",
    # Web Development
    "html", "css", "react", "angular", "vue", "node.js", "express", "django", "flask", "spring boot",
    # Databases
    "sql", "mysql", "postgresql", "mongodb", "sqlite", "oracle", "redis", "elasticsearch",
    # Cloud & DevOps
    "aws", "azure", "gcp", "docker", "kubernetes", "jenkins", "ci/cd", "terraform", "git", "github",
    # Data Science & ML
    "machine learning", "data science", "tensorflow", "pytorch", "keras", "scikit-learn", "pandas",
    "numpy", "r", "tableau", "power bi", "data visualization", "jupyter", "big data", "hadoop", "spark",
    # Soft Skills
    "leadership", "communication", "teamwork", "problem solving", "critical thinking", "time management",
    "project management", "agile", "scrum", "customer service", "presentation"
]

def extract_text_from_pdf(file_path):
    """Extract text content from PDF file"""
    text = ""
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page_num in range(len(pdf_reader.pages)):
                text += pdf_reader.pages[page_num].extract_text()
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
    return text

def extract_text_from_docx(file_path):
    """Extract text content from DOCX file"""
    text = ""
    try:
        doc = docx.Document(file_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    except Exception as e:
        print(f"Error extracting text from DOCX: {e}")
    return text

def extract_text_from_txt(file_path):
    """Extract text content from TXT file"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
            return file.read()
    except Exception as e:
        print(f"Error extracting text from TXT: {e}")
        return ""

def parse_resume(file_path):
    """Parse resume file and extract relevant information"""
    file_extension = os.path.splitext(file_path)[1].lower()
    
    # Extract text based on file type
    if file_extension == '.pdf':
        text = extract_text_from_pdf(file_path)
    elif file_extension == '.docx':
        text = extract_text_from_docx(file_path)
    elif file_extension == '.txt':
        text = extract_text_from_txt(file_path)
    else:
        return None
    
    # Clean and preprocess text
    raw_text = text
    clean_resume = clean_text(text)
    processed_resume = preprocess_text(text)
    
    # Extract skills
    skills = extract_skills(raw_text, COMMON_SKILLS)
    
    resume_data = {
        'raw_text': raw_text,
        'clean_text': clean_resume,
        'processed_text': processed_resume,
        'skills': skills,
        'file_type': file_extension[1:]  # Remove the dot
    }
    
    return resume_data