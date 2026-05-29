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
  // Ensure we strip any UTF-8 Byte Order Mark (BOM) at the very start of the text
  const cleanText = text.replace(/^\uFEFF/, '');
  const rows = cleanText.split(/\r?\n/);
  
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

// Helper to clean cell values from quotes, extraneous spaces, and trailing float decimals (.0)
export function cleanCellValue(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim().replace(/['"“”]/g, '');
  if (str.endsWith('.0')) {
    str = str.substring(0, str.length - 2);
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (/^0+$/.test(parts[1])) {
      str = parts[0];
    }
  }
  return str.trim();
}

// Specialized clean helper for codes (student IDs, pin codes) by removing all whitespace
export function cleanCodeValue(val: any): string {
  return cleanCellValue(val).replace(/\s/g, '');
}

/**
 * 학번을 기반으로 학년과 학과(반 배정 규칙) 정보를 자동으로 추출하는 분석 함수
 * - 학번 5자리 기준: 1번째 자리 = 학년, 3번째 자리 = 반
 * - 반 배정 학과 정보:
 *   - 1,2반: 항공서비스과
 *   - 3,4반: 부사관경영과
 *   - 5,6반: SNS마케팅과
 *   - 7,8반: 콘텐츠디자인과
 *   - 기타: 기타
 */
export function parseStudentIdInfo(studentId: string): { grade: string; classNum: number; department: string } {
  const cleanId = String(studentId || '').trim();
  let grade = '1';
  let classNum = 1;
  let department = '일반';

  if (cleanId.length >= 5) {
    // 1번째 자리: 학년
    grade = cleanId.charAt(0);
    // 3번째 자리: 반
    const classChar = cleanId.charAt(2);
    const parsedClass = parseInt(classChar, 10);
    if (!isNaN(parsedClass)) {
      classNum = parsedClass;
    }
  } else if (cleanId.length > 0) {
    const firstChar = cleanId.charAt(0);
    if (/^\d$/.test(firstChar)) {
      grade = firstChar;
    }
  }

  // 1,2반 -> 항공서비스과, 3,4반 -> 부사관경영과, 5,6반 -> SNS마케팅과, 7,8반 -> 콘텐츠디자인과
  if (classNum === 1 || classNum === 2) {
    department = '항공서비스과';
  } else if (classNum === 3 || classNum === 4) {
    department = '부사관경영과';
  } else if (classNum === 5 || classNum === 6) {
    department = 'SNS마케팅과';
  } else if (classNum === 7 || classNum === 8) {
    department = '콘텐츠디자인과';
  } else {
    department = '기타';
  }

  return { grade, classNum, department };
}

// Helper to look up column header index supporting alternative names, case insensivity, and spacing variants
export function findIndexByNames(headers: string[], possibleNames: string[]): number {
  if (!headers || headers.length === 0) return -1;

  // Clean actual headers: remove BOM, lowercase, remove all whitespaces/quotes/hyphens
  const cleanedHeaders = headers.map(h => 
    String(h || '').trim().replace(/^\uFEFF/, '').toLowerCase().replace(/['"“”\s_/-]/g, '')
  );

  // Clean target potential names
  const cleanedPossibles = possibleNames.map(p => 
    p.trim().toLowerCase().replace(/['"“”\s_/-]/g, '')
  );

  // 1st Pass: Exact matching
  for (const possible of cleanedPossibles) {
    const idx = cleanedHeaders.indexOf(possible);
    if (idx !== -1) return idx;
  }

  // 2nd Pass: Containment check
  for (let i = 0; i < cleanedHeaders.length; i++) {
    const header = cleanedHeaders[i];
    if (!header) continue;
    for (const possible of cleanedPossibles) {
      if (header.includes(possible) || possible.includes(header)) {
        return i;
      }
    }
  }

  return -1;
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
  accessToken?: string | null,
  appsScriptUrl?: string | null
): Promise<{
    auth: StudentAuth[];
    english: TypingRecord[];
    korean: TypingRecord[];
    levels: LevelRule[];
  }> {
  
  // Return empty/warning data instead of mock demo data if default placeholder is used
  if ((!spreadsheetId || spreadsheetId === DEFAULT_SPREADSHEET_ID) && (!appsScriptUrl || !appsScriptUrl.trim())) {
    return {
      auth: [],
      english: [],
      korean: [],
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

  // If Apps Script URL is specified, query it first
  if (appsScriptUrl && appsScriptUrl.trim()) {
    try {
      const cleanUrl = appsScriptUrl.trim();
      const fetchUrl = cleanUrl.includes('?') 
        ? `${cleanUrl}&action=getAllData&t=${Date.now()}` 
        : `${cleanUrl}?action=getAllData&t=${Date.now()}`;
        
      const response = await fetch(fetchUrl);
      if (!response.ok) {
        throw new Error(`Apps Script 웹 앱 응답 코드 오류: ${response.status}`);
      }
      const json = await response.json();
      if (json && (json.success === true || (json.auth && json.english))) {
        cachedSpreadsheetAuth = json.auth || [];
        cachedSpreadsheetEnglish = json.english || [];
        cachedSpreadsheetKorean = json.korean || [];
        cachedSpreadsheetLevels = json.levels || [];
        
        return {
          auth: cachedSpreadsheetAuth,
          english: cachedSpreadsheetEnglish,
          korean: cachedSpreadsheetKorean,
          levels: cachedSpreadsheetLevels
        };
      } else if (json && json.success === false) {
        throw new Error(json.message || 'Apps Script 처리 중 오류가 발생했습니다.');
      }
    } catch (e: any) {
      console.error('Apps Script Fetch Failed. Falling back to Google Sheets direct access.', e);
      if (!spreadsheetId || spreadsheetId === DEFAULT_SPREADSHEET_ID) {
        throw new Error(`구글 앱스 스크립트(GAS) 연동 실패: ${e.message || e}`);
      }
    }
  }

  try {
    const sheetsToFetch = ['students_auth', 'english_all', 'korean_all', 'level_rule'];
    const results: { [key: string]: any[] } = {};

    for (const sheetName of sheetsToFetch) {
      results[sheetName] = [];
      try {
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
            throw new Error(`[${sheetName}] 시트를 찾을 수 없거나 접근 권한이 없습니다. (API Code: ${res.status})`);
          }
          
          const data = await res.json();
          rows = data.values || [];
        } else {
          // Method 2: Public sheet fetching viewer endpoint when shared as "Anyone with the link can view"
          const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&${cacheBust}`;
          const res = await fetch(url);
          
          if (!res.ok) {
            throw new Error(`[${sheetName}] 웹 뷰(CSV) 조회 불가. 스프레드시트 공유 범위를 '링크가 있는 모든 사용자(뷰어)'로 설정했는지 확인해주세요.`);
          }
          
          const csvText = await res.text();
          rows = parseCSV(csvText);
        }

        if (rows.length < 2) {
          // Empty or header-only sheet
          continue;
        }

        // Clean headers
        const headers = rows[0].map(h => String(h || '').trim());
        
        if (sheetName === 'students_auth') {
          // Parse columns: 학번, 이름, 인증번호
          const idxId = findIndexByNames(headers, ['학번', 'ID', 'studentId', '학생ID', '학급번호', '번호']);
          const idxName = findIndexByNames(headers, ['이름', '성명', '학생명', 'name']);
          const idxPin = findIndexByNames(headers, ['인증번호', '비밀번호', '비번', '핀', '인증', 'pin']);

          if (idxId === -1 || idxName === -1 || idxPin === -1) {
            const missing = [];
            if (idxId === -1) missing.push('학번');
            if (idxName === -1) missing.push('이름');
            if (idxPin === -1) missing.push('인증번호');
            throw new Error(`'students_auth' 시트의 필수 컬럼 헤더(${missing.join(', ')})를 찾을 수 없습니다. 예: 헤더명이 정확한지 확인 바랍니다.`);
          }

          results[sheetName] = rows.slice(1).map(row => ({
            studentId: cleanCodeValue(row[idxId]),
            name: cleanCellValue(row[idxName]),
            pin: cleanCodeValue(row[idxPin])
          })).filter(item => item.studentId && item.pin);

        } else if (sheetName === 'english_all' || sheetName === 'korean_all') {
          // Parse columns: 학번, 이름, 학년, 과
          const idxId = findIndexByNames(headers, ['학번', 'ID', 'studentId', '학생ID', '학급번호', '번호']);
          const idxName = findIndexByNames(headers, ['이름', '성명', '학생명', 'name']);
          const idxGrade = findIndexByNames(headers, ['학년', 'grade', '반/학년']);
          const idxDept = findIndexByNames(headers, ['과', '학과', '계열', 'dept', '전공']);

          if (idxId === -1 || idxName === -1) {
            const missing = [];
            if (idxId === -1) missing.push('학번');
            if (idxName === -1) missing.push('이름');
            throw new Error(`'${sheetName}' 시트의 필수 컬럼 헤더(${missing.join(', ')})를 찾을 수 없습니다.`);
          }

          // Detect horizontal month columns (e.g. 5월, 6월, 7월, 8월, 9월, 10월, etc.)
          const horizontalMonths: { monthName: string; index: number }[] = [];
          headers.forEach((header, index) => {
            const hTrimmed = String(header || '').trim();
            // Match pattern like "5월", "10월" or contains month numbering
            if (/^\d+월$/.test(hTrimmed) || (hTrimmed.includes('월') && /\d+/.test(hTrimmed))) {
              horizontalMonths.push({ monthName: hTrimmed, index });
            }
          });

          const isHorizontal = horizontalMonths.length > 0;
          const parsedRecords: TypingRecord[] = [];

          if (isHorizontal) {
            // 1. HORIZONTAL PIVOT: Pivot columns (5월, 6월...) into individual records
            rows.slice(1).forEach(row => {
              const studentId = cleanCodeValue(row[idxId]);
              const name = cleanCellValue(row[idxName]);
              
              if (!studentId) return;

              // Extract dynamically based on 5-digit studentId rule
              const studentInfo = parseStudentIdInfo(studentId);
              const grade = studentInfo.grade;
              const department = studentInfo.department;

              horizontalMonths.forEach(({ monthName, index }) => {
                const speedRaw = row[index];
                if (speedRaw !== undefined && speedRaw !== null) {
                  const cleanedSpeed = cleanCodeValue(speedRaw);
                  if (cleanedSpeed !== '') { // Create records only for months where there is record data
                    const speedVal = parseInt(cleanedSpeed, 10);
                    if (!isNaN(speedVal)) {
                      parsedRecords.push({
                        studentId,
                        name,
                        grade,
                        department,
                        month: monthName,
                        speed: speedVal,
                        type: sheetName === 'english_all' ? 'english' : 'korean'
                      });
                    }
                  }
                }
              });
            });
            results[sheetName] = parsedRecords;
          } else {
            // 2. VERTICAL STANDARD PARSING
            const idxMonth = findIndexByNames(headers, ['월', '시기', 'month', '구분']);
            const speedHeader = sheetName === 'english_all' ? '영타' : '한타';
            const idxSpeed = findIndexByNames(headers, [speedHeader, sheetName === 'english_all' ? '영어' : '한글', 'speed', '타수']);

            if (idxSpeed === -1 || idxMonth === -1) {
              const missing = [];
              if (idxMonth === -1) missing.push('월(또는 각 월별 가로 컬럼)');
              if (idxSpeed === -1) missing.push(speedHeader);
              throw new Error(`'${sheetName}' 시트의 필수 컬럼 헤더(${missing.join(', ')})를 찾을 수 없습니다. (스프레드시트에 '5월', '6월' 같은 열을 만드시거나 '월'과 '${speedHeader}' 열을 갖춰 주십시오.)`);
            }

            results[sheetName] = rows.slice(1).map(row => {
              const studentId = cleanCodeValue(row[idxId]);
              const studentInfo = parseStudentIdInfo(studentId);
              return {
                studentId,
                name: cleanCellValue(row[idxName]),
                grade: studentInfo.grade,
                department: studentInfo.department,
                month: cleanCellValue(row[idxMonth]),
                speed: parseInt(cleanCodeValue(row[idxSpeed]), 10) || 0,
                type: sheetName === 'english_all' ? 'english' : 'korean'
              };
            }).filter(item => item.studentId && item.month);
          }

        } else if (sheetName === 'level_rule') {
          // Parse columns: 타입, 급수, 최소값
          const idxType = findIndexByNames(headers, ['타입', '구분', '종류', 'type', '언어']);
          const idxLevel = findIndexByNames(headers, ['급수', '등급', '레벨', 'level']);
          const idxMin = findIndexByNames(headers, ['최소값', '기준', '타수', '최소', 'min', '최저']);

          if (idxType === -1 || idxLevel === -1 || idxMin === -1) {
            const missing = [];
            if (idxType === -1) missing.push('타입');
            if (idxLevel === -1) missing.push('급수');
            if (idxMin === -1) missing.push('최소값');
            throw new Error(`'level_rule' 시트의 필수 컬럼 헤더(${missing.join(', ')})를 찾을 수 없습니다.`);
          }

          results[sheetName] = rows.slice(1).map(row => ({
            type: cleanCellValue(row[idxType]),
            level: cleanCellValue(row[idxLevel]),
            minVal: parseInt(cleanCodeValue(row[idxMin]), 10) || 0
          })).filter(item => item.type && item.level);
        }

      } catch (err: any) {
        console.error(`Error parsing sheet "${sheetName}":`, err);
        // Critical sheet must propagate error
        if (sheetName === 'students_auth') {
          throw new Error(`[학생 명부 로드 오류] ${err.message || '인증 시트를 불러오지 못했습니다.'}`);
        } else {
          // Non-critical sheet failures are gracefully defaulted
          results[sheetName] = [];
        }
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
