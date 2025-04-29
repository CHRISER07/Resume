document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded and parsed');
    // Navigation functionality
    setupNavigation();

    // Form submissions
    setupForms();

    // Load initial data
    loadResumes();
    loadJobs();
});

// Setup navigation between sections
function setupNavigation() {
    const navItems = {
        'nav-upload': 'upload-section',
        'nav-match': 'match-section',
        'nav-jobs': 'jobs-section',
        'nav-about': 'about-section'
    };

    // Handle navigation clicks
    Object.keys(navItems).forEach(navId => {
        const navElement = document.getElementById(navId);
        if (!navElement) return;

        navElement.addEventListener('click', function(e) {
            e.preventDefault();

            // Hide all sections
            document.querySelectorAll('.content-section').forEach(section => {
                section.style.display = 'none';
            });

            // Show selected section
            const targetSection = document.getElementById(navItems[navId]);
            if (targetSection) {
                targetSection.style.display = 'block';
            }

            // Update active nav
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            this.classList.add('active');
        });
    });
}

// Setup form submissions
function setupForms() {
    // Resume upload form
    const resumeForm = document.getElementById('resume-upload-form');
    if (resumeForm) {
        resumeForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Resume upload form submitted');

            const formData = new FormData();
            const resumeFileInput = document.getElementById('resume-file');

            if (!resumeFileInput || !resumeFileInput.files || !resumeFileInput.files[0]) {
                showAlert('Please select a resume file to upload', 'danger');
                return;
            }

            const resumeFile = resumeFileInput.files[0];
            formData.append('resume', resumeFile);

            // Show loading indicator
            showLoading('Processing resume...');

            fetch('/api/process_resume', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || 'Failed to process resume');
                    });
                }
                return response.json();
            })
            .then(data => {
                hideLoading();
                displayResumeResults(data);
                // Refresh resume list
                loadResumes();
            })
            .catch(error => {
                hideLoading();
                console.error('Error:', error);
                showAlert('Error processing resume: ' + error.message, 'danger');
            });
        });
    }

    // Job description form
    const jobForm = document.getElementById('job-description-form');
    if (jobForm) {
        jobForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Job description form submitted');

            const jobTitleInput = document.getElementById('job-title');
            const jobDescriptionInput = document.getElementById('job-description');

            if (!jobTitleInput || !jobDescriptionInput) {
                showAlert('Form elements not found', 'danger');
                return;
            }

            const jobTitle = jobTitleInput.value.trim();
            const jobDescription = jobDescriptionInput.value.trim();

            if (!jobTitle) {
                showAlert('Please enter a job title', 'danger');
                return;
            }

            if (!jobDescription) {
                showAlert('Please enter a job description', 'danger');
                return;
            }

            // Show loading indicator
            showLoading('Processing job description...');

            fetch('/api/process_job', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: jobTitle,
                    description: jobDescription
                })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || 'Failed to process job description');
                    });
                }
                return response.json();
            })
            .then(data => {
                hideLoading();
                displayJobResults(data);
                // Reset form
                jobForm.reset();
                // Refresh job list
                loadJobs();
            })
            .catch(error => {
                hideLoading();
                console.error('Error:', error);
                showAlert('Error processing job description: ' + error.message, 'danger');
            });
        });
    }

    // Match form
    const matchForm = document.getElementById('match-form');
    if (matchForm) {
        matchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Match form submitted');

            const resumeSelect = document.getElementById('select-resume');
            const jobSelect = document.getElementById('select-job');

            if (!resumeSelect || !jobSelect) {
                showAlert('Form elements not found', 'danger');
                return;
            }

            const resumeId = resumeSelect.value;
            const jobId = jobSelect.value;

            if (!resumeId) {
                showAlert('Please select a resume', 'danger');
                return;
            }

            if (!jobId) {
                showAlert('Please select a job description', 'danger');
                return;
            }

            // Show loading indicator
            showLoading('Calculating match...');

            fetch('/api/match', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    resume_id: resumeId,
                    job_id: jobId
                })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || 'Failed to calculate match');
                    });
                }
                return response.json();
            })
            .then(data => {
                hideLoading();
                displayMatchResults(data);
            })
            .catch(error => {
                hideLoading();
                console.error('Error:', error);
                showAlert('Error calculating match: ' + error.message, 'danger');
            });
        });
    }
}

