/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StudentAuth, TypingRecord, LevelRule, StudentStats } from './types';

// Default Spreadsheet ID (Used as an example in school setups)
export const DEFAULT_SPREADSHEET_ID = '1Q8v8_1_S_T-E_ST_S_h_e_e_t_I_D_D_e_m_o';

// --- ROBUST INLINE CSV PARSER ---
export function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  const rows = text.split(/\r?\n/);
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].trim();
    if (!row) continue;
    
    const cells: string[] = [];
    let insideQuote = false;
    let currentCell = '';
    
    for (let j = 0; j < row.length; j++) {
      const char = row[j];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        cells.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell.trim());
    result.push(cells);
  }
  return result;
}

// Helper to extract numeric month for proper sorting (e.g., "3월" -> 3, "10월" -> 10)
export function getMonthNumber(monthStr: string): number {
  const num = parseInt(monthStr.replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? 0 : num;
}

// Sort typing records chronologically by month
export function sortRecordsByMonth<T extends { month: string }>(records: T[]): T[] {
  return [...records].sort((a, b) => getMonthNumber(a.month) - getMonthNumber(b.month));
}

// --- HIGH-FIDELITY SAMPLE/SEED DATA ---
export const SAMPLE_AUTH_DATA: StudentAuth[] = [
  { studentId: '10101', name: '홍길동', pin: '4821' },
  { studentId: '10102', name: '김영희', pin: '1234' },
  { studentId: '10201', name: '이몽룡', pin: '9999' },
  { studentId: '10202', name: '성춘향', pin: '5678' }
];

export const SAMPLE_ENGLISH_RECORDS: TypingRecord[] = [
  // 홍길동 (Steady growth, Bronze to Gold)
  { studentId: '10101', name: '홍길동', grade: '1', department: '관광', month: '3월', speed: 120, type: 'english' },
  { studentId: '10101', name: '홍길동', grade: '1', department: '관광', month: '4월', speed: 175, type: 'english' },
  { studentId: '10101', name: '홍길동', grade: '1', department: '관광', month: '5월', speed: 215, type: 'english' },
  { studentId: '10101', name: '홍길동', grade: '1', department: '관광', month: '6월', speed: 230, type: 'english' },
  { studentId: '10101', name: '홍길동', grade: '1', department: '관광', month: '9월', speed: 275, type: 'english' },
  { studentId: '10101', name: '홍길동', grade: '1', department: '관광', month: '10월', speed: 360, type: 'english' },

  // 김영희 (Excellent starter, Silver to Diamond)
  { studentId: '10102', name: '김영희', grade: '1', department: '관광', month: '3월', speed: 220, type: 'english' },
  { studentId: '10102', name: '김영희', grade: '1', department: '관광', month: '4월', speed: 290, type: 'english' },
  { studentId: '10102', name: '김영희', grade: '1', department: '관광', month: '5월', speed: 310, type: 'english' },
  { studentId: '10102', name: '김영희', grade: '1', department: '관광', month: '6월', speed: 350, type: 'english' },
  { studentId: '10102', name: '김영희', grade: '1', department: '관광', month: '9월', speed: 410, type: 'english' },
  { studentId: '10102', name: '김영희', grade: '1', department: '관광', month: '10월', speed: 480, type: 'english' },

  // 이몽룡 (Overcomes plateau)
  { studentId: '10201', name: '이몽룡', grade: '1', department: '디자인', month: '3월', speed: 80, type: 'english' },
  { studentId: '10201', name: '이몽룡', grade: '1', department: '디자인', month: '4월', speed: 110, type: 'english' },
  { studentId: '10201', name: '이몽룡', grade: '1', department: '디자인', month: '5월', speed: 145, type: 'english' },
  { studentId: '10201', name: '이몽룡', grade: '1', department: '디자인', month: '6월', speed: 155, type: 'english' },
  { studentId: '10201', name: '이몽룡', grade: '1', department: '디자인', month: '9월', speed: 210, type: 'english' },
  { studentId: '10201', name: '이몽룡', grade: '1', department: '디자인', month: '10월', speed: 260, type: 'english' },

  // 성춘향 (Super rapid improvement)
  { studentId: '10202', name: '성춘향', grade: '1', department: '디자인', month: '3월', speed: 150, type: 'english' },
  { studentId: '10202', name: '성춘향', grade: '1', department: '디자인', month: '4월', speed: 160, type: 'english' },
  { studentId: '10202', name: '성춘향', grade: '1', department: '디자인', month: '5월', speed: 230, type: 'english' },
  { studentId: '10202', name: '성춘향', grade: '1', department: '디자인', month: '6월', speed: 290, type: 'english' },
  { studentId: '10202', name: '성춘향', grade: '1', department: '디자인', month: '9월', speed: 380, type: 'english' },
  { studentId: '10202', name: '성춘향', grade: '1', department: '디자인', month: '10월', speed: 460, type: 'english' }
];

export const SAMPLE_KOREAN_RECORDS: TypingRecord[] = [
  // 홍길동 (Fast growth in Hangul, Gold to Platinum)
  { studentId: '10101', name: '홍길동', grade: '1', department: '관광', month: '3월', speed: 320, type: 'korean' },
  { studentId: '10101', name: '홍길동', grade: '1', department: '관광', month: '4월', speed: 380, type: 'korean' },
  { studentId: '10101', name: '홍길동', grade: '1', department: '관광', month: '5월', speed: 430, type: 'korean' },
  { studentId: '10101', name: '홍길동', grade: '1', department: '관광', month: '6월', speed: 470, type: 'korean' },
  { studentId: '10101', name: '홍길동', grade: '1', department: '관광', month: '9월', speed: 560, type: 'korean' },
  { studentId: '10101', name: '홍길동', grade: '1', department: '관광', month: '10월', speed: 650, type: 'korean' },

  // 김영희 (Excellent starter in Hangul)
  { studentId: '10102', name: '김영희', grade: '1', department: '관광', month: '3월', speed: 450, type: 'korean' },
  { studentId: '10102', name: '김영희', grade: '1', department: '관광', month: '4월', speed: 510, type: 'korean' },
  { studentId: '10102', name: '김영희', grade: '1', department: '관광', month: '5월', speed: 580, type: 'korean' },
  { studentId: '10102', name: '김영희', grade: '1', department: '관광', month: '6월', speed: 600, type: 'korean' },
  { studentId: '10102', name: '김영희', grade: '1', department: '관광', month: '9월', speed: 690, type: 'korean' },
  { studentId: '10102', name: '김영희', grade: '1', department: '관광', month: '10월', speed: 810, type: 'korean' },

  // 이몽룡
  { studentId: '10201', name: '이몽룡', grade: '1', department: '디자인', month: '3월', speed: 210, type: 'korean' },
  { studentId: '10201', name: '이몽룡', grade: '1', department: '디자인', month: '4월', speed: 280, type: 'korean' },
  { studentId: '10201', name: '이몽룡', grade: '1', department: '디자인', month: '5월', speed: 340, type: 'korean' },
  { studentId: '10201', name: '이몽룡', grade: '1', department: '디자인', month: '6월', speed: 380, type: 'korean' },
  { studentId: '10201', name: '이몽룡', grade: '1', department: '디자인', month: '9월', speed: 460, type: 'korean' },
  { studentId: '10201', name: '이몽룡', grade: '1', department: '디자인', month: '10월', speed: 540, type: 'korean' },

  // 성춘향
  { studentId: '10202', name: '성춘향', grade: '1', department: '디자인', month: '3월', speed: 350, type: 'korean' },
  { studentId: '10202', name: '성춘향', grade: '1', department: '디자인', month: '4월', speed: 410, type: 'korean' },
  { studentId: '10202', name: '성춘향', grade: '1', department: '디자인', month: '5월', speed: 490, type: 'korean' },
  { studentId: '10202', name: '성춘향', grade: '1', department: '디자인', month: '6월', speed: 540, type: 'korean' },
  { studentId: '10202', name: '성춘향', grade: '1', department: '디자인', month: '9월', speed: 670, type: 'korean' },
  { studentId: '10202', name: '성춘향', grade: '1', department: '디자인', month: '10월', speed: 780, type: 'korean' }
];

export const SAMPLE_LEVEL_RULES: LevelRule[] = [
  { type: '영어', level: '3급(Bronze)', minVal: 100 },
  { type: '영어', level: '2급(Silver)', minVal: 200 },
  { type: '영어', level: '1급(Gold)', minVal: 350 },
  
  { type: '한글', level: '3급(Bronze)', minVal: 250 },
  { type: '한글', level: '2급(Silver)', minVal: 450 },
  { type: '한글', level: '1급(Gold)', minVal: 650 }
];

// Cache spreadsheet data in memory or session storage
let cachedSpreadsheetAuth: StudentAuth[] | null = null;
let cachedSpreadsheetEnglish: TypingRecord[] | null = null;
let cachedSpreadsheetKorean: TypingRecord[] | null = null;
let cachedSpreadsheetLevels: LevelRule[] | null = null;

// Clear cached spreadsheet data
export function clearDataCache() {
  cachedSpreadsheetAuth = null;
  cachedSpreadsheetEnglish = null;
  cachedSpreadsheetKorean = null;
  cachedSpreadsheetLevels = null;
}

// Fetch Google Sheets Data
export async function fetchSpreadsheetData(
  spreadsheetId: string,
  accessToken?: string | null
): Promise<{
    auth: StudentAuth[];
    english: TypingRecord[];
    korean: TypingRecord[];
    levels: LevelRule[];
  }> {
  
  // Return sample data if default placeholder is used
  if (!spreadsheetId || spreadsheetId === DEFAULT_SPREADSHEET_ID) {
    return {
      auth: SAMPLE_AUTH_DATA,
      english: SAMPLE_ENGLISH_RECORDS,
      korean: SAMPLE_KOREAN_RECORDS,
      levels: SAMPLE_LEVEL_RULES
    };
  }

  // If already cached, return it to prevent multiple duplicate network calls
  if (cachedSpreadsheetAuth && cachedSpreadsheetEnglish && cachedSpreadsheetKorean && cachedSpreadsheetLevels) {
    return {
      auth: cachedSpreadsheetAuth,
      english: cachedSpreadsheetEnglish,
      korean: cachedSpreadsheetKorean,
      levels: cachedSpreadsheetLevels
    };
  }

  try {
    const sheetsToFetch = ['students_auth', 'english_all', 'korean_all', 'level_rule'];
    const results: { [key: string]: any[] } = {};

    for (const sheetName of sheetsToFetch) {
      let rows: string[][] = [];

      const cacheBust = `t=${Date.now()}`;
      if (accessToken) {
        // Method 1: Private sheet fetching utilizing Google Sheets API v4 with active OAuth Token
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?valueRenderOption=FORMATTED_VALUE&${cacheBust}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error(`Sheet standard API read failed for "${sheetName}":`, errData);
          throw new Error(`스프레드시트 API 오류 (${sheetName} 시트를 찾을 수 없거나 접근 권한이 없습니다.)`);
        }
        
        const data = await res.json();
        rows = data.values || [];
      } else {
        // Method 2: Public sheet fetching viewer endpoint when shared as "Anyone with the link can view"
        const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&${cacheBust}`;
        const res = await fetch(url);
        
        if (!res.ok) {
          throw new Error(`스프레드시트 웹 뷰 오류: "${sheetName}" 시트를 조회하지 못했습니다. spreadsheetId가 올바르며 링크 공유 권한이 '링크가 있는 모든 사용자(뷰어)'로 설정되어 있는지 확인해주세요.`);
        }
        
        const csvText = await res.text();
        rows = parseCSV(csvText);
      }

      if (rows.length < 2) {
        // No data or just column names
        results[sheetName] = [];
        continue;
      }

      const headers = rows[0].map(h => h.trim());
      
      if (sheetName === 'students_auth') {
        // Parse columns: 학번, 이름, 인증번호
        // Map elements regardless of exact column position
        const idxId = headers.indexOf('학번');
        const idxName = headers.indexOf('이름');
        const idxPin = headers.indexOf('인증번호');

        if (idxId === -1 || idxName === -1 || idxPin === -1) {
          throw new Error('students_auth 시트의 컬럼 헤더가 올바르지 않습니다. 반드시 [학번, 이름, 인증번호] 형식이어야 합니다.');
        }

        results[sheetName] = rows.slice(1).map(row => ({
          studentId: String(row[idxId] || '').trim(),
          name: String(row[idxName] || '').trim(),
          pin: String(row[idxPin] || '').trim()
        })).filter(item => item.studentId && item.pin);

      } else if (sheetName === 'english_all' || sheetName === 'korean_all') {
        // Parse columns: 학번, 이름, 학년, 과, 월, 영타/한타
        const idxId = headers.indexOf('학번');
        const idxName = headers.indexOf('이름');
        const idxGrade = headers.indexOf('학년');
        const idxDept = headers.indexOf('과');
        const idxMonth = headers.indexOf('월');
        const speedHeader = sheetName === 'english_all' ? '영타' : '한타';
        const idxSpeed = headers.indexOf(speedHeader);

        if (idxId === -1 || idxName === -1 || idxSpeed === -1 || idxMonth === -1) {
          throw new Error(`${sheetName} 시트의 필수 컬럼 헤더(학번, 이름, 월, ${speedHeader})를 찾을 수 없습니다.`);
        }

        results[sheetName] = rows.slice(1).map(row => ({
          studentId: String(row[idxId] || '').trim(),
          name: String(row[idxName] || '').trim(),
          grade: idxGrade !== -1 ? String(row[idxGrade] || '').trim() : '',
          department: idxDept !== -1 ? String(row[idxDept] || '').trim() : '',
          month: String(row[idxMonth] || '').trim(),
          speed: parseInt(String(row[idxSpeed] || '0').replace(/[^0-9]/g, ''), 10) || 0,
          type: sheetName === 'english_all' ? 'english' : 'korean'
        })).filter(item => item.studentId && item.month);

      } else if (sheetName === 'level_rule') {
        // Parse columns: 타입, 급수, 최소값
        const idxType = headers.indexOf('타입');
        const idxLevel = headers.indexOf('급수');
        const idxMin = headers.indexOf('최소값');

        if (idxType === -1 || idxLevel === -1 || idxMin === -1) {
          throw new Error('level_rule 시트의 컬럼 헤더가 올바르지 않습니다. [타입, 급수, 최소값] 형식이어야 합니다.');
        }

        results[sheetName] = rows.slice(1).map(row => ({
          type: String(row[idxType] || '').trim(),
          level: String(row[idxLevel] || '').trim(),
          minVal: parseInt(String(row[idxMin] || '0').replace(/[^0-9]/g, ''), 10) || 0
        })).filter(item => item.type && item.level);
      }
    }

    cachedSpreadsheetAuth = results['students_auth'];
    cachedSpreadsheetEnglish = results['english_all'];
    cachedSpreadsheetKorean = results['korean_all'];
    cachedSpreadsheetLevels = results['level_rule'];

    return {
      auth: cachedSpreadsheetAuth || [],
      english: cachedSpreadsheetEnglish || [],
      korean: cachedSpreadsheetKorean || [],
      levels: cachedSpreadsheetLevels || []
    };

  } catch (error: any) {
    console.error('Spreadsheet Load Error:', error);
    throw error;
  }
}

// Compute student calculated typing statistics
export function calculateStudentStats(
  studentId: string,
  allRecords: TypingRecord[],
  allLevels: LevelRule[],
  type: 'english' | 'korean'
): StudentStats {
  // Filter for matching student and record type
  const targetTypeStr = type === 'english' ? 'english' : 'korean';
  const rawRecords = allRecords.filter(r => r.studentId === studentId && r.type === targetTypeStr);
  
  // Sort chronologically (March -> October, etc.)
  const history = sortRecordsByMonth(rawRecords);

  if (history.length === 0) {
    return {
      history: [],
      latestSpeed: 0,
      maxSpeed: 0,
      growth: 0,
      currentLevel: '기타 (기록 없음)',
      nextLevel: null,
      nextLevelNeeded: null,
      percentToNext: 0
    };
  }

  // Get speeds
  const latestRecord = history[history.length - 1];
  const latestSpeed = latestRecord.speed;
  const maxSpeed = Math.max(...history.map(r => r.speed));

  // Growth calculation: latest month speed minus previous month speed
  let growth = 0;
  if (history.length > 1) {
    const prevRecord = history[history.length - 2];
    growth = latestSpeed - prevRecord.speed;
  }

  // Map user sheet level_rule criteria to standard types
  const levelMappingType = type === 'english' ? '영어' : '한글';
  const levels = allLevels
    .filter(l => l.type === levelMappingType)
    .sort((a, b) => a.minVal - b.minVal);

  // Evaluate current level and next level
  let currentLevel = '무급 (훈련 필요)';
  let currentMinVal = 0;
  let nextLevel: string | null = null;
  let nextLevelNeeded: number | null = null;
  let percentToNext = 100;

  // Find achieved levels (latestSpeed >= level.minVal)
  const achievedLevels = levels.filter(l => latestSpeed >= l.minVal);
  if (achievedLevels.length > 0) {
    const highestAchieved = achievedLevels[achievedLevels.length - 1];
    currentLevel = highestAchieved.level;
    currentMinVal = highestAchieved.minVal;
  }

  // Find next target level (first level that is higher than current score)
  const incomingLevels = levels.filter(l => latestSpeed < l.minVal);
  if (incomingLevels.length > 0) {
    const firstNext = incomingLevels[0];
    nextLevel = firstNext.level;
    nextLevelNeeded = firstNext.minVal - latestSpeed;

    // Progression percentage from previous level to next level
    const denominator = firstNext.minVal - currentMinVal;
    if (denominator > 0) {
      percentToNext = Math.min(
        100,
        Math.max(0, Math.floor(((latestSpeed - currentMinVal) / denominator) * 100))
      );
    } else {
      percentToNext = 0;
    }
  } else if (levels.length > 0) {
    // Already hit maximum possible level
    nextLevel = '최고 등급 달성! 🎉';
    nextLevelNeeded = 0;
    percentToNext = 100;
  }

  return {
    history,
    latestSpeed,
    maxSpeed,
    growth,
    currentLevel,
    nextLevel,
    nextLevelNeeded,
    percentToNext
  };
}
