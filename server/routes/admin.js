// server/routes/admin.js

const express = require('express');
const router = express.Router();
const { getRows, appendRow, updateCell, getSheetMetadata } = require('../utils/sheets'); 
const moment = require('moment-timezone');

const VENDOR_SHEET_NAME = '09_廠商清單';
const MASTER_SHEET_NAME = '07_耗材主檔';
const MASTER_HEADERS = ['material_id', 'name', 'unit', 'current_cost', 'current_stock'];


// ----------------------------------------------------------------------
// 輔助函式：權限與數據轉換
// ----------------------------------------------------------------------

/**
 * 檢查使用者是否為系統管理員 (Administrator)
 */
const checkAdminRole = (req, res, next) => {
    if (req.user && req.user.role === 'Administrator') {
        next(); // 允許繼續
    } else {
        res.status(403).json({ message: '權限不足。此操作僅限系統管理員。' });
    }
};

/**
 * 將 Sheets 讀取的二維陣列資料轉換為物件陣列 (與 inventory.js 相同)
 */
function sheetDataToObjects(data, headers) {
    if (!data || data.length < 2) return []; 
    const dataRows = data.slice(1); 

    return dataRows.map(row => {
        let obj = {};
        headers.forEach((key, index) => {
            if (['current_cost', 'current_stock'].includes(key)) {
                obj[key] = parseFloat(row[index]) || 0;
            } else {
                obj[key] = row[index] || '';
            }
        });
        return obj;
    });
}


// ----------------------------------------------------------------------
// 1. 耗材主檔設定 (ADMIN ONLY)
// ----------------------------------------------------------------------

// 在所有 admin 路由前使用 checkAdminRole 中介層
router.use(checkAdminRole); 


/**
 * 取得所有耗材主檔清單 (GET /api/admin/inventory/master)
 * 與 inventory.js 中的路由類似，但這裡不需要 JWT 驗證，因為已經被 router.use(checkAdminRole) 處理
 */
router.get('/inventory/master', async (req, res) => {
    try {
        const rawMasterData = await getRows(MASTER_SHEET_NAME, 'A:E');
        const masterList = sheetDataToObjects(rawMasterData, MASTER_HEADERS);
        
        res.status(200).json({
            message: '耗材主檔讀取成功。',
            data: masterList,
        });

    } catch (error) {
        console.error('Error fetching master list:', error);
        res.status(500).json({ message: '無法讀取耗材主檔。', details: error.message });
    }
});


/**
 * 更新耗材成本或名稱 (PUT /api/admin/inventory/update)
 * 實作關鍵的【資料定位與覆蓋式更新】
 */
router.put('/inventory/update', async (req, res) => {
    const { material_id, name, current_cost, current_stock, unit } = req.body;
    
    if (!material_id) {
        return res.status(400).json({ message: '必須提供耗材 ID。' });
    }
    
    try {
        // 1. 讀取所有耗材資料，以找出目標 ID 所在的行數
        const rawMasterData = await getRows(MASTER_SHEET_NAME, 'A:E'); 
        const targetRowIndex = rawMasterData.findIndex(row => row[0] === material_id);
        
        if (targetRowIndex === -1) {
            return res.status(404).json({ message: `未找到 ID 為 ${material_id} 的耗材。` });
        }

        // 2. 準備要更新的新資料行
        // 注意：index 0 是標頭，所以 actualSheetRowIndex = targetRowIndex + 1
        const actualSheetRowIndex = targetRowIndex + 1; 
        const existingRow = rawMasterData[targetRowIndex];
        
        const newRowData = [
            material_id, // A: material_id (保持不變)
            name !== undefined ? name : existingRow[1], // B: name
            unit !== undefined ? unit : existingRow[2], // C: unit
            current_cost !== undefined ? current_cost : existingRow[3], // D: current_cost
            current_stock !== undefined ? current_stock : existingRow[4], // E: current_stock
        ];
        
        // 3. 執行覆蓋式更新
        // 範圍：A[行數] 到 E[行數]
        const updateRange = `A${actualSheetRowIndex}:E${actualSheetRowIndex}`;
        await updateCell(MASTER_SHEET_NAME, updateRange, newRowData);

        res.status(200).json({
            message: `耗材 ${material_id} 設定更新成功。`,
            updated_cost: newRowData[3],
        });

    } catch (error) {
        console.error('Error updating master inventory:', error);
        res.status(500).json({ message: '更新耗材主檔失敗。', details: error.message });
    }
});


// ----------------------------------------------------------------------
// 2. 廠商清單管理 (ADMIN ONLY)
// ----------------------------------------------------------------------

/**
 * 取得所有廠商清單 (GET /api/admin/vendors)
 */
router.get('/vendors', async (req, res) => {
    try {
        const rawVendorData = await getRows(VENDOR_SHEET_NAME, 'A:E');
        // 這裡不需要複雜轉換，直接返回原始數據 (不含標頭)
        res.status(200).json({
            message: '廠商清單讀取成功。',
            data: rawVendorData.slice(1).map(row => ({
                vendor_id: row[0],
                name: row[1],
                contact_person: row[2],
                phone: row[3],
                service_type: row[4],
            })),
        });

    } catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({ message: '無法讀取廠商清單。', details: error.message });
    }
});


/**
 * 新增廠商 (POST /api/admin/vendors/add)
 */
router.post('/vendors/add', async (req, res) => {
    const { name, contact_person, phone, service_type } = req.body;
    
    if (!name || !contact_person) {
        return res.status(400).json({ message: '廠商名稱和聯絡人為必填。' });
    }
    
    try {
        // 簡易 ID 生成：讀取當前行數，生成 VYY-XXX
        const allVendors = await getRows(VENDOR_SHEET_NAME, 'A:A');
        const vendorCount = allVendors.length > 0 ? allVendors.length - 1 : 0;
        const newIndex = vendorCount + 1;
        const paddedIndex = newIndex.toString().padStart(3, '0');
        const newVendorId = `V${moment().tz('Asia/Taipei').format('YY')}-${paddedIndex}`;
        
        const rowData = [
            newVendorId,
            name,
            contact_person,
            phone || '',
            service_type || '',
        ];
        
        await appendRow(VENDOR_SHEET_NAME, rowData);

        res.status(201).json({
            message: `廠商 ${name} (ID: ${newVendorId}) 成功新增。`,
            vendor_id: newVendorId
        });

    } catch (error) {
        console.error('Error adding vendor:', error);
        res.status(500).json({ message: '新增廠商失敗。', details: error.message });
    }
});

module.exports = router;