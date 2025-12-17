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
// 核心輔助函式與權限檢查
// ------------------------------------------------------------------

function getAuthToken() {
    return localStorage.getItem('jwtToken');
}

function getUserInfo() {
    return JSON.parse(localStorage.getItem('user'));
}

/**
 * 檢查登入狀態、更新用戶資訊顯示，並執行管理員權限檢查
 */
function checkAdminAccess() {
    const token = getAuthToken();
    const user = getUserInfo();
    
    if (!token || !user) {
         Swal.fire({ icon: 'error', title: '未經授權', text: '請先登入系統。' });
         setTimeout(() => { window.location.href = 'index.html'; }, 1000);
         return false;
    }

    if (user.role !== 'Administrator') {
         Swal.fire({ icon: 'error', title: '權限不足', text: '您不是系統管理員，無法進入此頁面。' });
         setTimeout(() => { window.location.href = 'index.html'; }, 1000);
         return false;
    }
    
    document.getElementById('user-info').textContent = `管理員: ${user.name} (${user.staff_id})`;
    return true;
}

// ----------------------------------------------------------------------
// 1. 廠商清單管理 (Vendor Management)
// ----------------------------------------------------------------------

/**
 * 載入並顯示廠商清單
 */
async function loadVendors() {
    const container = document.getElementById('vendor-list-container');
    container.innerHTML = `<p class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2"></div> 正在載入廠商清單...</p>`;

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/admin/vendors`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${getAuthToken()}` },
        });

        const data = await response.json();

        if (response.ok) {
            renderVendorList(data.data);
        } else {
             container.innerHTML = `<p class="text-danger text-center py-5">載入失敗：${data.message || '連線錯誤'}</p>`;
        }
    } catch (error) {
        container.innerHTML = '<p class="text-danger text-center py-5">連線到伺服器失敗。</p>';
    }
}

/**
 * 渲染廠商清單表格
 */
function renderVendorList(vendors) {
    const container = document.getElementById('vendor-list-container');
    
    if (vendors.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-5">目前沒有廠商紀錄。</p>';
        return;
    }
    
    let html = `<table class="table table-sm table-striped">
        <thead>
            <tr>
                <th>ID</th>
                <th>名稱</th>
                <th>聯絡人</th>
                <th>電話</th>
                <th>服務類型</th>
                <th>操作</th>
            </tr>
        </thead>
        <tbody>`;
    
    vendors.forEach(v => {
        html += `
            <tr>
                <td class="fw-bold">${v.vendor_id}</td>
                <td>${v.name}</td>
                <td>${v.contact_person}</td>
                <td>${v.phone}</td>
                <td>${v.service_type}</td>
                <td><button class="btn btn-sm btn-outline-danger" disabled>編輯/刪除 (未實作)</button></td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}


/**
 * 處理新增廠商表單提交
 */
async function handleAddVendor(event) {
    event.preventDefault();

    const name = document.getElementById('vendorName').value.trim();
    const contact_person = document.getElementById('contactPerson').value.trim();
    const phone = document.getElementById('vendorPhone').value.trim();
    const service_type = document.getElementById('serviceType').value.trim();

    const modal = bootstrap.Modal.getInstance(document.getElementById('addVendorModal'));
    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '儲存中...';

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/admin/vendors/add`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}` 
            },
            body: JSON.stringify({ name, contact_person, phone, service_type })
        });

        const data = await response.json();

        if (response.ok) {
            Swal.fire({ icon: 'success', title: '新增成功!', text: data.message });
            modal.hide();
            event.target.reset();
            loadVendors(); // 重新載入列表
            
        } else {
            Swal.fire({ icon: 'error', title: '新增失敗', text: data.message || '無法寫入廠商清單。' });
        }

    } catch (error) {
        Swal.fire({ icon: 'error', title: '連線錯誤', text: '無法連線到後端服務。' });
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '儲存廠商';
    }
}


// ----------------------------------------------------------------------
// 2. 耗材主檔維護 (Inventory Maintenance)
// ----------------------------------------------------------------------

/**
 * 載入並顯示耗材主檔清單
 */
async function loadMasterInventory() {
    const container = document.getElementById('master-inventory-list');
    container.innerHTML = `<p class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2"></div> 載入耗材主檔...</p>`;

    try {
        // 使用 Admin 路由讀取主檔
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/admin/inventory/master`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${getAuthToken()}` },
        });

        const data = await response.json();

        if (response.ok) {
            renderMasterInventoryList(data.data);
        } else {
             container.innerHTML = `<p class="text-danger text-center py-5">載入失敗：${data.message || '連線錯誤'}</p>`;
        }
    } catch (error) {
        container.innerHTML = '<p class="text-danger text-center py-5">連線到伺服器失敗。</p>';
    }
}

