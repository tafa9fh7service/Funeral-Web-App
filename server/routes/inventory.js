// server/routes/inventory.js

const express = require('express');
const router = express.Router();
const { getRows, appendRow, updateCell } = require('../utils/sheets'); 
const moment = require('moment-timezone');

const MASTER_SHEET_NAME = '07_耗材主檔';
const LOG_SHEET_NAME = '06_耗材日誌';
// 耗材主檔欄位：material_id, name, unit, current_cost, current_stock
const MASTER_HEADERS = ['material_id', 'name', 'unit', 'current_cost', 'current_stock'];


/**
 * 取得當前日誌中的最大 ID，並生成新的 log_id
 * @returns {Promise<string>} - 新的日誌 ID (例如: J25-001, J=Journal)
 */
async function generateLogId() {
    try {
        const allLogs = await getRows(LOG_SHEET_NAME, 'A:A');
        const logCount = allLogs.length > 0 ? allLogs.length - 1 : 0;
        
        const newIndex = logCount + 1;
        const year = moment().tz('Asia/Taipei').format('YY');
        
        const paddedIndex = newIndex.toString().padStart(3, '0');
        
        return `J${year}-${paddedIndex}`; 
        
    } catch (error) {
        console.error('Error generating log ID:', error.message);
        throw new Error('無法生成日誌 ID。');
    }
}


/**
 * 將 Sheets 讀取的二維陣列資料轉換為物件陣列 (通用轉換器)
 * @param {Array<Array<any>>} data - Sheets API 返回的資料
 * @param {Array<string>} headers - 預期的欄位名稱
 * @returns {Array<Object>} - 包含欄位名稱的物件陣列
 */
function sheetDataToObjects(data, headers) {
    if (!data || data.length < 2) return []; 
    // 忽略第一行（可能是標頭，也可能不是，但我們用傳入的 headers 確保一致性）
    const dataRows = data.slice(1); 

    return dataRows.map(row => {
        let obj = {};
        headers.forEach((key, index) => {
            // 處理數字欄位，確保是數字類型
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
// 1. 取得耗材主檔 (GET)
// ----------------------------------------------------------------------

/**
 * 取得所有耗材的主檔清單，供前端選擇
 * 路由：GET /api/inventory/master
 */
router.get('/master', async (req, res) => {
    try {
        // 嘗試讀取資料
        const rawMasterData = await getRows(MASTER_SHEET_NAME, 'A:E');
        
        if (!rawMasterData || rawMasterData.length === 0) {
            // 如果讀到空資料，通常是工作表名稱或範圍錯誤
            return res.status(500).json({ 
                message: `耗材主檔讀取失敗：工作表 ${MASTER_SHEET_NAME} 可能是空的，或工作表名稱不正確。`
            });
        }
        
        // 如果讀取成功，則進行轉換
        const masterList = sheetDataToObjects(rawMasterData, MASTER_HEADERS);
        
        res.status(200).json({
            message: '耗材主檔讀取成功。',
            data: masterList,
        });

    } catch (error) {
        console.error('Error fetching master list:', error);
        // 將 Sheets API 拋出的錯誤訊息返回給前端
        res.status(500).json({ 
            message: '耗材主檔讀取時發生連線錯誤，請檢查工作表名稱或權限。', 
            details: error.message // <-- 關鍵診斷信息
        });
    }
});


// ----------------------------------------------------------------------
// 2. 記錄耗材消耗 (POST)
// ----------------------------------------------------------------------

/**
 * 處理單一案件的耗材消耗記錄
 * 路由：POST /api/inventory/consume
 */
router.post('/consume', async (req, res) => {
    const { staff_id } = req.user; 
    
    // 預期從前端接收的資料
    const { case_id, items } = req.body; // items 是 [{ material_id, quantity }] 陣列

    if (!case_id || !items || items.length === 0) {
        return res.status(400).json({ message: '案件 ID 和消耗項目為必填。' });
    }

    try {
        // 1. 讀取耗材主檔以鎖定成本和更新庫存
        const rawMasterData = await getRows(MASTER_SHEET_NAME, 'A:E');
        const masterList = sheetDataToObjects(rawMasterData, MASTER_HEADERS);
        
        let writeLogRows = [];
        let totalCost = 0;
        const transactionDate = moment().tz('Asia/Taipei').format('YYYY-MM-DD HH:mm:ss');
        
        // 為了更新庫存，建立一個 Master ID 到其 Sheets Row Index 的映射
        // 由於 Sheets API 的 getRows 響應包含標頭行，所以 index 要 +1 (實際行數是 index + 2)
        const masterIndexMap = rawMasterData.slice(1).reduce((acc, row, index) => {
             acc[row[0]] = index + 2; // 實際行數
             return acc;
        }, {});
        
        let updateStockRequests = []; // 準備儲存庫存更新請求

        for (const item of items) {
            const masterItem = masterList.find(m => m.material_id === item.material_id);
            const consumedQuantity = parseInt(item.quantity);

            if (!masterItem) {
                return res.status(404).json({ message: `耗材 ID ${item.material_id} 不存在於主檔。` });
            }
            if (consumedQuantity <= 0) continue;

            // 鎖定成本 (Cost Lock)
            const costPerUnit = masterItem.current_cost;
            const itemTotalCost = costPerUnit * consumedQuantity;
            totalCost += itemTotalCost;
            
            // 寫入日誌行
            const logRow = [
                await generateLogId(), // log_id
                case_id,              // case_id
                item.material_id,     // material_id
                consumedQuantity,     // quantity
                costPerUnit,          // cost_per_unit (鎖定值)
                itemTotalCost,        // total_cost
                transactionDate,      // transaction_date
                staff_id              // staff_id
            ];
            writeLogRows.push(logRow);

            // 計算新的庫存
            const newStock = masterItem.current_stock - consumedQuantity;
            
            // 準備庫存更新請求 (更新 E 欄)
            const masterRowIndex = masterIndexMap[item.material_id];
            if (masterRowIndex) {
                 // updateCell 函式只需要 A1 Notation (例如: 'E2') 和新值
                 const updateRange = `E${masterRowIndex}`; 
                 updateStockRequests.push({ range: updateRange, value: newStock });
            }
        }
        
        // 2. 執行所有 Sheets 寫入操作
        
        // 寫入耗材日誌 (批量寫入以提高效率，雖然 appendRow 是單行操作，但這裡是陣列)
        for (const logRow of writeLogRows) {
            await appendRow(LOG_SHEET_NAME, logRow);
        }

        // 更新耗材主檔的庫存 (批量更新)
        // 註：Sheets API 支援批量更新，但為了保持 sheets.js 簡單，我們暫時使用迴圈單獨呼叫 updateCell。
        for (const req of updateStockRequests) {
            await updateCell(MASTER_SHEET_NAME, req.range, req.value);
        }

        res.status(201).json({
            message: `案件 ${case_id} 的 ${writeLogRows.length} 筆耗材消耗記錄成功建立。總成本: ${totalCost}`,
            total_cost: totalCost,
        });

    } catch (error) {
        console.error('Error consuming inventory:', error);
        res.status(500).json({ 
            message: '記錄耗材消耗失敗。', 
            details: error.message 
        });
    }
});

module.exports = router;