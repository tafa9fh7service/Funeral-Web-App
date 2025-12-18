// server/app.js

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { verifyToken } = require('./routes/auth'); // 引入 JWT 驗證中介層

// 1. 初始化環境變數
dotenv.config();

const app = express();

// 2. 中介軟體 (Middleware)
app.use(cors());
app.use(express.json());

// 3. 引入所有功能路由
const authRoutes = require('./routes/auth').router;      // 驗證
const caseRoutes = require('./routes/cases');           // 案件
const contractRoutes = require('./routes/contracts');   // 契約
const scheduleRoutes = require('./routes/schedule');    // 排班
const reminderRoutes = require('./routes/reminder');    // 提醒
const inventoryRoutes = require('./routes/inventory');  // 庫存
const paymentRoutes = require('./routes/payment');      // 金流
const reportRoutes = require('./routes/report');        // 報表聚合
const adminRoutes = require('./routes/admin');          // 後台管理
const procurementRoutes = require('./routes/procurement'); // 採購進貨
const notifyRoutes = require('./routes/notify').router;  // LINE 推播

// 4. 掛載 API 路由 (API Routes)
// 注意：除了 /api/auth 之外，其餘所有路由皆受 verifyToken 保護
app.use('/api/auth', authRoutes);
app.use('/api/cases', verifyToken, caseRoutes);
app.use('/api/contracts', verifyToken, contractRoutes);
app.use('/api/schedule', verifyToken, scheduleRoutes);
app.use('/api/reminders', verifyToken, reminderRoutes);
app.use('/api/inventory', verifyToken, inventoryRoutes);
app.use('/api/payment', verifyToken, paymentRoutes);
app.use('/api/report', verifyToken, reportRoutes);
app.use('/api/admin', verifyToken, adminRoutes);
app.use('/api/procurement', verifyToken, procurementRoutes);
app.use('/api/notify', verifyToken, notifyRoutes);

// 5. 基礎連線測試
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API Server is running correctly.' });
});

// 6. 錯誤處理 (Error Handling)
app.use((err, req, res, next) => {
    console.error('Server Internal Error:', err.stack);
    res.status(500).json({ message: '伺服器內部錯誤', error: err.message });
});

// 7. 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`==========================================`);
    console.log(`🚀 Funeral Web App Server 啟動成功`);
    console.log(`📡 運行埠號: ${PORT}`);
    console.log(`⏰ 當前時間: ${new Date().toLocaleString()}`);
    console.log(`==========================================`);
});