// Load all resumes for dropdown
function loadResumes() {
    console.log('Loading resumes...');
    // Show loading indicator for initial load only (not refreshes)
    const initialLoad = !document.getElementById('select-resume').options.length > 1;
    if (initialLoad) {
        showLoading('Loading resumes...');
    }

    fetch('/api/resumes')
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Failed to load resumes');
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Resumes loaded:', data);
            const selectResume = document.getElementById('select-resume');
            if (!selectResume) return;

            // Clear current options
            selectResume.innerHTML = '<option value="">Select a resume...</option>';

            // Add options
            if (data.resumes && Array.isArray(data.resumes)) {
                data.resumes.forEach(resume => {
                    const option = document.createElement('option');
                    option.value = resume.id;
                    option.textContent = resume.name;
                    selectResume.appendChild(option);
                });
            }
            if (initialLoad) {
                hideLoading();
            }
        })
        .catch(error => {
            console.error('Error loading resumes:', error);
            if (initialLoad) {
                hideLoading();
            }
            showAlert('Error loading resumes: ' + error.message, 'danger');
        });
}

// Load all job descriptions for dropdown and table
function loadJobs() {
    console.log('Loading jobs...');
    // Show loading indicator for initial load only (not refreshes)
    const initialLoad = !document.getElementById('select-job').options.length > 1;
    if (initialLoad) {
        showLoading('Loading jobs...');
    }

    fetch('/api/jobs')
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Failed to load jobs');
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Jobs loaded:', data);
            // Populate dropdown
            const selectJob = document.getElementById('select-job');
            if (selectJob) {
                // Clear current options
                selectJob.innerHTML = '<option value="">Select a job...</option>';

                // Add options
                if (data.jobs && Array.isArray(data.jobs)) {
                    data.jobs.forEach(job => {
                        const option = document.createElement('option');
                        option.value = job.id;
                        option.textContent = job.title;
                        selectJob.appendChild(option);
                    });
                }
            }

            // Populate jobs table
            const jobsTable = document.getElementById('jobs-table-body');
            if (jobsTable) {
                jobsTable.innerHTML = '';

                if (data.jobs && Array.isArray(data.jobs)) {
                    if (data.jobs.length === 0) {
                        // Show a "no jobs" message if there are no jobs
                        const row = document.createElement('tr');
                        row.innerHTML = '<td colspan="3" class="text-center">No job descriptions found. Add one from the Upload section.</td>';
                        jobsTable.appendChild(row);
                    } else {
                        data.jobs.forEach(job => {
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td>${job.title}</td>
                                <td>${job.id}</td>
                                <td>
                                    <button class="btn btn-sm btn-info view-job" data-id="${job.id}" aria-label="View job details">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="btn btn-sm btn-danger delete-job" data-id="${job.id}" aria-label="Delete job">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            `;
                            jobsTable.appendChild(row);
                        });
                    }
                }

                // Add event listeners to buttons
                setupJobActions();
            }
            if (initialLoad) {
                hideLoading();
            }
        })
        .catch(error => {
            console.error('Error loading jobs:', error);
            if (initialLoad) {
                hideLoading();
            }
            showAlert('Error loading jobs: ' + error.message, 'danger');
        });
}

// Setup actions for job table buttons
function setupJobActions() {
    // View job details
    document.querySelectorAll('.view-job').forEach(button => {
        button.addEventListener('click', function() {
            const jobId = this.getAttribute('data-id');
            if (!jobId) {
                showAlert('Job ID not found', 'danger');
                return;
            }

            // Show loading indicator
            showLoading('Loading job details...');

            fetch(`/api/jobs/${jobId}`)
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(data => {
                            throw new Error(data.error || 'Failed to load job details');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    hideLoading();
                    if (data.job) {
                        // Show job details in a modal
                        showJobModal(data.job);
                    } else {
                        throw new Error('Invalid job data returned');
                    }
                })
                .catch(error => {
                    hideLoading();
                    console.error('Error loading job details:', error);
                    showAlert('Error loading job details: ' + error.message, 'danger');
                });
        });
    });

    // Delete job
    document.querySelectorAll('.delete-job').forEach(button => {
        button.addEventListener('click', function() {
            if (!confirm('Are you sure you want to delete this job description?')) {
                return;
            }

            const jobId = this.getAttribute('data-id');
            if (!jobId) {
                showAlert('Job ID not found', 'danger');
                return;
            }

            // Show loading indicator
            showLoading('Deleting job...');

            fetch(`/api/jobs/${jobId}`, {
                method: 'DELETE'
            })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(data => {
                            throw new Error(data.error || 'Failed to delete job');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    hideLoading();
                    showAlert('Job description deleted successfully', 'success');
                    // Refresh job list
                    loadJobs();
                })
                .catch(error => {
                    hideLoading();
                    console.error('Error deleting job:', error);
                    showAlert('Error deleting job description: ' + error.message, 'danger');
                });
        });
    });
}

// Display job modal with details
function showJobModal(job) {
    if (!job || !job.title || !job.description) {
        showAlert('Invalid job data', 'danger');
        return;
    }

    // Create modal if it doesn't exist
    let modal = document.getElementById('job-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'job-modal';
        modal.className = 'modal fade';
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('aria-labelledby', 'job-modal-title');
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title" id="job-modal-title">Job Details</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <h3 id="modal-job-title"></h3>
                        <div class="mt-3">
                            <h5>Job Description</h5>
                            <div id="modal-job-description" class="border p-3 rounded bg-light"></div>
                        </div>
                        <div class="mt-3">
                            <h5>Required Skills</h5>
                            <div id="modal-job-skills" class="skill-tags"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Update modal content
    const titleEl = document.getElementById('modal-job-title');
    const descEl = document.getElementById('modal-job-description');
    const skillsContainerEl = document.getElementById('modal-job-skills');

    if (titleEl) titleEl.textContent = job.title;
    if (descEl) descEl.textContent = job.description;

    // Display skills
    if (skillsContainerEl) {
        skillsContainerEl.innerHTML = '';

        if (job.skills && Array.isArray(job.skills)) {
            job.skills.forEach(skill => {
                const skillTag = document.createElement('span');
                skillTag.className = 'skill-tag';
                skillTag.textContent = skill;
                skillsContainerEl.appendChild(skillTag);
            });
        }
    }

    // Show modal
    try {
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    } catch (error) {
        console.error('Error showing modal:', error);
        showAlert('Error displaying job details', 'danger');
    }
}

// Display resume processing results
function displayResumeResults(data) {
    if (!data || !data.id || !data.name) {
        showAlert('Invalid resume data', 'danger');
        return;
    }

    const resultsDiv = document.getElementById('processing-results');
    const resultContent = document.getElementById('result-content');

    if (!resultsDiv || !resultContent) {
        console.error('Result elements not found');
        return;
    }

    // Create content
    let content = `
        <div class="alert alert-success mb-4">
            <i class="fas fa-check-circle me-2"></i> Resume processed successfully!
        </div>

        <div class="row">
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Resume Details</h5>
                    </div>
                    <div class="card-body">
                        <h5>${data.name}</h5>
                        <p><strong>ID:</strong> ${data.id}</p>
                        <p><strong>File Type:</strong> ${data.file_type || 'Unknown'}</p>
                    </div>
                </div>
            </div>

            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Extracted Skills</h5>
                    </div>
                    <div class="card-body">
                        <div class="skill-tags">
    `;

    // Add skill tags
    if (data.skills && Array.isArray(data.skills)) {
        data.skills.forEach(skill => {
            content += `<span class="skill-tag">${skill}</span>`;
        });
    } else {
        content += '<p>No skills found</p>';
    }

    content += `
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    resultContent.innerHTML = content;
    resultsDiv.style.display = 'block';
}

// Display job processing results
function displayJobResults(data) {
    if (!data || !data.id || !data.title) {
        showAlert('Invalid job data received', 'danger');
        return;
    }

    showAlert(`Job "${data.title}" processed and saved successfully with ID: ${data.id}`, 'success');
}

// Display match results
function displayMatchResults(data) {
    if (!data || typeof data.match_score !== 'number') {
        showAlert('Invalid match data received', 'danger');
        return;
    }

    const matchResults = document.getElementById('match-results');
    const matchPercentage = document.getElementById('match-percentage');
    const matchingSkills = document.getElementById('matching-skills');
    const missingSkills = document.getElementById('missing-skills');

    if (!matchResults || !matchPercentage || !matchingSkills || !missingSkills) {
        console.error('Match result elements not found');
        return;
    }

    // Update match score
    matchPercentage.textContent = `${Math.round(data.match_score * 100)}%`;

    // Update the progress circle background based on score
    const progressCircle = document.querySelector('.progress-circle');
    if (progressCircle) {
        const score = data.match_score * 100;

        // Set color based on score
        let color;
        if (score >= 80) {
            color = '#28a745'; // green
        } else if (score >= 60) {
            color = '#17a2b8'; // teal
        } else if (score >= 40) {
            color = '#ffc107'; // yellow
        } else {
            color = '#dc3545'; // red
        }

        // Create gradient for circle
        progressCircle.style.background = `conic-gradient(
            ${color} 0% ${score}%,
            #f3f3f3 ${score}% 100%
        )`;
    }

    // Show matching skills
    matchingSkills.innerHTML = '';
    if (data.matching_skills && Array.isArray(data.matching_skills)) {
        if (data.matching_skills.length === 0) {
            matchingSkills.innerHTML = '<p class="text-muted">No matching skills found</p>';
        } else {
            data.matching_skills.forEach(skill => {
                const skillTag = document.createElement('span');
                skillTag.className = 'skill-tag matching-skill';
                skillTag.textContent = skill;
                matchingSkills.appendChild(skillTag);
            });
        }
    }

    // Show missing skills
    missingSkills.innerHTML = '';
    if (data.missing_skills && Array.isArray(data.missing_skills)) {
        if (data.missing_skills.length === 0) {
            missingSkills.innerHTML = '<p class="text-muted">No missing skills</p>';
        } else {
            data.missing_skills.forEach(skill => {
                const skillTag = document.createElement('span');
                skillTag.className = 'skill-tag missing-skill';
                skillTag.textContent = skill;
                missingSkills.appendChild(skillTag);
            });
        }
    }

    // Show results
    matchResults.style.display = 'block';
}

// Show alert message
function showAlert(message, type) {
    if (!message) return;

    // Default to info if type not specified
    type = type || 'info';

    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.setAttribute('role', 'alert');

    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    // Add to page
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(alertDiv, container.firstChild);

        // Auto dismiss after 5 seconds
        setTimeout(() => {
            try {
                const bsAlert = bootstrap.Alert.getOrCreateInstance(alertDiv);
                bsAlert.close();
            } catch (error) {
                // Fallback if bootstrap is not available
                alertDiv.remove();
            }
        }, 5000);
    } else {
        console.error('Container not found for alert');
    }
}

// Show loading indicator
function showLoading(message) {
    // Check if loading indicator already exists
    let loadingElement = document.getElementById('loading-indicator');
    
    // Create if it doesn't exist
    if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.id = 'loading-indicator';
        loadingElement.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center';
        loadingElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        loadingElement.style.zIndex = '9999';

        loadingElement.innerHTML = `
            <div class="bg-white p-4 rounded shadow-lg text-center">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div id="loading-message" class="text-dark"></div>
            </div>
        `;

        document.body.appendChild(loadingElement);
    }

    // Set or update the loading message
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) {
        loadingMessage.textContent = message || 'Loading...';
    }

    // Show the loading indicator
    loadingElement.style.display = 'flex';
    
    // Add a safety timeout of 30 seconds in case the operation never completes
    // This prevents the loading indicator from being stuck indefinitely
    if (window._loadingTimeout) {
        clearTimeout(window._loadingTimeout);
    }
    
    window._loadingTimeout = setTimeout(() => {
        console.warn('Loading operation timed out after 30 seconds');
        hideLoading();
        showAlert('The operation is taking longer than expected. Please check your network connection or try again later.', 'warning');
    }, 30000); // 30 seconds timeout
}

// Hide loading indicator
function hideLoading() {
    // Clear any pending safety timeout
    if (window._loadingTimeout) {
        clearTimeout(window._loadingTimeout);
        window._loadingTimeout = null;
    }
    
    const loadingElement = document.getElementById('loading-indicator');
    if (loadingElement) {
        // Remove the element completely instead of just hiding it
        loadingElement.parentNode.removeChild(loadingElement);
    }
}