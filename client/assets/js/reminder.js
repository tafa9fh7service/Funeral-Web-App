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
    const ZEABUR_API_DOMAIN = 'https://funeralwebapp-backend.zeabur.app'; 

    return {
        // 如果是本地，使用本地的 3000 埠
        API_BASE_URL: isLocal ? 'http://localhost:3000' : ZEABUR_API_DOMAIN,
        API_PATH: '/api',
    };
})(); 

// console.log(`API Base URL is set to: ${CONFIG.API_BASE_URL}`); // 可用於調試

// ------------------------------------------------------------------
// 核心輔助函式
// ------------------------------------------------------------------

function getAuthToken() {
    return localStorage.getItem('jwtToken');
}

function getUserInfo() {
    return JSON.parse(localStorage.getItem('user'));
}

/**
 * 檢查登入狀態並更新用戶資訊顯示
 */
function checkAuthAndDisplayUser() {
    if (!getAuthToken()) {
        Swal.fire({ icon: 'error', title: '未經授權', text: '請先登入系統。', timer: 2000 });
        setTimeout(() => { window.location.href = 'index.html'; }, 2000);
        return false;
    }
    const user = getUserInfo();
    document.getElementById('user-info').textContent = `登入者: ${user.name} (${user.staff_id})`;
    return true;
}

/**
 * 比較日期與今天，判斷是否過期或即將到期
 * @param {string} dateString YYYY-MM-DD
 * @returns {string} CSS class name
 */
function getDueStatus(dateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reminderDate = new Date(dateString);
    reminderDate.setHours(0, 0, 0, 0);
    
    // 提醒日與今天的時間差（毫秒）
    const diffTime = reminderDate.getTime() - today.getTime();
    // 提醒日與今天的天數差
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return 'is-due border-danger'; // 已經過期
    } else if (diffDays <= 7) {
        return 'is-upcoming border-warning'; // 七天內即將到期
    }
    return ''; // 正常
}

// ------------------------------------------------------------------
// 1. 提醒列表 (讀取)
// ------------------------------------------------------------------

/**
 * 從後端 API 載入提醒列表並顯示
 */
async function loadReminders() {
    if (!checkAuthAndDisplayUser()) return;

    const container = document.getElementById('reminders-container');
    container.innerHTML = '<li class="list-group-item text-center text-muted"><div class="spinner-border spinner-border-sm me-2" role="status"></div>正在載入提醒...</li>';

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/reminder`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}` 
            },
        });

        const data = await response.json();

        if (response.ok) {
            renderReminderList(data.data);
        } else {
            Swal.fire({ icon: 'error', title: '載入失敗', text: data.message || '無法載入提醒列表。' });
            container.innerHTML = `<li class="list-group-item text-danger text-center">載入失敗：${data.message}</li>`;
        }
    } catch (error) {
        console.error('Fetch reminders error:', error);
        container.innerHTML = '<li class="list-group-item text-danger text-center">連線到伺服器失敗。</li>';
    }
}

/**
 * 將提醒日誌資料渲染成 HTML 列表
 * @param {Array<Object>} reminders 
 */
function renderReminderList(reminders) {
    const container = document.getElementById('reminders-container');
    container.innerHTML = '';
    
    if (reminders.length === 0) {
        container.innerHTML = '<li class="list-group-item text-muted text-center py-4">目前沒有待辦提醒。</li>';
        return;
    }

    reminders.sort((a, b) => new Date(a.reminder_date) - new Date(b.reminder_date));

    reminders.forEach(r => {
        const dueStatusClass = getDueStatus(r.reminder_date);
        
        const listItem = document.createElement('li');
        listItem.className = `list-group-item list-group-item-reminder ${dueStatusClass}`;
        listItem.setAttribute('data-id', r.reminder_id);

        listItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1 text-primary">${r.case_id} - ${r.content}</h6>
                <small class="text-muted">${r.reminder_date}</small>
            </div>
            <p class="mb-1"><span class="badge bg-secondary me-2">${r.category}</span> ${r.status}</p>
            <small>建立者: ${r.created_by}</small>
        `;
        container.appendChild(listItem);
    });
}

// ------------------------------------------------------------------
// 2. 新增提醒 (寫入)
// ------------------------------------------------------------------

/**
 * 處理新增提醒表單提交
 */
async function handleAddReminder(event) {
    event.preventDefault();

    if (!checkAuthAndDisplayUser()) return;

    const case_id = document.getElementById('reminderCaseId').value.trim();
    const reminder_date = document.getElementById('reminderDate').value;
    const content = document.getElementById('reminderContent').value.trim();
    const category = document.getElementById('reminderCategory').value;
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('addReminderModal'));
    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '儲存中...';

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/reminder/add`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}` 
            },
            body: JSON.stringify({ case_id, reminder_date, category, content })
        });

        const data = await response.json();

        if (response.ok) {
            Swal.fire({ icon: 'success', title: '提醒新增成功!', text: data.message });
            modal.hide();
            event.target.reset();
            loadReminders(); // 重新載入列表
            
        } else {
            Swal.fire({ icon: 'error', title: '新增失敗', text: data.message || '無法寫入日誌。' });
        }

    } catch (error) {
        console.error('Reminder submission error:', error);
        Swal.fire({ icon: 'error', title: '連線錯誤', text: '無法連線到後端服務。' });
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '儲存提醒';
    }
}

// ------------------------------------------------------------------
// 3. 時間計算機 (計算)
// ------------------------------------------------------------------

/**
 * 處理時間計算機的提交
 */
async function handleDateCalculation(event) {
    event.preventDefault();

    if (!checkAuthAndDisplayUser()) return;

    const start_date = document.getElementById('startDateCalc').value;
    const type = document.getElementById('typeCalc').value;
    const resultDisplay = document.getElementById('calculation-result');
    
    resultDisplay.innerHTML = `<div class="spinner-border spinner-border-sm me-2" role="status"></div> 計算中...`;

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/reminder/calculate-date`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}` 
            },
            body: JSON.stringify({ start_date, type })
        });

        const data = await response.json();

        if (response.ok) {
            resultDisplay.className = 'alert alert-success border text-center';
            resultDisplay.innerHTML = `
                <p class="mb-1"><strong>${data.message}</strong></p>
                <p class="fs-4 mb-0 text-dark">${data.result_date}</p>
            `;
            
        } else {
            resultDisplay.className = 'alert alert-danger border text-center';
            resultDisplay.innerHTML = `<p class="mb-0">${data.message || '計算失敗'}</p>`;
        }

    } catch (error) {
        console.error('Calculation error:', error);
        resultDisplay.className = 'alert alert-danger border text-center';
        resultDisplay.innerHTML = `<p class="mb-0">連線到伺服器失敗。</p>`;
    }
}


// ------------------------------------------------------------------
// 應用程式初始化
// ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // 檢查登入狀態並初始化介面
    if (!checkAuthAndDisplayUser()) return;
    
    // 初始載入提醒列表
    loadReminders();
    
    // 綁定事件
    document.getElementById('add-reminder-form').addEventListener('submit', handleAddReminder);
    document.getElementById('date-calculate-form').addEventListener('submit', handleDateCalculation);
});