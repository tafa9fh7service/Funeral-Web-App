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
 * 格式化金額顯示
 * @param {number} amount 
 * @returns {string} 
 */
function formatCurrency(amount) {
    return `NT$ ${parseFloat(amount).toLocaleString('en-US')}`; 
}

// ------------------------------------------------------------------
// 1. 記錄收費 (POST)
// ------------------------------------------------------------------

/**
 * 處理收費記錄表單提交
 */
async function handlePaymentRecord(event) {
    event.preventDefault();

    if (!checkAuthAndDisplayUser()) return;

    const case_id = document.getElementById('caseIdPayment').value.trim();
    const amount = document.getElementById('amountPayment').value;
    const type = document.getElementById('typePayment').value;
    const payment_method = document.getElementById('methodPayment').value;
    
    if (!case_id || !amount || !type || !payment_method) {
         Swal.fire({ icon: 'warning', title: '資訊不完整', text: '請填寫所有必填欄位。' });
         return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/payment/record`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}` 
            },
            body: JSON.stringify({ case_id, amount, type, payment_method })
        });

        const data = await response.json();

        if (response.ok) {
            await Swal.fire({ 
                icon: 'success', 
                title: '收費記錄成功!', 
                html: `案件 ID: <strong>${case_id}</strong><br>金額: <strong>${formatCurrency(data.amount)}</strong>`,
                confirmButtonText: '確定'
            });
            document.getElementById('payment-record-form').reset();
            // 如果當前正在查詢此案件，則重新載入記錄
            const queryCaseId = document.getElementById('queryCaseId').value.trim();
            if (queryCaseId === case_id) {
                loadCasePaymentLogs(case_id);
            }
        } else {
            Swal.fire({ icon: 'error', title: '提交失敗', text: data.message || '無法寫入收費記錄。' });
        }

    } catch (error) {
        console.error('Payment record error:', error);
        Swal.fire({ icon: 'error', title: '連線錯誤', text: '無法連線到後端服務。' });
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 提交收費記錄';
    }
}

// ------------------------------------------------------------------
// 2. 查詢收費記錄 (GET)
// ------------------------------------------------------------------

/**
 * 載入並顯示單一案件的收費記錄
 * @param {string} case_id 
 */
async function loadCasePaymentLogs(case_id) {
    if (!checkAuthAndDisplayUser()) return;
    
    const display = document.getElementById('payment-logs-display');
    display.innerHTML = `<p class="text-center text-muted">正在查詢 ${case_id} 的紀錄...</p>`;

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/payment/case/${case_id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}` 
            },
        });

        const data = await response.json();

        if (response.ok) {
            renderPaymentLogs(case_id, data.data);
        } else {
             display.innerHTML = `<p class="text-danger text-center">查詢失敗：${data.message || '連線錯誤'}</p>`;
        }
    } catch (error) {
        console.error('Fetch payment logs error:', error);
        display.innerHTML = '<p class="text-danger text-center">連線到伺服器失敗。</p>';
    }
}

/**
 * 將收費日誌資料渲染成 HTML 列表
 * @param {string} case_id 
 * @param {Array<Object>} logs 
 */
function renderPaymentLogs(case_id, logs) {
    const display = document.getElementById('payment-logs-display');
    
    if (logs.length === 0) {
        display.innerHTML = `<p class="text-muted text-center">案件 ${case_id} 目前沒有收費紀錄。</p>`;
        return;
    }

    let html = `<h6 class="text-primary">案件 ${case_id} 收費歷史紀錄 (${logs.length} 筆)</h6>`;
    html += `<table class="table table-sm">
        <thead>
            <tr>
                <th>日期</th>
                <th>類型</th>
                <th>金額</th>
                <th>方式</th>
                <th>記錄者</th>
            </tr>
        </thead>
        <tbody>`;
    
    let totalPaid = 0;
    logs.forEach(log => {
        totalPaid += log.amount;
        html += `
            <tr>
                <td>${log.transaction_date.split(' ')[0]}</td>
                <td><span class="badge bg-info text-dark">${log.type}</span></td>
                <td class="fw-bold text-success">${formatCurrency(log.amount)}</td>
                <td>${log.payment_method}</td>
                <td>${log.recorded_by}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    html += `<div class="alert alert-success mt-3 mb-0"><strong>總計已收金額: ${formatCurrency(totalPaid)}</strong></div>`;
    display.innerHTML = html;
}

/**
 * 處理查詢按鈕點擊事件
 */
function handleQueryPayment() {
    const case_id = document.getElementById('queryCaseId').value.trim();
    if (case_id) {
        loadCasePaymentLogs(case_id);
    } else {
        Swal.fire({ icon: 'warning', title: '請輸入案件 ID', text: '請輸入您要查詢的案件編號。' });
    }
}


// ------------------------------------------------------------------
// 應用程式初始化
// ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // 檢查登入狀態並初始化介面
    if (!checkAuthAndDisplayUser()) return;
    
    // 綁定事件
    document.getElementById('payment-record-form').addEventListener('submit', handlePaymentRecord);
    document.getElementById('queryPaymentBtn').addEventListener('click', handleQueryPayment);
});