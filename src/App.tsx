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
  clearDataCache,
  parseStudentIdInfo
} from './data';
import { StudentAuth, TypingRecord, LevelRule, StudentStats } from './types';
import { StudentStatsCard } from './components/StudentCards';
import { TypingChart } from './components/TypingChart';
import { AdminPanel } from './components/AdminPanel';
import { GuideModal } from './components/GuideModal';
import { TeacherAnalytics } from './components/TeacherAnalytics';
import { 
  Keyboard, LogIn, GraduationCap, Lock, HelpCircle, 
  Settings, AlertCircle, BookOpen, LogOut, Medal, Sparkles,
  Sprout
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SCHOOL_APPS_SCRIPT_URL } from './config';

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
  const [appsScriptUrl, setAppsScriptUrl] = useState<string | null>(() => {
    return localStorage.getItem('school_apps_script_url') || SCHOOL_APPS_SCRIPT_URL || null;
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

  // Teacher authentication states
  const [isTeacher, setIsTeacher] = useState<boolean>(() => {
    return localStorage.getItem('is_teacher_authenticated') === 'true';
  });
  const [showTeacherLogin, setShowTeacherLogin] = useState(false);
  const [teacherPasswordInput, setTeacherPasswordInput] = useState('');
  const [teacherPasswordError, setTeacherPasswordError] = useState<string | null>(null);

  const handleTeacherLogout = () => {
    setIsTeacher(false);
    localStorage.removeItem('is_teacher_authenticated');
  };

  const handleTeacherLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherPasswordError(null);
    if (teacherPasswordInput === '1004') {
      setIsTeacher(true);
      localStorage.setItem('is_teacher_authenticated', 'true');
      setShowTeacherLogin(false);
      setTeacherPasswordInput('');
    } else {
      setTeacherPasswordError('비밀번호가 올바르지 않습니다.');
    }
  };

  const handleForceReload = async () => {
    setIsInitialLoading(true);
    setAuthError(null);
    setSheetLoadError(null);
    setSyncMessage(null);
    try {
      clearDataCache();
      const data = await fetchSpreadsheetData(spreadsheetId, googleToken, appsScriptUrl);
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
        const data = await fetchSpreadsheetData(spreadsheetId, googleToken, appsScriptUrl);
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
  }, [spreadsheetId, googleToken, appsScriptUrl]);

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
    if (!pinInput || pinInput.length < 4 || pinInput.length > 8) {
      setAuthError('생년월일 8자리를 올바르게 입력해 주세요. (예: 20080101)');
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

      // Dynamically extract Grade and Department strictly based on school 5-digit Student ID rule
      const studentInfo = parseStudentIdInfo(currentAuth.studentId);
      const grade = studentInfo.grade;
      const department = studentInfo.department;

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
  const handleSpreadsheetConfigured = (newSpreadsheetId: string, token: string | null, newAppsScriptUrl?: string | null) => {
    setSpreadsheetId(newSpreadsheetId);
    setGoogleToken(token);
    setAppsScriptUrl(newAppsScriptUrl || null);
    
    // Persist sheets settings to device Local Storage
    localStorage.setItem('school_spreadsheet_id', newSpreadsheetId);
    if (token) {
      localStorage.setItem('school_google_token', token);
    } else {
      localStorage.removeItem('school_google_token');
    }

    if (newAppsScriptUrl) {
      localStorage.setItem('school_apps_script_url', newAppsScriptUrl);
    } else {
      localStorage.removeItem('school_apps_script_url');
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
            
            {!studentSession && (
              <>
                {isTeacher ? (
                  <button 
                    onClick={handleTeacherLogout}
                    className="p-2.5 px-4 rounded-xl text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all flex items-center gap-2 text-xs font-extrabold cursor-pointer h-10 shadow-sm"
                  >
                    <Lock className="h-4 w-4 text-amber-600" />
                    <span>선생님 로그아웃</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      setTeacherPasswordError(null);
                      setTeacherPasswordInput('');
                      setShowTeacherLogin(true);
                    }}
                    className="p-2.5 px-4 rounded-xl text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-all flex items-center gap-2 text-xs font-extrabold cursor-pointer h-10 shadow-sm"
                  >
                    <Lock className="h-4 w-4 text-slate-500" />
                    <span>선생님 로그인</span>
                  </button>
                )}
              </>
            )}

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
              <p className="text-sm text-stone-605 font-bold mb-1">스프레드시트 데이터베이스를 원격 분석 중입니다...</p>
              <p className="text-xs text-stone-400 font-sans">최초 구동 시 최대 3초가 소요될 수 있습니다.</p>
            </div>
          )}

          {/* 2. CORE VIEW: TEACHER ANALYTICS OR STUDENT LOGIN GATES (Rendered if not loaded in session) */}
          {!isInitialLoading && !studentSession && (
            isTeacher ? (
              <TeacherAnalytics 
                authDb={authDb}
                englishDb={englishDb}
                koreanDb={koreanDb}
                onShowSettings={() => setShowAdmin(true)}
                spreadsheetId={spreadsheetId}
              />
            ) : (
              <div className="max-w-md w-full space-y-6 py-6">
                
                {/* Center Student Login Card */}
                <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm p-8 space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-600" />

                  <div className="space-y-4 text-center border-b border-slate-100 pb-5">
                    <div className="flex justify-center">
                      <div className="p-2.5 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-600 shadow-xs animate-pulse inline-flex">
                        <Sprout className="h-6 w-6" />
                      </div>
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-stone-900 leading-tight">2026 Speed-Up 인비 타자 챌린지</h2>
                    <p className="text-lg sm:text-xl text-emerald-655 font-extrabold mt-1.5 leading-snug">
                      디지털 읽걷쓰 성장 프로젝트
                    </p>
                  </div>

                  <form onSubmit={handleStudentLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1">
                        <GraduationCap className="h-4 w-4 text-emerald-600" />
                        학번 (5자리)
                      </label>
                      <input 
                        type="text" 
                        maxLength={5}
                        placeholder="예: 10101"
                        value={studentIdInput}
                        onChange={(e) => setStudentIdInput(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full px-4 py-3 border border-emerald-105 rounded-2xl text-base font-mono tracking-wide placeholder:font-sans placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-stone-50/20"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1">
                        <Lock className="h-4 w-4 text-emerald-600" />
                        개인 비밀번호 / 생년월일 (8자리)
                      </label>
                      <input 
                        type="password" 
                        maxLength={8}
                        placeholder="생년월일 8자리(예: 20080101)"
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
                      {isAuthenticating ? '인증 매칭 연동 중...' : '내 기록 확인하기'}
                    </button>
                  </form>

                  {authError && (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-105 text-rose-700 flex flex-col gap-2 text-xs">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-rose-600" />
                        <div>
                          <p className="font-extrabold text-rose-800">로그인에 실패하였습니다</p>
                          <p className="text-[11.1px] text-rose-600 font-bold leading-relaxed mt-1">
                            학번(5자리) 또는 생년월일(8자리)이 일치하지 않습니다. 로그인이 안될 경우 교육정보부로 문의하세요.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 🔐 Teacher Login Quick Trigger Button replacing original Spreadsheet Connection Indicator */}
                  <div className="pt-5 border-t border-slate-105 flex flex-col items-center justify-center gap-2">
                    <p className="text-[10px] text-stone-400 font-bold">2026 인비 타자 챌린지 성장 기록 시스템</p>
                    <button 
                      type="button"
                      onClick={() => {
                        setTeacherPasswordError(null);
                        setTeacherPasswordInput('');
                        setShowTeacherLogin(true);
                      }}
                      className="px-4.5 py-2.5 text-[11px] font-black text-slate-600 hover:text-indigo-700 bg-stone-55 hover:bg-indigo-50 border border-slate-200 rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs w-full"
                    >
                      <Lock className="h-4 w-4 text-slate-500" />
                      선생님 로그인 (데이터 분석 확인)
                    </button>
                  </div>
                </div>

              </div>
            )
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
                학생 개인정보 보호 체계가 가동 중입니다. 
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
          currentAppsScriptUrl={appsScriptUrl}
          onClose={() => setShowAdmin(false)}
        />
      )}

      {showGuide && (
        <GuideModal 
          onClose={() => setShowGuide(false)}
        />
      )}

      {showTeacherLogin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-indigo-100 shadow-xl max-w-sm w-full p-6 space-y-4 relative overflow-hidden animate-scale-up">
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-indigo-600" />
            
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-base font-black text-stone-900 tracking-tight">선생님 로그인</h3>
                <p className="text-xs text-stone-400 font-semibold">관리 권한 소유자인지 패스워드를 요구합니다.</p>
              </div>
              <button 
                onClick={() => {
                  setShowTeacherLogin(false);
                  setTeacherPasswordInput('');
                  setTeacherPasswordError(null);
                }}
                className="p-1 px-2.5 bg-slate-100 hover:bg-slate-205 text-stone-500 rounded-lg text-xs font-bold transition-all"
              >
                닫기 ✕
              </button>
            </div>

            <form onSubmit={handleTeacherLoginSubmit} className="space-y-3.5 pt-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest">
                  비밀번호 입력
                </label>
                <input 
                  type="password" 
                  placeholder="학교 비밀번호 4자리(한 번)"
                  value={teacherPasswordInput}
                  onChange={(e) => setTeacherPasswordInput(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-250 rounded-2xl text-base font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-stone-50/10"
                  required
                  autoFocus
                />
              </div>

              {teacherPasswordError && (
                <p className="text-[11px] text-rose-650 font-bold bg-rose-50 p-2 rounded-lg border border-rose-100 text-center">
                  ⚠️ {teacherPasswordError}
                </p>
              )}

              <button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 px-4 rounded-2xl transition-all text-xs cursor-pointer shadow-xs"
              >
                선생님 모드 진입하기 🔓
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

