// server/routes/cases.js (新增案件寫入功能)

const express = require('express');
const router = express.Router();
const { getRows, appendRow } = require('../utils/sheets'); // 引入寫入函式

const CASES_SHEET_NAME = '02_案件總覽';
const CASES_RANGE = 'A:E'; // 案件ID、通報日期、通報人、服務人員、案件狀態

/**
 * 根據試算表中的現有案件數生成新的案件 ID
 * 格式：P25-XXX (P=Project, 25=年份, XXX=流水號)
 * @returns {Promise<string>} - 新的案件 ID
 */
async function generateCaseId() {
    try {
        // 讀取所有案件 (包括標頭)
        const allCases = await getRows(CASES_SHEET_NAME, CASES_RANGE);
        
        // 案件數 = 總行數 - 1 (扣除標頭行)
        // 注意：如果工作表是空的，allCases.length 會是 0 或 1 (取決於Sheets API如何處理空表)
        let caseCount = allCases.length > 0 ? allCases.length - 1 : 0;
        
        // 如果工作表只有標頭 (總長度=1)，則案件數為 0
        if (allCases.length === 1 && allCases[0][0] === 'case_id') {
             caseCount = 0;
        }

        const newIndex = caseCount + 1;
        const year = new Date().getFullYear().toString().substring(2); // 例如：2025 -> 25
        
        // 格式化流水號，確保是三位數 (001, 002...)
        const paddedIndex = newIndex.toString().padStart(3, '0');
        
        return `P${year}-${paddedIndex}`; // P25-001
        
    } catch (error) {
        console.error('Error generating case ID:', error.message);
        throw new Error('無法生成案件 ID，請檢查 Sheets API 連線。');
    }
}


// ** 受保護路由 - 取得案件總覽 (保持不變) **
// 取得所有案件總覽 (範例: 接案通報列表)
router.get('/', async (req, res) => {
    // req.user 包含了從 JWT 解碼出來的使用者資訊
    console.log('User accessing cases:', req.user); 
    
    try {
        // 實際讀取 '02_案件總覽' 工作表，並排除標頭
        const rawCaseData = await getRows(CASES_SHEET_NAME, CASES_RANGE);
        const cases = rawCaseData.slice(1).map(row => ({
            case_id: row[0],
            通報日期: row[1],
            通報人: row[2],
            服務人員: row[3],
            案件狀態: row[4],
        }));

        res.status(200).json({
            message: '案件總覽列表讀取成功。',
            cases: cases.reverse() // 最新案件優先顯示
        });

    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(500).json({ message: '無法讀取案件資料。', details: error.message });
    }
});


// ** 【新增】受保護路由 - 處理新接案單提交 **
router.post('/add', async (req, res) => {
    // 透過 req.user 取得當前操作的員工資訊
    const { email, staff_id, name } = req.user; 
    
    // 取得前端傳來的接案資料
    const { 通報人, 服務人員 } = req.body; 
    
    if (!通報人 || !服務人員) {
        return res.status(400).json({ message: '通報人或服務人員資訊缺失。' });
    }
    
    try {
        // 1. 生成新的案件 ID
        const newCaseId = await generateCaseId();
        
        // 2. 準備要寫入的資料行 (確保順序與 Sheets 的欄位順序一致)
        const dateString = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }); // 確保時間正確
        
        const rowData = [
            newCaseId,              // A: case_id
            dateString,             // B: 通報日期
            通報人,                  // C: 通報人 (通常是家屬或醫院)
            服務人員,                // D: 服務人員 (誰負責此案)
            '新接案',               // E: 案件狀態 (初始狀態)
        ];
        
        // 3. 寫入到 Google Sheets
        await appendRow(CASES_SHEET_NAME, rowData);
        
        res.status(201).json({
            message: `案件 ${newCaseId} 成功建立並通報。`,
            case_id: newCaseId,
            通報人: 通報人
        });

    } catch (error) {
        console.error('Error adding new case:', error);
        res.status(500).json({ 
            message: '新增案件失敗。', 
            details: error.message 
        });
    }
});

module.exports = router;