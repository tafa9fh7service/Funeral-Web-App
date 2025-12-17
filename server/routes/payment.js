// server/routes/payment.js

const express = require('express');
const router = express.Router();
const { getRows, appendRow, updateCell } = require('../utils/sheets'); 
const moment = require('moment-timezone');

const PAYMENT_SHEET_NAME = '08_收費明細';
const CONTRACT_SHEET_NAME = '03_契約書'; // 需要讀取契約書總價

/**
 * 取得當前收費日誌中的最大 ID，並生成新的 payment_id
 * @returns {Promise<string>} - 新的收費 ID (例如: PYL25-001, PY=Payment Log)
 */
async function generatePaymentId() {
    try {
        const allLogs = await getRows(PAYMENT_SHEET_NAME, 'A:A');
        const logCount = allLogs.length > 0 ? allLogs.length - 1 : 0;
        
        const newIndex = logCount + 1;
        const year = moment().tz('Asia/Taipei').format('YY');
        
        const paddedIndex = newIndex.toString().padStart(3, '0');
        
        return `PYL${year}-${paddedIndex}`; 
        
    } catch (error) {
        console.error('Error generating payment ID:', error.message);
        throw new Error('無法生成收費 ID。');
    }
}


// ----------------------------------------------------------------------
// 1. 記錄客戶收費 (POST)
// ----------------------------------------------------------------------

/**
 * 處理客戶收費記錄，並寫入日誌
 * 路由：POST /api/payment/record
 */
router.post('/record', async (req, res) => {
    const { staff_id } = req.user; 
    
    // 預期從前端接收的資料
    const { case_id, amount, type, payment_method } = req.body; 

    if (!case_id || !amount || !type || !payment_method) {
        return res.status(400).json({ message: '案件 ID、金額、類型和支付方式為必填。' });
    }
    
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
         return res.status(400).json({ message: '金額必須是有效的正數。' });
    }

    try {
        // 1. 生成新的收費 ID
        const newPaymentId = await generatePaymentId();
        
        const transactionDate = moment().tz('Asia/Taipei').format('YYYY-MM-DD HH:mm:ss');
        
        // 2. 準備要寫入的資料行 (寫入 08_收費明細)
        // 欄位順序：payment_id, case_id, amount, type, payment_method, status, transaction_date, recorded_by
        const rowData = [
            newPaymentId,        // A: payment_id
            case_id,             // B: case_id
            parsedAmount,        // C: amount
            type,                // D: type (預付/尾款/超支)
            payment_method,      // E: payment_method
            '成功',              // F: status (預設成功)
            transactionDate,     // G: transaction_date
            staff_id             // H: recorded_by
        ];
        
        await appendRow(PAYMENT_SHEET_NAME, rowData);
        
        // TODO: 【優化】這裡應該呼叫另一個函式來計算並更新 '03_契約書' 中的繳費狀態

        res.status(201).json({
            message: `案件 ${case_id} 的 ${type} 收費記錄成功。`,
            payment_id: newPaymentId,
            amount: parsedAmount
        });

    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ 
            message: '記錄收費明細失敗。', 
            details: error.message 
        });
    }
});


// ----------------------------------------------------------------------
// 2. 取得案件收費紀錄 (GET)
// ----------------------------------------------------------------------

/**
 * 取得單一案件的所有收費紀錄
 * 路由：GET /api/payment/case/:case_id
 */
router.get('/case/:case_id', async (req, res) => {
    const { case_id } = req.params;
    
    try {
        // 假設收費明細的欄位順序為：payment_id, case_id, amount, type, method, status, date, recorded_by
        const rawPaymentData = await getRows(PAYMENT_SHEET_NAME, 'A:H');
        // 忽略標頭行
        const paymentLogs = rawPaymentData.slice(1).filter(row => row[1] === case_id); 
        
        const payments = paymentLogs.map(row => ({
            payment_id: row[0],
            amount: parseFloat(row[2]) || 0,
            type: row[3],
            payment_method: row[4],
            status: row[5],
            transaction_date: row[6],
            recorded_by: row[7]
        }));
        
        res.status(200).json({
            message: `案件 ${case_id} 的收費記錄讀取成功。`,
            data: payments,
        });

    } catch (error) {
        console.error('Error fetching payment logs:', error);
        res.status(500).json({ message: '無法讀取收費明細。', details: error.message });
    }
});

module.exports = router;