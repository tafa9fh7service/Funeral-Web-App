// server/app.js

// 引入所需的模組
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

// 讀取環境變數 (例如：PORT, JWT_SECRET)
dotenv.config(); 

const app = express();
const PORT = process.env.PORT || 3000;

// 設定 CORS，允許前端從不同埠號存取
app.use(cors({
    origin: '*', // 在開發階段允許所有來源，部署後建議改為您的前端網址
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// 設定 Express 處理 JSON 格式的請求體
app.use(express.json());

// ------------------------------------------------------------------
// 身份驗證中介層 (Middleware)
// 檢查請求 Header 中是否有有效的 JWT
// ------------------------------------------------------------------
const verifyToken = (req, res, next) => {
    // 從 Header 取得 Token (通常格式為: "Bearer <token>")
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // 如果沒有 Token 或格式不對，回傳 401 Unauthorized
        return res.status(401).json({ message: 'Authorization token missing or invalid format.' });
    }

    // 取得真正的 Token 字串
    const token = authHeader.split(' ')[1]; 
    
    try {
        // 驗證 Token 的有效性
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // 將解碼後的資訊 (例如：email, staff_id, role) 儲存到 req 物件中
        req.user = decoded; 
        next(); // 繼續執行後續的路由處理函式
    } catch (error) {
        // 驗證失敗 (例如：Token 過期或密鑰不匹配)
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
};


// ------------------------------------------------------------------
// 路由設定 (Routes)
// ------------------------------------------------------------------

// 基礎測試路由
app.get('/', (req, res) => {
    res.send('喪禮服務系統 API Server 正在運行...');
});

// ** 公開路由 **
// 引入認證相關路由 (例如：登入)
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);


// ** 受保護路由 - 需通過 verifyToken 檢查 **

// 引入案件相關路由 (案件列表, 接案單新增)
const caseRoutes = require('./routes/cases');
app.use('/api/cases', verifyToken, caseRoutes);

// 引入契約書相關路由 (契約書計算與儲存)
const contractRoutes = require('./routes/contracts');
app.use('/api/contracts', verifyToken, contractRoutes); 

// 引入排班相關路由 (排假申請與查詢)
const scheduleRoutes = require('./routes/schedule');
app.use('/api/schedule', verifyToken, scheduleRoutes);

// 引入提醒相關路由 (提醒列表, 時間計算機)
const reminderRoutes = require('./routes/reminder');
app.use('/api/reminder', verifyToken, reminderRoutes); 

// 引入耗材/庫存相關路由 (耗材消耗記錄, 主檔查詢)
const inventoryRoutes = require('./routes/inventory');
app.use('/api/inventory', verifyToken, inventoryRoutes);

// 引入收費/金流相關路由 (收費明細記錄與查詢)
const paymentRoutes = require('./routes/payment');
app.use('/api/payment', verifyToken, paymentRoutes);

// 引入彙報/查詢相關路由 (案件數據聚合與分析)
const reportRoutes = require('./routes/report');
app.use('/api/report', verifyToken, reportRoutes);

// 引入後台管理路由 (需要額外的 Admin 權限檢查) 【新增】
const adminRoutes = require('./routes/admin');
app.use('/api/admin', verifyToken, adminRoutes);


// 啟動伺服器
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`API Base URL: http://localhost:${PORT}/api`);
});

// 為了單元測試或其他模組化使用，導出 app
module.exports = app;