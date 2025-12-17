// server/routes/reminder.js

const express = require('express');
const router = express.Router();
const { getRows, appendRow, updateCell } = require('../utils/sheets'); 
const moment = require('moment-timezone'); // 引入 Moment.js 處理時間計算

const REMINDER_SHEET_NAME = '05_提醒列表';
const REMINDER_RANGE = 'A:G'; 

/**
 * 取得當前提醒列表中的最大 ID，並生成新的 reminder_id
 * @returns {Promise<string>} - 新的提醒 ID (例如: R25-001)
 */
async function generateReminderId() {
    try {
        const allReminders = await getRows(REMINDER_SHEET_NAME, 'A:A'); // 只讀取 ID 欄位
        
        const reminderCount = allReminders.length > 0 ? allReminders.length - 1 : 0;
        
        const newIndex = reminderCount + 1;
        const year = moment().tz('Asia/Taipei').format('YY'); // 取得台灣時區年份
        
        const paddedIndex = newIndex.toString().padStart(3, '0');
        
        return `R${year}-${paddedIndex}`; 
        
    } catch (error) {
        console.error('Error generating reminder ID:', error.message);
        throw new Error('無法生成提醒 ID。');
    }
}


// ----------------------------------------------------------------------
// 1. 取得提醒列表 (GET)
// ----------------------------------------------------------------------

/**
 * 查詢所有或特定案件的提醒列表
 * 路由：GET /api/reminder?case_id=P25-001
 */
router.get('/', async (req, res) => {
    const { case_id } = req.query; // 可選：案件 ID 篩選
    
    try {
        const rawReminderData = await getRows(REMINDER_SHEET_NAME, REMINDER_RANGE);
        // 如果只有標頭，返回空陣列
        if (rawReminderData.length <= 1) {
            return res.status(200).json({ message: '提醒列表讀取成功。', data: [] });
        }
        
        const reminderHeaders = rawReminderData[0]; 
        const reminders = rawReminderData.slice(1).map(row => {
             let obj = {};
             reminderHeaders.forEach((header, index) => {
                 obj[header] = row[index] || '';
             });
             return obj;
        });

        // 篩選邏輯
        const filteredReminders = reminders.filter(r => {
            if (case_id && r.case_id !== case_id) return false;
            return r.status !== '完成' && r.status !== '忽略'; // 預設只顯示未完成或未忽略的
        });


        res.status(200).json({
            message: '提醒列表讀取成功。',
            data: filteredReminders,
        });

    } catch (error) {
        console.error('Error fetching reminders:', error);
        res.status(500).json({ message: '無法讀取提醒列表。', details: error.message });
    }
});


// ----------------------------------------------------------------------
// 2. 新增提醒 (POST - 手動或自動)
// ----------------------------------------------------------------------

/**
 * 處理新增提醒請求
 * 路由：POST /api/reminder/add
 */
router.post('/add', async (req, res) => {
    const { staff_id } = req.user; 
    
    // 預期從前端接收的資料
    const { case_id, reminder_date, category, content } = req.body; 
    
    if (!case_id || !reminder_date || !content) {
        return res.status(400).json({ message: '案件 ID、提醒日期和內容為必填。' });
    }

    try {
        const newReminderId = await generateReminderId();
        
        // 準備寫入資料行
        const rowData = [
            newReminderId,        // A: reminder_id
            case_id,              // B: case_id 
            reminder_date,        // C: reminder_date (YYYY-MM-DD)
            category || '手動追蹤', // D: category
            content,              // E: content
            '待辦',               // F: status (初始狀態)
            staff_id,             // G: created_by
        ];
        
        await appendRow(REMINDER_SHEET_NAME, rowData);
        
        res.status(201).json({
            message: `提醒 ${newReminderId} 已成功建立。`,
            reminder_id: newReminderId,
        });

    } catch (error) {
        console.error('Error adding reminder:', error);
        res.status(500).json({ 
            message: '新增提醒失敗。', 
            details: error.message 
        });
    }
});


// ----------------------------------------------------------------------
// 3. 規劃流程時間計算機 (POST - 輔助計算)
// ----------------------------------------------------------------------
// 註：這是一個輔助功能，不需要寫入 Sheets，只負責計算日期

/**
 * 計算指定日期 (例如：往生/出殯日) 的百日、對年等日期
 * 路由：POST /api/reminder/calculate-date
 */
router.post('/calculate-date', async (req, res) => {
    const { start_date, type } = req.body; 
    
    if (!start_date || !type) {
        return res.status(400).json({ message: '請提供起始日期和計算類型。' });
    }
    
    // 使用 Moment.js 處理時間計算，並設定台灣時區
    const startDate = moment.tz(start_date, 'YYYY-MM-DD', 'Asia/Taipei');
    
    if (!startDate.isValid()) {
        return res.status(400).json({ message: '無效的起始日期格式，請使用 YYYY-MM-DD。' });
    }

    let calculatedDate = null;
    let label = '';
    
    // 

    switch (type) {
        case '百日':
            // 傳統習俗：往生後第100天
            calculatedDate = startDate.add(99, 'days'); 
            label = '百日 (第100天)';
            break;
        case '對年':
            // 傳統習俗：往生後滿一年，減一天。但現代常指滿一年當天。這裡以滿一年當天計算。
            calculatedDate = startDate.clone().add(1, 'years');
            label = '對年 (滿一年當日)';
            break;
        case '七七':
            // 往生後第49天
            calculatedDate = startDate.add(48, 'days');
            label = '七七 (滿七周)';
            break;
        case '滿三年':
             // 傳統習俗：三年後
            calculatedDate = startDate.clone().add(3, 'years');
            label = '滿三年';
            break;
        default:
            return res.status(400).json({ message: `不支援的計算類型：${type}` });
    }

    // 將結果格式化為 YYYY-MM-DD
    const resultDate = calculatedDate.format('YYYY-MM-DD');

    res.status(200).json({
        message: `${label} 計算成功`,
        start_date: start_date,
        type: type,
        result_date: resultDate,
    });
});

module.exports = router;