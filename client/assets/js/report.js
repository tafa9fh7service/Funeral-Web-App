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
// 數據讀取與彙報 (GET)
// ------------------------------------------------------------------

/**
 * 載入並顯示案件彙報數據
 * @param {string | null} case_id 案件 ID 篩選
 */
async function loadCaseReport(case_id = null) {
    if (!checkAuthAndDisplayUser()) return;
    
    const container = document.getElementById('report-table-container');
    container.innerHTML = `<p class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2"></div> 正在載入與聚合數據...</p>`;

    let url = `${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/report/cases`;
    if (case_id) {
        url = `${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/report/query?case_id=${case_id}`;
    }

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}` 
            },
        });

        const data = await response.json();

        if (response.ok) {
            renderReport(data.data);
        } else {
             Swal.fire({ icon: 'error', title: '查詢失敗', text: data.message || '無法取得彙報數據。' });
             container.innerHTML = `<p class="text-danger text-center py-5">查詢失敗：${data.message || '連線錯誤'}</p>`;
        }
    } catch (error) {
        console.error('Fetch report error:', error);
        container.innerHTML = '<p class="text-danger text-center py-5">連線到伺服器失敗。</p>';
    }
}

/**
 * 將彙報數據渲染到前端表格並更新摘要卡片
 * @param {Array<Object>} reports 
 */
function renderReport(reports) {
    const container = document.getElementById('report-table-container');
    
    if (reports.length === 0) {
        container.innerHTML = `<p class="text-muted text-center py-5">未找到案件紀錄。</p>`;
        // 重置摘要
        updateSummaryCards(0, 0, 0, 0);
        return;
    }

    let totalCases = reports.length;
    let totalFee = 0;
    let totalPaid = 0;
    let totalCost = 0;
    
    let html = `<table class="table table-sm table-striped table-hover">
        <thead>
            <tr>
                <th>案件ID</th>
                <th>狀態/人員</th>
                <th>契約費用</th>
                <th>已收金額</th>
                <th>耗材成本</th>
                <th>淨收益</th>
                <th>收益比</th>
            </tr>
        </thead>
        <tbody>`;
    
    reports.forEach(r => {
        totalFee += r.契約費用;
        totalPaid += r.已收金額;
        totalCost += r.耗材成本;

        let profitClass = 'profit-margin-low';
        if (parseFloat(r.收益比) > 20) {
            profitClass = 'profit-margin-high';
        } else if (parseFloat(r.收益比) < 0) {
            profitClass = 'profit-margin-negative';
        }

        html += `
            <tr>
                <td class="fw-bold">${r.case_id}</td>
                <td>
                    <span class="badge bg-primary">${r.案件狀態}</span><br>
                    <small class="text-muted">${r.服務人員}</small>
                </td>
                <td class="text-info">${formatCurrency(r.契約費用)}</td>
                <td class="text-success">${formatCurrency(r.已收金額)}</td>
                <td class="text-danger">${formatCurrency(r.耗材成本)}</td>
                <td class="fw-bold">${formatCurrency(r.淨收益)}</td>
                <td class="${profitClass}">${r.收益比}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
    
    // 更新頂部摘要卡片
    updateSummaryCards(totalCases, totalFee, totalPaid, totalCost);
}

/**
 * 更新頂部摘要卡片的數值
 */
function updateSummaryCards(totalCases, totalFee, totalPaid, totalCost) {
    document.getElementById('total-cases').textContent = totalCases;
    document.getElementById('total-fee').textContent = formatCurrency(totalFee);
    document.getElementById('total-paid').textContent = formatCurrency(totalPaid);
    document.getElementById('total-cost').textContent = formatCurrency(totalCost);
}


// ------------------------------------------------------------------
// 應用程式初始化
// ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // 檢查登入狀態並初始化介面
    if (!checkAuthAndDisplayUser()) return;
    
    // 綁定事件
    document.getElementById('queryReportBtn').addEventListener('click', () => {
        const case_id = document.getElementById('queryCaseId').value.trim();
        loadCaseReport(case_id);
    });
    
    document.getElementById('resetQueryBtn').addEventListener('click', () => {
        document.getElementById('queryCaseId').value = '';
        loadCaseReport(null);
    });
    
    // 初始載入所有數據
    loadCaseReport(null);
});