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
 * 取得當前月份的第一天和最後一天，用於預設查詢
 * @returns {{start: string, end: string}} YYYY-MM-DD
 */
function getCurrentMonthRange() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-11
    
    // 當月第一天
    const start = new Date(year, month, 1).toISOString().split('T')[0];
    
    // 當月最後一天
    const end = new Date(year, month + 1, 0).toISOString().split('T')[0];

    return { start, end };
}

// ------------------------------------------------------------------
// API 呼叫：讀取排班列表
// ------------------------------------------------------------------

/**
 * 從後端 API 載入排班日誌並顯示
 * @param {string} start_date 
 * @param {string} end_date 
 */
async function loadSchedule(start_date, end_date) {
    if (!checkAuthAndDisplayUser()) return;

    const display = document.getElementById('schedule-display');
    display.innerHTML = '<div class="text-center mt-5"><div class="spinner-border" role="status"></div><p>載入排班資訊中...</p></div>';

    let queryParams = new URLSearchParams();
    if (start_date) queryParams.append('start_date', start_date);
    if (end_date) queryParams.append('end_date', end_date);
    
    const url = `${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/schedule?${queryParams.toString()}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}` 
            },
        });

        const data = await response.json();

        if (response.ok) {
            renderScheduleList(data.data);
        } else {
            Swal.fire({ icon: 'error', title: '查詢失敗', text: data.message || '無法載入排班日誌。' });
            display.innerHTML = `<p class="text-danger text-center mt-5">載入失敗：${data.message || '連線錯誤'}</p>`;
        }
    } catch (error) {
        console.error('Fetch schedule error:', error);
        display.innerHTML = '<p class="text-danger text-center mt-5">連線到伺服器失敗。</p>';
    }
}

/**
 * 將排班日誌資料渲染成 HTML 列表
 * @param {Array<Object>} scheduleData 
 */
function renderScheduleList(scheduleData) {
    const display = document.getElementById('schedule-display');
    if (scheduleData.length === 0) {
        display.innerHTML = '<p class="text-muted text-center mt-5">該日期範圍內無排班或休假紀錄。</p>';
        return;
    }

    // 將資料按 staff_id 分組，方便顯示
    const groupedData = scheduleData.reduce((acc, log) => {
        if (!acc[log.staff_id]) {
            acc[log.staff_id] = {
                staff_id: log.staff_id,
                logs: []
            };
        }
        acc[log.staff_id].logs.push(log);
        return acc;
    }, {});
    
    let html = `
        <table class="table table-sm table-hover">
            <thead>
                <tr>
                    <th>員工 ID</th>
                    <th>日期</th>
                    <th>排班類型</th>
                    <th>日誌 ID</th>
                </tr>
            </thead>
            <tbody>`;

    // 依員工 ID 渲染
    Object.values(groupedData).forEach(staffGroup => {
        staffGroup.logs.forEach(log => {
            let badgeClass = 'bg-secondary';
            if (log.shift_type === '休假' || log.shift_type === '特休') {
                badgeClass = 'bg-danger';
            } else if (log.shift_type === '值班') {
                badgeClass = 'bg-primary';
            } else if (log.shift_type === '備勤') {
                badgeClass = 'bg-warning text-dark';
            }

            html += `
                <tr>
                    <td>${log.staff_id}</td>
                    <td>${log.date}</td>
                    <td><span class="badge ${badgeClass}">${log.shift_type}</span></td>
                    <td>${log.log_id}</td>
                </tr>
            `;
        });
    });

    html += `</tbody></table>`;
    display.innerHTML = html;
}

// ------------------------------------------------------------------
// API 呼叫：排假申請 (POST)
// ------------------------------------------------------------------

/**
 * 處理排假申請表單提交
 */
async function handleScheduleApply(event) {
    event.preventDefault();

    if (!checkAuthAndDisplayUser()) return;

    const date = document.getElementById('date-input').value;
    const shift_type = document.getElementById('shift-type-select').value;
    
    if (!date || !shift_type) {
         Swal.fire({ icon: 'warning', title: '資訊不完整', text: '請填寫申請日期和排班類型。' });
         return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/schedule/apply`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}` 
            },
            body: JSON.stringify({ date, shift_type })
        });

        const data = await response.json();

        if (response.ok) {
            await Swal.fire({ 
                icon: 'success', 
                title: '申請已提交!', 
                html: `日期: <strong>${date}</strong>，類型: <strong>${shift_type}</strong>`,
            });
            // 成功後重新載入列表
            const { start, end } = getCurrentMonthRange();
            loadSchedule(start, end);
            document.getElementById('schedule-apply-form').reset();
            
        } else {
            Swal.fire({ icon: 'error', title: '提交失敗', text: data.message || '無法寫入日誌。' });
        }

    } catch (error) {
        console.error('Schedule submission error:', error);
        Swal.fire({ icon: 'error', title: '連線錯誤', text: '無法連線到後端服務。' });
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '提交申請';
    }
}


// ------------------------------------------------------------------
// 應用程式初始化
// ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // 檢查登入狀態並初始化介面
    if (!checkAuthAndDisplayUser()) return;
    
    // 預設日期篩選範圍為當月
    const { start, end } = getCurrentMonthRange();
    document.getElementById('start-date-filter').value = start;
    document.getElementById('end-date-filter').value = end;
    
    // 初始載入當月排班
    loadSchedule(start, end);
    
    // 綁定事件
    document.getElementById('schedule-apply-form').addEventListener('submit', handleScheduleApply);
    document.getElementById('filter-schedule-btn').addEventListener('click', () => {
        const start_date = document.getElementById('start-date-filter').value;
        const end_date = document.getElementById('end-date-filter').value;
        loadSchedule(start_date, end_date);
    });
});