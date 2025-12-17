// server/routes/report.js

const express = require('express');
const router = express.Router();
const { getRows } = require('../utils/sheets'); 

// 定義所有需要的 Sheet 名稱
const CASE_SHEET = '02_案件總覽';
const CONTRACT_SHEET = '03_契約書';
const PAYMENT_SHEET = '08_收費明細';
const INVENTORY_LOG_SHEET = '06_耗材日誌';

// ----------------------------------------------------------------------
// 輔助函式：數據轉換與聚合
// ----------------------------------------------------------------------

/**
 * 讀取所有必要的工作表資料
 */
async function loadAllCaseRelatedData() {
    // 執行並行讀取以提高效率
    const [
        caseData,
        contractData,
        paymentData,
        inventoryData
    ] = await Promise.all([
        getRows(CASE_SHEET, 'A:E'), // case_id, 通報日期, 通報人, 服務人員, 案件狀態
        getRows(CONTRACT_SHEET, 'A:F'), // case_id, 服務項目, 服務費用, 合約狀態, 簽訂人員, 簽訂日期
        getRows(PAYMENT_SHEET, 'A:C'), // payment_id, case_id, amount (只需要 ID, Case ID, Amount)
        getRows(INVENTORY_LOG_SHEET, 'B:F') // case_id, material_id, quantity, cost_per_unit, total_cost (只需要 Case ID 和成本相關)
    ]);
    
    return { caseData, contractData, paymentData, inventoryData };
}

/**
 * 將所有獨立的 Sheets 數據整合、計算並返回給前端
 */
function aggregateCaseData({ caseData, contractData, paymentData, inventoryData }) {
    if (caseData.length <= 1) return []; // 沒有案件數據

    const cases = caseData.slice(1);
    const results = [];

    // 1. 建立合同、支付和成本的映射
    const contractMap = new Map(); // Key: case_id -> { totalFee, contractStatus }
    const paymentMap = new Map();   // Key: case_id -> totalPaid
    const inventoryCostMap = new Map(); // Key: case_id -> totalCost

    // 處理合同數據
    contractData.slice(1).forEach(row => {
        const case_id = row[0]; // A 欄
        const totalFee = parseFloat(row[2]) || 0; // C 欄: 服務費用
        const contractStatus = row[3] || '未簽訂'; // D 欄: 合約狀態

        // 由於一個案件可能有多個合同草稿，我們暫時取最新的（最後一筆寫入的）或只取已簽訂的最高金額
        // 這裡為了簡單，我們只取第一筆遇到的合同資訊作為預期收入。
        if (!contractMap.has(case_id)) { 
            contractMap.set(case_id, { 
                totalFee, 
                contractStatus 
            });
        }
    });
    
    // 處理支付數據 (累計已收金額)
    paymentData.slice(1).forEach(row => {
        const case_id = row[1]; // B 欄
        const amount = parseFloat(row[2]) || 0; // C 欄: amount
        paymentMap.set(case_id, (paymentMap.get(case_id) || 0) + amount);
    });
    
    // 處理耗材成本數據 (累計總成本)
    inventoryData.slice(1).forEach(row => {
        const case_id = row[0]; // B 欄
        const totalCost = parseFloat(row[4]) || 0; // F 欄: total_cost
        inventoryCostMap.set(case_id, (inventoryCostMap.get(case_id) || 0) + totalCost);
    });

    // 2. 整合案件數據並計算指標
    cases.forEach(row => {
        const case_id = row[0];
        const contractInfo = contractMap.get(case_id) || {};
        const totalPaid = paymentMap.get(case_id) || 0;
        const totalCost = inventoryCostMap.get(case_id) || 0;
        const totalFee = contractInfo.totalFee || 0;
        
        // 核心計算：淨收益 = 總費用 - 總成本
        const netProfit = totalFee - totalCost;
        // 收益比 = (淨收益 / 總費用) * 100% (避免除以零)
        const profitMargin = totalFee > 0 ? (netProfit / totalFee) * 100 : 0;

        results.push({
            case_id: case_id,
            通報日期: row[1],
            通報人: row[2],
            服務人員: row[3],
            案件狀態: row[4],
            
            // 財務指標
            契約費用: totalFee,
            耗材成本: totalCost,
            已收金額: totalPaid,
            未收金額: totalFee - totalPaid,
            淨收益: netProfit,
            收益比: profitMargin.toFixed(2) + '%' // 保留兩位小數
        });
    });

    return results;
}

// ----------------------------------------------------------------------
// 1. 取得所有案件彙報資訊 (GET)
// ----------------------------------------------------------------------

/**
 * 取得所有案件的整合數據和彙報指標
 * 路由：GET /api/report/cases
 */
router.get('/cases', async (req, res) => {
    try {
        const allData = await loadAllCaseRelatedData();
        const aggregatedResults = aggregateCaseData(allData);

        res.status(200).json({
            message: '案件彙報數據讀取與聚合成功。',
            data: aggregatedResults.reverse(), // 最新案件在前
        });

    } catch (error) {
        console.error('Error in report aggregation:', error);
        res.status(500).json({ 
            message: '數據彙報失敗。', 
            details: error.message 
        });
    }
});

// ----------------------------------------------------------------------
// 2. 綜合查詢 (GET - 篩選)
// ----------------------------------------------------------------------

/**
 * 綜合查詢，可根據 case_id 進行篩選
 * 路由：GET /api/report/query?case_id=P25-001
 */
router.get('/query', async (req, res) => {
    const { case_id } = req.query; // 取得查詢參數
    
    try {
        const allData = await loadAllCaseRelatedData();
        let aggregatedResults = aggregateCaseData(allData);

        if (case_id) {
            aggregatedResults = aggregatedResults.filter(item => 
                item.case_id.includes(case_id.toUpperCase())
            );
        }

        if (aggregatedResults.length === 0) {
            return res.status(404).json({ message: '未找到符合條件的案件。' });
        }

        res.status(200).json({
            message: '綜合查詢成功。',
            data: aggregatedResults,
        });

    } catch (error) {
        console.error('Error in general query:', error);
        res.status(500).json({ 
            message: '綜合查詢失敗。', 
            details: error.message 
        });
    }
});

module.exports = router;