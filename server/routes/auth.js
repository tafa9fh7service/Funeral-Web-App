// server/routes/auth.js (完整替換)

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getRows } = require('../utils/sheets');

const STAFF_SHEET = '01_人員清單';

// 登入 API
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // 抓取 A 欄到 F 欄 (含新增的密碼欄)
        const rows = await getRows(STAFF_SHEET, 'A:F');
        
        // 尋找工號符合的使用者
        const userRow = rows.find(row => row[0] === username);

        if (!userRow) {
            return res.status(401).json({ message: '帳號不存在' });
        }

        // 驗證 F 欄 (密碼)
        // 注意：這裡假設密碼在 F 欄 (索引值為 5)
        const dbPassword = userRow[5];

        if (dbPassword !== password) {
            return res.status(401).json({ message: '密碼錯誤' });
        }

        // 登入成功，封裝使用者資訊
        const user = {
            staff_id: userRow[0],
            name: userRow[1],
            role: userRow[3]
        };

        // 產生 JWT Token
        const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.json({
            message: '登入成功',
            token,
            user
        });

    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
});

// JWT 驗證中介層 (供其他路由使用)
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: '缺少認證憑證' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: '憑證無效或已過期' });
        req.user = user;
        next();
    });
}

module.exports = { router, verifyToken };