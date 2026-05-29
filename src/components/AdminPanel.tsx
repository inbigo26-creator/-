/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { googleSignIn, logout, getAccessToken } from '../auth';
import { fetchSpreadsheetData, DEFAULT_SPREADSHEET_ID, clearDataCache } from '../data';
import { 
  Settings, Key, Link2, CheckCircle2, AlertTriangle, Copy, 
  Terminal, ShieldCheck, HelpCircle, HardDriveDownload, UserCheck, Eye, LogIn, LogOut, ChevronDown, ChevronUp
} from 'lucide-react';
import { User } from 'firebase/auth';

interface AdminPanelProps {
  onSpreadsheetConfigured: (spreadsheetId: string, accessToken: string | null) => void;
  currentSpreadsheetId: string;
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  onSpreadsheetConfigured, 
  currentSpreadsheetId, 
  onClose 
}) => {
  const [spreadsheetIdIn, setSpreadsheetIdIn] = useState(
    currentSpreadsheetId === DEFAULT_SPREADSHEET_ID ? '' : currentSpreadsheetId
  );
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
    if (!spreadsheetIdIn) {
      alert('스프레드시트 ID 또는 링크를 입력해주십시오.');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      // Clear data cache before test
      clearDataCache();
      const data = await fetchSpreadsheetData(spreadsheetIdIn, accessToken);
      
      setTestResult({
        success: true,
        authCount: data.auth.length,
        englishCount: data.english.length,
        koreanCount: data.korean.length,
        levelCount: data.levels.length
      });

      // Notify parent app of new active sheet
      onSpreadsheetConfigured(spreadsheetIdIn, accessToken);
    } catch (err: any) {
      console.error(err);
      setTestResult({
        success: false,
        message: err.message || '인증되지 않은 시트이거나 스프레드시트 구조가 잘못되었습니다.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Use default mockup sandbox
  const handleResetToDemo = () => {
    setSpreadsheetIdIn('');
    setTestResult(null);
    onSpreadsheetConfigured(DEFAULT_SPREADSHEET_ID, null);
    alert('데모 가상 데이터 모드로 전환되었습니다.');
  };

  // Save and apply spreadsheet ID directly without requiring test sequence
  const handleSaveAndApply = () => {
    if (!spreadsheetIdIn) {
      alert('스프레드시트 URL 또는 ID를 먼저 입력해주십시오.');
      return;
    }
    // Clear data cache to ensure new fetch
    clearDataCache();
    onSpreadsheetConfigured(spreadsheetIdIn, accessToken);
    alert('🎉 스프레드시트 주소가 성공적으로 저장되었으며 대시보드에 적용되었습니다!');
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
 * 제작 목적: 학생 개인정보 보호를 위한 서버 필터링 조회 시스템
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('학생 타자 성장 조회 시스템')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
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

function cleanCode(val) {
  return cleanValue(val).replace(/\\s/g, '');
}

/**
 * 학생 인증 및 데이터 조회 (개인정보 보호 필터링 적용)
 * 학생은 본인의 정보만 다운로드 받으며, 전체 원본 DB가 사용자 기기로 넘어가지 않아 매우 안전합니다.
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
    
    // 2. 영어 타자 기록 가져오기
    var englishSheet = ss.getSheetByName('english_all');
    var englishRecords = [];
    if (englishSheet) {
      var engValues = englishSheet.getDataRange().getValues();
      var engHeaders = engValues[0];
      
      var eIdxId = findHeaderIndex(engHeaders, ['학번', 'ID', 'studentId', '학생ID', '학급번호', '번호']);
      var eIdxGrade = findHeaderIndex(engHeaders, ['학년', 'grade', '반/학년']);
      var eIdxDept = findHeaderIndex(engHeaders, ['과', '학과', '계열', 'dept', '전공']);
      var eIdxMonth = findHeaderIndex(engHeaders, ['월', '시기', 'month', '구분']);
      var eIdxSpeed = findHeaderIndex(engHeaders, ['영타', '영어', 'speed', '타수']);
      
      if (eIdxId !== -1 && eIdxMonth !== -1 && eIdxSpeed !== -1) {
        for (var i = 1; i < engValues.length; i++) {
          if (cleanCode(engValues[i][eIdxId]) === searchId) {
            englishRecords.push({
              studentId: searchId,
              name: studentName,
              grade: eIdxGrade !== -1 ? cleanCode(engValues[i][eIdxGrade]) : '',
              department: eIdxDept !== -1 ? cleanValue(engValues[i][eIdxDept]) : '',
              month: cleanValue(engValues[i][eIdxMonth]),
              speed: parseInt(cleanCode(engValues[i][eIdxSpeed]), 10) || 0,
              type: 'english'
            });
          }
        }
      }
    }
    
    // 3. 한글 타자 기록 가져오기
    var koreanSheet = ss.getSheetByName('korean_all');
    var koreanRecords = [];
    if (koreanSheet) {
      var korValues = koreanSheet.getDataRange().getValues();
      var korHeaders = korValues[0];
      
      var kIdxId = findHeaderIndex(korHeaders, ['학번', 'ID', 'studentId', '학생ID', '학급번호', '번호']);
      var kIdxGrade = findHeaderIndex(korHeaders, ['학년', 'grade', '반/학년']);
      var kIdxDept = findHeaderIndex(korHeaders, ['과', '학과', '계열', 'dept', '전공']);
      var kIdxMonth = findHeaderIndex(korHeaders, ['월', '시기', 'month', '구분']);
      var kIdxSpeed = findHeaderIndex(korHeaders, ['한타', '한글', 'speed', '타수']);
      
      if (kIdxId !== -1 && kIdxMonth !== -1 && kIdxSpeed !== -1) {
        for (var i = 1; i < korValues.length; i++) {
          if (cleanCode(korValues[i][kIdxId]) === searchId) {
            koreanRecords.push({
              studentId: searchId,
              name: studentName,
              grade: kIdxGrade !== -1 ? cleanCode(korValues[i][kIdxGrade]) : '',
              department: kIdxDept !== -1 ? cleanValue(korValues[i][kIdxDept]) : '',
              month: cleanValue(korValues[i][kIdxMonth]),
              speed: parseInt(cleanCode(korValues[i][kIdxSpeed]), 10) || 0,
              type: 'korean'
            });
          }
        }
      }
    }
    
    // 4. 타자 급수 기준 데이터 가져오기
    var ruleSheet = ss.getSheetByName('level_rule');
    var levelRules = [];
    if (ruleSheet) {
      var ruleValues = ruleSheet.getDataRange().getValues();
      var ruleHeaders = ruleValues[0];
      
      var rIdxType = findHeaderIndex(ruleHeaders, ['타입', '구분', '종류', 'type', '언어']);
      var rIdxLevel = findHeaderIndex(ruleHeaders, ['급수', '등급', '레벨', 'level']);
      var rIdxMin = findHeaderIndex(ruleHeaders, ['최소값', '기준', '타수', '최소', 'min', '최저']);
      
      if (rIdxType !== -1 && rIdxLevel !== -1 && rIdxMin !== -1) {
        for (var i = 1; i < ruleValues.length; i++) {
          levelRules.push({
            type: cleanValue(ruleValues[i][rIdxType]),
            level: cleanValue(ruleValues[i][rIdxLevel]),
            minVal: parseInt(cleanCode(ruleValues[i][rIdxMin]), 10) || 0
          });
        }
      }
    }
    
    return {
      success: true,
      studentName: studentName,
      studentId: searchId,
      english: englishRecords,
      korean: koreanRecords,
      levels: levelRules
    };
    
  } catch(e) {
    return { success: false, message: "시스템 처리 중 서버 오류가 발생했습니다: " + e.toString() };
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

      let currentLevel = "무급 (훈련 필요)";
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
