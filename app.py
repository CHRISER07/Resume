from flask import Flask, render_template, request, jsonify
import os
import uuid
import json
import logging
from werkzeug.utils import secure_filename
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from sentence_transformers import SentenceTransformer
from utils.resume_parser import parse_resume, COMMON_SKILLS
from utils.nlp_processor import preprocess_text, extract_skills
from utils.matching import match_resume_to_job
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
from io import BytesIO
import tempfile

# Initialize Flask app
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload
app.config['ALLOWED_EXTENSIONS'] = {'txt', 'pdf', 'docx'}

# AWS S3 Configuration (credentials via environment variables or IAM roles)
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
S3_BUCKET = os.getenv('S3_BUCKET', 'resuucketaw')

# Initialize S3 client
s3_client = boto3.client(
    's3',
    region_name=AWS_REGION
)  # Credentials are handled by AWS SDK (IAM roles or env vars)

# Create necessary directories for local development
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('data/job_descriptions', exist_ok=True)

# In-memory storage for demo purposes (consider a database for production)
resumes = {}
jobs = {}

# Load the SentenceTransformer model once
model = SentenceTransformer('paraphrase-MiniLM-L6-v2')

# ThreadPoolExecutor for asynchronous processing
executor = ThreadPoolExecutor(max_workers=int(os.getenv('WORKERS', 4)))

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def upload_to_s3(file_obj, object_name, bucket=S3_BUCKET):
    """Upload a file to an S3 bucket"""
    try:
        s3_client.upload_fileobj(file_obj, bucket, object_name)
        logger.info(f"Uploaded file to s3://{bucket}/{object_name}")
        return True
    except NoCredentialsError:
        logger.error("AWS credentials not available")
        return False
    except ClientError as e:
        logger.error(f"S3 upload error: {e}")
        return False

def download_from_s3(object_name, bucket=S3_BUCKET):
    """Download a file from an S3 bucket"""
    try:
        file_obj = BytesIO()
        s3_client.download_fileobj(bucket, object_name, file_obj)
        file_obj.seek(0)
        return file_obj
    except ClientError as e:
        logger.error(f"S3 download error: {e}")
        return None

def delete_from_s3(object_name, bucket=S3_BUCKET):
    """Delete a file from an S3 bucket"""
    try:
        s3_client.delete_object(Bucket=bucket, Key=object_name)
        logger.info(f"Deleted s3://{bucket}/{object_name}")
        return True
    except ClientError as e:
        logger.error(f"S3 delete error: {e}")
        return False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/process_resume', methods=['POST'])
