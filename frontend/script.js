// Configuration
const API_BASE_URL = '/api'; // Use relative path for API requests

// Global state
let employees = [];
let currentTab = 'employees';
let authToken = null;
let currentUser = null;

// DOM Elements
const loadingOverlay = document.getElementById('loadingOverlay');
const messageContainer = document.getElementById('messageContainer');
const employeesGrid = document.getElementById('employeesGrid');
const qrCodesGrid = document.getElementById('qrCodesGrid');
const searchInput = document.getElementById('searchInput');
const addEmployeeForm = document.getElementById('addEmployeeForm');
const editEmployeeForm = document.getElementById('editEmployeeForm');
const editModal = document.getElementById('editModal');

// Auth-related DOM Elements
const loginView = document.getElementById('loginView');
const mainContent = document.querySelector('.main');
const nav = document.querySelector('.nav');
const authContainer = document.getElementById('authContainer');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const usernameDisplay = document.getElementById('usernameDisplay');
const loginForm = document.getElementById('loginForm');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Initialize app
function initializeApp() {
    setupEventListeners();
    checkLoginState();
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    // Forms
    addEmployeeForm.addEventListener('submit', handleAddEmployee);
    editEmployeeForm.addEventListener('submit', handleEditEmployee);
    loginForm.addEventListener('submit', handleLogin);

    // Auth
    loginBtn.addEventListener('click', () => switchView('login'));
    logoutBtn.addEventListener('click', logout);


    // Modal
    editModal.addEventListener('click', function(e) {
        if (e.target === editModal) {
            closeEditModal();
        }
    });
}

// Check if user is already logged in from localStorage
function checkLoginState() {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');

    if (token && user) {
        authToken = token;
        currentUser = JSON.parse(user);
        updateUIAfterLogin();
    } else {
        switchView('login');
    }
}

