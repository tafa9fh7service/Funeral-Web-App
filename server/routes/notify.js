// server/routes/notify.js

const express = require('express');
const router = express.Router();
const { getRows } = require('../utils/sheets');
const moment = require('moment-timezone');
const { Client } = require('@line/bot-sdk'); // 需要安裝: npm install @line/bot-sdk

const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);
const REMINDER_SHEET = '05_提醒列表';

// ----------------------------------------------------------------------
// 1. 推播訊息函式 (改用 Messaging API Push Message)
// ----------------------------------------------------------------------
async function sendToLine(text) {
    const userId = process.env.LINE_USER_ID; 
    if (!userId) throw new Error('未設定 LINE_USER_ID');

    try {
        await client.pushMessage(userId, { type: 'text', text: text });
        return true;
    } catch (error) {
        console.error('Messaging API Error:', error);
        return false;
    }
}

// ----------------------------------------------------------------------
// 2. 檢查今日提醒並推播 (API 端點)
// ----------------------------------------------------------------------
router.get('/check-today', async (req, res) => {
    try {
        const rows = await getRows(REMINDER_SHEET, 'A:F');
        const today = moment().tz('Asia/Taipei').format('YYYY-MM-DD');
        
        const todayTasks = rows.slice(1).filter(row => {
            return row[2] === today && row[5] === '未處理';
        });

        if (todayTasks.length === 0) {
            return res.json({ message: '今日無待辦提醒事項。' });
        }

        let message = `🔔 今日禮儀提醒 (${today})\n`;
        todayTasks.forEach((task, index) => {
            message += `\n${index + 1}. [${task[1]}] ${task[3]}\n內容: ${task[4]}\n`;
        });

        const success = await sendToLine(message);
        
        if (success) {
            res.json({ message: `已成功透過 Messaging API 推播 ${todayTasks.length} 則提醒。` });
        } else {
            res.status(500).json({ message: '推播發送失敗。' });
        }
    } catch (error) {
        res.status(500).json({ message: '系統錯誤', details: error.message });
    }
});

module.exports = { router, sendToLine };