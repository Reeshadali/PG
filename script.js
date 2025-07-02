document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const loginContainer = document.getElementById('login-container');
    const mediaContainer = document.getElementById('media-container');
    const passwordInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');
    const errorMsg = document.getElementById('error-msg');
    const logoutBtn = document.getElementById('logout-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const downloadAllBtn = document.getElementById('download-all');
    const mediaGrid = document.getElementById('media-grid');
    const mediaTypeFilter = document.getElementById('media-type-filter');
    const uploadProgress = document.getElementById('upload-progress');
    const progressBar = document.querySelector('.progress');
    const progressText = document.querySelector('.progress-text');
    const storageInfo = document.createElement('div');
    storageInfo.className = 'storage-info';
    document.querySelector('header').appendChild(storageInfo);

    // App Configuration
    const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB
    const MAX_STORAGE_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5GB
    const DEFAULT_PASSWORD = '1318';
    const USERS_KEY = 'mediaAppUsers';
    const CURRENT_USER_KEY = 'currentMediaAppUser';

    // App State
    let currentUser = null;
    let users = {};

    // Initialize the app
    init();

    // Event Listeners
    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);
    downloadAllBtn.addEventListener('click', handleDownloadAll);
    mediaTypeFilter.addEventListener('change', renderMediaItems);
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    // Functions
    function init() {
        // Load users from localStorage
        const usersData = localStorage.getItem(USERS_KEY);
        users = usersData ? JSON.parse(usersData) : {};

        // If no users exist, create a default user
        if (Object.keys(users).length === 0) {
            users['default'] = {
                password: DEFAULT_PASSWORD,
                media: [],
                storageUsed: 0
            };
            saveUsers();
            alert(`Default username is "default" with password "${DEFAULT_PASSWORD}". You can create new users after login.`);
        }

        // Check if already authenticated
        currentUser = sessionStorage.getItem(CURRENT_USER_KEY);
        if (currentUser) {
            loginContainer.classList.add('hidden');
            mediaContainer.classList.remove('hidden');
            updateStorageInfo();
            renderMediaItems();
        } else {
            loginContainer.classList.remove('hidden');
            mediaContainer.classList.add('hidden');
        }
    }

    function handleLogin() {
        const username = prompt('Enter your username:') || 'default';
        const enteredPassword = passwordInput.value;

        if (users[username] && users[username].password === enteredPassword) {
            currentUser = username;
            sessionStorage.setItem(CURRENT_USER_KEY, currentUser);
            loginContainer.classList.add('hidden');
            mediaContainer.classList.remove('hidden');
            errorMsg.classList.add('hidden');
            passwordInput.value = '';
            updateStorageInfo();
            renderMediaItems();
        } else {
            errorMsg.classList.remove('hidden');
            passwordInput.value = '';
        }
    }

    function handleLogout() {
        sessionStorage.removeItem(CURRENT_USER_KEY);
        currentUser = null;
        loginContainer.classList.remove('hidden');
        mediaContainer.classList.add('hidden');
    }

    function handleFileUpload(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Check total size of selected files
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        if (totalSize > MAX_UPLOAD_SIZE) {
            alert(`Total upload size (${formatFileSize(totalSize)}) exceeds the maximum allowed (${formatFileSize(MAX_UPLOAD_SIZE)})`);
            return;
        }

        // Check available storage
        const availableStorage = MAX_STORAGE_SIZE - users[currentUser].storageUsed;
        if (totalSize > availableStorage) {
            alert(`Not enough storage available. You need ${formatFileSize(totalSize - availableStorage)} more space.`);
            return;
        }

        uploadProgress.classList.remove('hidden');
        let uploadCount = 0;
        let uploadErrors = 0;

        files.forEach((file, index) => {
            if (!file.type.match('image.*') && !file.type.match('video.*')) {
                alert(`File ${file.name} is not an image or video and was skipped.`);
                uploadErrors++;
                return;
            }

            if (file.size > MAX_UPLOAD_SIZE) {
                alert(`File ${file.name} (${formatFileSize(file.size)}) exceeds maximum file size of ${formatFileSize(MAX_UPLOAD_SIZE)}`);
                uploadErrors++;
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                const mediaItem = {
                    id: Date.now() + index,
                    name: file.name,
                    type: file.type.split('/')[0],
                    size: file.size,
                    formattedSize: formatFileSize(file.size),
                    data: e.target.result,
                    fileType: file.type,
                    uploadDate: new Date().toISOString()
                };

                users[currentUser].media.unshift(mediaItem);
                users[currentUser].storageUsed += file.size;
                uploadCount++;

                // Update progress
                const progress = Math.round(((uploadCount + uploadErrors) / files.length) * 100);
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `Uploading: ${progress}%`;

                if ((uploadCount + uploadErrors) === files.length) {
                    setTimeout(() => {
                        uploadProgress.classList.add('hidden');
                        progressBar.style.width = '0%';
                        progressText.textContent = 'Uploading: 0%';
                        saveUsers();
                        updateStorageInfo();
                        renderMediaItems();
                        fileInput.value = '';
                    }, 500);
                }
            };
            reader.readAsDataURL(file);
        });
    }

    function handleDownloadAll() {
        if (users[currentUser].media.length === 0) {
            alert('No media items to download.');
            return;
        }

        const zip = new JSZip();
        const folder = zip.folder(`${currentUser}_media`);

        users[currentUser].media.forEach(item => {
            const base64Data = item.data.split(',')[1];
            folder.file(item.name, base64Data, { base64: true });
        });

        zip.generateAsync({ type: "blob" }).then(content => {
            saveAs(content, `${currentUser}_media_files.zip`);
        });
    }

    function downloadMediaItem(item) {
        const link = document.createElement('a');
        link.href = item.data;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function deleteMediaItem(id) {
        if (confirm('Are you sure you want to delete this item?')) {
            const itemIndex = users[currentUser].media.findIndex(item => item.id === id);
            if (itemIndex !== -1) {
                users[currentUser].storageUsed -= users[currentUser].media[itemIndex].size;
                users[currentUser].media.splice(itemIndex, 1);
                saveUsers();
                updateStorageInfo();
                renderMediaItems();
            }
        }
    }

    function saveUsers() {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    function renderMediaItems() {
        const filter = mediaTypeFilter.value;
        let filteredItems = users[currentUser].media;

        if (filter !== 'all') {
            filteredItems = users[currentUser].media.filter(item => item.type === filter);
        }

        if (filteredItems.length === 0) {
            mediaGrid.innerHTML = '<div class="no-media">No media items found. Upload some files to get started.</div>';
            return;
        }

        mediaGrid.innerHTML = '';
        filteredItems.forEach(item => {
            const mediaElement = item.type === 'image' ? 
                `<img src="${item.data}" alt="${item.name}">` : 
                `<video controls><source src="${item.data}" type="${item.fileType}">Your browser does not support the video tag.</video>`;

            const mediaItem = document.createElement('div');
            mediaItem.className = 'media-item';
            mediaItem.innerHTML = `
                ${mediaElement}
                <div class="media-info">
                    <span>${item.name}</span>
                    <span class="file-size">${item.formattedSize} • ${new Date(item.uploadDate).toLocaleDateString()}</span>
                    <a href="#" class="download-btn" data-id="${item.id}">Download</a>
                </div>
                <button class="delete-btn" data-id="${item.id}">×</button>
            `;
            mediaGrid.appendChild(mediaItem);
        });

        document.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = parseInt(btn.getAttribute('data-id'));
                const item = users[currentUser].media.find(item => item.id === id);
                if (item) downloadMediaItem(item);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = parseInt(btn.getAttribute('data-id'));
                deleteMediaItem(id);
            });
        });
    }

    function updateStorageInfo() {
        const used = users[currentUser].storageUsed;
        const percentage = Math.round((used / MAX_STORAGE_SIZE) * 100);
        storageInfo.textContent = `Storage: ${formatFileSize(used)} / ${formatFileSize(MAX_STORAGE_SIZE)} (${percentage}%)`;
        storageInfo.style.color = percentage > 90 ? '#e74c3c' : percentage > 75 ? '#f39c12' : '#2ecc71';
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Add user management functions to the global scope for debugging
    window.manageUsers = {
        createUser: (username, password) => {
            if (users[username]) {
                return 'User already exists';
            }
            users[username] = {
                password: password,
                media: [],
                storageUsed: 0
            };
            saveUsers();
            return `User ${username} created`;
        },
        listUsers: () => Object.keys(users),
        deleteUser: (username) => {
            if (!users[username]) return 'User not found';
            delete users[username];
            saveUsers();
            return `User ${username} deleted`;
        }
    };
});