// Handle Login
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        showLoading();
        const data = await apiRequest('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        authToken = data.token;
        currentUser = data.user;

        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        updateUIAfterLogin();

    } catch (error) {
        showMessage(`Login failed: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// Handle Logout
function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    switchView('login');
}

// Update UI based on auth state
function updateUIAfterLogin() {
    usernameDisplay.textContent = currentUser.username;
    switchView('app');
    loadEmployees();
    setupSearch(); // Initialize search after login
}


// Switch between login view and main app view
function switchView(viewName) {
    if (viewName === 'login') {
        loginView.style.display = 'flex';
        mainContent.style.display = 'none';
        nav.style.display = 'none';
        authContainer.style.display = 'none';
    } else {
        loginView.style.display = 'none';
        mainContent.style.display = 'block';
        nav.style.display = 'flex';
        authContainer.style.display = 'flex';
        loginBtn.style.display = 'none';
        userInfo.style.display = 'flex';
    }
}

// Tab switching
function switchTab(tabName) {
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    currentTab = tabName;

    // Load content based on tab
    if (tabName === 'employees') {
        loadEmployees();
    } else if (tabName === 'qr-codes') {
        loadQRCodes();
    } else if (tabName === 'dashboard') {
        loadDashboardData();
    }
}

// Show loading overlay
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// Show message
function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    messageContainer.appendChild(messageDiv);
    
    // Remove message after 5 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// API Helper function
async function apiRequest(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers,
            ...options
        });

        if (response.status === 401 || response.status === 403) {
            // Auto-logout on auth error
            logout();
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        // Handle responses with no content
        if (response.status === 204) {
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Load employees
async function loadEmployees() {
    try {
        showLoading();
        const data = await apiRequest('/employees');
        employees = data.employees || [];
        renderEmployees(employees);
    } catch (error) {
        showMessage('Failed to load employees', 'error');
        renderEmployees([]);
    } finally {
        hideLoading();
    }
}

// Render employees
function renderEmployees(employeeList) {
    if (employeeList.length === 0) {
        employeesGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>No employees found</h3>
                <p>Add your first employee to get started</p>
                <button class="btn btn-primary" onclick="switchTab('add-employee')">
                    <i class="fas fa-plus"></i> Add Employee
                </button>
            </div>
        `;
        return;
    }

    employeesGrid.innerHTML = employeeList.map(employee => `
        <div class="employee-card">
            <div class="employee-header">
                <div class="employee-avatar">
                    ${getInitials(employee.name)}
                </div>
                <div class="employee-info">
                    <h3>${employee.name}</h3>
                    <p>${employee.email}</p>
                </div>
            </div>
            
            <div class="employee-details">
                <div class="employee-detail">
                    <i class="fas fa-building"></i>
                    <span>${employee.department}</span>
                </div>
                <div class="employee-detail">
                    <i class="fas fa-calendar"></i>
                    <span>Joined ${formatDate(employee.created_at)}</span>
                </div>
                <div class="employee-detail">
                    <i class="fas fa-circle"></i>
                    <span class="status-badge ${employee.status}">${employee.status}</span>
                </div>
            </div>
            
            <div class="employee-actions">
                <button class="btn btn-secondary" onclick="viewQRCode(${employee.id})">
                    <i class="fas fa-qrcode"></i> QR Code
                </button>
                <button class="btn btn-primary" onclick="editEmployee(${employee.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger" onclick="deleteEmployee(${employee.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

// Get initials from name
function getInitials(name) {
    if (!name) return '';
    return name.split(' ').map(word => word.charAt(0).toUpperCase()).join('');
}

// Format date
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

// Setup search functionality
function setupSearch() {
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filteredEmployees = employees.filter(employee => 
            employee.name.toLowerCase().includes(searchTerm) ||
            employee.email.toLowerCase().includes(searchTerm) ||
            employee.department.toLowerCase().includes(searchTerm)
        );
        renderEmployees(filteredEmployees);
    });
}

// Handle add employee form submission
async function handleAddEmployee(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('employeeName').value,
        email: document.getElementById('employeeEmail').value,
        department: document.getElementById('employeeDepartment').value
    };

    try {
        showLoading();
        await apiRequest('/employees', {
            method: 'POST',
            body: JSON.stringify(formData)
        });
        
        showMessage('Employee added successfully!');
        addEmployeeForm.reset();
        loadEmployees();
        switchTab('employees');
    } catch (error) {
        showMessage(`Failed to add employee: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// Edit employee
async function editEmployee(id) {
    const employee = employees.find(emp => emp.id === id);
    if (!employee) return;

    // Populate form
    document.getElementById('editEmployeeId').value = employee.id;
    document.getElementById('editEmployeeName').value = employee.name;
    document.getElementById('editEmployeeEmail').value = employee.email;
    document.getElementById('editEmployeeDepartment').value = employee.department;
    
    // Show modal
    editModal.style.display = 'flex';
}

// Handle edit employee form submission
async function handleEditEmployee(e) {
    e.preventDefault();
    
    const employeeId = document.getElementById('editEmployeeId').value;
    const formData = {
        name: document.getElementById('editEmployeeName').value,
        email: document.getElementById('editEmployeeEmail').value,
        department: document.getElementById('editEmployeeDepartment').value,
        status: 'active' // Or get from form if you have a status field
    };

    try {
        showLoading();
        await apiRequest(`/employees/${employeeId}`, {
            method: 'PUT',
            body: JSON.stringify(formData)
        });
        
        showMessage('Employee updated successfully!');
        closeEditModal();
        loadEmployees();
    } catch (error) {
        showMessage(`Failed to update employee: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// Close edit modal
function closeEditModal() {
    editModal.style.display = 'none';
}

// Delete employee
async function deleteEmployee(id) {
    if (!confirm('Are you sure you want to delete this employee? This is a soft delete.')) {
        return;
    }
    
    try {
        showLoading();
        await apiRequest(`/employees/${id}`, { method: 'DELETE' });
        showMessage('Employee deleted successfully.');
        loadEmployees();
    } catch (error) {
        showMessage('Failed to delete employee.', 'error');
    } finally {
        hideLoading();
    }
}

// View QR code (now just switches tab)
async function viewQRCode(id) {
    switchTab('qr-codes');
}

// Load QR Codes
async function loadQRCodes() {
    try {
        showLoading();
        // We can reuse the employees list if already loaded
        if (employees.length === 0) {
            const data = await apiRequest('/employees');
            employees = data.employees || [];
        }
        await renderQRCodes(employees);
    } catch (error) {
        showMessage('Failed to load QR codes', 'error');
    } finally {
        hideLoading();
    }
}

// Render QR Codes
async function renderQRCodes(employeeList) {
    if (employeeList.length === 0) {
        qrCodesGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-qrcode"></i>
                <h3>No QR Codes Found</h3>
                <p>Add an employee to generate their QR code.</p>
            </div>
        `;
        return;
    }

    const qrCodePromises = employeeList.map(async (employee) => {
        try {
            const tokenData = await apiRequest(`/employees/${employee.id}/qr-token`);
            const qrUrl = `${API_BASE_URL}/qr?token=${tokenData.qr_token}`;

            return `
                <div class="qr-code-card">
                    <h3>${employee.name}</h3>
                    <p>${employee.department}</p>
                    <iframe src="${qrUrl}" width="250" height="300" frameborder="0"></iframe>
                    <div class="qr-actions">
                        <button class="btn btn-primary" onclick="window.open('${qrUrl}', '_blank')">
                            <i class="fas fa-external-link-alt"></i> View Full Size
                        </button>
                    </div>
                </div>
            `;
        } catch (error) {
            return `
                <div class="qr-code-card">
                    <h3>${employee.name}</h3>
                    <p>${employee.department}</p>
                    <div class="error-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Failed to load QR code</p>
                    </div>
                </div>
            `;
        }
    });

    try {
        const qrCodeHtml = await Promise.all(qrCodePromises);
        qrCodesGrid.innerHTML = qrCodeHtml.join('');
    } catch (error) {
        qrCodesGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error loading QR codes</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

// --- Dashboard Functions ---

// Load dashboard data
async function loadDashboardData() {
    try {
        showLoading();
        const data = await apiRequest('/attendance');
        renderDashboard(data.attendance || []);
    } catch (error) {
        showMessage('Failed to load dashboard data', 'error');
        renderDashboard([]);
    } finally {
        hideLoading();
    }
}

// Render dashboard
function renderDashboard(attendanceList) {
    const dashboardContent = document.getElementById('dashboardContent');

    if (!dashboardContent) {
        console.error('Dashboard content element not found!');
        return;
    }

    if (attendanceList.length === 0) {
        dashboardContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <h3>No Attendance Records</h3>
                <p>No check-in or check-out events have been recorded yet.</p>
            </div>
        `;
        return;
    }

    // --- Summary Stats ---
    const checkedInCount = attendanceList.filter(a => a.status === 'checked-in').length;
    const today = new Date().toISOString().slice(0, 10);
    const checkInsToday = attendanceList.filter(a => a.check_in_time.startsWith(today)).length;

    const summaryHtml = `
        <div class="dashboard-summary">
            <div class="summary-card">
                <h4><i class="fas fa-sign-in-alt"></i> Currently Checked-In</h4>
                <p>${checkedInCount}</p>
            </div>
            <div class="summary-card">
                <h4><i class="fas fa-calendar-day"></i> Check-ins Today</h4>
                <p>${checkInsToday}</p>
            </div>
            <div class="summary-card">
                <h4><i class="fas fa-history"></i> Total Records</h4>
                <p>${attendanceList.length}</p>
            </div>
        </div>
    `;

    // --- Attendance Table ---
    const tableHtml = `
        <div class="table-container">
            <table class="attendance-table">
                <thead>
                    <tr>
                        <th>Employee</th>
                        <th>Status</th>
                        <th>Check-in Time</th>
                        <th>Check-out Time</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${attendanceList.map(record => `
                        <tr>
                            <td>
                                <div class="employee-cell">
                                    <div class="employee-avatar">${getInitials(record.employee_name)}</div>
                                    <div>
                                        <strong>${record.employee_name}</strong>
                                        <small>${record.employee_email}</small>
                                    </div>
                                </div>
                            </td>
                            <td><span class="status-badge ${record.status}">${record.status}</span></td>
                            <td>${formatDateTime(record.check_in_time)}</td>
                            <td>${record.check_out_time ? formatDateTime(record.check_out_time) : 'N/A'}</td>
                            <td>${record.notes || ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    dashboardContent.innerHTML = summaryHtml + tableHtml;
}

// Format Date and Time
function formatDateTime(dateTimeString) {
    if (!dateTimeString) return 'N/A';
    const options = {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    };
    return new Date(dateTimeString).toLocaleString(undefined, options);
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Escape key to close modal
    if (e.key === 'Escape') {
        closeEditModal();
    }
    
    // Ctrl/Cmd + N to add new employee
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        switchTab('add-employee');
    }
});

// Handle window resize for responsive design
window.addEventListener('resize', function() {
    // Adjust grid layouts if needed
    if (window.innerWidth < 768) {
        // Mobile adjustments
    }
});

// Export functions for global access
window.loadEmployees = loadEmployees;
window.loadQRCodes = loadQRCodes;
window.editEmployee = editEmployee;
window.deleteEmployee = deleteEmployee;
window.viewQRCode = viewQRCode;
window.closeEditModal = closeEditModal; 