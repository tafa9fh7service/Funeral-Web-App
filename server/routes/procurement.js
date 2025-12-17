// server/routes/procurement.js

const express = require('express');
const router = express.Router();
const { getRows, appendRow, updateCell } = require('../utils/sheets'); 
const moment = require('moment-timezone');

const PROCUREMENT_SHEET = '10_採購日誌';
const MASTER_SHEET = '07_耗材主檔';

// ----------------------------------------------------------------------
// 1. 提交採購單 (進貨)
// ----------------------------------------------------------------------
router.post('/restock', async (req, res) => {
    const { staff_id } = req.user;
    const { vendor_id, material_id, quantity, unit_cost } = req.body;

    if (!vendor_id || !material_id || !quantity || !unit_cost) {
        return res.status(400).json({ message: '廠商、耗材、數量與單價皆為必填。' });
    }

    const qty = parseInt(quantity);
    const cost = parseFloat(unit_cost);
    
    if (qty <= 0 || cost < 0) {
        return res.status(400).json({ message: '數量必須大於 0，成本不能為負。' });
    }

    try {
        // --- A. 生成採購單號 ---
        const logs = await getRows(PROCUREMENT_SHEET, 'A:A');
        const count = logs.length > 0 ? logs.length - 1 : 0; // 扣除標頭
        const newId = `PR${moment().tz('Asia/Taipei').format('YYMM')}-${(count + 1).toString().padStart(3, '0')}`;
        const date = moment().tz('Asia/Taipei').format('YYYY-MM-DD HH:mm:ss');

        // --- B. 寫入採購日誌 ---
        const logData = [
            newId,          // A: id
            date,           // B: date
            vendor_id,      // C: vendor
            material_id,    // D: material
            qty,            // E: quantity
            cost,           // F: unit_cost
            qty * cost,     // G: total_cost
            staff_id        // H: staff
        ];
        await appendRow(PROCUREMENT_SHEET, logData);

        // --- C. 更新主檔庫存與成本 ---
        // 1. 讀取主檔以找到該耗材的行數與當前庫存
        const masterData = await getRows(MASTER_SHEET, 'A:E');
        // masterData 結構: [id, name, unit, current_cost, current_stock]
        
        const rowIndex = masterData.findIndex(row => row[0] === material_id);
        
        if (rowIndex === -1) {
            return res.status(404).json({ message: '找不到指定的耗材 ID，無法更新庫存。' });
        }

        const actualRow = rowIndex + 1; // 試算表列號 (從1開始)
        const currentStock = parseInt(masterData[rowIndex][4]) || 0;
        const newStock = currentStock + qty;

        // 我們同時更新「當前成本」為最新的進貨價 (Last-In Price)
        // 更新範圍：D欄(成本) 到 E欄(庫存)
        const range = `D${actualRow}:E${actualRow}`;
        const updateValues = [[cost, newStock]];

        await updateCell(MASTER_SHEET, range, updateValues);

        res.status(201).json({
            message: '採購進貨成功！庫存已更新。',
            procurement_id: newId,
            new_stock: newStock,
            new_cost: cost
        });

    } catch (error) {
        console.error('Procurement error:', error);
        res.status(500).json({ message: '採購作業失敗。', details: error.message });
    }
});

// ----------------------------------------------------------------------
// 2. 查詢採購歷史 (GET)
// ----------------------------------------------------------------------
router.get('/history', async (req, res) => {
    try {
        const rawData = await getRows(PROCUREMENT_SHEET, 'A:H');
        const history = rawData.slice(1).map(row => ({
            id: row[0],
            date: row[1],
            vendor: row[2],
            material: row[3],
            qty: row[4],
            cost: row[5],
            total: row[6],
            staff: row[7]
        })).reverse(); // 最新的在前面

        res.status(200).json({ data: history });
    } catch (error) {
        res.status(500).json({ message: '無法讀取採購紀錄。' });
    }
});

module.exports = router;