def process_resume():
    if 'resume' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['resume']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed. Please upload .txt, .pdf, or .docx files'}), 400

    resume_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    file_extension = os.path.splitext(filename)[1].lower()
    s3_object_name = f"resumes/{resume_id}{file_extension}"

    # Upload to S3
    file.seek(0)  # Ensure file pointer is at start
    if not upload_to_s3(file, s3_object_name):
        return jsonify({'error': 'Failed to upload file to storage'}), 500

    # Download for processing
    temp_path = None
    try:
        file_obj = download_from_s3(s3_object_name)
        if not file_obj:
            delete_from_s3(s3_object_name)
            return jsonify({'error': 'Failed to retrieve uploaded file'}), 500

        with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp:
            temp.write(file_obj.read())
            temp_path = temp.name

        # Parse resume
        resume_data = parse_resume(temp_path)
        if not resume_data:
            delete_from_s3(s3_object_name)
            return jsonify({'error': 'Could not process file format'}), 400

        # Store resume data
        resume_data['id'] = resume_id
        resume_data['name'] = filename
        resume_data['s3_key'] = s3_object_name
        resumes[resume_id] = resume_data

        # Save resume metadata to S3
        resume_json = json.dumps(resume_data).encode('utf-8')
        metadata_s3_key = f"resumes/{resume_id}.json"
        if not upload_to_s3(BytesIO(resume_json), metadata_s3_key):
            logger.warning(f"Failed to save resume metadata to s3://{S3_BUCKET}/{metadata_s3_key}")

        return jsonify({
            'id': resume_id,
            'name': filename,
            'file_type': resume_data.get('file_type', 'Unknown'),
            'skills': resume_data.get('skills', [])
        })
    except Exception as e:
        delete_from_s3(s3_object_name)
        logger.error(f"Error processing resume: {str(e)}")
        return jsonify({'error': f'Error processing resume: {str(e)}'}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

@app.route('/api/process_job', methods=['POST'])
def process_job():
    try:
        data = request.json
        if not data or not isinstance(data, dict):
            return jsonify({'error': 'Invalid or missing JSON data'}), 400

        job_title = data.get('title', '').strip()
        job_description = data.get('description', '').strip()
        if not job_title:
            return jsonify({'error': 'Job title is required'}), 400
        if not job_description:
            return jsonify({'error': 'Job description is required'}), 400

        job_id = str(uuid.uuid4())
        clean_description = preprocess_text(job_description)
        skills = extract_skills(job_description, COMMON_SKILLS)

        job_data = {
            'id': job_id,
            'title': job_title,
            'description': job_description,
            'processed_text': clean_description,
            'skills': skills
        }
        jobs[job_id] = job_data

        # Save to S3
        job_json = json.dumps(job_data).encode('utf-8')
        s3_key = f"jobs/{job_id}.json"
        if not upload_to_s3(BytesIO(job_json), s3_key):
            logger.warning(f"Failed to save job to s3://{S3_BUCKET}/{s3_key}")

        return jsonify({
            'id': job_id,
            'title': job_title,
            'skills': skills
        })
    except Exception as e:
        logger.error(f"Error processing job: {str(e)}")
        return jsonify({'error': f'Error processing job: {str(e)}'}), 500

@app.route('/api/match', methods=['POST'])
def match():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400

        resume_id = data.get('resume_id')
        job_id = data.get('job_id')
        if not resume_id:
            return jsonify({'error': 'Resume ID is required'}), 400
        if not job_id:
            return jsonify({'error': 'Job ID is required'}), 400

        # Load resume if not in memory
        if resume_id not in resumes:
            try:
                s3_key = f"resumes/{resume_id}.json"
                response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
                resumes[resume_id] = json.loads(response['Body'].read().decode('utf-8'))
            except ClientError:
                return jsonify({'error': 'Resume not found'}), 404

        # Load job if not in memory
        if job_id not in jobs:
            try:
                s3_key = f"jobs/{job_id}.json"
                response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
                jobs[job_id] = json.loads(response['Body'].read().decode('utf-8'))
            except ClientError:
                return jsonify({'error': 'Job not found'}), 404

        resume_data = resumes[resume_id]
        job_data = jobs[job_id]

        # Calculate match
        future = executor.submit(match_resume_to_job, resume_data, job_data)
        try:
            match_result = future.result(timeout=10)
        except TimeoutError:
            logger.error("Match calculation timed out")
            return jsonify({'error': 'Match calculation timed out'}), 500

        return jsonify(match_result)
    except Exception as e:
        logger.error(f"Error in match calculation: {str(e)}")
        return jsonify({'error': f'Error calculating match: {str(e)}'}), 500

@app.route('/api/resumes', methods=['GET'])
def get_resumes():
    try:
        # List resumes from S3
        response = s3_client.list_objects_v2(Bucket=S3_BUCKET, Prefix='resumes/')
        resume_list = []
        if 'Contents' in response:
            for obj in response['Contents']:
                if obj['Key'].endswith('.json'):
                    try:
                        resume_data = s3_client.get_object(Bucket=S3_BUCKET, Key=obj['Key'])
                        resume = json.loads(resume_data['Body'].read().decode('utf-8'))
                        resume_list.append({'id': resume['id'], 'name': resume['name']})
                    except Exception as e:
                        logger.error(f"Error loading resume {obj['Key']}: {str(e)}")
        return jsonify({'resumes': resume_list})
    except Exception as e:
        logger.error(f"Error getting resumes: {str(e)}")
        return jsonify({'error': f'Error retrieving resumes: {str(e)}'}), 500

@app.route('/api/jobs', methods=['GET'])
def get_jobs():
    try:
        # List jobs from S3
        response = s3_client.list_objects_v2(Bucket=S3_BUCKET, Prefix='jobs/')
        job_list = []
        if 'Contents' in response:
            for obj in response['Contents']:
                if obj['Key'].endswith('.json'):
                    try:
                        job_data = s3_client.get_object(Bucket=S3_BUCKET, Key=obj['Key'])
                        job = json.loads(job_data['Body'].read().decode('utf-8'))
                        job_list.append({'id': job['id'], 'title': job['title']})
                    except Exception as e:
                        logger.error(f"Error loading job {obj['Key']}: {str(e)}")
        return jsonify({'jobs': job_list})
    except Exception as e:
        logger.error(f"Error getting jobs: {str(e)}")
        return jsonify({'error': f'Error retrieving jobs: {str(e)}'}), 500

@app.route('/api/jobs/<job_id>', methods=['GET', 'DELETE'])
def job_operations(job_id):
    try:
        if job_id not in jobs:
            try:
                s3_key = f"jobs/{job_id}.json"
                response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
                jobs[job_id] = json.loads(response['Body'].read().decode('utf-8'))
            except ClientError:
                return jsonify({'error': 'Job not found'}), 404

        if request.method == 'GET':
            return jsonify({'job': jobs[job_id]})

        elif request.method == 'DELETE':
            s3_key = f"jobs/{job_id}.json"
            delete_from_s3(s3_key)
            del jobs[job_id]
            return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error in job operations: {str(e)}")
        return jsonify({'error': f'Error with job operation: {str(e)}'}), 500

@app.route('/api/resumes/<resume_id>', methods=['DELETE'])
def delete_resume(resume_id):
    try:
        if resume_id not in resumes:
            try:
                s3_key = f"resumes/{resume_id}.json"
                response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
                resumes[resume_id] = json.loads(response['Body'].read().decode('utf-8'))
            except ClientError:
                return jsonify({'error': 'Resume not found'}), 404

        s3_key = resumes[resume_id].get('s3_key')
        metadata_s3_key = f"resumes/{resume_id}.json"
        if s3_key:
            delete_from_s3(s3_key)
        delete_from_s3(metadata_s3_key)
        del resumes[resume_id]
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error deleting resume: {str(e)}")
        return jsonify({'error': f'Error deleting resume: {str(e)}'}), 500

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File too large. Maximum size is 16MB'}), 413

# Load saved data from S3 on startup
def load_saved_data_from_s3():
    try:
        # Load jobs
        response = s3_client.list_objects_v2(Bucket=S3_BUCKET, Prefix='jobs/')
        if 'Contents' in response:
            for obj in response['Contents']:
                if obj['Key'].endswith('.json'):
                    try:
                        job_data = s3_client.get_object(Bucket=S3_BUCKET, Key=obj['Key'])
                        job = json.loads(job_data['Body'].read().decode('utf-8'))
                        if 'id' in job:
                            jobs[job['id']] = job
                    except Exception as e:
                        logger.error(f"Error loading job {obj['Key']}: {str(e)}")

        # Load resumes
        response = s3_client.list_objects_v2(Bucket=S3_BUCKET, Prefix='resumes/')
        if 'Contents' in response:
            for obj in response['Contents']:
                if obj['Key'].endswith('.json'):
                    try:
                        resume_data = s3_client.get_object(Bucket=S3_BUCKET, Key=obj['Key'])
                        resume = json.loads(resume_data['Body'].read().decode('utf-8'))
                        if 'id' in resume:
                            resumes[resume['id']] = resume
                    except Exception as e:
                        logger.error(f"Error loading resume {obj['Key']}: {str(e)}")
    except Exception as e:
        logger.error(f"Error loading data from S3: {str(e)}")

# Initialize data on startup
load_saved_data_from_s3()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)))