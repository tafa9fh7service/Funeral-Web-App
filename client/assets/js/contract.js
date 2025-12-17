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

/**
 * 取得 JWT Token
 * @returns {string | null} JWT Token
 */
function getAuthToken() {
    return localStorage.getItem('jwtToken');
}

/**
 * 取得使用者輸入的所有服務項目，並計算總費用
 * @returns {{items: Array<Object>, totalFee: number}} 服務項目列表和總費用
 */
function getServiceItemsAndCalculateTotal() {
    const itemsContainer = document.getElementById('service-items-container');
    const itemRows = itemsContainer.querySelectorAll('.item-row');
    const items = [];
    let totalFee = 0;

    itemRows.forEach(row => {
        const description = row.querySelector('.item-description').value.trim();
        // 將輸入值轉換為數字，如果轉換失敗則為 0
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const quantity = parseInt(row.querySelector('.item-quantity').value) || 1;
        
        const subtotal = price * quantity;
        totalFee += subtotal;

        // 確保至少有描述或價格的項目才被計入
        if (description || price > 0) {
            items.push({ description, price, quantity });
        }
    });

    return { items, totalFee };
}

/**
 * 格式化金額顯示
 * @param {number} amount 
 * @returns {string} 
 */
function formatCurrency(amount) {
    // 使用逗號分隔符格式化數字
    return `NT$ ${amount.toLocaleString('en-US')}`; 
}

/**
 * 更新頁面上的總費用顯示
 */
function updateSummaryDisplay() {
    const { totalFee } = getServiceItemsAndCalculateTotal();
    document.getElementById('total-fee').textContent = formatCurrency(totalFee);
}

/**
 * 移除一個服務項目
 * @param {HTMLElement} btn - 點擊的移除按鈕
 */
window.removeItem = function(btn) {
    const row = btn.closest('.item-row');
    if (row) {
        row.remove();
        updateSummaryDisplay();
    }
}


// ------------------------------------------------------------------
// 介面互動與 API 提交
// ------------------------------------------------------------------

/**
 * 新增一個空的服務項目輸入行
 */
function addItemRow() {
    const container = document.getElementById('service-items-container');
    const newRow = document.createElement('div');
    newRow.className = 'row g-2 mb-2 item-row';
    
    // HTML 模板
    newRow.innerHTML = `
        <div class="col-md-5">
            <input type="text" class="form-control item-description" placeholder="服務描述">
        </div>
        <div class="col-md-3">
            <input type="number" class="form-control item-price" placeholder="單價 (NT$)" min="0">
        </div>
        <div class="col-md-2">
            <input type="number" class="form-control item-quantity" placeholder="數量" value="1" min="1">
        </div>
        <div class="col-md-2 d-flex align-items-center">
            <button type="button" class="btn btn-sm btn-outline-danger remove-item-btn" onclick="removeItem(this)">移除</button>
        </div>
    `;
    
    container.appendChild(newRow);

    // 重新綁定事件監聽器到所有新的輸入欄位，確保計算功能即時更新
    newRow.querySelectorAll('.item-price, .item-quantity').forEach(input => {
        input.addEventListener('input', updateSummaryDisplay);
    });
}

/**
 * 處理契約書儲存與提交
 */
async function handleSaveContract() {
    const token = getAuthToken();
    if (!token) {
        Swal.fire({ icon: 'error', title: '未經授權', text: '請先登入系統。' });
        window.location.href = 'index.html';
        return;
    }
    
    const case_id = document.getElementById('caseIdInput').value.trim();
    if (!case_id) {
        Swal.fire({ icon: 'warning', title: '案件 ID 缺失', text: '請輸入有效的案件編號 (例如: P25-001)。' });
        return;
    }

    const { items, totalFee } = getServiceItemsAndCalculateTotal();
    if (items.length === 0) {
        Swal.fire({ icon: 'warning', title: '無服務項目', text: '請至少新增一個服務項目。' });
        return;
    }
    
    const contract_status = document.getElementById('contractStatus').value;

    const submitBtn = document.getElementById('save-contract-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '計算並儲存中...';


    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/contracts/add`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ case_id, items, contract_status })
        });

        const data = await response.json();

        if (response.ok) {
            await Swal.fire({ 
                icon: 'success', 
                title: '契約書儲存成功!', 
                html: `案件 ID: <strong>${case_id}</strong><br>總費用: <strong>${formatCurrency(totalFee)}</strong>`,
                confirmButtonText: '確定'
            });
            // 儲存成功後，將狀態改為待簽訂
            document.getElementById('contractStatus').value = '待簽訂';
            
        } else {
            Swal.fire({ icon: 'error', title: '儲存失敗', text: data.message || '無法新增契約書紀錄。' });
        }

    } catch (error) {
        console.error('Contract submission error:', error);
        Swal.fire({ icon: 'error', title: '連線錯誤', text: '無法連線到後端服務。' });
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 儲存契約書草稿並計算';
    }
}


// ------------------------------------------------------------------
// 應用程式初始化
// ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // 1. 檢查是否已登入
    if (!getAuthToken()) {
        Swal.fire({ icon: 'error', title: '未經授權', text: '請先登入系統。', timer: 2000 });
        setTimeout(() => { window.location.href = 'index.html'; }, 2000);
        return;
    }
    
    // 2. 初始計算 (確保一打開頁面總價為正確的初始值)
    updateSummaryDisplay(); 

    // 3. 綁定事件監聽器：當單價或數量改變時，重新計算總費用
    document.querySelectorAll('.item-price, .item-quantity').forEach(input => {
        input.addEventListener('input', updateSummaryDisplay);
    });

    // 4. 綁定按鈕事件
    document.getElementById('add-item-btn').addEventListener('click', addItemRow);
    document.getElementById('save-contract-btn').addEventListener('click', handleSaveContract);
});