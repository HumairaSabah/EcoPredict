document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('preview-container');
    const imagePreview = document.getElementById('image-preview');
    const btnClear = document.getElementById('btn-clear');
    const btnPredict = document.getElementById('btn-predict');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    // Camera elements
    const btnOpenCamera = document.getElementById('btn-open-camera');
    const cameraContainer = document.getElementById('camera-container');
    const cameraFeed = document.getElementById('camera-feed');
    const btnCapture = document.getElementById('btn-capture');
    const btnCloseCamera = document.getElementById('btn-close-camera');
    const cameraCanvas = document.getElementById('camera-canvas');
    let videoStream = null;
    
    const topPredictionLabel = document.querySelector('#top-prediction .label');
    const explanationSection = document.getElementById('explanation-section');
    const explanationList = document.getElementById('explanation-list');
    
    // Steps
    const stepsSection = document.getElementById('steps-section');
    const stepsList = document.getElementById('steps-list');

    // Screens and Flow Buttons
    const screenWelcome = document.getElementById('screen-welcome');
    const screenApp = document.getElementById('screen-app');
    const screenChallenge = document.getElementById('screen-challenge');
    
    const btnStart = document.getElementById('btn-start');
    const btnViewChallenge = document.getElementById('btn-view-challenge');
    const btnRestart = document.getElementById('btn-restart');
    const btnBackHome = document.getElementById('btn-back-home');
    
    const challengeClassTitle = document.getElementById('challenge-class-title');
    const challengeText = document.getElementById('challenge-text');
    const factText = document.getElementById('fact-text');

    let currentFile = null;
    let cachedChallengeData = null;

    // --- Screen Logic ---
    function showScreen(screenEl) {
        document.querySelectorAll('.screen').forEach(el => el.style.display = 'none');
        screenEl.style.display = 'block';
    }

    btnStart.addEventListener('click', () => showScreen(screenApp));
    btnBackHome.addEventListener('click', () => showScreen(screenWelcome));
    
    btnViewChallenge.addEventListener('click', () => {
        if (!cachedChallengeData) return;
        challengeClassTitle.textContent = cachedChallengeData.label;
        challengeText.textContent = cachedChallengeData.challenge;
        factText.textContent = cachedChallengeData.fact;
        showScreen(screenChallenge);
    });

    btnRestart.addEventListener('click', () => {
        btnClear.click();
        showScreen(screenApp);
    });

    // Handle Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('active'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('active'), false);
    });

    dropZone.addEventListener('drop', handleDrop, false);
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            handleFile(this.files[0]);
        }
    });

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        if (file && file.type.startsWith('image/')) {
            handleFile(file);
        } else {
            alert('Please upload an image file.');
        }
    }

    function handleFile(file) {
        currentFile = file;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = function() {
            imagePreview.src = reader.result;
            dropZone.style.display = 'none';
            previewContainer.classList.add('active');
            btnPredict.disabled = false;
            resetResults();
        }
    }

    btnClear.addEventListener('click', () => {
        currentFile = null;
        fileInput.value = '';
        dropZone.style.display = 'flex';
        previewContainer.classList.remove('active');
        btnPredict.disabled = true;
        resetResults();
    });

    function resetResults() {
        topPredictionLabel.textContent = 'Awaiting Image...';
        topPredictionLabel.style.color = 'var(--text-main)';
        explanationSection.style.display = 'none';
        explanationList.innerHTML = '';
        stepsSection.style.display = 'none';
        stepsList.innerHTML = '';
        btnViewChallenge.style.display = 'none';
        cachedChallengeData = null;
    }

    // Camera Logic
    btnOpenCamera.addEventListener('click', async (e) => {
        e.stopPropagation(); // prevent file input click
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            cameraFeed.srcObject = videoStream;
            dropZone.style.display = 'none';
            cameraContainer.style.display = 'block';
        } catch (err) {
            alert('Could not access the camera. Please ensure permissions are granted.');
            console.error(err);
        }
    });

    btnCloseCamera.addEventListener('click', () => {
        stopCamera();
        cameraContainer.style.display = 'none';
        dropZone.style.display = 'flex';
    });

    btnCapture.addEventListener('click', () => {
        cameraCanvas.width = cameraFeed.videoWidth;
        cameraCanvas.height = cameraFeed.videoHeight;
        const ctx = cameraCanvas.getContext('2d');
        ctx.drawImage(cameraFeed, 0, 0, cameraCanvas.width, cameraCanvas.height);
        
        cameraCanvas.toBlob((blob) => {
            const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
            stopCamera();
            cameraContainer.style.display = 'none';
            handleFile(file);
        }, 'image/jpeg');
    });

    function stopCamera() {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
        }
    }

    btnPredict.addEventListener('click', async () => {
        if (!currentFile) return;

        const formData = new FormData();
        formData.append('file', currentFile);

        loadingOverlay.classList.add('active');
        btnPredict.disabled = true;

        try {
            const response = await fetch('/predict', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                displayResults(data);
            } else {
                alert('Error: ' + data.error);
                btnPredict.disabled = false;
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during prediction.');
            btnPredict.disabled = false;
        } finally {
            loadingOverlay.classList.remove('active');
        }
    });

    function displayResults(data) {
        // Update top prediction
        topPredictionLabel.textContent = data.prediction;
        topPredictionLabel.style.color = 'var(--success)';

        // Clear previous explanations
        explanationList.innerHTML = '';
        explanationSection.style.display = 'block';

        // Add explanation
        data.explanation.forEach(text => {
            const li = document.createElement('li');
            li.innerHTML = text; // allow HTML like &rarr;
            explanationList.appendChild(li);
        });
        
        // Add Next Steps
        stepsList.innerHTML = '';
        stepsSection.style.display = 'block';
        data.next_steps.forEach(text => {
            const li = document.createElement('li');
            li.innerHTML = text; 
            stepsList.appendChild(li);
        });
        
        // Cache challenge data and show button
        cachedChallengeData = {
            label: data.prediction,
            challenge: data.challenge,
            fact: data.fact
        };
        btnViewChallenge.style.display = 'block';
    }
});
