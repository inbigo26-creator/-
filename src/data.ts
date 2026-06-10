import { GoogleGenAI } from '@google/genai';
import { SCHOOL_SPREADSHEET_ID } from './config';

// -----------------------------------------------------------------------------
// TYPES & INTERFACES
// -----------------------------------------------------------------------------

export interface StudentAuth {
  studentId: string;
  name: string;
  pin: string;
}

export interface TypingRecord {
  studentId: string;
  name: string;
  grade: string;
  department: string;
  month: string;
  speed: number;
  type: 'english' | 'korean';
}

export interface LevelRule {
  type: '영어' | '한글';
  level: string;
  minVal: number;
}

export interface StudentStats {
  history: { month: string; speed: number }[];
  latestSpeed: number;
  maxSpeed: number;
  growth: number;
  currentLevel: string;
  nextLevel: string;
  nextLevelNeeded: number;
  percentToNext: number;
}

export interface SchoolRankEntry {
  rank: number;
  studentId: string;
  name: string;
  grade: string;
  department: string;
  maxSpeed: number;
  growth: number;
  currentLevel: string;
}

// -----------------------------------------------------------------------------
// SAMPLE DATA / FALLBACKS
// -----------------------------------------------------------------------------

export const DEFAULT_SPREADSHEET_ID = SCHOOL_SPREADSHEET_ID || '1Q8v8_1_S_T-E_ST_S_h_e_e_t_I_D_D_e_m_o';

export function getMonthNumber(monthStr: string | undefined | null): number {
  if (!monthStr) return 0;
  const match = String(monthStr).match(/\d+/);
  if (match) {
    return parseInt(match[0], 10);
  }
  const s = String(monthStr).trim().toLowerCase();
  if (s.includes('jan')) return 1;
  if (s.includes('feb')) return 2;
  if (s.includes('mar')) return 3;
  if (s.includes('apr')) return 4;
  if (s.includes('may')) return 5;
  if (s.includes('jun')) return 6;
  if (s.includes('jul')) return 7;
  if (s.includes('aug')) return 8;
  if (s.includes('sep')) return 9;
  if (s.includes('oct')) return 10;
  if (s.includes('nov')) return 11;
  if (s.includes('dec')) return 12;
  return 0;
}

export const SAMPLE_LEVEL_RULES: LevelRule[] = [
  { type: '영어', level: '3급(Bronze)', minVal: 100 },
  { type: '영어', level: '2급(Silver)', minVal: 200 },
  { type: '영어', level: '1급(Gold)', minVal: 350 },
  
  { type: '한글', level: '3급(Bronze)', minVal: 250 },
  { type: '한글', level: '2급(Silver)', minVal: 450 },
  { type: '한글', level: '1급(Gold)', minVal: 650 }
];

// Memory cache to hold the resolved actual sheet titles across calls to prevent wasteful 404 retries
let resolvedSheetTitles: { [key: string]: string } = {};

// Cache spreadsheet data in memory or session storage
let cachedSpreadsheetAuth: StudentAuth[] | null = null;
let cachedSpreadsheetEnglish: TypingRecord[] | null = null;
let cachedSpreadsheetKorean: TypingRecord[] | null = null;
let cachedSpreadsheetLevels: LevelRule[] | null = null;
let cachedSpreadsheetPrivacy: { studentId: string; name: string; agreed: boolean }[] | null = null;

// Clear cached spreadsheet data
export function clearDataCache() {
  cachedSpreadsheetAuth = null;
  cachedSpreadsheetEnglish = null;
  cachedSpreadsheetKorean = null;
  cachedSpreadsheetLevels = null;
  cachedSpreadsheetPrivacy = null;
  resolvedSheetTitles = {};

  try {
    // Only clear resolved_sheets_ keys to ensure we can re-resolve sheet titles if needed,
    // but NEVER proactively delete the raw school_db_cache_ from localStorage! This acts as our rock-solid offline/emergency fallback.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('resolved_sheets_')) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.warn('[Cache Optimization] Failed clearing localStorage cache keys:', e);
  }
}

