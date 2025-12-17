// client/assets/js/xxx.js (頂部 CONFIG 區塊)

/**
 * 專案配置 (配置後端 API 基礎網址)
 * 實作環境切換邏輯：
 * 1. 如果是本地開發 (通常是 localhost 或 127.0.0.1)，使用本地埠號 3000。
 * 2. 如果已部署到遠端 (Zeabur)，則使用當前網域 (location.origin) 作為基礎，
 * 並指向 API 服務的域名。
 * * 部署到 Zeabur 後，您需要將此處的 production URL 替換為您的 API 服務的實際域名。
 */
const CONFIG = (() => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // 請在部署後，將此處的佔位符替換為您的 Zeabur API 服務的域名！
    const ZEABUR_API_DOMAIN = 'https://[您的 Zeabur API 服務域名].zeabur.app'; 

    return {
        // 如果是本地，使用本地的 3000 埠
        API_BASE_URL: isLocal ? 'http://localhost:3000' : ZEABUR_API_DOMAIN,
        API_PATH: '/api',
    };
})(); 

// console.log(`API Base URL is set to: ${CONFIG.API_BASE_URL}`); // 可用於調試

// ------------------------------------------------------------------
// 核心狀態管理與認證
// ------------------------------------------------------------------

/**
 * 檢查使用者是否已登入 (檢查 LocalStorage 中是否有 JWT)
 * @returns {string | null} JWT Token
 */
function getAuthToken() {
    return localStorage.getItem('jwtToken');
}

/**
 * 載入應用程式狀態：檢查是否有 Token，決定顯示登入介面或功能區。
 */
function loadAppState() {
    const token = getAuthToken();
    const user = JSON.parse(localStorage.getItem('user'));
    
    const loginSection = document.getElementById('login-section');
    const mainAppSection = document.getElementById('main-app-section');
    const userDisplay = document.getElementById('user-display');
    const casesLink = document.getElementById('show-cases-link');
    const formLink = document.getElementById('show-form-link');

    if (token && user) {
        // 已登入：顯示功能區
        loginSection.classList.add('d-none');
        mainAppSection.classList.remove('d-none');
        userDisplay.textContent = `歡迎回來, ${user.name} (${user.role})`;
        
        // 預設載入案件列表 (或您可以選擇載入表單)
        showCases();

    } else {
        // 未登入：顯示登入區
        loginSection.classList.remove('d-none');
        mainAppSection.classList.add('d-none');
        // 清理所有活動狀態
        casesLink?.classList.remove('active');
        formLink?.classList.remove('active');
    }
}

/**
 * 處理登入表單提交
 */
async function handleLogin(event) {
    event.preventDefault(); // 阻止表單的預設提交行為

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // 登入成功：儲存 Token 和使用者資訊
            localStorage.setItem('jwtToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            await Swal.fire({ 
                icon: 'success', 
                title: '登入成功', 
                text: `歡迎 ${data.user.name}！`,
                timer: 1500,
                showConfirmButton: false
            });
            loadAppState(); // 更新介面狀態
        } else {
            // 登入失敗：顯示錯誤訊息
            Swal.fire({ icon: 'error', title: '登入失敗', text: data.message || '請檢查您的帳號和密碼。' });
        }
    } catch (error) {
        console.error('Login error:', error);
        Swal.fire({ icon: 'error', title: '連線錯誤', text: '無法連線到後端服務。' });
    }
}

/**
 * 登出功能
 */
function handleLogout() {
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('user');
    loadAppState(); // 重新載入狀態，回到登入頁
    Swal.fire({ icon: 'info', title: '您已登出', showConfirmButton: false, timer: 1000 });
}


// ------------------------------------------------------------------
// 功能區塊切換與業務邏輯
// ------------------------------------------------------------------

/**
 * 隱藏所有內容區塊，僅顯示接案單表單
 */
function showNewCaseForm() {
    // 隱藏列表區，顯示表單區
    document.getElementById('content-display').classList.add('d-none'); 
    document.getElementById('new-case-form-section').classList.remove('d-none');
    
    // 清空列表內容，並更新選單 active 狀態
    document.getElementById('show-cases-link').classList.remove('active');
    document.getElementById('show-form-link').classList.add('active');
    
    // 可選：預填負責人員為當前登入者
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.name) {
        document.getElementById('服務人員').value = user.name;
    }
}

