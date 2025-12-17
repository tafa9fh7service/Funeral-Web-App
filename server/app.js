// server/app.js

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { verifyToken } = require('./routes/auth'); // 引入 JWT 驗證中介層

// 1. 初始化環境變數
dotenv.config();

const app = express();

// 2. 中介軟體 (Middleware)
app.use(cors());
app.use(express.json());

// 3. 引入各個功能路由
const authRoutes = require('./routes/auth').router; // 驗證路由
const caseRoutes = require('./routes/cases');      // 案件路由
const contractRoutes = require('./routes/contracts'); // 契約路由
const scheduleRoutes = require('./routes/schedule');  // 排班路由
const reminderRoutes = require('./routes/reminder');  // 提醒路由
const inventoryRoutes = require('./routes/inventory'); // 庫存路由
const paymentRoutes = require('./routes/payment');     // 金流路由
const reportRoutes = require('./routes/report');       // 報表路由
const adminRoutes = require('./routes/admin');         // 後台管理路由
const procurementRoutes = require('./routes/procurement'); // ★進銷存：採購路由

// 4. 掛載路由 (API Routes)
// 注意：除了 auth (登入) 之外，其餘路由皆經過 verifyToken 檢查
app.use('/api/auth', authRoutes);
app.use('/api/cases', verifyToken, caseRoutes);
app.use('/api/contracts', verifyToken, contractRoutes);
app.use('/api/schedule', verifyToken, scheduleRoutes);
app.use('/api/reminders', verifyToken, reminderRoutes);
app.use('/api/inventory', verifyToken, inventoryRoutes);
app.use('/api/payment', verifyToken, paymentRoutes);
app.use('/api/report', verifyToken, reportRoutes);
app.use('/api/admin', verifyToken, adminRoutes);
app.use('/api/procurement', verifyToken, procurementRoutes); // ★註冊採購進貨路由

// 5. 測試路由
app.get('/', (req, res) => {
    res.send('喪禮服務 Web App API 伺服器運作中...');
});

// 6. 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});