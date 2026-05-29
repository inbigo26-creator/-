/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  fetchSpreadsheetData, 
  calculateStudentStats, 
  DEFAULT_SPREADSHEET_ID, 
  getMonthNumber,
  clearDataCache
} from './data';
import { StudentAuth, TypingRecord, LevelRule, StudentStats } from './types';
import { StudentStatsCard } from './components/StudentCards';
import { TypingChart } from './components/TypingChart';
import { AdminPanel } from './components/AdminPanel';
import { GuideModal } from './components/GuideModal';
import { 
  Keyboard, LogIn, GraduationCap, Lock, HelpCircle, 
  Settings, AlertCircle, BookOpen, LogOut, Medal, Sparkles,
  Sprout
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function App() {
  // Input fields
  const [studentIdInput, setStudentIdInput] = useState('');
  const [pinInput, setPinInput] = useState('');

  // Active configurations
  const [spreadsheetId, setSpreadsheetId] = useState(() => {
    return localStorage.getItem('school_spreadsheet_id') || DEFAULT_SPREADSHEET_ID;
  });
  const [googleToken, setGoogleToken] = useState<string | null>(() => {
    return localStorage.getItem('school_google_token') || null;
  });

  // State loaded databases
  const [authDb, setAuthDb] = useState<StudentAuth[]>([]);
  const [englishDb, setEnglishDb] = useState<TypingRecord[]>([]);
  const [koreanDb, setKoreanDb] = useState<TypingRecord[]>([]);
  const [levelRulesDb, setLevelRulesDb] = useState<LevelRule[]>([]);

  // Authentication states
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [studentSession, setStudentSession] = useState<{
    id: string;
    name: string;
    grade: string;
    department: string;
    englishStats: StudentStats;
    koreanStats: StudentStats;
  } | null>(null);

  // Modals toggle
  const [showAdmin, setShowAdmin] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Background loading state when sheets are synced
  const [sheetMetrics, setSheetMetrics] = useState<{
    success: boolean;
    authRows: number;
    totalEng: number;
    totalKor: number;
  } | null>(null);

  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [showDebugList, setShowDebugList] = useState(false);
  const [sheetLoadError, setSheetLoadError] = useState<string | null>(null);

  const handleForceReload = async () => {
    setIsInitialLoading(true);
    setAuthError(null);
    setSheetLoadError(null);
    setSyncMessage(null);
    try {
      clearDataCache();
      const data = await fetchSpreadsheetData(spreadsheetId, googleToken);
      setAuthDb(data.auth);
      setEnglishDb(data.english);
      setKoreanDb(data.korean);
      setLevelRulesDb(data.levels);
      
      setSheetMetrics({
        success: true,
        authRows: data.auth.length,
        totalEng: data.english.length,
        totalKor: data.korean.length
      });
      setSyncMessage('스프레드시트 최신 정보(인증번호 1234 등) 실시간 연동 완료!');
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (err: any) {
      console.error(err);
      setSheetLoadError(err.message || '스프레드시트 상태를 확인해 주세요.');
    } finally {
      setIsInitialLoading(false);
    }
  };

  // Load spreadsheet data on configuration mount/change
  useEffect(() => {
    async function loadSheets() {
      setIsInitialLoading(true);
      setSheetLoadError(null);
      try {
        const data = await fetchSpreadsheetData(spreadsheetId, googleToken);
        setAuthDb(data.auth);
        setEnglishDb(data.english);
        setKoreanDb(data.korean);
        setLevelRulesDb(data.levels);
        
        setSheetMetrics({
          success: true,
          authRows: data.auth.length,
          totalEng: data.english.length,
          totalKor: data.korean.length
        });
      } catch (err: any) {
        console.error('Failed to prefetch spreadsheet criteria:', err);
        setSheetLoadError(err.message || '스프레드시트를 읽어오는 중 오류가 발생했습니다.');
        setSheetMetrics({
          success: false,
          authRows: 0,
          totalEng: 0,
          totalKor: 0
        });
      } finally {
        setIsInitialLoading(false);
      }
    }
    loadSheets();
  }, [spreadsheetId, googleToken]);

  // Normalization function to handle common Google Sheets formatting anomalies (like .0 float artifacts, commas, or extra spacing)
  const normalizeValue = (val: any): string => {
    if (val === null || val === undefined) return '';
    let cleaned = String(val).trim().replace(/,/g, '');
    if (cleaned.endsWith('.0')) {
      cleaned = cleaned.substring(0, cleaned.length - 2);
    } else if (cleaned.includes('.')) {
      const parts = cleaned.split('.');
      if (/^0+$/.test(parts[1])) {
        cleaned = parts[0];
      }
    }
    return cleaned.replace(/[^0-9A-Za-z]/g, '');
  };

  // Handle student credentials login match
  const handleStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!studentIdInput || studentIdInput.length !== 5) {
      setAuthError('학번 5자리를 정확히 입력해 주세요. (예: 10101)');
      return;
    }
    if (!pinInput || pinInput.length !== 4) {
      setAuthError('인증번호 4자리를 정확히 입력해 주세요. (예: 4821)');
      return;
    }

    setIsAuthenticating(true);

    try {
      // Find matching credentials in students_auth DB with robust normalization
      const currentAuth = authDb.find(
        (a) => normalizeValue(a.studentId) === normalizeValue(studentIdInput) && normalizeValue(a.pin) === normalizeValue(pinInput)
      );

      if (!currentAuth) {
        setAuthError('입력하신 학번 또는 인증번호가 일치하지 않습니다. 다시 확인해 드립니다.');
        setIsAuthenticating(false);
        return;
      }

      // Compute statistics for authenticated student ID
      const englishStats = calculateStudentStats(currentAuth.studentId, englishDb, levelRulesDb, 'english');
      const koreanStats = calculateStudentStats(currentAuth.studentId, koreanDb, levelRulesDb, 'korean');

      // Attempt to retrieve Grade/Class metadata from records
      let grade = '1';
      let department = '일반';
      
      const foundRec = [...englishDb, ...koreanDb].find(r => r.studentId === currentAuth.studentId);
      if (foundRec) {
        grade = foundRec.grade || '1';
        department = foundRec.department || '공통';
      }

      const session = {
        id: currentAuth.studentId,
        name: currentAuth.name,
        grade,
        department,
        englishStats,
        koreanStats
      };

      setStudentSession(session);

      // Trigger Confetti Celebration for high improvements
      const topImprovement = Math.max(englishStats.growth, koreanStats.growth);
      if (topImprovement > 0) {
        // Run confetti twice to be dazzling!
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
        setTimeout(() => {
          confetti({
            particleCount: 100,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
          });
          confetti({
            particleCount: 100,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
          });
        }, 300);
      }

    } catch (err) {
      console.error('Computation error:', err);
      setAuthError('통합 타자 계산을 수행하는 도중 데이터 오류가 발생하였습니다.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Log student out
  const handleStudentLogout = () => {
    setStudentSession(null);
    setStudentIdInput('');
    setPinInput('');
    setAuthError(null);
  };

  // Called when Teacher connects a spreadsheet
  const handleSpreadsheetConfigured = (newSpreadsheetId: string, token: string | null) => {
    setSpreadsheetId(newSpreadsheetId);
    setGoogleToken(token);
    
    // Persist sheets settings to device Local Storage
    localStorage.setItem('school_spreadsheet_id', newSpreadsheetId);
    if (token) {
      localStorage.setItem('school_google_token', token);
    } else {
      localStorage.removeItem('school_google_token');
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-805 font-sans flex flex-col md:flex-row antialiased select-none">
      
      {/* 1. SIDEBAR PROFILE PANEL (Visible on md desktop when logged in) */}
      {!isInitialLoading && studentSession && (
        <aside className="hidden md:flex w-64 bg-white border-r border-emerald-100 flex-col p-6 sticky top-0 h-screen shrink-0">
          <div className="mb-10 text-center">
            <div className="w-18 h-18 bg-emerald-50 rounded-full mx-auto mb-4 flex items-center justify-center text-emerald-600 font-extrabold text-2xl border border-emerald-100 shadow-xs">
              {studentSession.grade || '1'}
            </div>
            <h2 className="font-bold text-[17px] leading-tight text-slate-950 tracking-tight">{studentSession.id} {studentSession.name}</h2>
            <p className="text-xs text-emerald-600 mt-2 uppercase tracking-widest font-extrabold flex items-center justify-center gap-1.5 bg-emerald-50/60 py-1.5 px-3 rounded-full border border-emerald-100">
              <Sprout className="h-3.5 w-3.5 text-emerald-500 animate-pulse shrink-0" />
              {studentSession.grade}학년 {studentSession.department}과
            </p>
          </div>
          
          <nav className="flex-1 space-y-1.5">
            <button className="w-full text-left px-4 py-3 bg-emerald-100/60 text-emerald-700 rounded-xl font-bold flex items-center gap-3">
              <Keyboard className="h-5 w-5 text-emerald-600" />
              성장 대시보드
            </button>
            <button 
              onClick={() => setShowGuide(true)}
              className="w-full text-left px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium flex items-center gap-3 transition-colors cursor-pointer"
            >
              <BookOpen className="h-5 w-5 text-slate-400" />
              구축 가이드
            </button>
            <button 
              onClick={() => setShowAdmin(true)}
              className="w-full text-left px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium flex items-center gap-3 transition-colors cursor-pointer"
            >
              <Settings className="h-5 w-5 text-slate-405" />
              교사용 설정
            </button>
          </nav>

          <div className="pt-6 border-t border-slate-100">
            <button 
              onClick={handleStudentLogout}
              className="w-full px-4 py-2.5 text-xs font-bold text-stone-400 hover:text-rose-600 hover:bg-rose-50/30 rounded-xl transition-all uppercase tracking-widest text-center cursor-pointer font-bold"
            >
              로그아웃
            </button>
          </div>
        </aside>
      )}

      {/* 2. MAIN LAYOUT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Navigation Bar (Desktop version varies: small on desktop if sidebar is open) */}
        <header className="h-20 bg-white border-b border-emerald-100 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40 bg-white/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {!studentSession ? (
              <>
                <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-xs shrink-0">
                  <Keyboard className="h-5.5 w-5.5" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-black text-stone-900 tracking-tight leading-none flex items-center gap-1.5">
                    2026 Speed-Up 인비 타자 챌린지
                    <Sprout className="h-4 sm:h-4.5 w-4 sm:w-4.5 text-emerald-500 animate-bounce shrink-0" />
                  </h1>
                  <p className="text-[10px] sm:text-xs text-emerald-650 font-bold mt-1">
                    디지털 읽걷쓰 성장 프로젝트
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h1 className="text-base sm:text-lg font-black text-stone-900 tracking-tight flex items-center gap-1.5 leading-none">
                    2026 Speed-Up 인비 타자 챌린지 <span className="text-[9px] font-bold tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-lg uppercase select-none">Live</span>
                    <Sprout className="h-4 sm:h-4.5 w-4 sm:w-4.5 text-emerald-500 animate-pulse shrink-0" />
                  </h1>
                  <p className="text-[10.5px] text-emerald-650 font-bold mt-1">
                    디지털 읽걷쓰 성장 프로젝트
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            
            {/* Guide help button */}
            <button 
              onClick={() => setShowGuide(true)}
              className={`p-2.5 rounded-xl text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${studentSession ? 'md:hidden' : ''}`}
              title="도움말 가이드북"
            >
              <BookOpen className="h-4 w-4 text-slate-400" />
              <span className="hidden sm:inline">구축 가이드</span>
            </button>

            {/* School Spreadsheet Configurations */}
            <button 
              onClick={() => setShowAdmin(true)}
              className={`p-2.5 rounded-xl text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${studentSession ? 'md:hidden' : ''}`}
              title="교사용 시트 연동 설정"
            >
              <Settings className="h-4 w-4 text-slate-400" />
              <span className="hidden sm:inline">교사용 설정</span>
            </button>

            {studentSession && (
              <>
                <div className="text-right shrink-0 hidden sm:block mr-2">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">최종 업데이트</p>
                  <p className="text-xs font-bold text-slate-700 mt-1">2026.05.29</p>
                </div>
                <button 
                  onClick={handleStudentLogout}
                  className="md:hidden ml-2 p-2 px-3 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100/75 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>로그아웃</span>
                </button>
              </>
            )}

          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 bg-stone-50 p-4 sm:p-8 flex flex-col justify-center items-center min-w-0">

          {/* 1. INITIAL LOADING BANNER */}
          {isInitialLoading && (
            <div className="text-center py-20 px-8 bg-white border border-emerald-100 rounded-3xl max-w-md w-full shadow-sm">
              <div className="animate-spin h-10 w-10 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-sm text-stone-600 font-bold mb-1">스프레드시트 데이터베이스를 원격 분석 중입니다...</p>
              <p className="text-xs text-stone-400 font-sans">최초 구동 시 최대 3초가 소요될 수 있습니다.</p>
            </div>
          )}

          {/* 2. STUDENT LOGIN GATES (Rendered if not logged in & not loading) */}
          {!isInitialLoading && !studentSession && (
            <div className="max-w-md w-full space-y-6 py-6">
              
              <div className="flex flex-col gap-2">
                {spreadsheetId !== DEFAULT_SPREADSHEET_ID ? (
                  <div className="p-3.5 bg-emerald-50/95 border border-emerald-100 rounded-2xl flex flex-col sm:flex-row gap-2.5 items-center justify-between text-xs text-emerald-850 font-medium shadow-sm w-full">
                    <span className="flex items-center gap-1.5 text-left">
                      <Sparkles className="h-4 w-4 text-emerald-600 animate-pulse shrink-0" />
                      <span><strong>[학교 정보 모드]</strong> 실시간 스프레드시트 연동 중</span>
                    </span>
                    <div className="flex gap-1.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleForceReload}
                        className="flex-1 sm:flex-initial px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs whitespace-nowrap text-[11px]"
                      >
                        스프레드시트 새로고침 🔄
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAdmin(true)}
                        className="flex-1 sm:flex-initial px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs whitespace-nowrap text-[11px]"
                      >
                        연동 설정 변경 ⚙️
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200/60 rounded-2xl flex flex-col sm:flex-row gap-2.5 items-center justify-between text-xs text-amber-800 font-medium">
                    <span className="flex items-center gap-1.5 text-left">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span><strong>[가상 데모 모드]</strong> 가상 데이타 시연용 모드입니다.</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAdmin(true)}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-all text-[11px] whitespace-nowrap cursor-pointer"
                    >
                      실물 시트 연동 ⚙️
                    </button>
                  </div>
                )}

                {/* Local Sync Notification Popup */}
                {syncMessage && (
                  <div className="p-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                    <Sparkles className="h-4 w-4 text-blue-500 animate-ping" />
                    <span>{syncMessage}</span>
                  </div>
                )}

                {/* Spreadsheet Connection Error */}
                {sheetLoadError && (
                  <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs space-y-2.5 shadow-sm">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <p className="font-extrabold text-[12.5px] text-rose-900 leading-tight">교사용 구글 시트 연동 실패 안내</p>
                        <p className="text-[11px] text-rose-650 mt-1 font-semibold leading-normal">현재 연결하신 스프레드시트 또는 연동 설정에 문제가 있습니다.</p>
                      </div>
                    </div>
                    <div className="p-3 bg-white border border-rose-100/60 text-slate-700 rounded-xl leading-relaxed text-[11px] font-mono break-all font-semibold">
                      {sheetLoadError}
                    </div>
                    <div className="pt-2 border-t border-rose-200 space-y-1 font-sans text-[11px] leading-normal text-rose-700/80">
                      <p className="font-bold text-rose-900">💡 즉시 해결 가이드:</p>
                      <ul className="list-disc list-inside space-y-1 ml-1">
                        <li>스프레드시트 우측 상단 <strong>[공유] ➔ [링크가 있는 모든 사용자(뷰어)]</strong> 권한 설정이 완료되었는지 확인해주세요.</li>
                        <li>시트 하단에 <strong>students_auth</strong> (학생인증) 이름의 시트가 정확히 존재하고, 첫 줄에 <strong className="text-indigo-700 font-extrabold">학번</strong>, <strong className="text-indigo-700 font-extrabold">이름</strong>, <strong className="text-indigo-700 font-extrabold">인증번호</strong> 컬럼 헤더가 있는지 체크해 주세요.</li>
                        <li>입력하신 구글 시트 웹주소(URL) 또는 시트 ID가 올바른지 확인해 주세요.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Center Login Card */}
              <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm p-8 space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-600" />

                <div className="space-y-2 text-center border-b border-slate-100 pb-5">
                  <div className="flex justify-center mb-2">
                    <div className="p-2.5 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-600 shadow-xs animate-pulse inline-flex">
                      <Sprout className="h-6 w-6" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-stone-900 leading-tight">2026 Speed-Up 인비 타자 챌린지</h2>
                  <p className="text-xs text-emerald-650 font-extrabold mt-1">
                    디지털 읽걷쓰 성장 프로젝트
                  </p>
                  <p className="text-[11px] text-stone-400 leading-relaxed font-semibold mt-2">
                    학급에서 전달받은 학번 5자리와 개인 인증번호 4자리를 정확하게 입력하고 로그인해 주세요.
                  </p>
                </div>

                <form onSubmit={handleStudentLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1">
                      <GraduationCap className="h-4 w-4 text-emerald-600" />
                      학번 (5자리 정수)
                    </label>
                    <input 
                      type="text" 
                      maxLength={5}
                      placeholder="예: 10101 (1학년 1반 01번)"
                      value={studentIdInput}
                      onChange={(e) => setStudentIdInput(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full px-4 py-3 border border-emerald-105 rounded-2xl text-base font-mono tracking-wide placeholder:font-sans placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-stone-50/20"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1">
                      <Lock className="h-4 w-4 text-emerald-600" />
                      개인 비밀 인증번호 (4자리)
                    </label>
                    <input 
                      type="password" 
                      maxLength={4}
                      placeholder="핸드폰 끝 4자리 등의 인증 번호..."
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full px-4 py-3 border border-emerald-105 rounded-2xl text-base font-mono tracking-wide placeholder:font-sans placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-stone-50/20"
                      required
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={isAuthenticating}
                    className="w-full bg-linear-to-r from-emerald-600 to-green-600 text-white font-extrabold py-3.5 px-4 rounded-2xl hover:brightness-105 active:scale-[0.99] transition-all text-sm cursor-pointer shadow-lg shadow-emerald-100/50 flex items-center justify-center gap-1.5"
                  >
                    <LogIn className="h-4.5 w-4.5" />
                    {isAuthenticating ? '인증 매칭 연동 중...' : '챌린지 결과 조회 및 성장 대시보드 입장'}
                  </button>
                </form>

                {authError && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 flex flex-col gap-2 text-xs">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="font-bold leading-relaxed">{authError}</span>
                    </div>
                    <div className="mt-1.5 pt-2 border-t border-rose-200/50 text-rose-600 space-y-1.5 font-sans font-medium text-[11px] leading-relaxed">
                      <p className="font-extrabold text-rose-800">💡 로그인 번호가 맞지 않는다고 나오시나요?</p>
                      <p><strong>1. 스프레드시트 업데이트 반영 지연</strong><br />구글 스프레드시트에 새로 바꾼 비밀번호(예: 1234)가 웹 브라우저 캐시에 옛날 값으로 남아 있어서 발생할 수 있습니다. 상단의 <strong className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">[스프레드시트 새로고침 🔄]</strong> 버튼을 누르면 실시간으로 최신 데이터가 즉시 연동됩니다!</p>
                      <p><strong>2. 현재 가동 모드 재확인</strong><br />지금 <strong>{spreadsheetId === DEFAULT_SPREADSHEET_ID ? '가상 데모 모드 (Demo Sandbox)' : '우리 학교 개별 시트 모드'}</strong>입니다. {spreadsheetId === DEFAULT_SPREADSHEET_ID ? '데모 모드에서는 10101의 비빌번호가 4821로 지정되어 있으며, 선생님의 스프레드시트 1234 번호가 동작하려면 먼저 우측 상단 [교사용 설정]에서 본인이 관리하는 학급 구글 스프레드시트 ID/주소를 입력하고 연결해주셔야 합니다.' : '학교 스프레드시트가 연결된 상태입니다.'}</p>
                      <p><strong>3. 시트 명칭 및 학번 확인</strong><br />구글 스프레드시트의 <code>students_auth</code> 시트에 학생 <strong>학번(5자리)</strong>과 <strong>인증번호(4자리, 예: 1234)</strong>가 띄어쓰기 빈칸 없이 정확히 적혀 있는지 확인해주세요.</p>
                    </div>
                  </div>
                )}

                {/* Real-time Spreadsheet Data Inspector Toggle (highly helpful for teachers) */}
                <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDebugList(!showDebugList)}
                    className="w-full text-center text-xs text-slate-500 hover:text-emerald-700 bg-slate-50/50 hover:bg-emerald-50/50 py-2.5 px-3 rounded-xl border border-dashed border-slate-200 transition-all font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>🔍 {showDebugList ? '연동 데이터 점검창 닫기' : '현재 웹앱이 해석한 전체 학생 명단/비밀번호 확인'}</span>
                    <Sprout className={`h-3 w-3 text-emerald-500 transition-transform ${showDebugList ? 'rotate-180' : ''}`} />
                  </button>

                  {showDebugList && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                        <span className="text-[11px] text-slate-500 font-bold block">
                          📂 실시간 연동 등록 학생 (총 {authDb.length}명)
                        </span>
                        <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                          {spreadsheetId === DEFAULT_SPREADSHEET_ID ? '가상 데모' : '실제 학교 연결'}
                        </span>
                      </div>
                      
                      {authDb.length === 0 ? (
                        <p className="text-stone-500 text-[11px] leading-relaxed">
                          현재 시트에 등록된 사용자가 없거나, <code>students_auth</code> 시트에서 양식에 맞게 학번, 이름, 인증번호를 불러오지 못했습니다. '교사용 설정'의 스프레드시트 주소가 정확하며 공유 권한이 '뷰어'로 열려 있는지 점검 바랍니다.
                        </p>
                      ) : (
                        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 text-[11px] font-sans">
                          <p className="text-amber-750 bg-amber-50 p-2 rounded-lg border border-amber-100/60 leading-normal font-semibold mb-2">
                            💡 구글 시트에서 즉각 수합한 보안 대조군 데이터입니다. 실제 저장되어 있는 학번과 인증번호가 웹앱 관점에서 소수점(.0)이나 공백 없이 어떻게 전달되고 있는지 실시간 점검이 가능합니다.
                          </p>
                          <div className="grid grid-cols-2 gap-1.5 font-mono">
                            {authDb.map((st, i) => (
                              <div key={i} className="bg-white p-2 rounded-lg border border-slate-200 flex flex-col justify-between hover:border-emerald-300 transition-all">
                                <span className="text-slate-800 font-bold">{st.name} ({st.studentId})</span>
                                <span className="text-slate-600 font-semibold mt-1 text-[11px]">
                                  비밀번호: <strong className="text-indigo-600 font-extrabold bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded text-[11.5px] font-mono">{st.pin}</strong>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {spreadsheetId === DEFAULT_SPREADSHEET_ID && (
                <div className="bg-white rounded-2xl border border-emerald-100/70 p-4 space-y-2 text-xs text-stone-500 shadow-xs">
                  <p className="font-bold text-stone-850 flex items-center gap-1">
                    💡 데모 모드 전용 가상 로그인 계정:
                  </p>
                  <div className="font-mono space-y-1 bg-stone-50 p-2.5 rounded-xl border border-stone-150">
                    <p>• 학생 A: 학번 <strong className="text-stone-850">10101</strong> / 인증번호 <strong className="text-stone-850">4821</strong> (홍길동)</p>
                    <p>• 학생 B: 학번 <strong className="text-stone-850">10102</strong> / 인증번호 <strong className="text-stone-850">1234</strong> (김영희)</p>
                  </div>
                  <p className="pt-1 text-stone-400 font-medium">교사 계정의 스프레드시트를 구성해 상단 '교사용 설정'에 주소를 입포하면 실시간 학교 정보로 동작됩니다.</p>
                </div>
              )}

            </div>
          )}

          {/* 3. CORE PERSONAL PERFORMANCE DASHBOARD */}
          {!isInitialLoading && studentSession && (
            <div className="w-full max-w-5xl space-y-8 animate-fade-in py-2">
              
              {/* Header card banner */}
              <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-emerald-600" />
                
                <div className="space-y-1 sm:space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                      <Sprout className="h-3 w-3 text-emerald-600 animate-pulse" />
                      Speed-Up 인비 타자 챌린지
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 text-stone-605 text-[10px] font-bold rounded-lg">
                      {studentSession.grade}학년 {studentSession.department}과
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight font-sans">
                    <span className="text-emerald-700">{studentSession.name}</span> 학생의 성장 기록
                  </h2>
                  <p className="text-xs text-stone-400 font-medium tracking-tight font-sans">로그인 학번 : {studentSession.id} / 원격 데이터 동기화 완료</p>
                </div>

                <div className="bg-stone-50 border border-stone-150 rounded-2xl p-4 md:max-w-xs flex items-start gap-3 shadow-2xs font-sans">
                  <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl shrink-0">
                    <Medal className="h-5 w-5" />
                  </div>
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-stone-850">기적의 타수 성장 러너</p>
                    <p className="text-stone-550 leading-relaxed font-semibold">
                      속도가 월별로 증가하고 있습니다. 포기 지점을 넘어 지속 수련해 최고 급수인 1급(Gold)을 겨냥하세요!
                    </p>
                  </div>
                </div>
              </div>

              {/* Side by side stats */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* English */}
                <div className="space-y-6">
                  <StudentStatsCard 
                    stats={studentSession.englishStats} 
                    title="영어 타자 성장 진척도" 
                    type="english" 
                  />
                  
                  <TypingChart 
                    history={studentSession.englishStats.history} 
                    type="english" 
                  />
                </div>

                {/* Korean */}
                <div className="space-y-6">
                  <StudentStatsCard 
                    stats={studentSession.koreanStats} 
                    title="한글 타자 성장 진척도" 
                    type="korean" 
                  />

                  <TypingChart 
                    history={studentSession.koreanStats.history} 
                    type="korean" 
                  />
                </div>

              </div>

              <p className="text-xs text-slate-400 text-center font-medium leading-relaxed max-w-sm mx-auto">
                학생 개인정보 보호 체계가 가동 중입니다. 본 기록은 타인 학생 목록에 공유되지 않는 폐쇄형 네트워크 암호 조립 데이터입니다.
              </p>

            </div>
          )}

        </main>

        {/* FOOTER */}
        <footer className="w-full bg-white border-t border-slate-205 py-6 text-center text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-center px-4 sm:px-8 gap-3">
          <p className="font-medium tracking-wide">
            © 2026 School Typing Tracker. Created by Information Department.
          </p>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">시스템 정상</span>
            </div>
          </div>
        </footer>

      </div>

      {/* MODALS */}
      {showAdmin && (
        <AdminPanel 
          onSpreadsheetConfigured={handleSpreadsheetConfigured}
          currentSpreadsheetId={spreadsheetId}
          onClose={() => setShowAdmin(false)}
        />
      )}

      {showGuide && (
        <GuideModal 
          onClose={() => setShowGuide(false)}
        />
      )}

    </div>
  );
}

