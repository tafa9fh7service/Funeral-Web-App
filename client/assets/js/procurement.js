// client/assets/js/procurement.js

const CONFIG = (() => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const ZEABUR_API_DOMAIN = 'https://funeralwebapp-backend.zeabur.app'; // ★ 請確認此處網址是否正確
    return {
        API_BASE_URL: isLocal ? 'http://localhost:3000' : ZEABUR_API_DOMAIN,
        API_PATH: '/api',
    };
})();

function getAuthToken() { return localStorage.getItem('jwtToken'); }

async function init() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !getAuthToken()) {
        location.href = 'index.html';
        return;
    }
    document.getElementById('user-info').textContent = `${user.name}`;

    // 平行載入所有資料
    await Promise.all([loadVendors(), loadMaterials(), loadHistory()]);

    document.getElementById('procurement-form').addEventListener('submit', handleRestock);
}

// 載入供應商選單
async function loadVendors() {
    try {
        const res = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/admin/vendors`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        const json = await res.json();
        const select = document.getElementById('vendorSelect');
        select.innerHTML = '<option value="" disabled selected>請選擇供應商</option>';
        json.data.forEach(v => {
            select.innerHTML += `<option value="${v.vendor_id}">${v.name} (${v.vendor_id})</option>`;
        });
    } catch (e) { console.error(e); }
}

// 載入耗材選單
async function loadMaterials() {
    try {
        // 這裡可以複用 admin 的路由，或者 inventory 的路由
        const res = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/inventory/master`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        const json = await res.json();
        const select = document.getElementById('materialSelect');
        select.innerHTML = '<option value="" disabled selected>請選擇耗材</option>';
        json.data.forEach(m => {
            select.innerHTML += `<option value="${m.material_id}">${m.name} (庫存: ${m.current_stock})</option>`;
        });
    } catch (e) { console.error(e); }
}

// 載入歷史紀錄
async function loadHistory() {
    try {
        const res = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/procurement/history`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        const json = await res.json();
        const tbody = document.getElementById('history-list');
        if (json.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">尚無紀錄</td></tr>';
            return;
        }
        tbody.innerHTML = json.data.map(log => `
            <tr>
                <td><small>${log.date.split(' ')[0]}</small></td>
                <td>${log.material}</td>
                <td class="text-success fw-bold">+${log.qty}</td>
                <td>$${log.total}</td>
                <td><span class="badge bg-secondary">${log.staff}</span></td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

// 處理進貨提交
async function handleRestock(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = '處理中...';

    const payload = {
        vendor_id: document.getElementById('vendorSelect').value,
        material_id: document.getElementById('materialSelect').value,
        quantity: document.getElementById('qtyInput').value,
        unit_cost: document.getElementById('costInput').value
    };

    try {
        const res = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_PATH}/procurement/restock`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (res.ok) {
            Swal.fire('成功', `進貨成功！新庫存: ${json.new_stock}`, 'success');
            document.getElementById('procurement-form').reset();
            loadMaterials(); // 重新整理下拉選單的庫存顯示
            loadHistory();   // 重新整理列表
        } else {
            Swal.fire('失敗', json.message, 'error');
        }
    } catch (err) {
        Swal.fire('錯誤', '連線失敗', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '確認進貨';
    }
}

document.addEventListener('DOMContentLoaded', init);