/**
 * 示範存取受保護的 API (接案通報列表)
 */
async function showCases() {
    const token = getAuthToken();
    if (!token) {
        Swal.fire({ icon: 'warning', title: '權限不足', text: '請先登入。' });
        loadAppState();
        return;
    }

    // 隱藏表單區，顯示列表區
    document.getElementById('new-case-form-section').classList.add('d-none');
    document.getElementById('content-display').classList.remove('d-none');

    // 更新選單 active 狀態
    document.getElementById('show-form-link').classList.remove('active');
    document.getElementById('show-cases-link').classList.add('active');
    
    const contentDisplay = document.getElementById('content-display');
    contentDisplay.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div><p>載入案件中...</p></div>';

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/cases`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // 攜帶 JWT Token
                'Authorization': `Bearer ${token}` 
            }
        });

        const data = await response.json();

        if (response.ok) {
            // 成功取得資料
            let html = `<h3 class="mb-4">📜 案件列表 (${data.cases.length} 筆紀錄)</h3>`;
            html += `<table class="table table-striped table-hover"><thead><tr><th>案件ID</th><th>通報日期</th><th>通報人</th><th>服務人員</th><th>案件狀態</th></tr></thead><tbody>`;
            data.cases.forEach(c => {
                // 案件 ID 可以做成連結，未來點擊可導向詳細頁面
                html += `<tr><td><a href="#">${c.case_id}</a></td><td>${c.通報日期}</td><td>${c.通報人}</td><td>${c.服務人員}</td><td><span class="badge bg-primary">${c.案件狀態}</span></td></tr>`;
            });
            html += `</tbody></table>`;
            contentDisplay.innerHTML = html;
        } else {
            // Token 可能過期或無效
            contentDisplay.innerHTML = `<p class="text-danger">載入失敗: ${data.message || '無法取得案件資料。'}</p>`;
            if (response.status === 401 || response.status === 403) {
                 Swal.fire({ icon: 'error', title: '權限驗證失敗', text: '您的登入狀態已失效，請重新登入。' });
                 handleLogout();
            }
        }

    } catch (error) {
        console.error('Fetch cases error:', error);
        contentDisplay.innerHTML = `<p class="text-danger">連線錯誤：無法存取後端 API。</p>`;
    }
}


/**
 * 處理接案單提交的函式
 */
async function handleNewCaseSubmit(event) {
    event.preventDefault();

    const token = getAuthToken();
    if (!token) {
        Swal.fire({ icon: 'warning', title: '請重新登入', text: '登入狀態已失效。' });
        handleLogout();
        return;
    }
    
    const 通報人 = document.getElementById('通報人').value.trim();
    const 服務人員 = document.getElementById('服務人員').value.trim();
    
    if (!通報人 || !服務人員) {
         Swal.fire({ icon: 'warning', title: '資訊不完整', text: '請填寫所有必填欄位。' });
         return;
    }

    // 禁用按鈕，防止重複提交
    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';


    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/cases/add`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ 通報人, 服務人員 })
        });

        const data = await response.json();

        if (response.ok) {
            await Swal.fire({ 
                icon: 'success', 
                title: '接案通報成功!', 
                html: `案件 ID: <strong>${data.case_id}</strong>`,
                confirmButtonText: '查看案件列表'
            });
            // 提交成功後，清空表單，並跳轉到案件列表
            document.getElementById('new-case-form').reset(); 
            showCases(); // 重新載入列表
        } else {
            Swal.fire({ icon: 'error', title: '提交失敗', text: data.message || '無法新增案件紀錄。' });
        }

    } catch (error) {
        console.error('New case submission error:', error);
        Swal.fire({ icon: 'error', title: '連線錯誤', text: '無法連線到後端服務，請檢查伺服器是否運行。' });
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '提交接案通報';
    }
}


// ------------------------------------------------------------------
// 應用程式初始化
// ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // 檢查初始登入狀態
    loadAppState(); 
    
    // 綁定登入表單的提交事件
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // 綁定登出按鈕事件
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
    
    // 綁定接案單表單提交事件
    const newCaseForm = document.getElementById('new-case-form');
    if (newCaseForm) {
        newCaseForm.addEventListener('submit', handleNewCaseSubmit);
    }

    // 將核心功能函數暴露到全域，以便 HTML 中的 onclick 使用
    window.showCases = showCases;
    window.showNewCaseForm = showNewCaseForm;
});