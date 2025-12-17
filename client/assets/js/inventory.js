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

// 全域變數：儲存耗材主檔清單
let materialMasterList = []; 

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
 * 移除一個消耗項目
 * @param {HTMLElement} btn - 點擊的移除按鈕
 */
window.removeItem = function(btn) {
    const row = btn.closest('.item-row');
    if (row) {
        row.remove();
        // 確保至少留一筆項目在畫面上
        const container = document.getElementById('consume-items-container');
        if (container.querySelectorAll('.item-row').length === 0) {
            addItemRow(true); // 如果全刪光了，自動新增一個空的
        }
    }
}

// ------------------------------------------------------------------
// 1. 耗材主檔載入與渲染
// ------------------------------------------------------------------

/**
 * 從後端載入耗材主檔清單
 */
async function loadMaterialMaster() {
    if (!checkAuthAndDisplayUser()) return;

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/inventory/master`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}` 
            },
        });

        const data = await response.json();

        if (response.ok) {
            materialMasterList = data.data; // 儲存到全域變數
            
            // 更新所有現有的下拉選單
            document.querySelectorAll('.item-material-id').forEach(select => {
                renderMaterialOptions(select, materialMasterList);
            });

        } else {
            Swal.fire({ icon: 'error', title: '載入失敗', text: data.message || '無法載入耗材主檔。' });
        }
    } catch (error) {
        console.error('Fetch master error:', error);
        Swal.fire({ icon: 'error', title: '連線錯誤', text: '無法連線到後端服務，請檢查伺服器。' });
    }
}

/**
 * 渲染耗材下拉選單選項
 * @param {HTMLSelectElement} selectElement - 要更新的 <select> 元素
 * @param {Array<Object>} masterList - 耗材主檔清單
 */
function renderMaterialOptions(selectElement, masterList) {
    selectElement.innerHTML = '<option value="" disabled selected>請選擇耗材...</option>';

    masterList.forEach(item => {
        const option = document.createElement('option');
        option.value = item.material_id;
        option.textContent = `${item.name} (${item.material_id}) - 庫存: ${item.current_stock}`;
        option.setAttribute('data-unit', item.unit); // 將單位資訊儲存在 data 屬性
        selectElement.appendChild(option);
    });
    
    // 綁定 onchange 事件，以便更新單位顯示
    selectElement.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const unitDisplay = e.target.closest('.item-row').querySelector('.item-unit');
        unitDisplay.textContent = selectedOption.getAttribute('data-unit') || '單位';
    });
}

/**
 * 新增一個空的消耗項目輸入行
 */
function addItemRow(isInitial = false) {
    const container = document.getElementById('consume-items-container');
    const newRow = document.createElement('div');
    newRow.className = 'row g-2 mb-2 item-row';
    
    newRow.innerHTML = `
        <div class="col-md-5">
            <select class="form-select item-material-id" required>
                <option value="" disabled selected>載入中...</option>
            </select>
        </div>
        <div class="col-md-3">
            <input type="number" class="form-control item-quantity" placeholder="消耗數量" value="1" min="1" required>
        </div>
        <div class="col-md-2 d-flex align-items-center">
            <span class="text-muted item-unit">單位</span>
        </div>
        <div class="col-md-2 d-flex align-items-center">
            <button type="button" class="btn btn-sm btn-outline-danger remove-item-btn" ${isInitial ? 'disabled' : ''} onclick="removeItem(this)">移除</button>
        </div>
    `;
    
    container.appendChild(newRow);
    
    // 渲染選項到新的下拉選單
    const newSelect = newRow.querySelector('.item-material-id');
    renderMaterialOptions(newSelect, materialMasterList);
}


// ------------------------------------------------------------------
// 2. 提交消耗記錄 (寫入)
// ------------------------------------------------------------------

/**
 * 處理提交消耗記錄的表單
 */
async function handleConsumeSubmit(event) {
    event.preventDefault();

    if (!checkAuthAndDisplayUser()) return;

    const case_id = document.getElementById('caseIdConsume').value.trim();
    const itemRows = document.getElementById('consume-items-container').querySelectorAll('.item-row');
    
    if (!case_id) {
        Swal.fire({ icon: 'warning', title: '案件 ID 缺失', text: '請輸入有效的案件編號。' });
        return;
    }
    
    const items = [];
    let isValid = true;

    itemRows.forEach(row => {
        const material_id = row.querySelector('.item-material-id').value;
        const quantity = parseInt(row.querySelector('.item-quantity').value);
        
        if (!material_id || quantity <= 0) {
            isValid = false;
        } else {
            items.push({ material_id, quantity });
        }
    });

    if (!isValid) {
        Swal.fire({ icon: 'warning', title: '項目缺失', text: '請檢查是否所有項目都已選擇耗材和填寫數量。' });
        return;
    }

    const submitBtn = document.getElementById('save-consume-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';


    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/inventory/consume`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}` 
            },
            body: JSON.stringify({ case_id, items })
        });

        const data = await response.json();

        if (response.ok) {
            await Swal.fire({ 
                icon: 'success', 
                title: '消耗記錄成功!', 
                html: `案件 ID: <strong>${case_id}</strong><br>總成本: NT$ <strong>${data.total_cost.toLocaleString()}</strong>`,
                confirmButtonText: '確定'
            });
            document.getElementById('inventory-consume-form').reset();
            // 重新載入主檔，以顯示更新後的庫存
            loadMaterialMaster(); 
        } else {
            Swal.fire({ icon: 'error', title: '提交失敗', text: data.message || '無法新增消耗記錄。' });
        }

    } catch (error) {
        console.error('Consume submission error:', error);
        Swal.fire({ icon: 'error', title: '連線錯誤', text: '無法連線到後端服務。' });
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 提交消耗記錄並更新庫存';
    }
}


// ------------------------------------------------------------------
// 應用程式初始化
// ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // 檢查登入狀態並初始化介面
    if (!checkAuthAndDisplayUser()) return;
    
    // 載入耗材主檔
    loadMaterialMaster();
    
    // 綁定事件
    document.getElementById('add-item-btn').addEventListener('click', () => addItemRow(false));
    document.getElementById('inventory-consume-form').addEventListener('submit', handleConsumeSubmit);
});