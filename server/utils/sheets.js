// server/utils/sheets.js

const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config(); 

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

let sheets;

/**
 * 自動偵測環境並初始化 Google Sheets API
 * 1. 本地環境：讀取 .env 中的 KEY_FILE 路徑
 * 2. 雲端環境：讀取環境變數 GOOGLE_SERVICE_ACCOUNT_JSON (字串格式)
 */
async function authorize() {
    try {
        let authOptions = {};

        // 偵測 Zeabur 環境變數
        if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
            // 解析儲存在環境變數中的 JSON 字串
            const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
            authOptions = {
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'], 
            };
        } else {
            // 本地開發環境
            const KEY_FILE_PATH = path.join(process.cwd(), process.env.KEY_FILE || 'google-service-account-key.json');
            authOptions = {
                keyFile: KEY_FILE_PATH,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'], 
            };
        }

        const auth = new GoogleAuth(authOptions);
        const client = await auth.getClient();
        sheets = google.sheets({ version: 'v4', auth: client });
        
        console.log('Google Sheets API authorized successfully.');
    } catch (error) {
        console.error('Error authorizing Google Sheets API:', error.message);
        throw new Error('Sheets API 授權失敗。請檢查環境變數或金鑰檔案。');
    }
}

// --- 以下為通用 CRUD 函式 ---

async function getRows(sheetName, range) {
    if (!sheets) await authorize();
    const fullRange = `${sheetName}!${range}`; 
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: fullRange,
        });
        return response.data.values || [];
    } catch (error) {
        throw new Error(`讀取失敗: ${error.message}`);
    }
}

async function appendRow(sheetName, rowData) {
    if (!sheets) await authorize();
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:A`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [rowData] },
        });
    } catch (error) {
        throw new Error(`寫入失敗: ${error.message}`);
    }
}

async function updateCell(sheetName, range, value) {
    if (!sheets) await authorize();
    
    let values = (Array.isArray(value) && Array.isArray(value[0])) ? value : 
                 (Array.isArray(value) ? [value] : [[value]]);

    const processedValues = values.map(row => 
        row.map(cell => (typeof cell === 'string' && !isNaN(cell) && isFinite(cell)) ? parseFloat(cell) : cell)
    );

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!${range}`,
            valueInputOption: 'RAW', 
            resource: { values: processedValues },
        });
    } catch (error) {
        throw new Error(`更新失敗: ${error.message}`);
    }
}

authorize().catch(err => console.error('初始化錯誤:', err.message));

module.exports = { getRows, appendRow, updateCell };