/**
 * 渲染耗材維護表格
 */
function renderMasterInventoryList(masterList) {
    const container = document.getElementById('master-inventory-list');
    
    if (masterList.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-5">耗材主檔沒有紀錄。</p>';
        return;
    }
    
    let html = `<table class="table table-sm table-striped">
        <thead>
            <tr>
                <th>ID</th>
                <th>名稱</th>
                <th>單位</th>
                <th>當前成本 (NT$)</th>
                <th>當前庫存</th>
                <th>操作</th>
            </tr>
        </thead>
        <tbody>`;
    
    masterList.forEach(m => {
        html += `
            <tr data-id="${m.material_id}">
                <td class="fw-bold">${m.material_id}</td>
                <td><input type="text" class="form-control form-control-sm" data-field="name" value="${m.name}" disabled></td>
                <td><input type="text" class="form-control form-control-sm" data-field="unit" value="${m.unit}" disabled></td>
                <td><input type="number" class="form-control form-control-sm" data-field="current_cost" value="${m.current_cost}"></td>
                <td><input type="number" class="form-control form-control-sm" data-field="current_stock" value="${m.current_stock}"></td>
                <td><button class="btn btn-sm btn-warning save-master-btn">更新</button></td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
    
    // 綁定更新按鈕事件
    document.querySelectorAll('.save-master-btn').forEach(btn => {
        btn.addEventListener('click', handleUpdateMasterInventory);
    });
}

/**
 * 處理耗材主檔更新
 */
async function handleUpdateMasterInventory(event) {
    const btn = event.target;
    const row = btn.closest('tr');
    const material_id = row.getAttribute('data-id');
    
    const name = row.querySelector('[data-field="name"]').value;
    const unit = row.querySelector('[data-field="unit"]').value;
    const current_cost = parseFloat(row.querySelector('[data-field="current_cost"]').value);
    const current_stock = parseInt(row.querySelector('[data-field="current_stock"]').value);

    if (isNaN(current_cost) || isNaN(current_stock)) {
        Swal.fire({ icon: 'warning', title: '輸入錯誤', text: '成本和庫存必須為有效數字。' });
        return;
    }

    btn.disabled = true;
    btn.textContent = '更新中...';

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/admin/inventory/update`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}` 
            },
            body: JSON.stringify({ material_id, name, unit, current_cost, current_stock })
        });

        const data = await response.json();

        if (response.ok) {
            Swal.fire({ icon: 'success', title: '更新成功!', html: `ID: ${material_id}<br>新成本: NT$ ${data.updated_cost.toLocaleString()}` });
            // 重新載入列表以確認最新的數據
            loadMasterInventory(); 
            
        } else if (response.status === 403) {
             Swal.fire({ icon: 'error', title: '權限不足', text: '您沒有權限執行此操作。' });
        } else {
            Swal.fire({ icon: 'error', title: '更新失敗', text: data.message || '無法寫入主檔。' });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: '連線錯誤', text: '無法連線到後端服務。' });
    } finally {
        btn.disabled = false;
        btn.textContent = '更新';
    }
}


// ------------------------------------------------------------------
// 應用程式初始化
// ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // 檢查管理員權限
    if (!checkAdminAccess()) return;
    
    // 初始載入廠商清單
    loadVendors();
    
    // 綁定事件
    document.getElementById('add-vendor-form').addEventListener('submit', handleAddVendor);
    
    // 當 Tab 切換到耗材維護時，載入耗材主檔
    const inventoryTab = document.getElementById('inventory-tab');
    if (inventoryTab) {
        inventoryTab.addEventListener('shown.bs.tab', loadMasterInventory);
    }
});