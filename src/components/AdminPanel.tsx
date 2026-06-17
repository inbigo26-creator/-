/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { googleSignIn, logout, getAccessToken } from '../auth';
import { fetchSpreadsheetData, DEFAULT_SPREADSHEET_ID, clearDataCache, parseStudentIdInfo } from '../data';
import { StudentAuth } from '../types';
import { 
  Settings, Key, Link2, CheckCircle2, AlertTriangle, Copy, 
  Terminal, ShieldCheck, HelpCircle, HardDriveDownload, UserCheck, Eye, LogIn, LogOut, ChevronDown, ChevronUp,
  Lock, Unlock
} from 'lucide-react';
import { User } from 'firebase/auth';

interface AdminPanelProps {
  onSpreadsheetConfigured: (spreadsheetId: string, accessToken: string | null, appsScriptUrl?: string | null) => void;
  currentSpreadsheetId: string;
  currentAppsScriptUrl?: string | null;
  onClose: () => void;
  mvpLocks?: {[month: string]: boolean};
  onToggleMvpLock?: (month: string, currentWinners: any[]) => void;
  monthlySnackWinnersHistory?: {[month: string]: { winners: any[] }};
  sortedMonths?: string[];
  authDb?: StudentAuth[];
  onResetStudentPin?: (studentId: string, newPin: string) => Promise<boolean>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  onSpreadsheetConfigured, 
  currentSpreadsheetId, 
  currentAppsScriptUrl,
  onClose,
  mvpLocks = {},
  onToggleMvpLock,
  monthlySnackWinnersHistory = {},
  sortedMonths = [],
  authDb = [],
  onResetStudentPin
}) => {
  const [selectedStudentIdForReset, setSelectedStudentIdForReset] = useState<string>('');
  const [isResettingPin, setIsResettingPin] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  const [spreadsheetIdIn, setSpreadsheetIdIn] = useState(
    currentSpreadsheetId === DEFAULT_SPREADSHEET_ID ? '' : currentSpreadsheetId
  );
  const [appsScriptUrlIn, setAppsScriptUrlIn] = useState(currentAppsScriptUrl || '');
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    authCount?: number;
    englishCount?: number;
    koreanCount?: number;
    levelCount?: number;
    message?: string;
  } | null>(null);

  // Tabs for Apps Script Code Export
  const [selectedScriptTab, setSelectedScriptTab] = useState<'gs' | 'html'>('gs');
  const [copiedText, setCopiedText] = useState(false);
  const [showScriptExporter, setShowScriptExporter] = useState(false);

  // Privacy Policy File Upload and Edit
  const [privacyText, setPrivacyText] = useState<string>(() => localStorage.getItem('privacy_policy_text') || '');
  const [privacySaveSuccess, setPrivacySaveSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Handle Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    setIsAuthenticating(true);
    setTestResult(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setAccessToken(res.accessToken);
        clearDataCache(); // Clear cache to allow fresh fetch
      }
    } catch (err: any) {
      console.error('Google Auth Failed:', err);
      alert('구글 로그인에 실패했습니다: ' + err.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Handle Sign Out from Google Workspace
  const handleGoogleSignOut = async () => {
    try {
      await logout();
      setGoogleUser(null);
      setAccessToken(null);
      setTestResult(null);
      clearDataCache();
    } catch (err) {
      console.error('Signout failed:', err);
    }
  };

  // 🛡️ Privacy Policy File Handlers
  const handleFileRead = (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      alert('텍스트(.txt) 또는 마크다운(.md) 파일만 업로드할 수 있습니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setPrivacyText(text);
        setPrivacySaveSuccess(false);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileRead(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileRead(e.target.files[0]);
    }
  };

  const handleSavePrivacy = () => {
    localStorage.setItem('privacy_policy_text', privacyText);
    setPrivacySaveSuccess(true);
    setTimeout(() => setPrivacySaveSuccess(false), 3000);
  };

  const handleResetPrivacy = () => {
    if (confirm('개인정보처리방침을 기본 제공안으로 초기화하시겠습니까?')) {
      localStorage.removeItem('privacy_policy_text');
      setPrivacyText('');
      setPrivacySaveSuccess(true);
      setTimeout(() => setPrivacySaveSuccess(false), 3000);
    }
  };

  // Extract Spreadsheet ID from Google Sheets URL
  const handleSpreadsheetIdChange = (val: string) => {
    let extractedId = val.trim();
    // Regex to match google sheets url structure
    const match = val.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      extractedId = match[1];
    }
    setSpreadsheetIdIn(extractedId);
  };

  // Test real database connection
  const handleTestConnection = async () => {
    if (!spreadsheetIdIn && !appsScriptUrlIn) {
      alert('스프레드시트 ID/URL 또는 가스(GAS) 앱 주소를 입력해주십시오.');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      // Clear data cache before test
      clearDataCache();
      const targetSheetId = spreadsheetIdIn || DEFAULT_SPREADSHEET_ID;
      const data = await fetchSpreadsheetData(targetSheetId, accessToken, appsScriptUrlIn);
      
      setTestResult({
        success: true,
        authCount: data.auth.length,
        englishCount: data.english.length,
        koreanCount: data.korean.length,
        levelCount: data.levels.length
      });

      // Notify parent app of new active sheet
      onSpreadsheetConfigured(targetSheetId, accessToken, appsScriptUrlIn);
    } catch (err: any) {
      console.error(err);
      setTestResult({
        success: false,
        message: err.message || '인증되지 않은 연결이거나 데이터 분석(CORS/권한)에 실패했습니다.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Use default mockup sandbox
  const handleResetToDemo = () => {
    setSpreadsheetIdIn('');
    setAppsScriptUrlIn('');
    setTestResult(null);
    onSpreadsheetConfigured(DEFAULT_SPREADSHEET_ID, null, null);
    alert('데모 가상 데이터 모드로 전환되었습니다.');
  };

  // Save and apply spreadsheet ID directly without requiring test sequence
  const handleSaveAndApply = () => {
    if (!spreadsheetIdIn && !appsScriptUrlIn) {
      alert('스프레드시트 URL/ID 또는 생성한 앱스 스크립트 웹 앱 URL을 먼저 입력해주십시오.');
      return;
    }
    // Clear data cache to ensure new fetch
    clearDataCache();
    const targetSheetId = spreadsheetIdIn || DEFAULT_SPREADSHEET_ID;
    onSpreadsheetConfigured(targetSheetId, accessToken, appsScriptUrlIn);
    alert('🎉 스프레드시트 주소 및 앱스 스크립트 경로가 성공적으로 저장되었으며 대시보드에 적용되었습니다!');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Standalone Google Apps Script backend source code
  const appsScriptCode_GS = `/**
 * 학생 타자 성장 조회 시스템 - Code.gs
 * [안내] Google 스프레드시트 상단 메뉴 [확장 프로그램] > [Apps Script] 에 붙여넣으세요.
 * 
 * 제작 목적: 학생 개인정보 보호를 위한 서버 필터링 조회 시스템 및 API 게이트웨이
 */

function doGet(e) {
  // 1. 디바이스 AI 스튜디오 및 프론트엔드 실시간 API 인터페이스 분기
  if (e && e.parameter && e.parameter.action) {
    if (e.parameter.action === 'getAllData') {
      try {
        var data = getAllDataForSystem();
        return ContentService.createTextOutput(JSON.stringify(data))
            .setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 1b. 개인정보 수집 및 이용 동의 처리
    if (e.parameter.action === 'saveConsent') {
      try {
        var stdId = e.parameter.studentId;
        var stdNm = e.parameter.name;
        var agreement = e.parameter.agreement || 'Y';
        var res = saveConsentGas(stdId, stdNm, agreement);
        return ContentService.createTextOutput(JSON.stringify(res))
            .setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 1c. 학생 비밀번호 변경 처리
    if (e.parameter.action === 'saveStudentPin') {
      try {
        var stdId = e.parameter.studentId;
        var pin = e.parameter.pin;
        var res = saveStudentPinGas(stdId, pin);
        return ContentService.createTextOutput(JSON.stringify(res))
            .setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
      }
    }
  }

  // 2. 단일 학생 검색 분기 (선택 사항)
  if (e && e.parameter && e.parameter.studentId) {
    try {
      var stdId = e.parameter.studentId;
      var pin = e.parameter.pin;
      var data = getStudentTypingData(stdId, pin);
      return ContentService.createTextOutput(JSON.stringify(data))
          .setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // 3. 기본값: 모바일 학생용 직접 단독 조회 HTML 페이지 파싱 렌더링
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('학생 타자 성장 조회 시스템')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * 전교생 데이터 일괄 로드 (React 앱 연동용)
 */
function getAllDataForSystem() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = {
    success: true,
    auth: [],
    english: [],
    korean: [],
    levels: [],
    privacy: []
  };

  var fallbackNamesMap = {
    'students_auth': ['students_auth', 'student_auth', 'students', 'auth', '인증', '학생명부', '학생_auth'],
    'english_all': ['english_all', 'english', '영어_all', '영어', '영어타자', 'englishes', 'eng_all'],
    'korean_all': ['korean_all', 'korean', '한글_all', '한글', '한글타자', 'koreans', 'kor_all'],
    'level_rule': ['level_rule', 'level_rules', 'levels', 'rules', '급수기준', '기준'],
    'privacy': ['privacy_consent', 'privacy', '개인정보동의', '동의여부', '동의']
  };

  function getSheetByPossibleNames(candidates) {
    if (!ss) return null;
    var allSheets = ss.getSheets();
    
    // 1차: 대소문자 및 특수기호/공백 정밀 일치
    for (var i = 0; i < candidates.length; i++) {
      var cand = String(candidates[i]).trim().toLowerCase().replace(/[\s_/-]/g, '');
      for (var j = 0; j < allSheets.length; j++) {
        var sClean = String(allSheets[j].getName()).trim().toLowerCase().replace(/[\s_/-]/g, '');
        if (sClean === cand) {
          return allSheets[j];
        }
      }
    }
    
    // 2차: 느슨한 부분 포함 일치
    for (var i = 0; i < candidates.length; i++) {
      var cand = String(candidates[i]).trim().toLowerCase().replace(/[\s_/-]/g, '');
      for (var j = 0; j < allSheets.length; j++) {
        var sClean = String(allSheets[j].getName()).trim().toLowerCase().replace(/[\s_/-]/g, '');
        if (sClean.indexOf(cand) !== -1 || cand.indexOf(sClean) !== -1) {
          return allSheets[j];
        }
      }
    }
    return null;
  }

  // 1. students_auth
  var authSheet = getSheetByPossibleNames(fallbackNamesMap['students_auth']);
  if (authSheet) {
    var values = authSheet.getDataRange().getValues();
    var headers = values[0];
    var idxId = findHeaderIndex(headers, ['학번', 'ID', 'studentId', '학생ID', '학급번호', '번호']);
    var idxName = findHeaderIndex(headers, ['이름', '성명', '학생명', 'name']);
    var idxPin = findHeaderIndex(headers, ['인증번호', '비밀번호', '비번', '핀', '인증', 'pin']);
    
    if (idxId !== -1 && idxName !== -1 && idxPin !== -1) {
      for (var i = 1; i < values.length; i++) {
        var id = cleanCode(values[i][idxId]);
        var p = cleanCode(values[i][idxPin]);
        var nm = cleanValue(values[i][idxName]);
        if (id && p) {
          result.auth.push({ studentId: id, name: nm, pin: p });
        }
      }
    }
  }

  // 통합 유연 파싱 헬퍼 (가로 누적/세로 누적 레이아웃 완벽 동시 지원)
  function parseTypingSheet(candidates, typeStr) {
    var sheet = getSheetByPossibleNames(candidates);
    var dataList = [];
    if (!sheet) return dataList;

    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return dataList;

    var headers = values[0];
    var idxId = findHeaderIndex(headers, ['학번', 'ID', 'studentId', '학생ID', '학급번호', '번호']);
    var idxName = findHeaderIndex(headers, ['이름', '성명', '학생명', 'name']);

    if (idxId === -1 || idxName === -1) return dataList;

    // 헤더에서 각 월(예: 5월, 6월, 7월 등 가로 컬럼) 감지
    var horizontalMonths = [];
    for (var col = 0; col < headers.length; col++) {
      if (col === idxId || col === idxName) continue;
      var h = String(headers[col] || '').trim();
      var numMatch = h.match(/\\d+/);
      if (numMatch) {
        var numVal = parseInt(numMatch[0], 10);
        if (numVal >= 1 && numVal <= 12) {
          horizontalMonths.push({ monthName: numVal + '월', index: col });
        }
      }
    }

    if (horizontalMonths.length > 0) {
      // 가로형 레이아웃 파싱: 한 행에 여러 월 데이터 동시 존재
      for (var row = 1; row < values.length; row++) {
        var id = cleanCode(values[row][idxId]);
        var name = cleanValue(values[row][idxName]);

        if (!id) continue;

        var studentInfo = parseStudentIdInfoGas(id);

        for (var m = 0; m < horizontalMonths.length; m++) {
          var mInfo = horizontalMonths[m];
          var speedRaw = values[row][mInfo.index];
          if (speedRaw !== undefined && speedRaw !== null && String(speedRaw).trim() !== '') {
            var speedVal = parseInt(cleanCode(speedRaw), 10);
            if (!isNaN(speedVal)) {
              dataList.push({
                studentId: id,
                name: name,
                grade: studentInfo.grade,
                department: studentInfo.department,
                month: mInfo.monthName,
                speed: speedVal,
                type: typeStr
              });
            }
          }
        }
      }
    } else {
      // 기존 세로형 레이아웃 파싱: 월(구분) 컬럼 + 타수 컬럼
      var idxMonth = findHeaderIndex(headers, ['월', '시기', 'month', '구분']);
      var targetHeaderName = typeStr === 'english' ? '영타' : '한타';
      var idxSpeed = findHeaderIndex(headers, [targetHeaderName, typeStr === 'english' ? '영어' : '한글', 'speed', '타수']);

      if (idxMonth !== -1 && idxSpeed !== -1) {
        for (var row = 1; row < values.length; row++) {
          var id = cleanCode(values[row][idxId]);
          var mon = cleanValue(values[row][idxMonth]);
          var speedRaw = values[row][idxSpeed];

          if (id && mon && speedRaw !== undefined && speedRaw !== null && String(speedRaw).trim() !== '') {
            var speedVal = parseInt(cleanCode(speedRaw), 10) || 0;
            var studentInfo = parseStudentIdInfoGas(id);
            dataList.push({
              studentId: id,
              name: idxName !== -1 ? cleanValue(values[row][idxName]) : '',
              grade: studentInfo.grade,
              department: studentInfo.department,
              month: mon,
              speed: speedVal,
              type: typeStr
            });
          }
        }
      }
    }
    return dataList;
  }

  result.english = parseTypingSheet(fallbackNamesMap['english_all'], 'english');
  result.korean = parseTypingSheet(fallbackNamesMap['korean_all'], 'korean');

  // 4. level_rule
  var ruleSheet = getSheetByPossibleNames(fallbackNamesMap['level_rule']);
  if (ruleSheet) {
    var values = ruleSheet.getDataRange().getValues();
    var headers = values[0];
    var idxType = findHeaderIndex(headers, ['타입', '구분', '종류', 'type', '언어']);
    var idxLevel = findHeaderIndex(headers, ['급수', '등급', '레벨', 'level']);
    var idxMin = findHeaderIndex(headers, ['최소값', '기준', '타수', '최소', 'min', '최저']);

    if (idxType !== -1 && idxLevel !== -1 && idxMin !== -1) {
      for (var i = 1; i < values.length; i++) {
        var ty = cleanValue(values[i][idxType]);
        var lv = cleanValue(values[i][idxLevel]);
        if (ty && lv) {
          result.levels.push({
            type: ty,
            level: lv,
            minVal: parseInt(cleanCode(values[i][idxMin]), 10) || 0
          });
        }
      }
    }
  }

  // 4b. privacy_consent parsing from sheet
  var privacySheet = getSheetByPossibleNames(fallbackNamesMap['privacy']);
  if (privacySheet) {
    var pValues = privacySheet.getDataRange().getValues();
    if (pValues.length > 1) {
      var pHeaders = pValues[0];
      var pIdxId = findHeaderIndex(pHeaders, ['학번', 'ID', 'studentId', '학생ID', '학급번호', '번호', '학급']);
      var pIdxName = findHeaderIndex(pHeaders, ['이름', '성명', '학생명', 'name']);
      var pIdxAgreed = findHeaderIndex(pHeaders, ['동의', 'consent', 'agreed', '동의여부']);
      
      if (pIdxId !== -1 && pIdxName !== -1) {
        for (var i = 1; i < pValues.length; i++) {
          var id = cleanCode(pValues[i][pIdxId]);
          var nm = cleanValue(pValues[i][pIdxName]);
          var rawAgreed = pIdxAgreed !== -1 ? pValues[i][pIdxAgreed] : '';
          var agreed = pIdxAgreed !== -1 ? isAgreedValueGas(rawAgreed) : false;
          if (id) {
            result.privacy.push({ studentId: id, name: nm, agreed: agreed });
          }
        }
      }
    }
  }

  return result;
}

/**
 * 유연한 헤더 매칭용 인덱스 검색 함수 (대소문자, 공백, 다양한 한글명 대응)
 */
function findHeaderIndex(headers, possibleNames) {
  if (!headers || headers.length === 0) return -1;
  
  var cleanedHeaders = headers.map(function(h) {
    return String(h || '').trim().replace(/^\\uFEFF/, '').toLowerCase().replace(/['"“”\\s_\\/\\\\-]/g, '');
  });
  
  var cleanedPossibles = possibleNames.map(function(p) {
    return String(p || '').trim().toLowerCase().replace(/['"“”\\s_\\/\\\\-]/g, '');
  });
  
  // 1차: 완전 일치 체크
  for (var i = 0; i < cleanedPossibles.length; i++) {
    var idx = cleanedHeaders.indexOf(cleanedPossibles[i]);
    if (idx !== -1) return idx;
  }
  
  // 2차: 포함 체크
  for (var i = 0; i < cleanedHeaders.length; i++) {
    var header = cleanedHeaders[i];
    if (!header) continue;
    for (var j = 0; j < cleanedPossibles.length; j++) {
      if (header.indexOf(cleanedPossibles[j]) !== -1 || cleanedPossibles[j].indexOf(header) !== -1) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * 개인정보 동의 상태를 다각도로 안전하게 판별 (미동의, 비동의를 완벽 구분하여 '동의' 오탐 방지)
 */
function isAgreedValueGas(val) {
  if (val === null || val === undefined) return false;
  var clean = String(val).trim().toUpperCase().replace(/[\s_/-]/g, '');
  if (!clean) return false;

  // Explicit negative indicators (우선 필터링하여 '미동의' 등에 대한 오동작 원천 차단)
  if (
    clean === 'N' ||
    clean === 'NO' ||
    clean === 'FALSE' ||
    clean === 'X' ||
    clean.indexOf('미동의') !== -1 ||
    clean.indexOf('비동의') !== -1 ||
    clean.indexOf('안함') !== -1 ||
    clean.indexOf('거절') !== -1 ||
    clean.indexOf('거부') !== -1 ||
    clean.indexOf('아니오') !== -1 ||
    clean.indexOf('PENDING') !== -1
  ) {
    return false;
  }

  // Explicit positive indicators
  if (
    clean === 'Y' ||
    clean === 'YES' ||
    clean === 'TRUE' ||
    clean === 'ACTIVE' ||
    clean.indexOf('동의') !== -1 ||
    clean.indexOf('AGREE') !== -1
  ) {
    return true;
  }

  return false;
}

/**
 * 값 정제 헬퍼 (소수점 .0 및 따옴표 제거)
 */
function cleanValue(val) {
  if (val === null || val === undefined) return '';
  var str = String(val).trim().replace(/['"“”]/g, '');
  if (str.endsWith('.0')) {
    str = str.substring(0, str.length - 2);
  }
  return str.trim();
}

/**
 * 전열 및 공백 제거 헬퍼
 */
function cleanCode(val) {
  return cleanValue(val).replace(/\\s/g, '');
}

/**
 * 학번 5자리 기반 학년/학과 추출 규칙 지원
 */
function parseStudentIdInfoGas(studentId) {
  var cleanId = String(studentId || '').trim();
  var grade = '1';
  var classNum = 1;
  var department = '일반';

  if (cleanId.length >= 5) {
    grade = cleanId.charAt(0);
    var classChar = cleanId.charAt(2);
    var parsedClass = parseInt(classChar, 10);
    if (!isNaN(parsedClass)) {
      classNum = parsedClass;
    }
  } else if (cleanId.length > 0) {
    var firstChar = cleanId.charAt(0);
    if (/^\d$/.test(firstChar)) {
      grade = firstChar;
    }
  }

  if (classNum === 1 || classNum === 2) {
    department = '항공서비스';
  } else if (classNum === 3 || classNum === 4) {
    department = '부사관경영';
  } else if (classNum === 5 || classNum === 6) {
    department = 'SNS마케팅';
  } else if (classNum === 7 || classNum === 8) {
    department = '콘텐츠디자인';
  } else {
    department = '기타';
  }

  return { grade: grade, department: department };
}

/**
 * 학생 인증 및 데이터 조회 (개인정보 보호 필터링 적용)
 */
function getStudentTypingData(studentId, pin) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. 학생 본인 인증 시트 조회
    var authSheet = ss.getSheetByName('students_auth');
    if (!authSheet) {
      return { success: false, message: "students_auth 시트를 찾을 수 없습니다." };
    }
    
    var authValues = authSheet.getDataRange().getValues();
    var authHeaders = authValues[0];
    
    var idxId = findHeaderIndex(authHeaders, ['학번', 'ID', 'studentId', '학생ID', '학급번호', '번호']);
    var idxName = findHeaderIndex(authHeaders, ['이름', '성명', '학생명', 'name']);
    var idxPin = findHeaderIndex(authHeaders, ['인증번호', '비밀번호', '비번', '핀', '인증', 'pin']);
    
    if (idxId === -1 || idxName === -1 || idxPin === -1) {
      return { success: false, message: "students_auth 시트의 필수 컬럼 헤더(학번, 이름, 인증번호)를 일치시킬 수 없습니다. 헤더 이름을 확인해 주세요." };
    }
    
    var isAuthorized = false;
    var studentName = '';
    var searchId = cleanCode(studentId);
    var searchPin = cleanCode(pin);
    
    for (var i = 1; i < authValues.length; i++) {
      var rowId = cleanCode(authValues[i][idxId]);
      var rowPin = cleanCode(authValues[i][idxPin]);
      if (rowId === searchId && rowPin === searchPin) {
        isAuthorized = true;
        studentName = cleanValue(authValues[i][idxName]);
        break;
      }
    }
    
    if (!isAuthorized) {
      return { success: false, message: "학번 또는 개인인증번호가 일치하지 않습니다." };
    }
    
    // 2. 통합 파싱 도구를 사용해 전체 데이터를 파싱한 뒤 로그인한 학생 데이터만 슬라이스 필터링 (가로형 포맷 대응 완료)
    var allData = getAllDataForSystem();
    
    var englishRecords = allData.english.filter(function(r) { return r.studentId === searchId; });
    var koreanRecords = allData.korean.filter(function(r) { return r.studentId === searchId; });
    
    return {
      success: true,
      studentName: studentName,
      studentId: searchId,
      english: englishRecords,
      korean: koreanRecords,
      levels: allData.levels,
      privacy: allData.privacy ? allData.privacy.filter(function(r) { return r.studentId === searchId; }) : []
    };
    
  } catch(e) {
    return { success: false, message: "시스템 처리 중 서버 오류가 발생했습니다: " + e.toString() };
  }
}

/**
 * 개인정보 수집 및 이용 동의 저장
 */
function saveConsentGas(studentId, name, agreement) {
  var aggStatus = (agreement === 'N' || agreement === 'n') ? 'N' : 'Y';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var candidates = ['privacy_consent', 'privacy', '개인정보동의', '동의여부', '동의'];
  var sheet = null;
  
  if (ss) {
    var allSheets = ss.getSheets();
    for (var i = 0; i < candidates.length; i++) {
      var cand = String(candidates[i]).trim().toLowerCase().replace(/[\s_/-]/g, '');
      for (var j = 0; j < allSheets.length; j++) {
        var sClean = String(allSheets[j].getName()).trim().toLowerCase().replace(/[\s_/-]/g, '');
        if (sClean === cand) {
          sheet = allSheets[j];
          break;
        }
      }
      if (sheet) break;
    }
  }
  
  if (!sheet) {
    sheet = ss.insertSheet('privacy');
    sheet.appendRow(['학번', '이름', '동의']);
  }
  
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idxId = findHeaderIndex(headers, ['학번', 'ID', 'studentId', '학생ID', '학급번호', '번호']);
  var idxName = findHeaderIndex(headers, ['이름', '성명', '학생명', 'name']);
  var idxAgreed = findHeaderIndex(headers, ['동의', 'consent', 'agreed', '동의여부']);
  
  if (idxId === -1) idxId = 0;
  if (idxName === -1) idxName = 1;
  if (idxAgreed === -1) idxAgreed = 2;
  
  var foundRowIndex = -1;
  
  function normalizeIdGasTemp(val) {
    if (val === null || val === undefined) return '';
    var s = String(val).trim().replace(/['"“”\s]/g, '');
    if (s.indexOf('.0') !== -1 && s.endsWith('.0')) {
      s = s.substring(0, s.length - 2);
    }
    return s;
  }
  
  var searchId = normalizeIdGasTemp(studentId);
  for (var i = 1; i < values.length; i++) {
    var curId = normalizeIdGasTemp(values[i][idxId]);
    if (curId && curId === searchId) {
      foundRowIndex = i + 1;
      break;
    }
  }
  
  if (foundRowIndex !== -1) {
    sheet.getRange(foundRowIndex, idxAgreed + 1).setValue(aggStatus);
    if (name) {
      sheet.getRange(foundRowIndex, idxName + 1).setValue(name);
    }
  } else {
    var newRow = [];
    var maxIdx = Math.max(idxId, idxName, idxAgreed);
    for (var col = 0; col <= maxIdx; col++) {
      if (col === idxId) newRow.push(studentId);
      else if (col === idxName) newRow.push(name || '');
      else if (col === idxAgreed) newRow.push(aggStatus);
      else newRow.push('');
    }
    sheet.appendRow(newRow);
  }
  
  return { success: true, message: "동의 정보가 성공적으로 기록되었습니다." };
}

/**
 * 학생 비밀번호 변경/재설정
 */
function saveStudentPinGas(studentId, pin) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var candidates = ['students_auth', 'student_auth', 'students', 'auth', '인증', '학생명부', '학생_auth'];
  var sheet = null;
  
  if (ss) {
    var allSheets = ss.getSheets();
    for (var i = 0; i < candidates.length; i++) {
      var cand = String(candidates[i]).trim().toLowerCase().replace(/[\s_/-]/g, '');
      for (var j = 0; j < allSheets.length; j++) {
        var sClean = String(allSheets[j].getName()).trim().toLowerCase().replace(/[\s_/-]/g, '');
        if (sClean === cand) {
          sheet = allSheets[j];
          break;
        }
      }
      if (sheet) break;
    }
  }
  
  if (!sheet) {
    return { success: false, message: "학생 인증 명부 시트를 찾을 수 없습니다." };
  }
  
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idxId = findHeaderIndex(headers, ['학번', 'ID', 'studentId', '학생ID', '학급번호', '번호', '학급']);
  var idxPin = findHeaderIndex(headers, ['인증번호', '비밀번호', '비번', '핀', '인증', 'pin']);
  
  if (idxId === -1) idxId = 0;
  if (idxPin === -1) idxPin = 2; // Default to C column
  
  var foundRowIndex = -1;
  
  function normalizeIdGasTemp(val) {
    if (val === null || val === undefined) return '';
    var s = String(val).trim().replace(/['"“”\s]/g, '');
    if (s.indexOf('.0') !== -1 && s.endsWith('.0')) {
      s = s.substring(0, s.length - 2);
    }
    return s;
  }
  
  var searchId = normalizeIdGasTemp(studentId);
  for (var i = 1; i < values.length; i++) {
    var curId = normalizeIdGasTemp(values[i][idxId]);
    if (curId && curId === searchId) {
      foundRowIndex = i + 1;
      break;
    }
  }
  
  if (foundRowIndex !== -1) {
    sheet.getRange(foundRowIndex, idxPin + 1).setValue("'" + pin);
    return { success: true, message: "학생 비밀번호가 성공적으로 변경되었습니다." };
  } else {
    return { success: false, message: "학생 인증 명부에서 해당 학번(" + studentId + ")을 찾을 수 없습니다." };
  }
}`;

  const appsScriptCode_HTML = `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta charset="UTF-8">
  <title>학생 타자 성장 조회 시스템</title>
  <!-- Tailwind CSS 모바일 가속 로딩 -->
  <script src="https://cdn.tailwindcss.com"></script>
 </head>
<body class="bg-slate-50 min-h-screen text-slate-800 antialiased font-sans flex items-center justify-center p-4">
  <div class="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
    
    <!-- Header -->
    <div class="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 text-white text-center">
      <h1 class="text-xl font-bold tracking-tight">학생 타자 성장 조회</h1>
      <p class="text-xs text-indigo-100 mt-1 font-medium">학번과 개인 인증번호로 본인 기록을 조회하세요</p>
    </div>

    {/* 로그인 폼 */}
    <div id="login-section" class="p-6 space-y-5">
      <div>
        <label class="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">학번 (5자리)</label>
        <input type="number" id="studentId" placeholder="예: 10101" class="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-lg tracking-wide placeholder:font-sans placeholder:text-sm">
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">비밀 인증번호 (4자리)</label>
        <input type="password" id="pin" placeholder="예: 4821 또는 휴대폰 번호 끝 4자리" class="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-lg tracking-wide placeholder:font-sans placeholder:text-sm">
      </div>
      <button onclick="handleLogin()" id="btn-login" class="w-full bg-indigo-600 inline-block text-white font-semibold py-3.5 px-4 rounded-2xl hover:bg-indigo-700 active:scale-[0.98] transition-transform text-center shadow-md cursor-pointer">기록 조회하기</button>
      <p id="login-error" class="text-xs text-red-500 text-center font-medium hidden"></p>
    </div>

    {/* 결과 출력 뷰포트 (학습용 기본 탑재) */}
    <div id="result-section" class="hidden p-6 space-y-6">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h2 class="text-lg font-bold text-slate-800" id="std-name">학생 이름</h2>
          <p class="text-xs text-slate-400 font-mono" id="std-id">학번</p>
        </div>
        <button onclick="handleLogout()" class="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer">로그아웃</button>
      </div>

      <!-- 타자 통합 카드 -->
      <div id="typing-cards-container" class="space-y-4"></div>
    </div>
  </div>

  <script>
    // 로그인 실행 기능
    function handleLogin() {
      const studentId = document.getElementById('studentId').value;
      const pin = document.getElementById('pin').value;
      const errorEl = document.getElementById('login-error');
      const btn = document.getElementById('btn-login');

      if(!studentId || !pin) {
        errorEl.innerText = "학번과 인증번호를 모두 입력해 주십시오.";
        errorEl.classList.remove('hidden');
        return;
      }

      errorEl.classList.add('hidden');
      btn.innerText = "조회 중입니다...";
      btn.disabled = true;

      // Apps Script 백엔드 함수 호출
      google.script.run
        .withSuccessHandler(function(response) {
          btn.innerText = "기록 조회하기";
          btn.disabled = false;
          
          if (response.success) {
            showStats(response);
          } else {
            errorEl.innerText = response.message;
            errorEl.classList.remove('hidden');
          }
        })
        .withFailureHandler(function(err) {
          btn.innerText = "기록 조회하기";
          btn.disabled = false;
          errorEl.innerText = "오류 발생: " + err.toString();
          errorEl.classList.remove('hidden');
        })
        .getStudentTypingData(studentId, pin);
    }

    function showStats(data) {
      document.getElementById('login-section').classList.add('hidden');
      document.getElementById('result-section').classList.remove('hidden');
      
      document.getElementById('std-name').innerText = data.studentName + " 학생";
      document.getElementById('std-id').innerText = data.studentId;

      const container = document.getElementById('typing-cards-container');
      container.innerHTML = '';

      // 영어 타자 계산
      if (data.english && data.english.length > 0) {
        container.innerHTML += buildCardHTML(data.english, data.levels, '영어');
      } else {
        container.innerHTML += buildEmptyHTML('영어 타자');
      }

      // 한글 타자 계산
      if (data.korean && data.korean.length > 0) {
        container.innerHTML += buildCardHTML(data.korean, data.levels, '한글');
      } else {
        container.innerHTML += buildEmptyHTML('한글 타자');
      }
    }

    function buildCardHTML(records, levels, type) {
      // 정렬
      records.sort(function(a, b) {
        const aNum = parseInt(a.month.replace(/[^0-9]/g, '')) || 0;
        const bNum = parseInt(b.month.replace(/[^0-9]/g, '')) || 0;
        return aNum - bNum;
      });

      const latest = records[records.length - 1];
      const maxSpeed = Math.max.apply(Math, records.map(function(o) { return o.speed; }));
      
      let growth = 0;
      if (records.length > 1) {
        growth = latest.speed - records[records.length - 2].speed;
      }

      // 레벨 계산
      const filteredLevels = levels.filter(function(l) { return l.type === type; });
      filteredLevels.sort(function(a, b) { return a.minVal - b.minVal; });

      let currentLevel = "꿈나무 (훈련 필요)";
      let currentMinVal = 0;
      let nextLevel = null;
      let nextLevelNeeded = null;
      let percent = 100;

      const achieved = filteredLevels.filter(function(l) { return latest.speed >= l.minVal; });
      if (achieved.length > 0) {
        const highest = achieved[achieved.length - 1];
        currentLevel = highest.level;
        currentMinVal = highest.minVal;
      }

      const nextList = filteredLevels.filter(function(l) { return latest.speed < l.minVal; });
      if (nextList.length > 0) {
        const nNode = nextList[0];
        nextLevel = nNode.level;
        nextLevelNeeded = nNode.minVal - latest.speed;
        
        const denom = nNode.minVal - currentMinVal;
        if (denom > 0) {
          percent = Math.floor(((latest.speed - currentMinVal) / denom) * 100);
        } else {
          percent = 0;
        }
      }

      const isDiffPlus = growth > 0;
      const diffHTML = isDiffPlus ? '<span class="text-emerald-500 font-bold font-mono">▲ ' + growth + '</span>' : (growth < 0 ? '<span class="text-rose-500 font-bold font-mono">▼ ' + Math.abs(growth) + '</span>' : '<span class="text-slate-400 font-semibold font-mono">- 0</span>');
      const unit = type === '영어' ? 'WPM' : '타';

      return '<div class="border border-slate-100 p-5 rounded-2xl bg-slate-50/50 space-y-4">' +
        '<div class="flex justify-between items-center">' +
          '<h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">✨ ' + type + ' 타자 기록</h3>' +
          '<span class="bg-indigo-50 text-indigo-600 border border-indigo-100 text-xs font-bold px-2.5 py-0.5 rounded-full">' + currentLevel + '</span>' +
        '</div>' +
        '<div class="grid grid-cols-3 gap-2.5 text-center">' +
          '<div class="bg-white p-2 text-xs rounded-xl shadow-xs border border-slate-50"><p class="text-slate-400 font-medium leading-relaxed mb-0.5">최신 기록</p><p class="font-bold text-base font-mono text-slate-800">' + latest.speed + '</p></div>' +
          '<div class="bg-white p-2 text-xs rounded-xl shadow-xs border border-slate-50"><p class="text-slate-400 font-medium leading-relaxed mb-0.5">최고 기록</p><p class="font-bold text-base font-mono text-slate-800">' + maxSpeed + '</p></div>' +
          '<div class="bg-white p-2 text-xs rounded-xl shadow-xs border border-slate-50"><p class="text-slate-400 font-medium leading-relaxed mb-0.5">전월 대비</p><p>' + diffHTML + '</p></div>' +
        '</div>' +
        (nextLevel ? 
          '<div class="bg-white p-3.5 rounded-xl border border-slate-100/50 space-y-2 text-xs">' +
            '<div class="flex justify-between font-semibold"><span>목표: <strong class="text-indigo-600">' + nextLevel + '</strong></span><span class="text-slate-400 font-mono">' + percent + '%</span></div>' +
            '<div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-indigo-600 rounded-full" style="width: ' + percent + '%"></div></div>' +
            '<p class="text-center text-[11px] text-slate-500">다음 급수까지 <strong class="text-slate-700">' + nextLevelNeeded + ' ' + unit + '</strong> 남았습니다!</p>' +
          '</div>' : 
          '<p class="text-center text-[11px] text-emerald-600 font-semibold">최고급수 도달 완료! 🎉</p>'
        ) +
      '</div>';
    }

    function buildEmptyHTML(name) {
      return '<div class="p-6 text-center border-2 border-dashed border-slate-100 bg-slate-50/20 rounded-2xl"><p class="text-xs text-slate-400">' + name + ' 기록 데이터가 부재합니다.</p></div>';
    }

    function handleLogout() {
      document.getElementById('login-section').classList.remove('hidden');
      document.getElementById('result-section').classList.add('hidden');
      document.getElementById('studentId').value = '';
      document.getElementById('pin').value = '';
    }
  </script>
</body>
</html>`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="relative bg-white rounded-3xl w-full max-w-2xl border border-gray-100 shadow-xl overflow-hidden flex flex-col my-8">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gray-900 text-white shadow-xs">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 tracking-tight">교사용 스프레드시트 연동 및 시스템 관리</h2>
              <p className="text-xs text-gray-400 font-medium">학교 구글 데이터베이스 연동과 소스 코드 빌더</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-100 cursor-pointer"
          >
            닫기
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto max-h-[70vh]">
          
          {/* 📱 모바일 및 전 기기 연동 가이드 배너 */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
            <span className="font-black text-emerald-850 flex items-center gap-1.5 text-xs sm:text-sm">
              <span>📱</span> 모바일 / 외부 디바이스 실시간 연동 가이드
            </span>
            <p className="text-[11.8px] text-emerald-800 leading-relaxed font-semibold">
              PC뿐만 아니라 <strong>스마트폰, 태블릿 등 어느 디바이스에서 접속</strong>하더라도 연동된 구글 스프레드시트 기록을 완벽하게 동기화하고 조회하기 위해서는 아래 <strong>두 가지 방법 중 하나를 필수로 완료</strong>해 주셔야 합니다:
            </p>
            <ul className="list-decimal list-inside text-[11px] text-emerald-700 space-y-2 font-medium pl-1">
              <li>
                <strong className="text-emerald-900">구글 시트 공유 권한 개방 (가장 간편):</strong> 연동한 구글 스프레드시트 우측 상단 <strong className="text-emerald-950 font-black">[공유]</strong> 버튼을 누르고, 일반 액세스 설정을 <strong>'링크가 있는 모든 사용자 / 뷰어'</strong>로 지정해 주세요. 스마트폰 폰 화면에서도 즉시 실시간 연동이 정상 작동합니다.
              </li>
              <li>
                <strong className="text-emerald-900">앱스 스크립트 웹 앱 주소 연동 (최고 보안):</strong> 시트를 완전 비공개 모드로 유지하면서 조회를 지원하려면, 아래 <strong>[구글 Apps Script 독립 배포 코드 추출기]</strong> 탭을 클릭하여 코드를 복사해 배포한 후, 부여받은 Web App URL을 ⚡ 입력칸에 붙여넣어 주십시오. CORS 우회를 통해 모바일 통신 제한을 안전하게 뚫고 0.1초 고속 조회를 제공합니다.
              </li>
            </ul>
          </div>
          
          {/* Step 1: 구글 스프레드시트 토글 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                구글 스프레드시트 URL 또는 ID 입력
              </label>
              <button 
                onClick={handleResetToDemo}
                className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                가상 가이딩 데이터 회귀 (데모)
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Link2 className="h-5 w-5" />
                </div>
                <input 
                  type="text" 
                  value={spreadsheetIdIn}
                  onChange={(e) => handleSpreadsheetIdChange(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/시트ID/edit 형태 링크 입력..."
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-505"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveAndApply}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-xs hover:shadow-md transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 justify-center"
              >
                <CheckCircle2 className="h-4.5 w-4.5" />
                저장 및 연동하기
              </button>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed font-medium">
              * 스프레드시트 공유 권한을 <strong>'링크가 있는 모든 사용자(뷰어)'</strong>로 완료 시, 별도의 구글 로그인 없이도 즉시 전교생 조회가 가능해집니다.
            </p>
          </div>

          {/* Step 1-2: 구글 앱스 스크립트 웹 앱 URL 복사 붙여넣기 */}
          <div className="p-5 rounded-2xl bg-indigo-50/20 border border-indigo-100/50 space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full text-[10px]">교사용 분산 모딩</span>
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                ⚡ 구글 앱스 스크립트(GAS) Web App 주소 입력
              </label>
            </div>
            
            <p className="text-xs text-indigo-805 leading-relaxed font-sans">
              스프레드시트를 비공개로 지키면서도 <strong>로그인 없이 초고속으로</strong> 연동하려면, 생성한 웹 앱 URL(웹 앱 주소)을 아래에 입력하십시오. 제일 하단 코드로 15초 안에 즉시 배포할 수 있습니다.
            </p>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-indigo-600">
                <Terminal className="h-4.5 w-4.5" />
              </div>
              <input 
                type="text" 
                value={appsScriptUrlIn}
                onChange={(e) => setAppsScriptUrlIn(e.target.value.trim())}
                placeholder="https://script.google.com/macros/s/배포키입력/exec 형태 주소 붙여넣기..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-505 font-mono text-indigo-950"
              />
            </div>
          </div>

          {/* Step 2: Private Access via Teacher OAuth */}
          <div className="p-5 rounded-2xl bg-indigo-50/20 border border-indigo-100/50 space-y-4">
            <div className="flex gap-3">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 h-10 w-10 shrink-0 flex items-center justify-center">
                <Key className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-indigo-900">구글 워크스페이스 관리자 로그인 (선택 사항)</h3>
                <p className="text-xs text-indigo-700/80 leading-relaxed">
                  스프레드시트를 '비공개(공유 안함)'로 유지하고 싶다면, 교사 구글 계정으로 로그인하여 시스템 사용 권한을 한시적으로 위임합니다.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {!googleUser ? (
                <button 
                  onClick={handleGoogleSignIn}
                  disabled={isAuthenticating}
                  className="bg-indigo-600 shrink-0 text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-indigo-700 transition-colors text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <LogIn className="h-4 w-4" />
                  {isAuthenticating ? '인증 화면 호출 중...' : '구글 계정과 안전하게 연동'}
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-3 w-full justify-between bg-white p-3 rounded-xl border border-indigo-100">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-semibold text-indigo-900">{googleUser.email} (연동 완료)</span>
                  </div>
                  <button 
                    onClick={handleGoogleSignOut}
                    className="p-1 px-2.5 rounded-lg border border-red-200 text-[10px] font-bold text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    연동 끊기
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Connection Test */}
          <div className="space-y-3">
            <button 
              onClick={handleTestConnection}
              disabled={isTesting}
              className="w-full bg-gray-900 text-white font-semibold py-3 px-4 rounded-2xl hover:bg-gray-800 transition-colors text-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isTesting ? '데이터베이스 상태 분석 중...' : '스프레드시트 구조 적합성 검증'}
            </button>

            {testResult && (
              <div className={`p-4 rounded-2xl border text-xs space-y-2 leading-relaxed ${
                testResult.success ? 'bg-emerald-50/30 border-emerald-100 text-emerald-800' : 'bg-rose-50/30 border-rose-100 text-rose-800'
              }`}>
                <div className="flex items-center gap-2 font-bold text-sm">
                  {testResult.success ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>성공적으로 데이터 연동 준비 완료!</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                      <span>데이터 분석에 실패했습니다</span>
                    </>
                  )}
                </div>
                
                {testResult.success ? (
                  <div className="grid grid-cols-2 gap-3 mt-2 font-medium">
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-100/40">
                      • students_auth: <strong className="font-mono text-emerald-700">{testResult.authCount}</strong> 명 등록 완료
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-100/40">
                      • english_all: <strong className="font-mono text-emerald-700">{testResult.englishCount}</strong> 개 성장 추이
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-100/40">
                      • korean_all: <strong className="font-mono text-emerald-700">{testResult.koreanCount}</strong> 개 성장 추이
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-100/40">
                      • level_rule: <strong className="font-mono text-emerald-700">{testResult.levelCount}</strong> 개 급수 체계 로드
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 font-semibold">{testResult.message}</p>
                )}
              </div>
            )}
          </div>

          {/* 🔗 원클릭 학생용 접속/공유 링크 생성기 */}
          <div className="p-5 rounded-2xl bg-teal-50/30 border border-teal-200/50 space-y-3">
            <div className="flex gap-3">
              <div className="p-2 rounded-xl bg-teal-50 text-teal-700 h-10 w-10 shrink-0 flex items-center justify-center">
                <Link2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-teal-900">🔗 학생용 최적화 실시간 연동 공유 링크 생성</h3>
                <p className="text-xs text-teal-850 leading-relaxed font-sans font-medium">
                  스마트폰이나 다른 PC로 접속하는 학생들이 별도의 연동 설정 없이 즉시 로그인하고 실시간 조회 및 비밀번호 변경을 진행할 수 있도록 설계된 '원클릭 연동 접속 링크'입니다.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const targetSid = spreadsheetIdIn || currentSpreadsheetId;
                const targetGas = appsScriptUrlIn || currentAppsScriptUrl || '';
                const shareUrl = `${window.location.origin}${window.location.pathname}?sid=${encodeURIComponent(targetSid)}&gas=${encodeURIComponent(targetGas)}`;
                navigator.clipboard.writeText(shareUrl);
                alert("🎉 학생용 실시간 연동용 접속 주소가 복사되었습니다!\n학생들에게 전달(단톡방, QR, 알림장 등)하시면 바로 스프레드시트와 동기화되어 정상 작동합니다.\n\n[복사된 주소]:\n" + shareUrl);
              }}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-extrabold py-3 px-4 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs hover:shadow-md"
            >
              <Copy className="h-4 w-4" />
              학생들에게 전송할 실시간 연동 주소 복사하기
            </button>
          </div>

          {/* 🏆 월간 MVP 마감 관리 (Lock Manager) */}
          <div className="p-5 rounded-2xl bg-amber-50/20 border border-amber-200/50 space-y-4">
            <div className="flex gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-700 h-10 w-10 shrink-0 flex items-center justify-center">
                <Lock className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-amber-900">🏆 월간 MVP 마감 관리 (Lock Manager)</h3>
                <p className="text-xs text-amber-850 leading-relaxed font-medium">
                  매월 타자 수련 마감 시점에 마감 버튼을 클릭하면, 이후 구글 스프레드시트에 더 높은 점수의 데이터가 추가되더라도 그 달의 MVP 수상 내역(명예의 전당)이 변동되지 않도록 고정됩니다.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {sortedMonths.length === 0 ? (
                <div className="p-4 text-center rounded-xl bg-white border border-amber-100/50 text-xs text-amber-600 font-semibold">
                  데이터베이스가 연동되어 있지 않거나 월 기록이 존재하지 않습니다.
                </div>
              ) : (
                sortedMonths.map(month => {
                  const isLocked = !!mvpLocks[month];
                  const monthData = monthlySnackWinnersHistory[month];
                  const winners = monthData?.winners || [];
                  const winnerNames = winners.map(w => w.name).join(', ') || '없음';

                  return (
                    <div 
                      key={month} 
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border transition-all gap-3 ${
                        isLocked 
                          ? 'bg-amber-100/20 border-amber-200 shadow-xs' 
                          : 'bg-white border-gray-150 hover:bg-gray-50/50'
                      }`}
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs sm:text-sm text-stone-800">{month} MVP 선정</span>
                          {isLocked ? (
                            <span className="inline-flex items-center gap-1 bg-amber-100 border border-amber-200/55 text-amber-850 font-bold px-2 py-0.5 rounded-full text-[10px]">
                              <Lock className="h-2.5 w-2.5" />
                              마감됨 (🔒 고정 완료)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-gray-150 text-gray-600 border border-gray-200 font-bold px-2 py-0.5 rounded-full text-[10px]">
                              <Unlock className="h-2.5 w-2.5" />
                              분석 중 (🔓 실시간 계산)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500 font-medium">
                          • 현재 수상자: <strong className="text-stone-700 font-bold">{winnerNames}</strong> (총 {winners.length}명)
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => onToggleMvpLock && onToggleMvpLock(month, winners)}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer text-center shrink-0 border shadow-xs h-9 ${
                          isLocked 
                            ? 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50' 
                            : 'bg-amber-500 border-amber-600 text-white hover:bg-amber-600 active:scale-95'
                        }`}
                      >
                        {isLocked ? '마감 취소 (실시간 전환)' : '월간 MVP 마감하기'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* 🛡️ 개인정보처리방침 파일 등록 및 설정 관리 */}
          <div className="p-5 rounded-2xl bg-emerald-50/25 border border-emerald-200/80 space-y-4">
            <div className="flex gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 h-10 w-10 shrink-0 flex items-center justify-center font-black text-base border border-emerald-100 shadow-3xs">
                🛡️
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-black text-slate-800">🛡️ 개인정보처리방침 파일 등록 및 상세 설정</h3>
                <p className="text-xs text-stone-500 leading-relaxed font-bold">
                  학생 회원 및 사용자가 조회할 수 있는 <strong className="text-emerald-805">개인정보처리방침</strong> 파일(.txt, .md)을 등록하거나 내용을 직접 편집할 수 있습니다. 등록된 방침은 대시보드 화면 맨 아래의 링크를 통해 학생들이 투명하게 확인할 수 있습니다.
                </p>
              </div>
            </div>

            {/* Drag & Drop File Upload Area */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                dragActive 
                  ? 'border-emerald-500 bg-emerald-50/60' 
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <input 
                type="file" 
                id="privacy-file-upload" 
                accept=".txt,.md" 
                onChange={handleFileChange} 
                className="hidden" 
              />
              <label htmlFor="privacy-file-upload" className="cursor-pointer space-y-1.5 block">
                <div className="text-slate-400 font-bold text-xs">
                  📁 마크다운(.md) 또는 텍스트(.txt) 파일을 여기에 드래그해 놓거나 <span className="text-emerald-600 underline font-black">컴퓨터에서 선택</span> 하세요
                </div>
                <p className="text-[10px] text-stone-400">
                  파일 업로드 시 아래 창에 내용이 자동으로 인식되어 불러와집니다.
                </p>
              </label>
            </div>

            {/* Direct Edit Textarea */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 block">
                ✍️ 방침 내용 수동 편집 시 적용 창
              </label>
              <textarea
                value={privacyText}
                onChange={(e) => {
                  setPrivacyText(e.target.value);
                  setPrivacySaveSuccess(false);
                }}
                placeholder="여기에 직접 처리방침 내용을 입력하거나 위의 파일 업로드를 이용하십시오. 빈 상태로 저장 시 기본 탑재된 방침안이 적용됩니다."
                className="w-full min-h-[140px] text-[11px] font-medium font-sans p-3 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap gap-2 justify-between items-center">
              <button
                type="button"
                onClick={handleResetPrivacy}
                className="px-4 py-2 hover:bg-rose-50 border border-stone-200 hover:border-rose-200 text-stone-500 hover:text-rose-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                기본방침 초기화
              </button>
              <button
                type="button"
                onClick={handleSavePrivacy}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs active:scale-98 flex items-center gap-1.5"
              >
                💾 설정 저장하기
              </button>
            </div>

            {privacySaveSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-900 text-xs font-bold animate-fade-in flex items-center gap-1.5">
                <span className="text-emerald-605">✓</span>
                새로운 개인정보처리방침 설정이 브라우저와 시스템에 안전하게 저장 및 적용되었습니다!
              </div>
            )}
          </div>

          <div className="h-px bg-gray-100" />

          {/* 🔑 학생 전용 비밀번호 분실 초기화 (Password Reset Section) */}
          <div className="p-5 rounded-2xl bg-yellow-50/20 border border-yellow-250 space-y-4">
            <div className="flex gap-3">
              <div className="p-2 rounded-xl bg-yellow-150 text-amber-700 h-10 w-10 shrink-0 flex items-center justify-center font-black text-base">
                🔑
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-amber-900">🔐 학생 비밀번호 현황 조회 및 초기화</h3>
                <p className="text-xs text-amber-800 leading-relaxed font-bold">
                  학생들이 비밀번호(생년월일)를 분실했거나 잘못 변경한 경우, 아래에서 해당 학생을 조회하여 초기 비밀번호인 <strong className="text-amber-950 bg-yellow-200 border border-yellow-300 px-1.5 py-0.5 rounded font-mono">12345678</strong>로 즉시 초기화/변경 처리가 가능합니다. (노란색 강조 관리 기능)
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <select
                    value={selectedStudentIdForReset}
                    onChange={(e) => {
                      setSelectedStudentIdForReset(e.target.value);
                      setResetSuccessMessage(null);
                    }}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-250 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-gray-700 bg-white font-semibold"
                  >
                    <option value="">-- 초기화할 학생을 선택하십시오 --</option>
                    {(authDb || []).map((student) => {
                      const info = parseStudentIdInfo(student.studentId);
                      return (
                        <option key={student.studentId} value={student.studentId}>
                          [{student.studentId}] {student.name} ({info.grade}학년 {info.department}) [현재비번: {student.pin}]
                        </option>
                      );
                    })}
                  </select>
                </div>
                
                <button
                  type="button"
                  disabled={!selectedStudentIdForReset || isResettingPin}
                  onClick={async () => {
                    const student = (authDb || []).find(s => s.studentId === selectedStudentIdForReset);
                    if (!student) return;
                    if (window.confirm(`정말 [${student.name}] 학생의 개인 비밀번호를 초기 비밀번호인 '12345678'로 강제 변경/초기화하시겠습니까?`)) {
                      setIsResettingPin(true);
                      setResetSuccessMessage(null);
                      const success = onResetStudentPin ? await onResetStudentPin(student.studentId, '12345678') : false;
                      setIsResettingPin(false);
                      if (success) {
                        setResetSuccessMessage(`[${student.name}] 학생의 비밀번호가 '12345678'로 정상 초기화되었습니다! 학생이 즉시 새 비밀번호나 '12345678'로 로그인할 수 있습니다.`);
                      } else {
                        alert('비밀번호 초기화 저장 도중 오류가 발생했습니다. 구글 시트 쓰기 권한 또는 Apps Script 상태를 점검하십시오.');
                      }
                    }
                  }}
                  className={`px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer text-center shrink-0 border h-11 flex items-center justify-center gap-1.5 ${
                    !selectedStudentIdForReset 
                      ? 'bg-yellow-200/50 border-yellow-300 text-slate-400 cursor-not-allowed'
                      : 'bg-yellow-400 hover:bg-yellow-500 border-yellow-500 text-slate-900 active:scale-98 shadow-sm'
                  }`}
                >
                  {isResettingPin ? '초기화 처리 중...' : '초기 비밀번호(12345678)로 재설정'}
                </button>
              </div>

              {resetSuccessMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-900 text-xs font-bold leading-normal animate-fade-in flex items-center gap-1.5">
                  <span className="text-emerald-605 text-sm font-black">✓</span>
                  {resetSuccessMessage}
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Section: Google Apps Script Export Form */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <button 
              onClick={() => setShowScriptExporter(!showScriptExporter)}
              className="w-full flex justify-between items-center bg-gray-50 p-4 font-bold text-sm text-gray-800 focus:outline-none cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Terminal className="h-4.5 w-4.5 text-indigo-600" />
                선택 사항: 구글 앱스 스크립트(GAS) 독립 배포 코드 추출기
              </span>
              {showScriptExporter ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showScriptExporter && (
              <div className="p-5 space-y-4 bg-white border-t border-gray-50">
                <div className="flex gap-2">
                  <span className="inline-block bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-md text-[11px]">개인정보 철저 필터링</span>
                  <span className="inline-block bg-teal-50 border border-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded-md text-[11px]">전원 보안 통신</span>
                </div>
                
                <p className="text-xs text-gray-500 leading-relaxed font-sans">
                  스프레드시트 [확장 프로그램] &gt; [Apps Script] 에 해당 코드를 배포하면, <strong>학생 개인정보 유출 우려가 완벽 차단된</strong> 초고인프라 독립 배포 웹서버를 평생 무료 라이선스로 즉시 운영하실 수 있습니다.
                </p>

                {/* Tabs to select GS or HTML */}
                <div className="flex border-b border-gray-100 gap-1.5">
                  <button 
                    onClick={() => setSelectedScriptTab('gs')}
                    className={`pb-2 px-3 text-xs font-bold transition-all relative ${
                      selectedScriptTab === 'gs' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Code.gs (서버 제어 기능)
                  </button>
                  <button 
                    onClick={() => setSelectedScriptTab('html')}
                    className={`pb-2 px-3 text-xs font-bold transition-all relative ${
                      selectedScriptTab === 'html' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    index.html (프론트엔드 모바일 뷰)
                  </button>
                </div>

                <div className="relative">
                  <button 
                    onClick={() => copyToClipboard(selectedScriptTab === 'gs' ? appsScriptCode_GS : appsScriptCode_HTML)}
                    className="absolute right-3.5 top-3.5 flex items-center gap-1 bg-gray-900 border border-gray-800 text-white rounded-lg px-2.5 py-1.5 hover:bg-gray-800 active:scale-95 transition-all text-[11px] font-semibold cursor-pointer z-10"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copiedText ? '복사 완료!' : '코드 복사하기'}
                  </button>
                  
                  <pre className="p-4 bg-gray-950 text-gray-100 text-[11px] font-mono rounded-xl max-h-60 overflow-y-auto whitespace-pre leading-relaxed select-all">
                    {selectedScriptTab === 'gs' ? appsScriptCode_GS : appsScriptCode_HTML}
                  </pre>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-gray-50 bg-gray-50/50 flex flex-wrap gap-2 items-center justify-between">
          <p className="text-[11px] text-gray-400 font-medium">
            * 입력한 시트 주소는 브라우저 보안 쿠키 및 안전 로컬 스토리지에 자동 저장됩니다.
          </p>
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-950 hover:bg-gray-900 transition-colors text-xs font-semibold text-white tracking-wide cursor-pointer"
          >
            대시보드로 돌아가기
          </button>
        </div>

      </div>
    </div>
  );
};
