    FROM python:3.9-slim

    # Install build dependencies and poppler-utils
    RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        python3-dev \
        build-essential \
        poppler-utils \
        && apt-get clean \
        && rm -rf /var/lib/apt/lists/*

    WORKDIR /app

    COPY requirements.txt .
    RUN pip install --no-cache-dir --upgrade pip && \
        pip install --no-cache-dir -r requirements.txt

    # Download NLTK and spaCy resources
    RUN python -m nltk.downloader punkt stopwords wordnet && \
        python -m spacy download en_core_web_sm

    COPY . .

    # Set environment variables
    ENV AWS_REGION=us-east-1
    ENV S3_BUCKET=resuucketaw
    ENV PORT=5000
    ENV WORKERS=4

    EXPOSE 5000

    CMD ["gunicorn", "--workers=4", "--threads=2", "--timeout=120", "--bind", "0.0.0.0:5000", "app:app"]