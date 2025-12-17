// server/routes/contracts.js

const express = require('express');
const router = express.Router();
const { appendRow } = require('../utils/sheets'); 

const CONTRACT_SHEET_NAME = '03_契約書';

/**
 * 【新增契約書】 處理前端提交的契約書內容與費用計算
 */
router.post('/add', async (req, res) => {
    // req.user 包含了從 JWT 解碼出來的登入人員資訊
    // 這裡使用 staff_id 和 name 來記錄簽訂人員
    const { staff_id, name } = req.user; 
    
    // 預期從前端接收的資料：case_id, items (服務項目陣列), contract_status
    const { case_id, items, contract_status = '待簽訂' } = req.body; 

    if (!case_id || !items || items.length === 0) {
        return res.status(400).json({ message: '案件 ID 和契約項目列表不能為空。' });
    }

    try {
        // 1. 執行核心計算邏輯
        let totalFee = 0;
        let serviceSummary = []; // 用於 Sheets 摘要顯示

        for (const item of items) {
            // item 結構預期 { description: string, price: number, quantity: number }
            const subtotal = (item.price || 0) * (item.quantity || 1);
            totalFee += subtotal;
            // 摘要格式：項目名稱 (總價)
            serviceSummary.push(`${item.description} (NT$${subtotal.toLocaleString()})`);
        }
        
        // 將服務項目摘要為一個字串
        const summaryString = serviceSummary.join('; '); 

        // 2. 準備寫入契約書工作表 (03_契約書) 的資料
        const dateString = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }); 
        
        // 注意：rowData 的順序必須與 Sheets 的欄位順序 (case_id, 服務項目, 服務費用, 合約狀態, 簽訂人員, 簽訂日期) 一致
        const rowData = [
            case_id,                     // A: case_id (連結到 02_案件總覽)
            summaryString,               // B: 服務項目 (摘要)
            totalFee,                    // C: 服務費用 (總價)
            contract_status,             // D: 合約狀態
            `${name} (${staff_id})`,     // E: 簽訂人員
            dateString,                  // F: 簽訂日期
        ];
        
        // 3. 寫入到 Google Sheets 
        await appendRow(CONTRACT_SHEET_NAME, rowData);
        
        res.status(201).json({
            message: `案件 ${case_id} 的契約書草稿已成功建立。`,
            total_fee: totalFee,
            summary: summaryString
        });

    } catch (error) {
        console.error('Error adding contract:', error);
        res.status(500).json({ 
            message: '新增契約書失敗。', 
            details: error.message 
        });
    }
});

module.exports = router;