// client/assets/js/app.js

// ------------------------------------------------------------------
// 1. 自動環境偵測配置
// ------------------------------------------------------------------
const CONFIG = (() => {
    // 偵測是否為本地環境
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // 【重要】部署後請修改此處為您的 Zeabur API 網域
    const ZEABUR_API_DOMAIN = 'https://funeralwebapp-backend.zeabur.app'; 

    return {
        API_BASE_URL: isLocal ? 'http://localhost:3000' : ZEABUR_API_DOMAIN,
        API_PATH: '/api',
    };
})();

// ------------------------------------------------------------------
// 2. 核心狀態管理與認證
// ------------------------------------------------------------------

function getAuthToken() {
    return localStorage.getItem('jwtToken');
}

/**
 * 載入應用程式狀態 (判斷顯示登入視窗或主畫面)
 */
function loadAppState() {
    const token = getAuthToken();
    const loginSection = document.getElementById('login-section');
    const mainSection = document.getElementById('main-section');
    const userDisplay = document.getElementById('user-display');
    const logoutButton = document.getElementById('logout-button');

    if (token) {
        // 已登入
        loginSection.classList.add('d-none');
        mainSection.classList.remove('d-none');
        logoutButton.classList.remove('d-none');
        
        const user = JSON.parse(localStorage.getItem('user'));
        if (user) {
            userDisplay.textContent = `你好，${user.name} (${user.role})`;
        }
        showCases(); // 預設顯示案件列表
    } else {
        // 未登入
        loginSection.classList.remove('d-none');
        mainSection.classList.add('d-none');
        logoutButton.classList.add('d-none');
        userDisplay.textContent = '';
    }
}

/**
 * 處理登入提交
 */
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('jwtToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            Swal.fire({ icon: 'success', title: '登入成功', timer: 1500, showConfirmButton: false });
            setTimeout(() => { loadAppState(); }, 1500);
        } else {
            Swal.fire({ icon: 'error', title: '登入失敗', text: data.message || '帳號或密碼錯誤' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        Swal.fire({ icon: 'error', title: '連線失敗', text: '請確認後端伺服器是否已啟動。' });
    }
}

/**
 * 處理登出
 */
function handleLogout() {
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('user');
    location.reload();
}

// ------------------------------------------------------------------
// 3. 案件管理模組
// ------------------------------------------------------------------

/**
 * 顯示案件列表
 */
async function showCases() {
    const token = getAuthToken();
    const contentDisplay = document.getElementById('content-display');
    const formSection = document.getElementById('new-case-form-section');

    // 切換 UI 顯示
    formSection.classList.add('d-none');
    contentDisplay.classList.remove('d-none');
    document.getElementById('show-cases-link').classList.add('active');
    document.getElementById('show-form-link').classList.remove('active');

    contentDisplay.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary" role="status"></div><p>案件載入中...</p></div>';

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/cases`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (response.ok) {
            let html = `<h4 class="mb-3">📋 案件列表 (${data.cases.length} 筆)</h4>`;
            html += `<div class="table-responsive"><table class="table table-hover align-middle">
                <thead class="table-light">
                    <tr><th>案件ID</th><th>通報日期</th><th>通報人</th><th>服務人員</th><th>狀態</th></tr>
                </thead>
                <tbody>`;
            data.cases.forEach(c => {
                html += `<tr>
                    <td class="fw-bold">${c.case_id}</td>
                    <td>${c.通報日期}</td>
                    <td>${c.通報人}</td>
                    <td>${c.服務人員}</td>
                    <td><span class="badge bg-primary">${c.案件狀態}</span></td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
            contentDisplay.innerHTML = html;
        } else {
            contentDisplay.innerHTML = `<div class="alert alert-danger">載入失敗：${data.message}</div>`;
        }
    } catch (error) {
        contentDisplay.innerHTML = `<div class="alert alert-danger">無法連線至 API。</div>`;
    }
}

/**
 * 顯示新增案件表單
 */
function showNewCaseForm() {
    document.getElementById('content-display').classList.add('d-none');
    document.getElementById('new-case-form-section').classList.remove('d-none');
    document.getElementById('show-cases-link').classList.remove('active');
    document.getElementById('show-form-link').classList.add('active');
}

/**
 * 處理案件提交
 */
async function handleNewCaseSubmit(e) {
    e.preventDefault();
    const informer = document.getElementById('informer').value.trim();
    const staff = document.getElementById('staff').value.trim();

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/cases`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({ informer, staff })
        });

        const data = await response.json();
        if (response.ok) {
            Swal.fire('成功', `新案件已建立: ${data.case_id}`, 'success');
            document.getElementById('new-case-form').reset();
            showCases();
        } else {
            Swal.fire('錯誤', data.message, 'error');
        }
    } catch (error) {
        Swal.fire('錯誤', '連線異常，請檢查網路。', 'error');
    }
}

// ------------------------------------------------------------------
// 4. 初始化
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadAppState();

    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    const newCaseForm = document.getElementById('new-case-form');
    if (newCaseForm) newCaseForm.addEventListener('submit', handleNewCaseSubmit);
});