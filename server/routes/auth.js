// server/routes/auth.js

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getRows } = require('../utils/sheets'); // 引入 Sheets 工具

// 設定工作表名稱和欄位
const STAFF_SHEET_NAME = '01_人員清單';
// 試算表的欄位順序：staff_id, name, email, role, status
const STAFF_HEADERS = ['staff_id', 'name', 'email', 'role', 'status']; 
const STAFF_RANGE = 'A:E'; // 讀取 A 到 E 欄位

/**
 * 將 Sheets 讀取的二維陣列資料轉換為物件陣列
 * @param {Array<Array<any>>} data - Sheets API 返回的資料
 * @returns {Array<Object>} - 包含欄位名稱的物件陣列
 */
function sheetDataToObject(data) {
    if (!data || data.length < 2) return []; // 確保有標頭和至少一行資料

    const [headerRow, ...dataRows] = data; // 標頭是第一行，其餘是資料

    return dataRows.map(row => {
        let obj = {};
        // 遍歷預設的 STAFF_HEADERS 欄位，並對應到該行的值
        // 我們使用預設的 STAFF_HEADERS 來確保即使Sheets標頭有錯，程式碼也能按預期欄位處理
        STAFF_HEADERS.forEach((key, index) => {
            obj[key] = row[index] || ''; // 如果該欄位為空，則設定為空字串
        });
        return obj;
    }).filter(obj => obj.status === 'Active'); // 只處理狀態為 'Active' 的員工
}


// 


router.post('/login', async (req, res) => {
    const { email, password } = req.body; // 密碼目前不檢查，未來優化時使用

    if (!email) {
        return res.status(400).json({ message: '請輸入電子郵件。' });
    }

    try {
        // 1. 從 Google Sheets 讀取所有員工資料 (A:E 欄位)
        const rawStaffData = await getRows(STAFF_SHEET_NAME, STAFF_RANGE);
        
        // 2. 轉換為易於處理的物件格式，並過濾狀態
        const staffList = sheetDataToObject(rawStaffData);
        
        // 3. 查找是否有符合的員工
        const user = staffList.find(staff => staff.email.toLowerCase() === email.toLowerCase());

        // ** 實際密碼驗證邏輯 (目前跳過) **
        // if (!user || user.password !== hash(password)) { ... } 
        // 由於 Google Sheets 不適合儲存 Hashed 密碼，我們目前只驗證 Email 存在性

        if (user) {
            // 找到使用者且狀態為 Active (已在 sheetDataToObject 內過濾)

            // 建立 JWT Token
            const token = jwt.sign({ 
                staff_id: user.staff_id, 
                email: user.email, 
                role: user.role 
            }, process.env.JWT_SECRET, { expiresIn: '1h' });

            return res.status(200).json({
                message: '登入成功，已從 Google Sheets 驗證。',
                token: token,
                user: { staff_id: user.staff_id, name: user.name, role: user.role }
            });

        } else {
            // 未找到使用者
            return res.status(401).json({ 
                message: '無效的帳號或權限不足，請聯繫管理員。' 
            });
        }

    } catch (error) {
        console.error('Login processing error:', error);
        return res.status(500).json({ 
            message: '伺服器內部錯誤，無法連接資料庫或讀取資料。', 
            details: error.message 
        });
    }
});

module.exports = router;