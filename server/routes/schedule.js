// server/routes/schedule.js

const express = require('express');
const router = express.Router();
const { getRows, appendRow } = require('../utils/sheets'); 

const SCHEDULE_SHEET_NAME = '04_排班日誌';
// 欄位順序：log_id, staff_id, date, shift_type, applied_by
const SCHEDULE_RANGE = 'A:E'; 


/**
 * 取得當前排班日誌中的最大 ID，並生成新的 log_id
 * @returns {Promise<string>} - 新的 log ID (例如: L25-001)
 */
async function generateLogId() {
    try {
        const allLogs = await getRows(SCHEDULE_SHEET_NAME, 'A:A'); // 只讀取 ID 欄位
        
        // 總行數 - 1 (扣除標頭)
        const logCount = allLogs.length > 0 ? allLogs.length - 1 : 0;
        
        const newIndex = logCount + 1;
        const year = new Date().getFullYear().toString().substring(2); 
        
        const paddedIndex = newIndex.toString().padStart(3, '0');
        
        return `L${year}-${paddedIndex}`; 
        
    } catch (error) {
        console.error('Error generating log ID:', error.message);
        throw new Error('無法生成排班日誌 ID。');
    }
}


// ----------------------------------------------------------------------
// 1. 取得排班資訊 (GET)
// ----------------------------------------------------------------------

/**
 * 查詢指定日期範圍內的排班日誌
 * 路由：GET /api/schedule?start_date=2025-12-01&end_date=2025-12-31
 */
router.get('/', async (req, res) => {
    const { start_date, end_date } = req.query; // 取得查詢參數
    
    // TODO: 這裡應該加入日期格式檢查
    
    try {
        // 讀取所有排班日誌，並排除標頭
        const rawScheduleData = await getRows(SCHEDULE_SHEET_NAME, SCHEDULE_RANGE);
        const logHeaders = rawScheduleData[0]; // log_id, staff_id, date, shift_type, applied_by
        const logs = rawScheduleData.slice(1);
        
        const scheduleList = logs.map(row => {
             let obj = {};
             logHeaders.forEach((header, index) => {
                 obj[header] = row[index] || '';
             });
             return obj;
        });

        // 簡單的日期篩選邏輯
        const filteredSchedule = scheduleList.filter(log => {
            if (!start_date || !end_date) return true; // 如果沒有日期參數，返回所有
            const logDate = log.date; 
            // 判斷日期是否在範圍內 (YYYY-MM-DD 格式可以直接字串比較)
            return logDate >= start_date && logDate <= end_date; 
        });


        res.status(200).json({
            message: '排班日誌讀取成功。',
            data: filteredSchedule,
        });

    } catch (error) {
        console.error('Error fetching schedule:', error);
        res.status(500).json({ message: '無法讀取排班日誌。', details: error.message });
    }
});


// ----------------------------------------------------------------------
// 2. 申請休假 (POST - 寫入新的日誌)
// ----------------------------------------------------------------------

/**
 * 處理員工的排假/排班申請
 * 路由：POST /api/schedule/apply
 */
router.post('/apply', async (req, res) => {
    // 登入人員就是申請人
    const { staff_id, name } = req.user; 
    
    // 預期從前端接收的資料：申請日期、排班類型
    const { date, shift_type } = req.body; 
    
    if (!date || !shift_type) {
        return res.status(400).json({ message: '申請日期和排班類型為必填。' });
    }
    
    // 檢查 shift_type 是否有效 (例如：休假, 值班, 備勤)
    const validShiftTypes = ['休假', '值班', '備勤', '特休'];
    if (!validShiftTypes.includes(shift_type)) {
         return res.status(400).json({ message: `無效的排班類型：${shift_type}。` });
    }

    try {
        // 1. 生成新的日誌 ID
        const newLogId = await generateLogId();
        
        // 2. 準備要寫入的資料行 (注意：資料寫入 Sheets 之前，我們沒有檢查重複)
        const rowData = [
            newLogId,        // A: log_id
            staff_id,        // B: staff_id (申請人)
            date,            // C: date (YYYY-MM-DD 格式較佳)
            shift_type,      // D: shift_type
            staff_id,        // E: applied_by (誰提交的)
        ];
        
        // 3. 寫入到 Google Sheets
        await appendRow(SCHEDULE_SHEET_NAME, rowData);
        
        res.status(201).json({
            message: `${name} 的 ${shift_type} 申請已紀錄。`,
            log_id: newLogId,
        });

    } catch (error) {
        console.error('Error applying schedule change:', error);
        res.status(500).json({ 
            message: '排班日誌寫入失敗。', 
            details: error.message 
        });
    }
});

module.exports = router;