// Fetch Google Sheets Data
export async function fetchSpreadsheetData(
  spreadsheetId: string,
  accessToken?: string | null,
  appsScriptUrl?: string | null,
  forceFresh: boolean = false
): Promise<{
    auth: StudentAuth[];
    english: TypingRecord[];
    korean: TypingRecord[];
    levels: LevelRule[];
    privacy: { studentId: string; name: string; agreed: boolean }[];
  }> {
  
  // Return empty/warning data instead of mock demo data if default placeholder is used
  if ((!spreadsheetId || spreadsheetId === '1Q8v8_1_S_T-E_ST_S_h_e_e_t_I_D_D_e_m_o') && (!appsScriptUrl || !appsScriptUrl.trim())) {
    return {
      auth: [],
      english: [],
      korean: [],
      levels: SAMPLE_LEVEL_RULES,
      privacy: []
    };
  }

  // 0. CHECK PERSISTENT LOCALSTORAGE OFFSET CACHE (5 minutes TTL for instant loading)
  const dbCacheKey = `school_db_cache_${spreadsheetId}`;
  if (!forceFresh) {
    try {
      const cachedStr = localStorage.getItem(dbCacheKey);
      if (cachedStr) {
        const cachedObj = JSON.parse(cachedStr);
        const now = Date.now();
        // 5 minutes TTL (300,005ms)
        if (now - cachedObj.timestamp < 300000) {
          console.log('[Cache Optimization] Loaded spreadsheet database from localStorage cache (TTL valid). Instant load!');
          cachedSpreadsheetAuth = cachedObj.auth || [];
          cachedSpreadsheetEnglish = cachedObj.english || [];
          cachedSpreadsheetKorean = cachedObj.korean || [];
          cachedSpreadsheetLevels = cachedObj.levels || [];
          cachedSpreadsheetPrivacy = cachedObj.privacy || [];
          
          return {
            auth: cachedSpreadsheetAuth || [],
            english: cachedSpreadsheetEnglish || [],
            korean: cachedSpreadsheetKorean || [],
            levels: cachedSpreadsheetLevels || [],
            privacy: cachedSpreadsheetPrivacy || []
          };
        }
      }
    } catch (e) {
      console.warn('[Cache Optimization] Failed parsing cached spreadsheet database.', e);
    }

    // If already cached in memory, return it to prevent multiple duplicate network calls
    if (cachedSpreadsheetAuth && cachedSpreadsheetEnglish && cachedSpreadsheetKorean && cachedSpreadsheetLevels) {
      return {
        auth: cachedSpreadsheetAuth,
        english: cachedSpreadsheetEnglish,
        korean: cachedSpreadsheetKorean,
        levels: cachedSpreadsheetLevels,
        privacy: cachedSpreadsheetPrivacy || []
      };
    }
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
        cachedSpreadsheetPrivacy = json.privacy || [];
        
        // Cache to localStorage
        try {
          localStorage.setItem(`school_db_cache_${spreadsheetId}`, JSON.stringify({
            auth: cachedSpreadsheetAuth,
            english: cachedSpreadsheetEnglish,
            korean: cachedSpreadsheetKorean,
            levels: cachedSpreadsheetLevels,
            privacy: cachedSpreadsheetPrivacy,
            timestamp: Date.now()
          }));
        } catch (_) {}

        return {
          auth: cachedSpreadsheetAuth,
          english: cachedSpreadsheetEnglish,
          korean: cachedSpreadsheetKorean,
          levels: cachedSpreadsheetLevels,
          privacy: cachedSpreadsheetPrivacy
        };
      } else if (json && json.success === false) {
        throw new Error(json.message || 'Apps Script 처리 중 오류가 발생했습니다.');
      }
    } catch (e: any) {
      console.warn('Apps Script Fetch Failed. Falling back to Google Sheets direct access.', e);
    }
  }

  try {
    // Exact sheet order specified: privacy / students_auth / english_all / korean_all / level_rule
    const sheetsToFetch = ['privacy', 'students_auth', 'english_all', 'korean_all', 'level_rule'];
    const results: { [key: string]: any[] } = {};

    // Load persistent cache from localStorage to guarantee extremely fast (0ms) lookups!
    const cacheKey = `resolved_sheets_${spreadsheetId}`;
    let cachedTitles: { [key: string]: string } = {};
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        cachedTitles = JSON.parse(saved);
        resolvedSheetTitles = { ...resolvedSheetTitles, ...cachedTitles };
      }
    } catch (_) {}

    // Fallbacks prioritized by standard/user-given exact workbook names at the front
    const fallbackNamesMap: { [key: string]: string[] } = {
      'privacy': ['privacy', 'privacy_consent', '개인정보동의', '동의여부', '동의'],
      'students_auth': ['students_auth', 'student_auth', 'students', 'auth', '인증', '학생명부', '학생_auth'],
      'english_all': ['english_all', 'english', '영어_all', '영어', '영어타자', 'englishes', 'eng_all'],
      'korean_all': ['korean_all', 'korean', '한글_all', '한글', '한글타자', 'koreans', 'kor_all'],
      'level_rule': ['level_rule', 'level_rules', 'levels', 'rules', '급수기준', '기준']
    };

    // If we do NOT have an accessToken (i.e. gviz/tq CSV fallback mode), we pre-fetch the default first sheet of the spreadsheet.
    // This allows us to instantly check if other queries fell back to this first sheet, avoiding false positive matches and skipping loop retries in milliseconds!
    let firstSheetCsvText = '';
    let firstSheetHeaders: string[] = [];
    let firstSheetParsedResults: any[] = [];
    let firstSheetKeyDiscovered: string | null = null;

    if (!accessToken) {
      try {
        console.log('[Sheets Optimization] Pre-fetching default first sheet signature to identify default fallbacks...');
        const cacheBust = `t=${Date.now()}`;
        const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&${cacheBust}`;
        const res = await fetch(url);
        if (res.ok) {
          firstSheetCsvText = await res.text();
          const firstSheetRows = parseCSV(firstSheetCsvText);
          if (firstSheetRows.length >= 1) {
            firstSheetHeaders = firstSheetRows[0].map(h => String(h || '').trim());
            
            // Auto-detect which sheetKey this first sheet actually behaves as!
            const idxId = findIndexByNames(firstSheetHeaders, ['학번', 'ID', 'studentId', '학생ID', '학급번호', '번호', '학급']);
            const idxName = findIndexByNames(firstSheetHeaders, ['이름', '성명', '학생명', 'name']);
            const idxPin = findIndexByNames(firstSheetHeaders, ['인증번호', '비밀번호', '비번', '핀', '인증', 'pin']);
            const idxAgreed = findIndexByNames(firstSheetHeaders, ['동의', 'consent', 'agreed', '동의여부']);
            const idxType = findIndexByNames(firstSheetHeaders, ['타입', '구분', '종류', 'type', '언어']);
            const idxLevel = findIndexByNames(firstSheetHeaders, ['급수', '등급', '레벨', 'level']);
            const idxMin = findIndexByNames(firstSheetHeaders, ['최소값', '기준', '타수', '최소', 'min', '최저']);

            if (idxId !== -1 && idxName !== -1 && idxPin !== -1) {
              firstSheetKeyDiscovered = 'students_auth';
              firstSheetParsedResults = firstSheetRows.slice(1).map(row => ({
                studentId: cleanCodeValue(row[idxId]),
                name: cleanCellValue(row[idxName]),
                pin: cleanCodeValue(row[idxPin])
              })).filter(item => item.studentId && item.pin);
            } else if (idxId !== -1 && idxName !== -1 && idxAgreed !== -1) {
              firstSheetKeyDiscovered = 'privacy';
              firstSheetParsedResults = firstSheetRows.slice(1).map(row => {
                const rawAgreed = row[idxAgreed];
                const hasAgreed = idxAgreed !== -1 ? isAgreedValue(rawAgreed) : false;
                return {
                  studentId: cleanCodeValue(row[idxId]),
                  name: cleanCellValue(row[idxName]),
                  agreed: hasAgreed
                };
              }).filter(item => item.studentId);
            } else if (idxType !== -1 && idxLevel !== -1 && idxMin !== -1) {
              firstSheetKeyDiscovered = 'level_rule';
              firstSheetParsedResults = firstSheetRows.slice(1).map(row => ({
                type: cleanCellValue(row[idxType]),
                level: cleanCellValue(row[idxLevel]),
                minVal: parseInt(cleanCodeValue(row[idxMin]), 10) || 0
              })).filter(item => item.type && item.level);
            }
            
            if (firstSheetKeyDiscovered) {
              results[firstSheetKeyDiscovered] = firstSheetParsedResults;
              resolvedSheetTitles[firstSheetKeyDiscovered] = firstSheetKeyDiscovered;
              try {
                const cacheKey2 = `resolved_sheets_${spreadsheetId}`;
                localStorage.setItem(cacheKey2, JSON.stringify(resolvedSheetTitles));
              } catch (_) {}
              console.log(`[Sheets Optimization] Managed to auto-discover that the first sheet behaves as: "${firstSheetKeyDiscovered}". Pre-populated!`);
            }
          }
        }
      } catch (err) {
        console.error('[Sheets Optimization] Failed pre-fetching first sheet signature:', err);
      }
    }

    // Helper process to fetch a single sheet-key asynchronously
    const fetchSingleSheet = async (sheetKey: string): Promise<any[]> => {
      // If we already preloaded this sheetKey as the first sheet, return its results directly!
      if (firstSheetKeyDiscovered === sheetKey) {
        return firstSheetParsedResults;
      }

      // Prioritize previously verified actual sheet name to skip the candidates loop, but allow fallback on failure!
      const verifiedTitle = resolvedSheetTitles[sheetKey];
      let candidates = fallbackNamesMap[sheetKey] || [sheetKey];
      if (verifiedTitle) {
        candidates = [verifiedTitle, ...candidates.filter(c => c !== verifiedTitle)];
      }
      
      let loadedSuccessfully = false;
      let lastErrorMessage = '';
      let parsedResults: any[] = [];

      for (const candidateName of candidates) {
        try {
          let rows: string[][] = [];
          const cacheBust = `t=${Date.now()}`;

          if (accessToken) {
            // Method 1: Private sheet fetching utilizing Google Sheets API v4 with active OAuth Token
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(candidateName)}?valueRenderOption=FORMATTED_VALUE&${cacheBust}`;
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            
            if (!res.ok) {
              throw new Error(`[${candidateName}] 시트를 찾을 수 없거나 접근 권한이 없습니다.`);
            }
            
            const data = await res.json();
            rows = data.values || [];
          } else {
            // Method 2: Public sheet fetching viewer endpoint when shared as "Anyone with the link can view"
            const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(candidateName)}&${cacheBust}`;
            const res = await fetch(url);
            
            if (!res.ok) {
              throw new Error(`[${candidateName}] 웹 뷰(CSV) 조회 불가.`);
            }
            
            const csvText = await res.text();

            // EXCELLENT INSTANT OPTIMIZATION: If Google Sheets redirected us to the first sheet (fallback behavior when sheet name isn't found),
            // and this is not the first sheet itself (which is privacy), skip this candidate instantly (0ms logic penalty)!
            if (firstSheetCsvText && csvText === firstSheetCsvText && sheetKey !== 'privacy' && sheetKey !== firstSheetKeyDiscovered) {
              console.log(`[Sheets Optimization] Candidate "${candidateName}" redirected to default first sheet signature. Skipping.`);
              continue;
            }

            rows = parseCSV(csvText);
          }

          if (rows.length < 2) {
            // Empty or header-only sheet - try next candidate
            continue;
          }

          // Clean headers
          const headers = rows[0].map(h => String(h || '').trim());
          
          if (sheetKey === 'students_auth') {
            // Parse columns: 학번, 이름, 인증번호
            const idxId = findIndexByNames(headers, ['학번', 'ID', 'studentId', '학생ID', '학급번호', '번호', '학급']);
            const idxName = findIndexByNames(headers, ['이름', '성명', '학생명', 'name']);
            const idxPin = findIndexByNames(headers, ['인증번호', '비밀번호', '비번', '핀', '인증', 'pin']);

            if (idxId === -1 || idxName === -1 || idxPin === -1) {
              continue; // try next candidate if headers don't match
            }

            parsedResults = rows.slice(1).map(row => ({
              studentId: cleanCodeValue(row[idxId]),
              name: cleanCellValue(row[idxName]),
              pin: cleanCodeValue(row[idxPin])
            })).filter(item => item.studentId && item.pin);

          } else if (sheetKey === 'english_all' || sheetKey === 'korean_all') {
            // Parse columns: 학번, 이름, 학년, 과
            const idxId = findIndexByNames(headers, ['학번', 'ID', 'studentId', '학생ID', '학급번호', '번호', '학급']);
            const idxName = findIndexByNames(headers, ['이름', '성명', '학생명', 'name']);
            const idxGrade = findIndexByNames(headers, ['학년', 'grade', '반/학년']);
            const idxDept = findIndexByNames(headers, ['과', '학과', '계열', 'dept', '전공']);

            if (idxId === -1 || idxName === -1) {
              continue; // try next candidate
            }

            // Detect horizontal month columns (e.g. 5월, 6월, 7월, 8월, 9월, 10월, 5, 3월 한타, 한타 3월 etc.)
            const horizontalMonths: { monthName: string; index: number }[] = [];
            headers.forEach((header, index) => {
              const hTrimmed = String(header || '').trim();
              if (index === idxId || index === idxName || index === idxGrade || index === idxDept) {
                return;
              }
              // Extract the first sequence of digits to check if it represents a valid month (1~12)
              const numericMatch = hTrimmed.match(/\d+/);
              if (numericMatch) {
                const numVal = parseInt(numericMatch[0], 10);
                if (numVal >= 1 && numVal <= 12) {
                  horizontalMonths.push({ monthName: `${numVal}월`, index });
                }
              }
            });

            const isHorizontal = horizontalMonths.length > 0;
            const parsedRecords: TypingRecord[] = [];

            if (isHorizontal) {
              // 1. HORIZONTAL PIVOT: Pivot columns into individual records
              rows.slice(1).forEach(row => {
                const studentId = cleanCodeValue(row[idxId]);
                const name = cleanCellValue(row[idxName]);
                
                if (!studentId) return;

                const studentInfo = parseStudentIdInfo(studentId);
                const grade = studentInfo.grade;
                const department = studentInfo.department;

                horizontalMonths.forEach(({ monthName, index }) => {
                  const speedRaw = row[index];
                  if (speedRaw !== undefined && speedRaw !== null) {
                    const cleanedSpeed = cleanCodeValue(speedRaw);
                    if (cleanedSpeed !== '') {
                      const speedVal = parseInt(cleanedSpeed, 10);
                      if (!isNaN(speedVal)) {
                        parsedRecords.push({
                          studentId,
                          name,
                          grade,
                          department,
                          month: monthName,
                          speed: speedVal,
                          type: sheetKey === 'english_all' ? 'english' : 'korean'
                        });
                      }
                    }
                  }
                });
              });
              parsedResults = parsedRecords;
            } else {
              // 2. VERTICAL STANDARD PARSING
              const idxMonth = findIndexByNames(headers, ['월', '시기', 'month', '구분']);
              const speedHeader = sheetKey === 'english_all' ? '영타' : '한타';
              const idxSpeed = findIndexByNames(headers, [speedHeader, sheetKey === 'english_all' ? '영어' : '한글', 'speed', '타수']);

              if (idxSpeed === -1 || idxMonth === -1) {
                continue; // try next candidate (maybe vertical headers failed to match)
              }

              parsedResults = rows.slice(1).map(row => {
                const studentId = cleanCodeValue(row[idxId]);
                const studentInfo = parseStudentIdInfo(studentId);
                return {
                  studentId,
                  name: cleanCellValue(row[idxName]),
                  grade: studentInfo.grade,
                  department: studentInfo.department,
                  month: cleanCellValue(row[idxMonth]),
                  speed: parseInt(cleanCodeValue(row[idxSpeed]), 10) || 0,
                  type: sheetKey === 'english_all' ? 'english' : 'korean'
                };
              }).filter(item => item.studentId && item.month);
            }

          } else if (sheetKey === 'level_rule') {
            // Parse columns: 타입, 급수, 최소값
            const idxType = findIndexByNames(headers, ['타입', '구분', '종류', 'type', '언어']);
            const idxLevel = findIndexByNames(headers, ['급수', '등급', '레벨', 'level']);
            const idxMin = findIndexByNames(headers, ['최소값', '기준', '타수', '최소', 'min', '최저']);

            if (idxType === -1 || idxLevel === -1 || idxMin === -1) {
              continue; // try next candidate
            }

            parsedResults = rows.slice(1).map(row => ({
              type: cleanCellValue(row[idxType]),
              level: cleanCellValue(row[idxLevel]),
              minVal: parseInt(cleanCodeValue(row[idxMin]), 10) || 0
            })).filter(item => item.type && item.level);
          } else if (sheetKey === 'privacy') {
            // Parse columns: 학번, 이름, 동의 
            let idxId = findIndexByNames(headers, ['학번', 'ID', 'studentId', '학생ID', '학급번호', '번호', '학급']);
            let idxName = findIndexByNames(headers, ['이름', '성명', '학생명', 'name']);
            let idxAgreed = findIndexByNames(headers, ['동의', 'consent', 'agreed', '동의여부']);

            // Detect if this sheet is actually students_auth due to gviz/tq fallback
            const idxPinInPrivacy = findIndexByNames(headers, ['인증번호', '비밀번호', '비번', '핀', '인증', 'pin']);

            if (idxPinInPrivacy !== -1) {
              continue; // try next candidate (or reject fallback to auth sheet)
            }

            // Fallback to indexes 0, 1, 2 if headers aren't detected but we have rows
            if (idxId === -1 && rows.length > 0 && rows[0].length >= 1) idxId = 0;
            if (idxName === -1 && rows.length > 0 && rows[0].length >= 2) idxName = 1;
            if (idxAgreed === -1 && rows.length > 0 && rows[0].length >= 3) idxAgreed = 2;

            if (idxId === -1 || idxName === -1) {
              continue; // try next candidate (or reject if we can't find core values)
            }

            parsedResults = rows.slice(1).map(row => {
              const rawAgreed = idxAgreed !== -1 ? row[idxAgreed] : undefined;
              const hasAgreed = idxAgreed !== -1 ? isAgreedValue(rawAgreed) : false;
              return {
                studentId: cleanCodeValue(row[idxId]),
                name: cleanCellValue(row[idxName]),
                agreed: hasAgreed
              };
            }).filter(item => item.studentId);
          }

          // Successfully found and matched! Remember this verified candidate title
          resolvedSheetTitles[sheetKey] = candidateName;
          try {
            const cacheKey = `resolved_sheets_${spreadsheetId}`;
            localStorage.setItem(cacheKey, JSON.stringify(resolvedSheetTitles));
          } catch (_) {}

          loadedSuccessfully = true;
          break; // break candidate loop for this sheetKey

        } catch (err: any) {
          lastErrorMessage = err.message || 'Unknown error';
          // continue candidate loop
        }
      }

      if (!loadedSuccessfully) {
        console.warn(`Failed loading single sheet key "${sheetKey}": ${lastErrorMessage}`);
        if (sheetKey === 'students_auth') {
          throw new Error(`[학생 명부 로드 오류] ${lastErrorMessage || '인증용 학생 명부 시트를 불러올 수 없습니다. 시트 명을 검토해 주세요.'}`);
        }
      }

      return parsedResults;
    };

    // Parallel concurrent trigger using Promise.all for outstanding performance!
    const loadedDataArrays = await Promise.all(
      sheetsToFetch.map(sheetKey => fetchSingleSheet(sheetKey))
    );

    // Unpack results back to their designated keys
    sheetsToFetch.forEach((key, index) => {
      results[key] = loadedDataArrays[index];
    });

    cachedSpreadsheetAuth = results['students_auth'];
    cachedSpreadsheetEnglish = results['english_all'];
    cachedSpreadsheetKorean = results['korean_all'];
    cachedSpreadsheetLevels = results['level_rule'];
    cachedSpreadsheetPrivacy = results['privacy'] || [];

    // Cache to localStorage
    try {
      localStorage.setItem(`school_db_cache_${spreadsheetId}`, JSON.stringify({
        auth: cachedSpreadsheetAuth,
        english: cachedSpreadsheetEnglish,
        korean: cachedSpreadsheetKorean,
        levels: cachedSpreadsheetLevels,
        privacy: cachedSpreadsheetPrivacy,
        timestamp: Date.now()
      }));
    } catch (_) {}

    return {
      auth: cachedSpreadsheetAuth || [],
      english: cachedSpreadsheetEnglish || [],
      korean: cachedSpreadsheetKorean || [],
      levels: cachedSpreadsheetLevels || [],
      privacy: cachedSpreadsheetPrivacy || []
    };

  } catch (error: any) {
    console.error('Spreadsheet Load Error:', error);
    
    // EMERGENCY FALLBACK: Check if we have ANY previously stored cache in localStorage (regardless of TTL)
    try {
      const dbCacheKey = `school_db_cache_${spreadsheetId}`;
      const cachedStr = localStorage.getItem(dbCacheKey);
      if (cachedStr) {
        const cachedObj = JSON.parse(cachedStr);
        console.warn('[Offline Fallback] 네트워크 오류 또는 권한 문제로 인해 보관된 이전 로컬 캐시 데이터를 성공적으로 불러왔습니다.');
        cachedSpreadsheetAuth = cachedObj.auth || [];
        cachedSpreadsheetEnglish = cachedObj.english || [];
        cachedSpreadsheetKorean = cachedObj.korean || [];
        cachedSpreadsheetLevels = cachedObj.levels || [];
        cachedSpreadsheetPrivacy = cachedObj.privacy || [];
        
        return {
          auth: cachedSpreadsheetAuth || [],
          english: cachedSpreadsheetEnglish || [],
          korean: cachedSpreadsheetKorean || [],
          levels: cachedSpreadsheetLevels || [],
          privacy: cachedSpreadsheetPrivacy || []
        };
      }
    } catch (_) {}

    // If no cache is found and we have no spreadsheet config, or direct fetch failed, throw a friendly explanation
    if (!spreadsheetId || spreadsheetId === '1Q8v8_1_S_T-E_ST_S_h_e_e_t_I_D_D_e_m_o') {
      throw new Error(`구글 스프레드시트 연동 실패: ${error.message || error}. 스프레드시트 공유 권한 설정을 '링크가 있는 모든 사용자에게 뷰어'로 공개해 주시거나 Apps Script 설정을 다시 점검해 주세요.`);
    }
    
    throw new Error(`구글 스프레드시트 [ID: ${spreadsheetId}] 로딩 실패: ${error.message || error}. 스프레드시트의 공유 권한을 '링크가 있는 모든 사용자(뷰어)'로 설정하거나 관리자 패널의 Apps Script URL을 재확인해주십시오.`);
  }
}

// Compute student calculated typing statistics
export function calculateStudentStats(
  studentId: string,
  allRecords: TypingRecord[],
  allLevels: LevelRule[],
  type: 'english' | 'korean'
): StudentStats {
  // Normalize IDs to prevent exact-string mismatch due to spacing, types, or float artifacts (.0)
  const norm = (id: string) => String(id || '').trim().replace(/[^0-9A-Za-z]/g, '');
  const targetIdNorm = norm(studentId);

  const history = allRecords
    .filter((r) => norm(r.studentId) === targetIdNorm && r.type === type)
    .map((r) => ({
      month: r.month,
      speed: r.speed
    }))
    // Sort by chronological timing if applicable, or keep spreadsheet ordering
    .slice(-10); // Keep last 10 records for history view

  const latestSpeed = history.length > 0 ? history[history.length - 1].speed : 0;
  const maxSpeed = history.length > 0 ? Math.max(...history.map((h) => h.speed)) : 0;
  
  // Calculate improvement (growth): Max Speed minus the earliest recorded speed
  const earliestSpeed = history.length > 0 ? history[0].speed : 0;
  const growth = maxSpeed - earliestSpeed;

  // Filter levels for the target subject
  const subjectLabel = type === 'english' ? '영어' : '한글';
  const levels = allLevels
    .filter((l) => l.type === subjectLabel)
    .sort((a, b) => a.minVal - b.minVal);

  let currentLevel = '무급';
  let nextLevel = '최종 수료';
  let nextLevelNeeded = 0;
  let percentToNext = 100;

  // Evaluate highest criteria matched
  for (let i = 0; i < levels.length; i++) {
    if (maxSpeed >= levels[i].minVal) {
      currentLevel = levels[i].level;
    }
  }

  // Find next achievable criteria
  const nextIdx = levels.findIndex((l) => maxSpeed < l.minVal);
  if (nextIdx !== -1) {
    const nextL = levels[nextIdx];
    nextLevel = nextL.level;
    nextLevelNeeded = nextL.minVal - maxSpeed;
    
    // Calculate progress percentage to next grade
    const prevMin = nextIdx > 0 ? levels[nextIdx - 1].minVal : 0;
    const range = nextL.minVal - prevMin;
    const progress = maxSpeed - prevMin;
    percentToNext = range > 0 ? Math.min(100, Math.max(0, Math.round((progress / range) * 100))) : 0;
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

// Save Privacy Consent back to Spreadsheet
export async function saveConsentToSpreadsheet(
  spreadsheetId: string,
  studentId: string,
  name: string,
  googleToken?: string | null,
  appsScriptUrl?: string | null,
  agreementStatus: 'Y' | 'N' = 'Y'
): Promise<boolean> {
  // Offline or Demo Mode
  if ((!spreadsheetId || spreadsheetId === '1Q8v8_1_S_T-E_ST_S_h_e_e_t_I_D_D_e_m_o') && (!appsScriptUrl || !appsScriptUrl.trim())) {
    console.log('Consent stored locally in demo/placeholder mode.');
    return true;
  }

  const rowData = [studentId, name, agreementStatus];
  let lastError: any = null;

  // 1. Save using Apps Script custom action if available
  if (appsScriptUrl && appsScriptUrl.trim()) {
    try {
      const cleanUrl = appsScriptUrl.trim();
      const fetchUrl = cleanUrl.includes('?')
        ? `${cleanUrl}&action=saveConsent&studentId=${encodeURIComponent(studentId)}&name=${encodeURIComponent(name)}&agreement=${encodeURIComponent(agreementStatus)}&t=${Date.now()}`
        : `${cleanUrl}?action=saveConsent&studentId=${encodeURIComponent(studentId)}&name=${encodeURIComponent(name)}&agreement=${encodeURIComponent(agreementStatus)}&t=${Date.now()}`;
      
      const res = await fetch(fetchUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      });
      if (!res.ok) {
        throw new Error(`Apps Script API 응답 실패 (코드: ${res.status})`);
      }
      
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        if (text.includes('google-signin') || text.includes('Sign in') || text.includes('DOCTYPE html') || text.includes('login') || text.includes('service_login')) {
          throw new Error('구글 앱스 스크립트 접근 권한이 올바르지 않습니다. 웹앱 배포 시 [액세스 권한이 있는 사용자(Who has access)]를 [모든 사용자(Anyone)]로 설정했는지 확인해 주세요. (스프레드시트 동의여부 수정을 위해 필수적입니다)');
        }
        throw new Error('앱스 스크립트 응답이 유효한 JSON 형식이 아닙니다. 웹앱 배포 상태를 재확인해 주세요.');
      }

      if (json && json.success !== false) {
        console.log(`Privacy consent (${agreementStatus}) logged successfully via Apps Script web app API.`);
        return true;
      } else {
        throw new Error(json?.message || 'Apps Script에서 동의 결과 처리에 실패 응답을 보냈습니다.');
      }
    } catch (err: any) {
      console.error('GAS Apps Script consent append failed:', err);
      lastError = err;
    }
  }

  // 2. Save directly via Google Sheets API (v4) with valid OAuth token
  if (googleToken) {
    try {
      // 2a. Determine which sheet title actually exists out of candidates
      const sheetsMetaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
      const metaRes = await fetch(sheetsMetaUrl, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      let activeSheetName = 'privacy';
      if (metaRes.ok) {
        const metaData = await metaRes.json();
        const sheetTitles = (metaData.sheets || []).map((s: any) => s.properties.title);
        const candidates = ['privacy_consent', 'privacy', '개인정보동의', '동의여부', '동의'];
        const matched = sheetTitles.find((title: string) => 
          candidates.some(cand => cand.toLowerCase() === title.trim().toLowerCase())
        );
        if (matched) {
          activeSheetName = matched;
        } else {
          // If none of candidates exist, create a new 'privacy' sheet
          try {
            const createUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
            const createRes = await fetch(createUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${googleToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                requests: [
                  {
                    addSheet: {
                      properties: {
                        title: 'privacy'
                      }
                    }
                  }
                ]
              })
            });

            if (createRes.ok) {
              // Newly created sheet - prepopulate Headers
              const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/privacy!A1:C1?valueInputOption=USER_ENTERED`;
              await fetch(headerUrl, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${googleToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  values: [['학번', '이름', '동의']]
                })
              });
              activeSheetName = 'privacy';
            }
          } catch (createErr) {
            console.log('Error creating initial privacy sheet:', createErr);
          }
        }
      }

      // 2b. Fetch existing values from the active sheet to search for studentId in place update
      const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(activeSheetName)}?valueRenderOption=FORMATTED_VALUE`;
      const getRes = await fetch(getUrl, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      let updated = false;

      if (getRes.ok) {
        const getData = await getRes.json();
        const values = getData.values || [];
        if (values.length > 0) {
          const headers = values[0].map((h: any) => String(h || '').trim());
          const idxId = findIndexByNames(headers, ['학번', 'ID', 'studentId', '학생ID', '학급번호', '번호', '학급']);
          const idxName = findIndexByNames(headers, ['이름', '성명', '학생명', 'name']);
          const idxAgreed = findIndexByNames(headers, ['동의', 'consent', 'agreed', '동의여부']);

          if (idxId !== -1) {
            const targetCleanId = studentId.trim().replace(/\s/g, '');
            let foundRowIndex = -1;
            for (let i = 1; i < values.length; i++) {
              const rowId = String(values[i][idxId] || '').trim().replace(/\s/g, '');
              if (rowId === targetCleanId) {
                foundRowIndex = i + 1; // 1-based index (e.g. index 1 is row 2)
                break;
              }
            }

            if (foundRowIndex !== -1) {
              const updateColIndex = idxAgreed !== -1 ? idxAgreed : 2;
              const colLetter = String.fromCharCode(65 + updateColIndex); // A, B, C, D...
              const updateRange = `${activeSheetName}!${colLetter}${foundRowIndex}`;
              
              const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`;
              const updateRes = await fetch(updateUrl, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${googleToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  values: [[agreementStatus]]
                })
              });
              if (updateRes.ok) {
                console.log(`Directly updated cell ${updateRange} to '${agreementStatus}'`);
                updated = true;
              } else {
                throw new Error(`동의 데이터 직접 셀 업데이트 쓰기 실패: ${await updateRes.text()}`);
              }
            }
          }
        }
      }

      // If existing student registration wasn't found in active privacy sheet, do standard append
      if (!updated) {
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(activeSheetName)}:append?valueInputOption=USER_ENTERED`;
        const appendRes = await fetch(appendUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [rowData]
          })
        });

        if (appendRes.ok) {
          console.log(`Appended new consent row [${studentId}, ${name}, '${agreementStatus}'] to ${activeSheetName}`);
          return true;
        } else {
          throw new Error(`동의 행 추가(Append) API 실패: ${await appendRes.text()}`);
        }
      } else {
        return true;
      }
    } catch (err: any) {
      console.error('Direct Google Sheets save process failed:', err);
      lastError = err;
    }
  }

  // If we reached here, and we had an error or were not able to save anywhere
  if (lastError) {
    if (appsScriptUrl && appsScriptUrl.trim()) {
      throw lastError;
    }
    console.warn('[Offline Fallback] Google spreadsheets write failed, continuing with browser local storage fallback:', lastError.message || lastError);
    return true; // Return true as fallback so the student is not blocked from logging in or using the app
  }

  // If no write configuration exists (e.g. read-only share-link CSV mode), bypass error and approve local storage fallback
  if (!appsScriptUrl && !googleToken) {
    console.log('No write integration config (Apps Script or Google OAuth Token) matches. Operating under browser local storage mode.');
    return true;
  }

  console.warn('[Offline Fallback] No integration write device completed, using local storage fallback.');
  return true;
}

// -----------------------------------------------------------------------------
// ANALYTICS & UTILS
// -----------------------------------------------------------------------------

// Search column header index in sheet
function findIndexByNames(headers: string[], candidates: string[]): number {
  return headers.findIndex((h) =>
    candidates.some((cand) => cand.toLowerCase() === h.toLowerCase())
  );
}

// Clean and normalize input search fields
const cleanCellValue = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null) return '';
  return String(val).trim();
};

const cleanCodeValue = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null) return '';
  let clean = String(val).trim();
  // Strip trailing float decimal artifacts (.0) from spreadsheet integers (e.g. 10101.0 -> 10101)
  if (clean.includes('.')) {
    const parts = clean.split('.');
    if (/^0+$/.test(parts[1])) {
      clean = parts[0];
    }
  }
  return clean.replace(/[^0-9A-Za-z]/g, '');
};

// Check if a cell represents a yes consent status
function isAgreedValue(val: string | number | undefined | null): boolean {
  if (val === undefined || val === null) return false;
  const s = String(val).trim().toLowerCase();
  return (
    s === 'y' ||
    s === 'yes' ||
    s === 'true' ||
    s === '1' ||
    s === 'o' ||
    s.includes('동의') ||
    s === '예' ||
    s === '여' ||
    s === '확인' ||
    s.includes('agree')
  );
}

// Generate typing records statistics for grade breakdown rank list view
export function generateSchoolRanks(
  allAuth: StudentAuth[],
  allEnglish: TypingRecord[],
  allKorean: TypingRecord[],
  allLevels: LevelRule[],
  type: 'english' | 'korean'
): SchoolRankEntry[] {
  const records = type === 'english' ? allEnglish : allKorean;
  const ranks: SchoolRankEntry[] = [];

  // Group typing values by unique active studentId
  const studentIds = Array.from(new Set(allAuth.map((a) => a.studentId)));

  for (const sId of studentIds) {
    const authRecord = allAuth.find((a) => a.studentId === sId);
    if (!authRecord) continue;

    const stats = calculateStudentStats(sId, records, allLevels, type);
    if (stats.maxSpeed > 0) {
      ranks.push({
        rank: 0,
        studentId: sId,
        name: authRecord.name,
        grade: parseStudentIdInfo(sId).grade,
        department: parseStudentIdInfo(sId).department,
        maxSpeed: stats.maxSpeed,
        growth: stats.growth,
        currentLevel: stats.currentLevel
      });
    }
  }

  // Sort descending by highest typing speed
  const sorted = ranks.sort((a, b) => b.maxSpeed - a.maxSpeed);
  sorted.forEach((item, index) => {
    item.rank = index + 1;
  });

  return sorted;
}

// Helper: Parse school standard 5-digit student id to extract Grade and Department
export function parseStudentIdInfo(studentId: string): { grade: string; department: string } {
  const idStr = String(studentId || '').trim();
  let grade = '1';
  let classNum = 1;
  let department = '기타';

  if (idStr.length >= 5) {
    grade = idStr.charAt(0);
    const classChar = idStr.charAt(2);
    const parsedClass = parseInt(classChar, 10);
    if (!isNaN(parsedClass)) {
      classNum = parsedClass;
    }
  } else if (idStr.length > 0) {
    const firstChar = idStr.charAt(0);
    if (/^\d$/.test(firstChar)) {
      grade = firstChar;
    } else {
      grade = '기타';
    }
    
    // Attempt intermediate character for class if 4 digits (e.g. 1215 is grade 1, class 2, number 15)
    if (idStr.length >= 3) {
      const classChar = idStr.charAt(1);
      const parsedClass = parseInt(classChar, 10);
      if (!isNaN(parsedClass)) {
        classNum = parsedClass;
      }
    }
  } else {
    return { grade: '기타', department: '공통' };
  }

  if (classNum === 1 || classNum === 2) {
    department = '항공서비스';
  } else if (classNum === 3 || classNum === 4) {
    department = '부사관경영';
  } else if (classNum === 5 || classNum === 6) {
    department = 'SNS마케팅';
  } else if (classNum === 7 || classNum === 8) {
    department = '콘텐츠디자인';
  }

  return { grade, department };
}

export function normalizeDepartment(dept: string | null | undefined): string {
  const d = String(dept || '').trim();
  if (d.includes('항공')) return '항공서비스';
  if (d.includes('부사관')) return '부사관경영';
  if (d.includes('SNS') || d.includes('sns') || d.includes('Sns')) return 'SNS마케팅';
  if (d.includes('콘텐츠') || d.includes('컨텐츠')) return '콘텐츠디자인';
  return d || '공통';
}

export function resolveStudentGradeAndDept(studentId: string, sheetGrade?: string | null, sheetDept?: string | null): { grade: string; department: string } {
  const info = parseStudentIdInfo(studentId);
  
  let finalGrade = '';
  if (info.grade && info.grade !== '기타' && info.grade !== '공통') {
    finalGrade = info.grade;
  } else {
    finalGrade = sheetGrade ? String(sheetGrade).replace(/학년/g, '').trim() : '';
  }
  if (!finalGrade || finalGrade === '기타') {
    finalGrade = '1';
  }
  finalGrade = finalGrade.replace(/학년/g, '').trim();

  let finalDept = '';
  if (info.department && info.department !== '기타' && info.department !== '공통') {
    finalDept = info.department;
  } else {
    finalDept = normalizeDepartment(sheetDept);
  }
  if (!finalDept || finalDept === '기타') {
    finalDept = '공통';
  }

  return { grade: finalGrade, department: finalDept };
}

// Simple and robust parser for double-quoted or standard CSV fields
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"'; // Doubled quote acts as an escaped quote
        i++;
      } else {
        inQuotes = !inQuotes; // Toggle quote state
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue);
      currentValue = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip LF of CRLF
      }
      row.push(currentValue);
      lines.push(row);
      row = [];
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  // Push remaining trailing values
  if (currentValue !== '' || row.length > 0) {
    row.push(currentValue);
    lines.push(row);
  }

  return lines.filter((l) => l.length > 0 && l.some((cell) => cell.trim() !== ''));
}
