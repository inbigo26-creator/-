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
  parseStudentIdInfo,
  saveConsentToSpreadsheet,
  normalizeDepartment,
  resolveStudentGradeAndDept,
  saveStudentPinToSpreadsheet
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
  Sprout, Star, TrendingUp, ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SCHOOL_SPREADSHEET_ID, SCHOOL_APPS_SCRIPT_URL } from './config';

const isExcludedStudentName = (name: string): boolean => {
  if (!name) return false;
  const n = name.trim();
  return n.includes('(자퇴)') || n.includes('(위탁)') || n.includes('*');
};

const cleanStudentId = (id: string) => String(id || '').trim().replace(/[^0-9A-Za-z]/g, '');

const maskName = (name: string): string => {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return trimmed[0] + '○';
  return trimmed[0] + '○' + trimmed.slice(2);
};

export default function App() {
  // Input fields
  const [studentIdInput, setStudentIdInput] = useState('');
  const [pinInput, setPinInput] = useState('');

  // Active configurations
  const [spreadsheetId, setSpreadsheetId] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlSid = params.get('sid');
      if (urlSid && urlSid.trim() && urlSid !== '1Q8v8_1_S_T-E_ST_S_h_e_e_t_I_D_D_e_m_o') {
        localStorage.setItem('school_spreadsheet_id', urlSid.trim());
        return urlSid.trim();
      }
    } catch (e) {
      console.warn('Failed parsing URL sid parameter:', e);
    }
    const localVal = localStorage.getItem('school_spreadsheet_id');
    if (localVal && localVal.trim() && localVal !== '1Q8v8_1_S_T-E_ST_S_h_e_e_t_I_D_D_e_m_o') {
      return localVal;
    }
    return SCHOOL_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
  });
  const [googleToken, setGoogleToken] = useState<string | null>(() => {
    return localStorage.getItem('school_google_token') || null;
  });
  const [appsScriptUrl, setAppsScriptUrl] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlGas = params.get('gas');
      if (urlGas && urlGas.trim()) {
        localStorage.setItem('school_apps_script_url', urlGas.trim());
        return urlGas.trim();
      }
    } catch (e) {
      console.warn('Failed parsing URL gas parameter:', e);
    }
    const localVal = localStorage.getItem('school_apps_script_url');
    if (localVal && localVal.trim()) {
      return localVal;
    }
    return SCHOOL_APPS_SCRIPT_URL || null;
  });

  // State loaded databases
  const [authDb, setAuthDb] = useState<StudentAuth[]>([]);
  const [englishDb, setEnglishDb] = useState<TypingRecord[]>([]);
  const [koreanDb, setKoreanDb] = useState<TypingRecord[]>([]);
  const [levelRulesDb, setLevelRulesDb] = useState<LevelRule[]>([]);
  const [privacyDb, setPrivacyDb] = useState<{ studentId: string; name: string; agreed: boolean }[]>([]);

  // Authentication states
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingSession, setPendingSession] = useState<{
    id: string;
    name: string;
    grade: string;
    department: string;
    englishStats: StudentStats;
    koreanStats: StudentStats;
  } | null>(null);
  const [privacyCheckboxChecked, setPrivacyCheckboxChecked] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [studentSession, setStudentSession] = useState<{
    id: string;
    name: string;
    grade: string;
    department: string;
    englishStats: StudentStats;
    koreanStats: StudentStats;
  } | null>(null);
  const [studentTab, setStudentTab] = useState<'my_stats' | 'hall_of_fame' | 'privacy_consent'>('my_stats');
  const [selectedHallMonth, setSelectedHallMonth] = useState<string>('');
  const [showPrivacyOnlyModal, setShowPrivacyOnlyModal] = useState(false);
  const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState(false);

  // Student own Password change states
  const [showStudentPasswordChangeModal, setShowStudentPasswordChangeModal] = useState(false);
  const [studentCurrentPinInput, setStudentCurrentPinInput] = useState('');
  const [studentNewPinInput, setStudentNewPinInput] = useState('');
  const [studentNewPinConfirmInput, setStudentNewPinConfirmInput] = useState('');
  const [studentPasswordChangeError, setStudentPasswordChangeError] = useState<string | null>(null);
  const [studentPasswordChangeSuccess, setStudentPasswordChangeSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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
    const isAuth = localStorage.getItem('is_teacher_authenticated') === 'true';
    if (!isAuth) return false;
    
    const lastActivityStr = localStorage.getItem('teacher_last_activity_at');
    if (!lastActivityStr) return false;
    
    const lastActivity = parseInt(lastActivityStr, 10);
    // 30 minutes check (30 * 60 * 1000 = 1,800,000 ms)
    if (Date.now() - lastActivity > 1800000) {
      localStorage.removeItem('is_teacher_authenticated');
      localStorage.removeItem('teacher_last_activity_at');
      return false;
    }
    // Set current active time
    localStorage.setItem('teacher_last_activity_at', String(Date.now()));
    return true;
  });
  const [showTeacherLogin, setShowTeacherLogin] = useState(false);
  const [teacherPasswordInput, setTeacherPasswordInput] = useState('');
  const [teacherPasswordError, setTeacherPasswordError] = useState<string | null>(null);

  const handleTeacherLogout = () => {
    setIsTeacher(false);
    localStorage.removeItem('is_teacher_authenticated');
    localStorage.removeItem('teacher_last_activity_at');
  };

  // 🏆 Monthly MVP Lock States
  const [mvpLocks, setMvpLocks] = useState<{[month: string]: boolean}>(() => {
    try {
      const stored = localStorage.getItem(`school_mvp_locks_${spreadsheetId}`);
      return stored ? JSON.parse(stored) : {};
    } catch (_) {
      return {};
    }
  });

  const [frozenMvpWinners, setFrozenMvpWinners] = useState<{[month: string]: any[]}>(() => {
    try {
      const stored = localStorage.getItem(`school_mvp_frozen_winners_${spreadsheetId}`);
      return stored ? JSON.parse(stored) : {};
    } catch (_) {
      return {};
    }
  });

  useEffect(() => {
    try {
      // Correct spreadsheet change sync
      const storedLocks = localStorage.getItem(`school_mvp_locks_${spreadsheetId}`);
      setMvpLocks(storedLocks ? JSON.parse(storedLocks) : {});

      const storedWinners = localStorage.getItem(`school_mvp_frozen_winners_${spreadsheetId}`);
      setFrozenMvpWinners(storedWinners ? JSON.parse(storedWinners) : {});
    } catch (e) {
      console.error('Error reloading MVP lock configuration:', e);
    }
  }, [spreadsheetId]);

  const handleToggleMvpLock = (month: string, currentWinners: any[]) => {
    const isLocked = !!mvpLocks[month];
    const nextLocks = { ...mvpLocks, [month]: !isLocked };
    setMvpLocks(nextLocks);
    localStorage.setItem(`school_mvp_locks_${spreadsheetId}`, JSON.stringify(nextLocks));

    const nextWinners = { ...frozenMvpWinners };
    if (!isLocked) {
      nextWinners[month] = currentWinners;
    } else {
      delete nextWinners[month];
    }
    setFrozenMvpWinners(nextWinners);
    localStorage.setItem(`school_mvp_frozen_winners_${spreadsheetId}`, JSON.stringify(nextWinners));
  };

  // 📋 Calculate student-level latest speed averages (excluding special status students) for school & grade comparison
  const statsAverages = React.useMemo(() => {
    // 1. Get unique student set from authDb
    const studentMap = new Map<string, { studentId: string; name: string; grade: string; department: string }>();
    authDb.forEach(s => {
      const info = parseStudentIdInfo(s.studentId);
      const resolved = resolveStudentGradeAndDept(s.studentId, info.grade, info.department);
      studentMap.set(cleanStudentId(s.studentId), {
        studentId: s.studentId,
        name: s.name,
        grade: resolved.grade,
        department: resolved.department
      });
    });

    const validStudents = Array.from(studentMap.values()).filter(s => !isExcludedStudentName(s.name));

    // 2. Map latest and peak Korean and English speeds
    const studentsWithLatestSpeeds = validStudents.map(s => {
      const cleanId = cleanStudentId(s.studentId);
      
      const sEng = englishDb.filter(r => cleanStudentId(r.studentId) === cleanId)
        .sort((a,b) => getMonthNumber(a.month) - getMonthNumber(b.month));
      const engSpeed = sEng.length > 0 ? sEng[sEng.length - 1].speed : 0;
      const maxEngSpeed = sEng.length > 0 ? Math.max(...sEng.map(r => r.speed), 0) : 0;

      const sKor = koreanDb.filter(r => cleanStudentId(r.studentId) === cleanId)
        .sort((a,b) => getMonthNumber(a.month) - getMonthNumber(b.month));
      const korSpeed = sKor.length > 0 ? sKor[sKor.length - 1].speed : 0;
      const maxKorSpeed = sKor.length > 0 ? Math.max(...sKor.map(r => r.speed), 0) : 0;

      return {
        ...s,
        engSpeed,
        korSpeed,
        maxEngSpeed,
        maxKorSpeed
      };
    });

    const listGrades = ['1', '2', '3'];

    // Unify averages: Exclude 결시 (absent, speed === 0) and use maximum speeds over all months
    const korActive = studentsWithLatestSpeeds.filter(s => s.maxKorSpeed > 0);
    const engActive = studentsWithLatestSpeeds.filter(s => s.maxEngSpeed > 0);

    const korSchoolAvg = korActive.length > 0 ? Math.round(korActive.reduce((sum, s) => sum + s.maxKorSpeed, 0) / korActive.length) : 0;
    const engSchoolAvg = engActive.length > 0 ? Math.round(engActive.reduce((sum, s) => sum + s.maxEngSpeed, 0) / engActive.length) : 0;

    const korGradeAvg: { [grade: string]: number } = { '1': 0, '2': 0, '3': 0 };
    const engGradeAvg: { [grade: string]: number } = { '1': 0, '2': 0, '3': 0 };

    listGrades.forEach(g => {
      const gKorActive = korActive.filter(s => {
        const sGradeNum = String(s.grade || '').replace(/[^0-9]/g, '');
        const targetGradeNum = String(g).replace(/[^0-9]/g, '');
        return sGradeNum === targetGradeNum;
      });
      korGradeAvg[g] = gKorActive.length > 0 ? Math.round(gKorActive.reduce((sum, s) => sum + s.maxKorSpeed, 0) / gKorActive.length) : 0;

      const gEngActive = engActive.filter(s => {
        const sGradeNum = String(s.grade || '').replace(/[^0-9]/g, '');
        const targetGradeNum = String(g).replace(/[^0-9]/g, '');
        return sGradeNum === targetGradeNum;
      });
      engGradeAvg[g] = gEngActive.length > 0 ? Math.round(gEngActive.reduce((sum, s) => sum + s.maxEngSpeed, 0) / gEngActive.length) : 0;
    });

    return {
      korean: {
        schoolAverage: korSchoolAvg,
        gradeAverage: korGradeAvg
      },
      english: {
        schoolAverage: engSchoolAvg,
        gradeAverage: engGradeAvg
      }
    };
  }, [authDb, englishDb, koreanDb]);

  // 🟢 1. Sort months chronologically
  const sortedMonths = React.useMemo(() => {
    const months = Array.from(new Set([
      ...englishDb.map(r => r.month),
      ...koreanDb.map(r => r.month)
    ]));
    return months.sort((a,b) => getMonthNumber(a) - getMonthNumber(b));
  }, [englishDb, koreanDb]);

  // 🟢 2. Calculate Snack Award History Chronologically
  const monthlySnackWinnersHistory = React.useMemo(() => {
    interface Winner {
      studentId: string;
      name: string;
      grade: string;
      department: string;
      value: number;
    }

    const historyMap: {
      [month: string]: {
        winners: { studentId: string; name: string; department: string; grade: string; reason: string; value: number }[];
      };
    } = {};

    const cumulativeSnackWinners = new Set<string>();

    sortedMonths.forEach((month, monthIdx) => {
      const isLocked = !!mvpLocks[month];
      let selectedWinners: { studentId: string; name: string; department: string; grade: string; reason: string; value: number }[] = [];
      const localSelectedSet = new Set<string>();

      if (isLocked && frozenMvpWinners && frozenMvpWinners[month]) {
        selectedWinners = frozenMvpWinners[month];
        selectedWinners.forEach(w => {
          const cleanId = cleanStudentId(w.studentId);
          localSelectedSet.add(cleanId);
          cumulativeSnackWinners.add(cleanId);
        });
      } else {
        const korThisMonth = koreanDb.filter(r => r.month === month);
        const engThisMonth = englishDb.filter(r => r.month === month);
        const prevMonthName = monthIdx > 0 ? sortedMonths[monthIdx - 1] : null;

        // Kor Speed
        const rawKorSpeedCandidates = korThisMonth.map(r => {
          const { grade: rGrade, department: rDept } = resolveStudentGradeAndDept(r.studentId, r.grade, r.department);
          return {
            studentId: r.studentId,
            name: r.name,
            grade: rGrade,
            department: rDept,
            value: r.speed
          };
        }).sort((a,b) => b.value - a.value);

        // Eng Speed
        const rawEngSpeedCandidates = engThisMonth.map(r => {
          const { grade: rGrade, department: rDept } = resolveStudentGradeAndDept(r.studentId, r.grade, r.department);
          return {
            studentId: r.studentId,
            name: r.name,
            grade: rGrade,
            department: rDept,
            value: r.speed
          };
        }).sort((a,b) => b.value - a.value);

        // Kor Growth
        const rawKorGrowthCandidates: Winner[] = [];
        if (prevMonthName) {
          const korPrev = koreanDb.filter(r => r.month === prevMonthName);
          korThisMonth.forEach(curr => {
            const prev = korPrev.find(p => cleanStudentId(p.studentId) === cleanStudentId(curr.studentId));
            if (prev) {
              const diff = curr.speed - prev.speed;
              if (diff > 0) {
                const { grade: rGrade, department: rDept } = resolveStudentGradeAndDept(curr.studentId, curr.grade, curr.department);
                rawKorGrowthCandidates.push({
                  studentId: curr.studentId,
                  name: curr.name,
                  grade: rGrade,
                  department: rDept,
                  value: diff
                });
              }
            }
          });
        }
        rawKorGrowthCandidates.sort((a,b) => b.value - a.value);

        // Eng Growth
        const rawEngGrowthCandidates: Winner[] = [];
        if (prevMonthName) {
          const engPrev = englishDb.filter(r => r.month === prevMonthName);
          engThisMonth.forEach(curr => {
            const prev = engPrev.find(p => cleanStudentId(p.studentId) === cleanStudentId(curr.studentId));
            if (prev) {
              const diff = curr.speed - prev.speed;
              if (diff > 0) {
                const { grade: rGrade, department: rDept } = resolveStudentGradeAndDept(curr.studentId, curr.grade, curr.department);
                rawEngGrowthCandidates.push({
                  studentId: curr.studentId,
                  name: curr.name,
                  grade: rGrade,
                  department: rDept,
                  value: diff
                });
              }
            }
          });
        }
        rawEngGrowthCandidates.sort((a,b) => b.value - a.value);

        const trySelectWinnerForGrade = (list: Winner[], gradeVal: string, reasonTag: string) => {
          for (let i = 0; i < list.length; i++) {
            const s = list[i];
            const cleanId = cleanStudentId(s.studentId);
            const sGradeNum = String(s.grade).replace(/[^0-9]/g, '');
            const targetGradeNum = String(gradeVal).replace(/[^0-9]/g, '');

            if (sGradeNum !== targetGradeNum) continue;
            if (isExcludedStudentName(s.name)) continue;

            if (!cumulativeSnackWinners.has(cleanId) && !localSelectedSet.has(cleanId)) {
              selectedWinners.push({
                studentId: s.studentId,
                name: s.name,
                department: s.department,
                grade: s.grade,
                reason: `${gradeVal}학년 ${reasonTag}`,
                value: s.value
              });
              localSelectedSet.add(cleanId);
              cumulativeSnackWinners.add(cleanId);
              break;
            }
          }
        };

        ['1', '2', '3'].forEach(g => {
          trySelectWinnerForGrade(rawKorSpeedCandidates, g, '한글 최고 속도');
        });
        ['1', '2', '3'].forEach(g => {
          trySelectWinnerForGrade(rawEngSpeedCandidates, g, '영어 최고 속도');
        });
        if (prevMonthName) {
          ['1', '2', '3'].forEach(g => {
            trySelectWinnerForGrade(rawKorGrowthCandidates, g, '한글 최고 향상도');
          });
        }
        if (prevMonthName) {
          ['1', '2', '3'].forEach(g => {
            trySelectWinnerForGrade(rawEngGrowthCandidates, g, '영어 최고 향상도');
          });
        }
      }

      historyMap[month] = {
        winners: selectedWinners
      };
    });

    return historyMap;
  }, [englishDb, koreanDb, sortedMonths, mvpLocks, frozenMvpWinners]);

  // 🟢 3. Calculate Cumulative Periodic Final Awards (5월~10월)
  const cumulativeFinalAwards = React.useMemo(() => {
    const studentIds = Array.from(new Set([...englishDb.map(r => r.studentId), ...koreanDb.map(r => r.studentId)]));

    const korSpeeds: { studentId: string; name: string; department: string; grade: string; value: number }[] = [];
    const engSpeeds: typeof korSpeeds = [];
    const korGrowths: typeof korSpeeds = [];
    const engGrowths: typeof korSpeeds = [];

    studentIds.forEach(sid => {
      const cleanId = cleanStudentId(sid);
      const sKor = koreanDb.filter(r => cleanStudentId(r.studentId) === cleanId).sort((a,b) => getMonthNumber(a.month) - getMonthNumber(b.month));
      const sEng = englishDb.filter(r => cleanStudentId(r.studentId) === cleanId).sort((a,b) => getMonthNumber(a.month) - getMonthNumber(b.month));

      const info = parseStudentIdInfo(sid);

      if (sKor.length > 0) {
        const maxVal = Math.max(...sKor.map(r => r.speed));
        const { grade: rGrade, department: rDept } = resolveStudentGradeAndDept(sid, sKor[0].grade, sKor[0].department);

        korSpeeds.push({
          studentId: sid,
          name: sKor[0].name,
          department: rDept,
          grade: rGrade,
          value: maxVal
        });

        if (sKor.length >= 2) {
          const firstSpeed = sKor[0].speed;
          const lastSpeed = sKor[sKor.length - 1].speed;
          const improvement = lastSpeed - firstSpeed;
          if (improvement > 0) {
            korGrowths.push({
              studentId: sid,
              name: sKor[0].name,
              department: rDept,
              grade: rGrade,
              value: improvement
            });
          }
        }
      }

      if (sEng.length > 0) {
        const maxVal = Math.max(...sEng.map(r => r.speed));
         const { grade: rGrade, department: rDept } = resolveStudentGradeAndDept(sid, sEng[0].grade, sEng[0].department);

        engSpeeds.push({
          studentId: sid,
          name: sEng[0].name,
          department: rDept,
          grade: rGrade,
          value: maxVal
        });

        if (sEng.length >= 2) {
          const firstSpeed = sEng[0].speed;
          const lastSpeed = sEng[sEng.length - 1].speed;
          const improvement = lastSpeed - firstSpeed;
          if (improvement > 0) {
            engGrowths.push({
              studentId: sid,
              name: sEng[0].name,
              department: rDept,
              grade: rGrade,
              value: improvement
            });
          }
        }
      }
    });

    const getTopPerGrade = (list: typeof korSpeeds) => {
      const result: typeof korSpeeds = [];
      const grades = ['1', '2', '3'];
      grades.forEach(g => {
        const sortedForGrade = list
          .filter(s => {
            const sGradeNum = String(s.grade || '').replace(/[^0-9]/g, '');
            const targetGradeNum = String(g).replace(/[^0-9]/g, '');
            return sGradeNum === targetGradeNum && !isExcludedStudentName(s.name);
          })
          .sort((a, b) => b.value - a.value);
        if (sortedForGrade.length > 0) {
          result.push(sortedForGrade[0]);
        }
      });
      return result.sort((a, b) => a.grade.localeCompare(b.grade));
    };

    return {
      korSpeed: getTopPerGrade(korSpeeds),
      engSpeed: getTopPerGrade(engSpeeds),
      korGrowth: getTopPerGrade(korGrowths),
      engGrowth: getTopPerGrade(engGrowths)
    };
  }, [englishDb, koreanDb]);

  const handleTeacherLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherPasswordError(null);
    if (teacherPasswordInput === '1004') {
      setIsTeacher(true);
      const now = Date.now();
      localStorage.setItem('is_teacher_authenticated', 'true');
      localStorage.setItem('teacher_last_activity_at', String(now));
      setShowTeacherLogin(false);
      setTeacherPasswordInput('');
      
      // Clear cache so the teacher always loads completely fresh data right after login
      try {
        clearDataCache();
      } catch (_) {}
      
      setIsInitialLoading(true);
      try {
        const data = await fetchSpreadsheetData(spreadsheetId, googleToken, appsScriptUrl, true);
        setAuthDb(data.auth);
        setEnglishDb(data.english);
        setKoreanDb(data.korean);
        setLevelRulesDb(data.levels);
        setPrivacyDb(data.privacy || []);
        
        setSheetMetrics({
          success: true,
          authRows: data.auth.length,
          totalEng: data.english.length,
          totalKor: data.korean.length
        });
      } catch (err: any) {
        console.error('Failed to reload sheet post login:', err);
      } finally {
        setIsInitialLoading(false);
      }
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
      const data = await fetchSpreadsheetData(spreadsheetId, googleToken, appsScriptUrl, true);
      setAuthDb(data.auth);
      setEnglishDb(data.english);
      setKoreanDb(data.korean);
      setLevelRulesDb(data.levels);
      setPrivacyDb(data.privacy || []);
      
      setSheetMetrics({
        success: true,
        authRows: data.auth.length,
        totalEng: data.english.length,
        totalKor: data.korean.length
      });
      setSyncMessage('스프레드시트 최신 정보 연동 완료!');
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
        // If a teacher is authenticated when mounting, bypass cache to guarantee latest view
        if (isTeacher) {
          try {
            clearDataCache();
          } catch (_) {}
        }
        const data = await fetchSpreadsheetData(spreadsheetId, googleToken, appsScriptUrl, isTeacher);
        setAuthDb(data.auth);
        setEnglishDb(data.english);
        setKoreanDb(data.korean);
        setLevelRulesDb(data.levels);
        setPrivacyDb(data.privacy || []);
        
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
  }, [spreadsheetId, googleToken, appsScriptUrl, isTeacher]);

  // 🕒 Teacher autologout logic (30 minutes of inactivity)
  useEffect(() => {
    if (!isTeacher) return;

    // Tick checking every 5 seconds
    const intervalId = setInterval(() => {
      const lastActivityStr = localStorage.getItem('teacher_last_activity_at');
      if (lastActivityStr) {
        const lastActivity = parseInt(lastActivityStr, 10);
        const now = Date.now();
        // 30 minutes in milliseconds = 30 * 60 * 1000 = 1,800,000 ms
        if (now - lastActivity > 1800000) {
          setIsTeacher(false);
          localStorage.removeItem('is_teacher_authenticated');
          localStorage.removeItem('teacher_last_activity_at');
        }
      } else {
        setIsTeacher(false);
        localStorage.removeItem('is_teacher_authenticated');
      }
    }, 5000);

    const handleUserActivity = () => {
      localStorage.setItem('teacher_last_activity_at', String(Date.now()));
    };

    // Listeners for activity extension (sliding window)
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('keypress', handleUserActivity);
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('keypress', handleUserActivity);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
    };
  }, [isTeacher]);

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

  const normalizePinValue = (val: any): string => {
    if (val === null || val === undefined) return '';
    let cleaned = String(val).trim();
    if (cleaned.endsWith('.0')) {
      cleaned = cleaned.substring(0, cleaned.length - 2);
    }
    return cleaned;
  };

  // Handle student credentials login match
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!studentIdInput || studentIdInput.length !== 5) {
      setAuthError('학번 5자리를 정확히 입력해 주세요. (예: 10101)');
      return;
    }
    if (!pinInput || pinInput.trim() === '') {
      setAuthError('비밀번호를 입력해 주세요.');
      return;
    }

    setIsAuthenticating(true);

    try {
      // Force clear data cache to obtain the most up-to-date credential/consent status from the Google Sheet
      try {
        clearDataCache();
      } catch (_) {}

      let currentAuth = null;
      let freshData = {
        auth: authDb,
        english: englishDb,
        korean: koreanDb,
        levels: levelRulesDb,
        privacy: privacyDb
      };

      try {
        console.log('[Login Optimization] Fetching the latest spreadsheet data during student login...');
        const pulledData = await fetchSpreadsheetData(spreadsheetId, googleToken, appsScriptUrl, true);
        freshData = pulledData;
        
        // Update local state with fresh data
        setAuthDb(pulledData.auth);
        setEnglishDb(pulledData.english);
        setKoreanDb(pulledData.korean);
        setLevelRulesDb(pulledData.levels);
        setPrivacyDb(pulledData.privacy || []);

        currentAuth = pulledData.auth.find((a) => {
          if (normalizeValue(a.studentId) !== normalizeValue(studentIdInput)) return false;
          const localOverride = localStorage.getItem(`student_pin_override_${cleanStudentId(a.studentId)}`);
          const expectedPin = localOverride || a.pin;
          return normalizePinValue(expectedPin) === normalizePinValue(pinInput);
        });
      } catch (fetchErr) {
        console.warn('[Login Fallback] Failed fetching fresh spreadsheet data, using cached local states:', fetchErr);
        currentAuth = authDb.find((a) => {
          if (normalizeValue(a.studentId) !== normalizeValue(studentIdInput)) return false;
          const localOverride = localStorage.getItem(`student_pin_override_${cleanStudentId(a.studentId)}`);
          const expectedPin = localOverride || a.pin;
          return normalizePinValue(expectedPin) === normalizePinValue(pinInput);
        });
      }

      if (!currentAuth) {
        setAuthError('입력하신 학번 또는 생년월일이 일치하지 않습니다. 다시 확인해 주세요.');
        setIsAuthenticating(false);
        return;
      }

      // Compute statistics for authenticated student ID using the fresh/cached database
      const englishStats = calculateStudentStats(currentAuth.studentId, freshData.english, freshData.levels, 'english');
      const koreanStats = calculateStudentStats(currentAuth.studentId, freshData.korean, freshData.levels, 'korean');

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

      // Check if student has already consented to privacy terms
      const normId = normalizeValue(currentAuth.studentId);
      
      // Google Sheets replication delay bypass cache
      const localConsented = localStorage.getItem('privacy_consent_' + normId) === 'true';
      
      // Search from the end of the array to prioritize the latest record in case there are multiple rows for this student
      const sheetRecord = [...(freshData.privacy || [])].reverse().find(p => normalizeValue(p.studentId) === normId);
      
      // Determine consent status: Prioritize Sheet record if we have a real spreadsheet connection!
      let hasConsented = false;
      const isRealSpreadsheet = spreadsheetId && spreadsheetId !== '1Q8v8_1_S_T-E_ST_S_h_e_e_t_I_D_D_e_m_o';

      if (isRealSpreadsheet) {
        if (sheetRecord) {
          if (sheetRecord.agreed) {
            hasConsented = true;
            console.log(`[통계 및 동의 디버그] 학번: ${normId}, 구글 시트에 기록 발견됨 - 동의 여부(agreed): true`);
            localStorage.setItem('privacy_consent_' + normId, 'true');
          } else {
            // 스프레드시트에서 동의여부 상태가 Y가 아닌 경우 (예: 선생님이 시트에서 직접 N으로 강제 수정했거나 체크 해제한 경우)
            // 브라우저의 로컬 캐시를 우회하지 않고, 무조건 시트의 기준(N)을 최우선 적용하여 동의 팝업이 다시 뜨도록 함!
            hasConsented = false;
            console.log(`[통계 및 동의 디버그] 학번: ${normId}, 구글 시트에 미동의('N' 또는 false)로 기록됨 -> 동의 팝업 강제 노출 및 로컬 캐시 삭제`);
            localStorage.removeItem('privacy_consent_' + normId);
          }
        } else {
          // IMPORTANT: If they are NOT recorded in the sheet, it is their FIRST login (최초 로그인)!
          if (localConsented) {
            hasConsented = true;
            console.log(`[통계 및 동의 디버그] 학번: ${normId}, 구글 시트 기록은 없으나 로컬 동의 승인 상태 유지 -> 임시 승인`);
          } else {
            hasConsented = false;
            console.log(`[통계 및 동의 디버그] 학번: ${normId}, 시트 기록 없음 (최초 로그인) -> 무조건 동의 팝업을 표시합니다.`);
            localStorage.removeItem('privacy_consent_' + normId);
          }
        }
      } else {
        // Fallback to localStorage only in demo/placeholder mode where no real spreadsheet exists
        hasConsented = localConsented;
        console.log(`[통계 및 동의 디버그] 데모/플레이스홀더 모드 - 로컬 스토리지 기준 동의 여부: ${localConsented}`);
      }

      if (!hasConsented) {
        console.log(`[통계 및 동의 디버그] 학번: ${normId} - 동의 미완료 상태이므로 동의 수집 팝업(Pending)을 표시합니다.`);
        setPendingSession(session);
        setPrivacyCheckboxChecked(false); // Default to FALSE (unchecked) as requested ("동의 여부 체크는 해제된 채로 해줘야지")
        setConsentError(null);
        setIsAuthenticating(false);
        return;
      }

      console.log(`[통계 및 동의 디버그] 학번: ${normId} - 동의 확인 완료(Active). 로그인을 승인합니다.`);

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

    } catch (err: any) {
      console.error('Computation/fetching error during login:', err);
      setAuthError('통합 스프레드시트 연동 중 오류가 발생하였습니다: ' + (err.message || err));
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
    setPendingSession(null);
  };

  // Change or Reset student PIN/password
  const handleResetStudentPin = async (studentId: string, newPin: string): Promise<boolean> => {
    try {
      // 1. Save to Google spreadsheet first (using GAS URL and/or OAuth direct token)
      const success = await saveStudentPinToSpreadsheet(spreadsheetId, studentId, newPin, googleToken, appsScriptUrl);
      if (!success) {
        throw new Error('스프레드시트 갱신 중 실패가 리턴되었습니다.');
      }
      
      // 2. Set Local storage override to secure offline robustness
      const normId = studentId.trim().replace(/[^0-9A-Za-z]/g, '');
      localStorage.setItem(`student_pin_override_${normId}`, newPin);

      // 3. Update authDb state in-memory so instantly matched
      setAuthDb((prev) =>
        prev.map((a) => {
          if (a.studentId.trim().replace(/[^0-9A-Za-z]/g, '') === normId) {
            return { ...a, pin: newPin };
          }
          return a;
        })
      );

      return true;
    } catch (err: any) {
      console.error('Password reset failed:', err);
      return false;
    }
  };

  // Student student password edit self
  const handleStudentSelfChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentSession) return;
    
    setStudentPasswordChangeError(null);
    setStudentPasswordChangeSuccess(null);

    const normCurrentInput = studentCurrentPinInput.trim();
    // Validate current PIN matching
    const studentAuth = authDb.find(a => cleanStudentId(a.studentId) === cleanStudentId(studentSession.id));
    const localOverride = localStorage.getItem(`student_pin_override_${cleanStudentId(studentSession.id)}`);
    const expectedCurrentPin = localOverride || (studentAuth ? studentAuth.pin : '');

    if (normalizePinValue(normCurrentInput) !== normalizePinValue(expectedCurrentPin)) {
      setStudentPasswordChangeError('현재 비밀번호가 정확하지 않습니다.');
      return;
    }

    if (studentNewPinInput.trim().length < 2) {
      setStudentPasswordChangeError('새 비밀번호를 입력해 주세요.');
      return;
    }

    if (studentNewPinInput !== studentNewPinConfirmInput) {
      setStudentPasswordChangeError('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const success = await handleResetStudentPin(studentSession.id, studentNewPinInput);
      if (success) {
        setStudentPasswordChangeSuccess('비밀번호가 성공적으로 변경되었습니다! 변경된 생년월일/비밀번호로 즉시 반영되었습니다.');
        setStudentCurrentPinInput('');
        setStudentNewPinInput('');
        setStudentNewPinConfirmInput('');
      } else {
        setStudentPasswordChangeError('스프레드시트에 데이터를 반영하는 도중 실패했습니다. 네트워크를 확인해 주세요.');
      }
    } catch (err: any) {
      setStudentPasswordChangeError('오류: ' + (err.message || err));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveConsent = async () => {
    if (!pendingSession) return;
    setIsSavingConsent(true);
    setConsentError(null);
    try {
      await saveConsentToSpreadsheet(
        spreadsheetId,
        pendingSession.id,
        pendingSession.name,
        googleToken,
        appsScriptUrl,
        'Y'
      );

      const normId = normalizeValue(pendingSession.id);
      localStorage.setItem('privacy_consent_' + normId, 'true');

      setPrivacyDb(prev => [
        ...prev.filter(p => normalizeValue(p.studentId) !== normId),
        { studentId: pendingSession.id, name: pendingSession.name, agreed: true }
      ]);

      setStudentSession(pendingSession);

      const topImprovement = Math.max(pendingSession.englishStats.growth, pendingSession.koreanStats.growth);
      if (topImprovement > 0) {
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
      setPendingSession(null); // Only close modal on successful save!
    } catch (err: any) {
      console.error('Failed saving privacy consent:', err);
      const errStr = String(err.message || err);
      
      // If the error is credentials mismatch or apps script issues, perform an elegant local fallback.
      // Since the student has successfully logged in already, blocking them here due to an outdated/incorrect GAS deployed script is bad UX.
      if (errStr.includes('일치하지 않습니다') || errStr.includes('Apps Script') || errStr.includes('유효한 JSON') || errStr.includes('접근 권한') || errStr.includes('실패')) {
        const normId = normalizeValue(pendingSession.id);
        localStorage.setItem('privacy_consent_' + normId, 'true');

        setPrivacyDb(prev => [
          ...prev.filter(p => normalizeValue(p.studentId) !== normId),
          { studentId: pendingSession.id, name: pendingSession.name, agreed: true }
        ]);

        setStudentSession(pendingSession);
        
        // Trigger confetti celebration
        const topImprovement = Math.max(pendingSession.englishStats.growth, pendingSession.koreanStats.growth);
        if (topImprovement > 0) {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
        
        setPendingSession(null);
        alert(`로그인이 임시 완료되었습니다!\n\n⚠️ 디버그 안내: 스프레드시트에 개인정보 관련 동의 여부를 실시간 연동하여 저장하지 못했습니다.\n\n[원인]: 구글 스프레드시트에 연동되어 있는 구글 앱스 스크립트(Apps Script)가 본 시스템의 동의 저장 기능을 지원하지 않는 이전 버전이거나, 앱스 스크립트 웹앱 배포 권한([액세스 권한이 있는 사용자]를 [모든 사용자]로 설정)에 문제가 있을 수 있습니다.\n\n[조치 방법]: 관리자 패널의 2단계에서 'Apps Script 소스코드 복사' 버튼을 눌러 소스코드를 새로 복사한 뒤, 구글 스프레드시트의 [확장 프로그램 > Apps Script] 프로젝트에 붙여넣어 교체하고 꼭 [새 버전으로 웹앱 배포]를 진행해 주시기 바랍니다.`);
      } else {
        setConsentError(err.message || '동의 상태를 연동 저장하지 못했습니다. 관리자 설정 및 네트워크를 확인해 주세요.');
      }
    } finally {
      setIsSavingConsent(false);
    }
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
            <button
              onClick={() => setStudentTab('my_stats')}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all cursor-pointer ${
                studentTab === 'my_stats'
                  ? 'bg-emerald-100/60 text-emerald-700 font-black'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50/50'
              }`}
            >
              <Keyboard className="h-5 w-5 text-emerald-600" />
              성장 대시보드
            </button>
            <button
              onClick={() => setStudentTab('hall_of_fame')}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all cursor-pointer ${
                studentTab === 'hall_of_fame'
                  ? 'bg-rose-100/60 text-rose-750 font-black'
                  : 'text-stone-500 hover:text-stone-850 hover:bg-stone-50/50'
              }`}
            >
              <Medal className="h-5 w-5 text-rose-500" />
              명예의 전당
            </button>
            <button
              onClick={() => setStudentTab('privacy_consent')}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all cursor-pointer ${
                studentTab === 'privacy_consent'
                  ? 'bg-indigo-100/60 text-indigo-750 font-black'
                  : 'text-stone-500 hover:text-slate-800 hover:bg-stone-50/50'
              }`}
            >
              <Lock className="h-5 w-5 text-indigo-550" />
              개인정보 동의 안내
            </button>

            {/* 🔑 Yellow emphasized Password Change Button */}
            <button
              type="button"
              onClick={() => {
                setStudentPasswordChangeError(null);
                setStudentPasswordChangeSuccess(null);
                setStudentCurrentPinInput('');
                setStudentNewPinInput('');
                setStudentNewPinConfirmInput('');
                setShowStudentPasswordChangeModal(true);
              }}
              className="mt-2 w-full text-left px-4 py-3 rounded-xl font-black flex items-center gap-3 bg-yellow-405 hover:bg-yellow-500 text-slate-900 border border-yellow-500 shadow-xs cursor-pointer transition-all active:scale-[0.98]"
            >
              <span className="text-slate-850 text-base shrink-0 animate-pulse">🔑</span>
              <span>비밀번호 변경하기</span>
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
                    <span className="hidden sm:inline">2026 Speed-Up 인비 타자 챌린지</span>
                    <span className="sm:hidden block leading-tight text-sm">
                      2026 Speed-Up<br />인비 타자 챌린지
                    </span>
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
                    <span className="hidden sm:inline">2026 Speed-Up 인비 타자 챌린지</span>
                    <span className="sm:hidden block max-w-[190px] leading-tight text-xs">
                      2026 Speed-Up<br />인비 타자 챌린지
                    </span>
                    <span className="text-[9px] font-bold tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-lg uppercase select-none shrink-0">Live</span>
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
                    className="p-2 sm:p-2.5 px-2.5 sm:px-4 rounded-xl text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-all flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-extrabold cursor-pointer min-h-10 sm:h-10 shadow-sm shrink-0"
                  >
                    <Lock className="h-4 w-4 text-slate-500 shrink-0" />
                    <span className="hidden sm:inline">선생님 로그인</span>
                    <span className="sm:hidden block leading-tight text-center">선생님<br />로그인</span>
                  </button>
                )}
              </>
            )}

            {studentSession && (
              <>
                <div className="text-right shrink-0 hidden sm:block mr-2">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">Today is</p>
                  <p className="text-xs font-bold text-slate-700 mt-1">{getFormattedDate()}</p>
  
</p>
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
        <main className={`flex-1 bg-stone-50 p-4 sm:p-8 flex flex-col items-center min-w-0 ${
          (studentSession || isTeacher) && !isInitialLoading ? 'justify-start' : 'justify-center'
        }`}>

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
                mvpLocks={mvpLocks}
                onToggleMvpLock={handleToggleMvpLock}
                frozenMvpWinners={frozenMvpWinners}
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
                    <h2 className="text-2xl font-black tracking-tight text-stone-900 leading-tight">
                      <span className="hidden sm:inline">2026 Speed-Up 인비 타자 챌린지</span>
                      <span className="sm:hidden block">
                        2026 Speed-Up<br />인비 타자 챌린지
                      </span>
                    </h2>
                    <p className="text-xl sm:text-[27px] text-emerald-700 font-extrabold mt-2 tracking-tight leading-snug">
                      디지털 읽걷쓰 성장 프로젝트 🌱
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
                      {isAuthenticating ? '로딩 중....(시간이 조금 필요해요)' : '내 기록 확인하기'}
                    </button>
                  </form>

                  {sheetLoadError && (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col gap-1.5 text-xs">
                      <div className="flex items-start gap-1.5">
                        <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-amber-600" />
                        <div>
                          <p className="font-extrabold text-amber-950">스프레드시트 동기화 경고</p>
                          <p className="text-[11px] text-amber-700 font-bold leading-relaxed mt-0.5 whitespace-pre-wrap">
                            {sheetLoadError}
                          </p>
                          <p className="text-[10px] text-amber-500 font-medium leading-relaxed mt-1">
                            우측 상단 ⚙️ 설정을 통해 스프레드시트 ID와 시트명을 다시 점검해 주십시오.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {authError && (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-105 text-rose-700 flex flex-col gap-2 text-xs">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-rose-600" />
                        <div>
                          <p className="font-extrabold text-rose-800">로그인에 실패하였습니다</p>
                          <p className="text-[11.1px] text-rose-600 font-bold leading-relaxed mt-1">
                            학번(5자리) 또는 비밀번호가 일치하지 않습니다. 로그인이 안될 경우 교육정보부로 문의하세요.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 🔐 Privacy Policy viewer for student before logging in */}
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setShowPrivacyOnlyModal(true)}
                      className="text-[11px] text-emerald-750 hover:text-emerald-800 hover:underline font-black transition-all cursor-pointer font-sans"
                    >
                      [개인정보 수집·이용 동의 안내 보기]
                    </button>
                  </div>

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
                      className="px-4.5 py-2.5 text-[11px] font-bold text-yellow-900 bg-yellow-50 hover:bg-yellow-100 border border-yellow-250/65 rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs w-full"
                    >
                      <Lock className="h-4 w-4 text-yellow-700" />
                      선생님 로그인 (통계 확인)
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
                    <span className="text-emerald-700">{studentSession.id} {studentSession.name}</span> 학생의 성장 기록
                  </h2>
                  <p className="text-xs text-stone-400 font-medium tracking-tight font-sans">로그인 학번 : {studentSession.id} ({studentSession.name}) / 데이터 동기화 완료</p>
                  
                  {/* 🔑 Yellow emphasized Password Change Button right in header banner for top-level visibility */}
                  <div className="pt-2 flex flex-wrap gap-2 animate-fade-in">
                    <button
                      type="button"
                      onClick={() => {
                        setStudentPasswordChangeError(null);
                        setStudentPasswordChangeSuccess(null);
                        setStudentCurrentPinInput('');
                        setStudentNewPinInput('');
                        setStudentNewPinConfirmInput('');
                        setShowStudentPasswordChangeModal(true);
                      }}
                      className="px-4 py-2 bg-yellow-405 hover:bg-yellow-500 text-slate-900 border border-yellow-500 text-[11px] font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-98"
                    >
                      <span className="text-slate-800 text-xs animate-pulse">🔑</span>
                      <span>비밀번호 변경하기</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStudentLogout}
                      className="md:hidden px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                    >
                      <LogOut className="h-3 w-3" />
                      <span>로그아웃</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 📊 STUDENT VIEW NAVIGATION TABS */}
              <div className="flex bg-stone-100 p-1.5 rounded-2xl border border-stone-200 shadow-2xs max-w-sm sm:max-w-md md:max-w-lg w-full">
                <button
                  type="button"
                  onClick={() => setStudentTab('my_stats')}
                  className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    studentTab === 'my_stats'
                      ? 'bg-emerald-600 text-white shadow-sm font-black'
                      : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50/50'
                  }`}
                >
                  📊 나의 타자 기록
                </button>
                <button
                  type="button"
                  onClick={() => setStudentTab('hall_of_fame')}
                  className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    studentTab === 'hall_of_fame'
                      ? 'bg-rose-600 text-white shadow-sm font-black'
                      : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50/50'
                  }`}
                >
                  🏆 명예의 전당
                </button>
                <button
                  type="button"
                  onClick={() => setStudentTab('privacy_consent')}
                  className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    studentTab === 'privacy_consent'
                      ? 'bg-indigo-650 text-white shadow-sm font-black'
                      : 'text-stone-500 hover:text-indigo-800 hover:bg-stone-50/50'
                  }`}
                >
                  🔒 개인정보 동의
                </button>
              </div>

              {studentTab === 'hall_of_fame' && (() => {
                const activeHallMonth = selectedHallMonth || (sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1] : '');
                const winners = monthlySnackWinnersHistory[activeHallMonth]?.winners || [];
                const monthlyKorSpeed = winners.filter(w => w.reason.includes('한글 최고 속도'));
                const monthlyEngSpeed = winners.filter(w => w.reason.includes('영어 최고 속도'));
                const monthlyKorGrowth = winners.filter(w => w.reason.includes('한글 최고 향상도'));
                const monthlyEngGrowth = winners.filter(w => w.reason.includes('영어 최고 향상도'));

                return (
                  <div className="space-y-8 animate-fade-in font-sans">
                    {/* 1. Monthly Awards Block */}
                    <div className="bg-white rounded-3xl border border-rose-100 p-6 space-y-6 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-100">
                        <div className="flex items-center gap-3">
                          <span className="p-2 bg-rose-50 text-rose-600 rounded-xl text-lg">🏆</span>
                          <div>
                            <h3 className="text-sm font-black text-slate-800 tracking-wide font-sans">
                              월간 MVP (5월~10월)
                            </h3>
                            <p className="text-[10px] text-stone-400 font-bold font-sans">
                              [안내] 월간 MVP 선정은 최초 1회만, 다음달 기회는 다른 학생들에게 돌아갑니다.
                            </p>
                          </div>
                        </div>

                        {/* Month selector switcher tabs */}
                        <div className="flex flex-wrap gap-1 bg-stone-50 border border-stone-150 p-1 rounded-xl">
                          {sortedMonths.map((m) => {
                            const isSelected = activeHallMonth === m;
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setSelectedHallMonth(m)}
                                className={`px-3 py-1.5 text-[10.5px] font-black rounded-lg transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-rose-600 text-white shadow-3xs'
                                    : 'text-stone-500 hover:bg-stone-155 hover:text-stone-900 bg-white border border-stone-200/50'
                                }`}
                              >
                                {m}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {activeHallMonth ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          
                          {/* section: Speeds */}
                          <div className="space-y-6">
                            
                            {/* Kor Speed */}
                            <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-2xs">
                              <h4 className="text-xs font-black text-rose-700 tracking-wider uppercase border-b pb-2 flex items-center gap-1.5">
                                <Star className="h-4 w-4" />
                                한글 타자 최고 타수 (3명)
                              </h4>
                              
                              <div className="space-y-2.5">
                                {monthlyKorSpeed.length === 0 ? (
                                  <p className="text-center text-xs text-stone-400 py-8 font-medium">시상 결과가 없습니다.</p>
                                ) : (
                                  monthlyKorSpeed.map((w, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-rose-50/40 border border-rose-100 flex-row text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-lg bg-rose-200 text-rose-800 text-[10px] font-black">
                                          {w.grade}학년 대표
                                        </span>
                                        <div>
                                          {isTeacher ? (
                                            <>
                                              <p className="font-extrabold text-stone-900">{maskName(w.name)}</p>
                                              <p className="text-[10px] text-stone-400">{w.grade}학년 {w.department}</p>
                                            </>
                                          ) : (
                                            <p className="font-extrabold text-stone-900">{w.grade}학년 {w.department}</p>
                                          )}
                                        </div>
                                      </div>
                                      <span className="font-mono text-sm text-rose-700 font-extrabold">{w.value}타 최고</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            {/* Eng Speed */}
                            <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-2xs">
                              <h4 className="text-xs font-black text-indigo-700 tracking-wider uppercase border-b pb-2 flex items-center gap-1.5">
                                <Star className="h-4 w-4" />
                                영어 타자 최고 타수 (3명)
                              </h4>
                              
                              <div className="space-y-2.5">
                                {monthlyEngSpeed.length === 0 ? (
                                  <p className="text-center text-xs text-stone-400 py-8 font-medium">시상 결과가 없습니다.</p>
                                ) : (
                                  monthlyEngSpeed.map((w, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/40 border border-indigo-100 flex-row text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-lg bg-indigo-200 text-indigo-850 text-[10px] font-black">
                                          {w.grade}학년 대표
                                        </span>
                                        <div>
                                          {isTeacher ? (
                                            <>
                                              <p className="font-extrabold text-stone-900">{maskName(w.name)}</p>
                                              <p className="text-[10px] text-stone-400">{w.grade}학년 {w.department}</p>
                                            </>
                                          ) : (
                                            <p className="font-extrabold text-stone-900">{w.grade}학년 {w.department}</p>
                                          )}
                                        </div>
                                      </div>
                                      <span className="font-mono text-sm text-indigo-700 font-extrabold">{w.value}타 최고</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                            
                          </div>

                          {/* section: Cumulative Improvements */}
                          <div className="space-y-6">
                            
                            {/* Kor growth */}
                            <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-2xs">
                              <h4 className="text-xs font-black text-emerald-800 tracking-wider uppercase border-b pb-2 flex items-center gap-1.5">
                                <TrendingUp className="h-4 w-4" />
                                한글 타자 최고 향상 (3명)
                              </h4>
                              
                              <div className="space-y-2.5">
                                {monthlyKorGrowth.length === 0 ? (
                                  <p className="text-center text-xs text-stone-400 py-8 font-medium">시상 결과가 없습니다.</p>
                                ) : (
                                  monthlyKorGrowth.map((w, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/40 border border-emerald-100 flex-row text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-lg bg-emerald-200 text-emerald-800 text-[10px] font-black">
                                          {w.grade}학년 대표
                                        </span>
                                        <div>
                                          {isTeacher ? (
                                            <>
                                              <p className="font-extrabold text-stone-900">{maskName(w.name)}</p>
                                              <p className="text-[10px] text-stone-450">{w.grade}학년 {w.department}</p>
                                            </>
                                          ) : (
                                            <p className="font-extrabold text-stone-900">{w.grade}학년 {w.department}</p>
                                          )}
                                        </div>
                                      </div>
                                      <span className="text-right">
                                        <strong className="font-mono text-sm text-emerald-600 block">+{w.value}타 ▲</strong>
                                        <span className="text-[9px] text-stone-400 font-mono">시작대비 우상향</span>
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            {/* Eng growth */}
                            <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-2xs">
                              <h4 className="text-xs font-black text-emerald-800 tracking-wider uppercase border-b pb-2 flex items-center gap-1.5">
                                <TrendingUp className="h-4 w-4" />
                                영어 타자 최고 향상 (3명)
                              </h4>
                              
                              <div className="space-y-2.5">
                                {monthlyEngGrowth.length === 0 ? (
                                  <p className="text-center text-xs text-stone-400 py-8 font-medium">시상 결과가 없습니다.</p>
                                ) : (
                                  monthlyEngGrowth.map((w, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/40 border border-emerald-100 flex-row text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-lg bg-emerald-200 text-emerald-800 text-[10px] font-black">
                                          {w.grade}학년 대표
                                        </span>
                                        <div>
                                          {isTeacher ? (
                                            <>
                                              <p className="font-extrabold text-stone-900">{maskName(w.name)}</p>
                                              <p className="text-[10px] text-stone-450">{w.grade}학년 {w.department}</p>
                                            </>
                                          ) : (
                                            <p className="font-extrabold text-stone-900">{w.grade}학년 {w.department}</p>
                                          )}
                                        </div>
                                      </div>
                                      <span className="text-right">
                                        <strong className="font-mono text-sm text-emerald-600 block">+{w.value}타 ▲</strong>
                                        <span className="text-[9px] text-stone-400 font-mono">시작대비 우상향</span>
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                          </div>

                        </div>
                      ) : (
                        <p className="text-stone-400 text-xs text-center py-10 font-bold">지정 가능한 시상 연월이 존재하지 않습니다.</p>
                      )}
                    </div>

                  {/* 👑 2. Cumulative Final Awards Block */}
                  <div className="bg-white rounded-3xl border border-amber-100 p-6 space-y-6 shadow-sm">
                    <div className="flex items-center gap-3 pb-3 border-b border-amber-100">
                      <span className="p-2 bg-amber-50 text-amber-600 rounded-xl text-lg">👑</span>
                      <div>
                        <h3 className="text-sm font-black text-slate-800 tracking-wide font-sans">
                          명예의 전당 (5월~10월 누적 최종 선정) 
                        </h3>
                        <p className="text-[10px] text-stone-400 font-bold font-sans">
                          전 기간 중 각 학년별/부문별 최고 실적 및 최대 성장을 이루어낸 자랑스런 영광의 수상자입니다.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      
                      {/* section: Speeds */}
                      <div className="space-y-6">
                        
                        {/* Kor Speed */}
                        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-2xs">
                          <h4 className="text-xs font-black text-rose-700 tracking-wider uppercase border-b pb-2 flex items-center gap-1.5">
                            <Star className="h-4 w-4 text-rose-500" />
                            한글 타자 최고 타수 (최종 3명)
                          </h4>

                          <div className="space-y-2.5">
                            {cumulativeFinalAwards.korSpeed.length === 0 ? (
                              <p className="text-center text-xs text-stone-400 py-8 font-medium">시상 결과가 없습니다.</p>
                            ) : (
                              cumulativeFinalAwards.korSpeed.map((s, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-rose-50/40 border border-rose-100 flex-row text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-lg bg-rose-200 text-rose-800 text-[10px] font-black">
                                      {s.grade}학년 1위
                                    </span>
                                    <div>
                                      {isTeacher ? (
                                        <>
                                          <p className="font-extrabold text-stone-900">{maskName(s.name)}</p>
                                          <p className="text-[10px] text-stone-400">{s.grade}학년 {s.department}</p>
                                        </>
                                      ) : (
                                        <p className="font-extrabold text-stone-900">{s.grade}학년 {s.department}</p>
                                      )}
                                    </div>
                                  </div>
                                  <span className="font-mono text-sm text-rose-700 font-extrabold">{s.value}타 최고</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Eng Speed */}
                        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-2xs">
                          <h4 className="text-xs font-black text-indigo-700 tracking-wider uppercase border-b pb-2 flex items-center gap-1.5">
                            <Star className="h-4 w-4" />
                            영어 타자 최고 타수 (최종 3명)
                          </h4>

                          <div className="space-y-2.5">
                            {cumulativeFinalAwards.engSpeed.length === 0 ? (
                              <p className="text-center text-xs text-stone-400 py-8 font-medium">시상 결과가 없습니다.</p>
                            ) : (
                              cumulativeFinalAwards.engSpeed.map((s, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/40 border border-indigo-100 flex-row text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-lg bg-indigo-200 text-indigo-850 text-[10px] font-black">
                                      {s.grade}학년 1위
                                    </span>
                                    <div>
                                      {isTeacher ? (
                                        <>
                                          <p className="font-extrabold text-stone-900">{maskName(s.name)}</p>
                                          <p className="text-[10px] text-stone-404">{s.grade}학년 {s.department}</p>
                                        </>
                                      ) : (
                                        <p className="font-extrabold text-stone-900">{s.grade}학년 {s.department}</p>
                                      )}
                                    </div>
                                  </div>
                                  <span className="font-mono text-sm text-indigo-700 font-extrabold">{s.value}타 최고</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                      </div>

                      {/* section: Cumulative Improvements */}
                      <div className="space-y-6">
                        
                        {/* Kor growth */}
                        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-2xs">
                          <h4 className="text-xs font-black text-emerald-800 tracking-wider uppercase border-b pb-2 flex items-center gap-1.5">
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                            한글 타자 최고 향상 (최종 3명)
                          </h4>

                          <div className="space-y-2.5">
                            {cumulativeFinalAwards.korGrowth.length === 0 ? (
                              <p className="text-center text-xs text-stone-400 py-8 leading-normal font-medium font-sans">기록 측정을 위한 2회차 이상의<br/>기록 입력 축적이 필요합니다.</p>
                            ) : (
                              cumulativeFinalAwards.korGrowth.map((s, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/40 border border-emerald-100 flex-row text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-lg bg-emerald-200 text-emerald-800 text-[10px] font-black">
                                      {s.grade}학년 1위
                                    </span>
                                    <div>
                                      {isTeacher ? (
                                        <>
                                          <p className="font-extrabold text-stone-900">{maskName(s.name)}</p>
                                          <p className="text-[10px] text-stone-450">{s.grade}학년 {s.department}</p>
                                        </>
                                      ) : (
                                        <p className="font-extrabold text-stone-900">{s.grade}학년 {s.department}</p>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-right">
                                    <strong className="font-mono text-sm text-emerald-600 block">+{s.value}타 ▲</strong>
                                    <span className="text-[9px] text-stone-400 font-mono">시작대비 우상향</span>
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Eng growth */}
                        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-2xs">
                          <h4 className="text-xs font-black text-emerald-800 tracking-wider uppercase border-b pb-2 flex items-center gap-1.5">
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                            영어 타자 최고 향상 (최종 3명)
                          </h4>

                          <div className="space-y-2.5">
                            {cumulativeFinalAwards.engGrowth.length === 0 ? (
                              <p className="text-center text-xs text-stone-400 py-8 leading-normal font-medium font-sans">기록 측정을 위한 2회차 이상의<br/>기록 입력 축적이 필요합니다.</p>
                            ) : (
                              cumulativeFinalAwards.engGrowth.map((s, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/40 border border-emerald-100 flex-row text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-lg bg-emerald-200 text-emerald-800 text-[10px] font-black">
                                      {s.grade}학년 1위
                                    </span>
                                    <div>
                                      {isTeacher ? (
                                        <>
                                          <p className="font-extrabold text-stone-900">{maskName(s.name)}</p>
                                          <p className="text-[10px] text-stone-450">{s.grade}학년 {s.department}</p>
                                        </>
                                      ) : (
                                        <p className="font-extrabold text-stone-900">{s.grade}학년 {s.department}</p>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-right">
                                    <strong className="font-mono text-sm text-emerald-600 block">+{s.value}타 ▲</strong>
                                    <span className="text-[9px] text-stone-400 font-mono">시작대비 우상향</span>
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                      </div>

                    </div>
                  </div>
                </div>
              );
            })()}

              {studentTab === 'my_stats' && (
                <div className="space-y-8 animate-fade-in font-sans">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in font-sans">
                    {/* Korean */}
                    <div className="space-y-6">
                      <StudentStatsCard 
                        stats={studentSession.koreanStats} 
                        title="한글 타자 성장 기록" 
                        type="korean" 
                        gradeAverage={statsAverages.korean.gradeAverage[studentSession.grade || '1']}
                        schoolAverage={statsAverages.korean.schoolAverage}
                      />

                      <TypingChart 
                        history={studentSession.koreanStats.history} 
                        type="korean" 
                        gradeAverage={statsAverages.korean.gradeAverage[studentSession.grade || '1']}
                        schoolAverage={statsAverages.korean.schoolAverage}
                      />
                    </div>

                    {/* English */}
                    <div className="space-y-6">
                      <StudentStatsCard 
                        stats={studentSession.englishStats} 
                        title="영어 타자 성장 기록" 
                        type="english" 
                        gradeAverage={statsAverages.english.gradeAverage[studentSession.grade || '1']}
                        schoolAverage={statsAverages.english.schoolAverage}
                      />
                      
                      <TypingChart 
                        history={studentSession.englishStats.history} 
                        type="english" 
                        gradeAverage={statsAverages.english.gradeAverage[studentSession.grade || '1']}
                        schoolAverage={statsAverages.english.schoolAverage}
                      />
                    </div>
                  </div>

                  {/* 🏆 공식 타자 인증 등급(급수) 기준표 (페이지 하단 배치 및 2급 라이트 그레이 연한 파스텔톤 적용) */}
                  <div className="bg-white rounded-3xl border border-stone-200 shadow-3xs p-5 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-stone-150">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">🏆</span>
                          <h3 className="text-sm font-black text-slate-900 tracking-tight">인비고 타자 인증 급수 기준표</h3>
                        </div>
                        <p className="text-[10.5px] text-stone-400 font-bold">꾸준한 연습으로 타자 급수 취득에 도전하세요!</p>
                      </div>
                      <span className="self-start sm:self-center px-2 py-0.5 bg-emerald-50 text-emerald-750 text-[9.5px] font-black rounded-lg border border-emerald-100 shadow-3xs select-none">
                        한글/영어 급수 기준
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 한글과 영어 등급표를 모던하고 깔끔한 카드로 배치 */}
                      <div className="bg-emerald-50/15 border border-emerald-100/60 p-4 rounded-2xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-emerald-850 flex items-center gap-1.5">
                            <span>🇰🇷</span> 한글 타자 기준
                          </span>
                          <span className="text-[9px] text-emerald-600 bg-white font-extrabold px-1.5 py-0.5 rounded-md border border-emerald-100/50">KOREAN</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white px-2 py-2 rounded-xl border border-emerald-100 text-center shadow-3xs">
                            <span className="text-[9.5px] font-black text-amber-600 block mb-0.5">🥇 1급</span>
                            <span className="text-[11px] font-mono font-black text-stone-800">350타 이상</span>
                          </div>
                          <div className="bg-white px-2 py-2 rounded-xl border border-slate-200 text-center shadow-3xs">
                            <span className="text-[9.5px] font-black text-slate-500 block mb-0.5">🥈 2급</span>
                            <span className="text-[11px] font-mono font-black text-stone-800">250타 이상</span>
                          </div>
                          <div className="bg-white px-2 py-2 rounded-xl border border-orange-100 text-center shadow-3xs">
                            <span className="text-[9.5px] font-black text-orange-655 block mb-0.5">🥉 3급</span>
                            <span className="text-[11px] font-mono font-black text-stone-800">150타 이상</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-indigo-50/15 border border-indigo-100/50 p-4 rounded-2xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-indigo-850 flex items-center gap-1.5">
                            <span>🇺🇸</span> 영어 타자 기준
                          </span>
                          <span className="text-[9px] text-indigo-600 bg-white font-extrabold px-1.5 py-0.5 rounded-md border border-indigo-100/55">ENGLISH</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white px-2 py-2 rounded-xl border border-indigo-100 text-center shadow-3xs">
                            <span className="text-[9.5px] font-black text-amber-600 block mb-0.5">🥇 1급</span>
                            <span className="text-[11px] font-mono font-black text-stone-800">200타 이상</span>
                          </div>
                          <div className="bg-white px-2 py-2 rounded-xl border border-slate-200 text-center shadow-3xs">
                            <span className="text-[9.5px] font-black text-slate-500 block mb-0.5">🥈 2급</span>
                            <span className="text-[11px] font-mono font-black text-stone-800">150타 이상</span>
                          </div>
                          <div className="bg-white px-2 py-2 rounded-xl border border-orange-100 text-center shadow-3xs">
                            <span className="text-[9.5px] font-black text-orange-655 block mb-0.5">🥉 3급</span>
                            <span className="text-[11px] font-mono font-black text-stone-800">100타 이상</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {studentTab === 'privacy_consent' && (
                <div className="bg-white rounded-3xl border border-indigo-100 p-6 sm:p-8 space-y-6 shadow-sm animate-fade-in font-sans max-w-2xl mx-auto">
                  <div className="flex items-center gap-3 pb-3 border-b border-indigo-50">
                    <div className="p-2.5 bg-indigo-50 text-indigo-650 rounded-xl border border-indigo-100/60">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 tracking-tight">개인정보 수집 및 이용 동의 현황</h3>
                      <p className="text-[11px] text-stone-400 font-bold">학생의 동의 정보와 수집 세부 방침을 안내해 드립니다.</p>
                    </div>
                  </div>

                  {/* 동의 완료 확인 카드 (시트 및 로컬스토리지 복합 검증) */}
                  {(() => {
                    const normId = normalizeValue(studentSession.id);
                    const sheetRecord = privacyDb.find(p => normalizeValue(p.studentId) === normId);
                    const localConsented = localStorage.getItem('privacy_consent_' + normId) === 'true';
                    // Count as agreed if either local storage has it or the spreadsheet records it as agreed!
                    const isAgreed = localConsented || (sheetRecord ? sheetRecord.agreed : false);

                    if (isAgreed) {
                      return (
                        <div className="p-4.5 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span className="text-xs font-black text-emerald-800">개인정보 동의 상태 : 동의 완료(Active)</span>
                            </div>
                            <p className="text-[11px] text-emerald-705/80 font-semibold leading-relaxed">
                              귀하는 원활한 타자 성적 조회 및 성취도 추적 관리를 지지하며 동의하였습니다.
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 shrink-0 items-end">
                            <span className="text-[10px] font-black bg-emerald-600 text-white px-3 py-1.5 rounded-lg uppercase tracking-widest text-center">
                              ACTIVE
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm('개인정보 동의 기록을 로컬 및 구글 스프레드시트에서 초기화(N 상태로 동의 철회)하고 로그아웃하시겠습니까? (로그인 시 동의 팝업이 다시 나타나게 됩니다)')) {
                                  const nId = normalizeValue(studentSession.id);
                                  localStorage.removeItem('privacy_consent_' + nId);
                                  
                                  // Live sync modification to spreadsheet so it is explicitly marked 'N' in Google Sheets!
                                  try {
                                    await saveConsentToSpreadsheet(
                                      spreadsheetId,
                                      studentSession.id,
                                      studentSession.name,
                                      googleToken,
                                      appsScriptUrl,
                                      'N'
                                    );
                                  } catch (err) {
                                    console.error('Failed to update consent to N in spreadsheet:', err);
                                  }

                                  setPrivacyDb(prev => [
                                    ...prev.filter(p => normalizeValue(p.studentId) !== nId),
                                    { studentId: studentSession.id, name: studentSession.name, agreed: false }
                                  ]);
                                  handleStudentLogout();
                                }
                              }}
                              className="text-[9.5px] font-black text-stone-400 hover:text-rose-600 transition-colors underline cursor-pointer"
                            >
                              [동의 초기화 및 로그아웃]
                            </button>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="p-4.5 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                              <span className="text-xs font-black text-rose-800">개인정보 동의 상태 : 동의 미완료 (N)</span>
                            </div>
                            <p className="text-[11px] text-rose-750/80 font-semibold leading-relaxed font-sans">
                              현재 구글 스프레드시트 상의 개인정보 동의 상태가 'N'으로 비활성화되어 있습니다. 다음 로그인 시에 동의 수집 팝업이 다시 나타납니다.
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 shrink-0 items-end">
                            <span className="text-[10px] font-black bg-rose-600 text-white px-3 py-1.5 rounded-lg uppercase tracking-widest text-center">
                              PENDING (N)
                            </span>
                            <button
                              type="button"
                              onClick={handleStudentLogout}
                              className="text-[9.5px] font-black text-indigo-600 hover:text-rose-600 transition-colors underline cursor-pointer"
                            >
                              [바로 로그아웃 및 다시 동의]
                            </button>
                          </div>
                        </div>
                      );
                    }
                  })()}

                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4 text-indigo-550 shrink-0" />
                      개인정보 보호법 제15조에 따른 주요 동의 내용 요약
                    </h4>

                    <div className="bg-stone-50 border border-stone-150 rounded-2xl p-4.5 space-y-3.5 text-xs text-stone-605">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-1.5 sm:gap-4 pb-3 border-b border-stone-200/50 font-sans">
                        <span className="font-black text-stone-900">1. 수집 항목</span>
                        <span className="sm:col-span-3 text-stone-750 font-bold font-sans">
                          학번, 이름, 생년월일, 매월 타자검정 결과 (타수, 성장도, 급수)
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-1.5 sm:gap-4 pb-3 border-b border-stone-200/50 font-sans">
                        <span className="font-black text-stone-900">2. 수집 및 이용 목적</span>
                        <span className="sm:col-span-3 text-stone-750 font-bold font-sans">
                          인비 타자 챌린지 내 사용자 본인 확인/식별, 개인별 성장도 계산 및 조회, 학교별/학년별 통계 관리
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-1.5 sm:gap-4 font-sans">
                        <span className="font-black text-stone-900">3. 보유 및 이용 기간</span>
                        <span className="sm:col-span-3 text-emerald-800 font-extrabold font-sans">
                          해당 학년도 종료 시까지 (종료 후 안전하게 파기됩니다.)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-indigo-50/50 text-center space-y-2">
                    <p className="text-[11px] font-black text-stone-700">
                      동의 주체: {studentSession.id}
                    </p>
                    <p className="text-[10px] text-stone-400 leading-normal">
                      ※ 귀하는 동의를 거부할 권리가 있으나, 동의 거부 시 본 성장 관리 프로그램을 이용할 수 없습니다. <br />
                      동의 철회나 정보 정정을 원하실 경우, 담당 교사에게 문의해 주시기 바랍니다.
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-400 text-center font-medium leading-relaxed max-w-sm mx-auto">
                학생 개인정보 보호 체계가 가동 중입니다. 
              </p>

            </div>
          )}

        </main>

        {/* FOOTER */}
        <footer className="w-full bg-white border-t border-slate-205 py-6 text-center text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-center px-4 sm:px-8 gap-3">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-medium tracking-wide">
            <span>Copyright © 2026 INBIGO. All rights reserved. | Version 1.0.0</span>
            <span className="hidden sm:inline text-slate-250">|</span>
            <button 
              onClick={() => setShowPrivacyPolicyModal(true)} 
              className="text-stone-500 hover:text-stone-900 font-bold underline decoration-dotted decoration-1 underline-offset-3 transition-colors cursor-pointer"
            >
              개인정보처리방침
            </button>
          </div>
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
          mvpLocks={mvpLocks}
          onToggleMvpLock={handleToggleMvpLock}
          monthlySnackWinnersHistory={monthlySnackWinnersHistory}
          sortedMonths={sortedMonths}
          authDb={authDb}
          onResetStudentPin={handleResetStudentPin}
        />
      )}

      {showStudentPasswordChangeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="relative bg-white rounded-3xl w-full max-w-md border border-gray-100 shadow-xl overflow-hidden flex flex-col my-8 animate-scale-up border-yellow-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-yellow-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-yellow-405 text-slate-900 font-bold shadow-xs">
                  🔑
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-905 tracking-tight">개인 비밀번호 변경 (생년월일)</h2>
                  <p className="text-[11px] text-amber-800 font-bold leading-normal">로그인 시 사용할 자신만의 비밀번호를 지정합니다.</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowStudentPasswordChangeModal(false);
                  setStudentPasswordChangeError(null);
                  setStudentPasswordChangeSuccess(null);
                }}
                className="p-1 px-3 rounded-lg border border-gray-250 text-xs font-semibold text-gray-500 hover:bg-gray-100 cursor-pointer"
              >
                닫기
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleStudentSelfChangePassword} className="p-6 space-y-4">
              <div className="bg-yellow-50/30 border border-yellow-200/55 rounded-xl p-3.5 text-xs text-yellow-905 leading-relaxed font-bold">
                ⚠️ 변경 시 기존 생년월일 대신 지정된 새 비밀번호로 교사 승인 없이 즉시 교체(덮어쓰기)되며, 다음 로그인부터 변경된 비밀번호로 접속하셔야 합니다.
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">
                  로그인 학번
                </label>
                <div className="w-full px-4 py-2.5 bg-gray-50 border border-gray-150 rounded-xl text-xs font-bold text-gray-600">
                  [{studentSession?.id}]
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
                  현재 비밀번호 (생년월일 등)
                </label>
                <input 
                  type="password"
                  maxLength={50}
                  placeholder="현재 비밀번호를 입력하십시오"
                  value={studentCurrentPinInput}
                  onChange={(e) => setStudentCurrentPinInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-250 text-sm font-mono tracking-wide placeholder:font-sans placeholder:text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
                  새 비밀번호 (자유롭게 지정 가능)
                </label>
                <input 
                  type="password"
                  maxLength={50}
                  placeholder="원하는 비밀번호를 입력하세요."
                  value={studentNewPinInput}
                  onChange={(e) => setStudentNewPinInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-250 text-sm font-mono tracking-wide placeholder:font-sans placeholder:text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
                  새 비밀번호 확인
                </label>
                <input 
                  type="password"
                  maxLength={50}
                  placeholder="동일하게 한 번 더 입력해주십시오"
                  value={studentNewPinConfirmInput}
                  onChange={(e) => setStudentNewPinConfirmInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-250 text-sm font-mono tracking-wide placeholder:font-sans placeholder:text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
              </div>

              {studentPasswordChangeError && (
                <div className="p-3 bg-red-50 border border-red-150 text-red-850 rounded-xl text-xs font-bold leading-normal">
                  ⚠️ {studentPasswordChangeError}
                </div>
              )}

              {studentPasswordChangeSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-150 text-emerald-900 rounded-xl text-xs font-semibold leading-normal">
                  ✓ {studentPasswordChangeSuccess}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setShowStudentPasswordChangeModal(false);
                    setStudentPasswordChangeError(null);
                    setStudentPasswordChangeSuccess(null);
                  }}
                  className="px-4 py-3 border border-gray-200 text-gray-505 font-bold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-5 py-3 bg-yellow-405 border border-yellow-500 hover:bg-yellow-500 text-slate-900 font-extrabold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {isChangingPassword ? '비밀번호 저장 중...' : '비밀번호 즉시 변경'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
                <p className="text-xs text-stone-400 font-semibold">학생들의 타자 결과 통계를 확인할 수 있습니다.</p>
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
                  placeholder="학교 비밀번호 1번"
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
                className="w-full bg-yellow-50 hover:bg-yellow-100 text-yellow-904 font-extrabold py-2.5 px-4 rounded-2xl transition-all text-xs cursor-pointer shadow-2xs border border-yellow-200"
              >
                선생님 모드 들어가기 🔓
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🔐 Privacy Consent Modal Popup */}
      {pendingSession && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in animate-duration-150">
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-xl max-w-lg w-full p-6 sm:p-8 space-y-6 relative overflow-hidden animate-scale-up">
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-600" />
            
            <div className="flex items-center gap-3 pb-3 border-b border-stone-100">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <AlertCircle className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-slate-950 font-sans tracking-tight">
                개인정보 수집·이용 동의 안내
              </h3>
            </div>

            <div className="space-y-4 text-xs tracking-tight text-stone-605 leading-relaxed font-sans">
              <p className="font-bold">
                본 프로그램은 학생들의 타자 능력 향상도 관리를 위해 아래와 같이 최소한의 개인정보를 수집합니다.
              </p>
              
              <div className="bg-stone-50 border border-stone-150 rounded-2xl p-4.5 space-y-2 text-[11px] font-sans shadow-3xs">
                <div>
                  <span className="font-black text-stone-900 font-sans">1. 수집 항목: </span>
                  <span className="font-black text-emerald-800 font-sans">학번, 이름, 생년월일, 매월 타자검정 결과</span>
                </div>
                <div>
                  <span className="font-black text-stone-900 font-sans">2. 수집 목적: </span>
                  <span className="font-black text-emerald-800 font-sans">사용자 식별, 로그인 서비스 제공, 월별 타자 성적 관리</span>
                </div>
                <div>
                  <span className="font-black text-stone-900 font-sans">3. 보유 기간: </span>
                  <span className="font-black text-emerald-800 font-sans">해당 학년도 종료 시까지</span>
                </div>
              </div>

              <p className="text-[10.5px] font-black text-stone-500 font-sans leading-relaxed">
                ※ 귀하는 개인정보 수집·이용에 동의하지 않을 권리가 있으며, 동의 거부 시 본 프로그램 이용이 불가능합니다.
              </p>
            </div>

            {consentError && (
              <div className="bg-rose-50 border border-rose-150 rounded-2xl p-4.5 text-xs text-rose-800 font-medium space-y-1 shadow-3xs">
                <p className="font-bold text-rose-600 flex items-center gap-1">⚠️ 동의 정보를 저장하지 못했습니다:</p>
                <p className="text-[11px] leading-relaxed select-text">{consentError}</p>
              </div>
            )}

            <div className="pt-2 border-t border-stone-100 space-y-5">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={privacyCheckboxChecked}
                  onChange={(e) => setPrivacyCheckboxChecked(e.target.checked)}
                  className="mt-0.5 h-4.5 w-4.5 rounded-sm border-stone-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-black text-stone-900 font-sans">
                  위 내용을 확인하였으며, 개인정보 수집 및 이용에 동의합니다. (필수)
                </span>
              </label>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPendingSession(null);
                    setPrivacyCheckboxChecked(false);
                    setStudentIdInput('');
                    setPinInput('');
                  }}
                  className="flex-1 py-3 text-xs font-bold bg-stone-100 hover:bg-stone-200/80 text-stone-500 rounded-2xl transition-all cursor-pointer"
                >
                  동의 거부 (취소)
                </button>
                <button
                  type="button"
                  disabled={!privacyCheckboxChecked || isSavingConsent}
                  onClick={handleSaveConsent}
                  className={`flex-1 py-3 text-xs font-black rounded-2xl transition-all text-white shadow-xs cursor-pointer flex items-center justify-center gap-1.5 ${
                    privacyCheckboxChecked && !isSavingConsent
                      ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-98'
                      : 'bg-stone-300 text-stone-500 cursor-not-allowed'
                  }`}
                >
                  {isSavingConsent ? '저장 중...' : '동의 및 확인'}
                </button>
              </div>

              <p className="text-[9.5px] text-stone-400 font-medium text-center leading-normal font-sans">
                귀하는 동의를 거부할 권리가 있으나, 동의 거부 시 프로그램 이용이 제한될 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 🔐 Standalone Guidelines Disclosure modal */}
      {showPrivacyOnlyModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in animate-duration-150">
          <div className="bg-white rounded-3xl border border-indigo-100 shadow-xl max-w-lg w-full p-6 sm:p-8 space-y-6 relative overflow-hidden animate-scale-up font-sans">
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-400 to-indigo-600" />
            
            <div className="flex items-center gap-3 pb-3 border-b border-stone-100">
              <div className="p-2.5 bg-indigo-50 text-indigo-650 rounded-xl border border-indigo-100">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-slate-950 font-sans tracking-tight">
                개인정보 수집·이용 동의 안내
              </h3>
            </div>

            <div className="space-y-4 text-xs tracking-tight text-stone-605 leading-relaxed font-sans">
              <p className="font-bold">
                본 인비 타자 챌린지 프로그램은 학생들의 타자 수련 능력 향상도 관리를 위해 아래와 같이 최소한의 개인정보를 안전하게 수집합니다.
              </p>
              
              <div className="bg-stone-50 border border-stone-150 rounded-2xl p-4.5 space-y-2 text-[11px] font-sans shadow-3xs">
                <div>
                  <span className="font-black text-stone-900 font-sans">1. 수집 항목: </span>
                  <span className="font-black text-indigo-805 font-sans">학번, 이름, 생년월일, 매월 타자검정 결과 (속도/정확도/성장율/급수)</span>
                </div>
                <div>
                  <span className="font-black text-stone-900 font-sans">2. 수집 목적: </span>
                  <span className="font-black text-indigo-805 font-sans">인증을 통한 본인 식별, 성장 통계 분석, 개인 진도 대시보드 및 명예의 전당 통계 제공</span>
                </div>
                <div>
                  <span className="font-black text-stone-900 font-sans">3. 보유 및 이용 기간: </span>
                  <span className="font-black text-indigo-850 font-sans">수집 일로부터 해당 학년도 종료 시까지 (학기가 종료된 후 데이터는 복구 불가능하도록 자동 파기됩니다.)</span>
                </div>
              </div>

              <p className="text-[10.5px] font-black text-stone-500 font-sans leading-relaxed">
                ※ 귀하는 상기 개인정보 수집 및 이용의 동의를 거부할 권리가 있습니다. 단, 동의를 거부하는 경우 본 프로그램 내 대시보드 조회 및 성장도 기록 매칭에 일부 제한이 따를 수 있음을 안내해 드립니다.
              </p>
            </div>

            <div className="pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowPrivacyOnlyModal(false)}
                className="w-full py-3 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all cursor-pointer shadow-xs active:scale-98 text-center"
              >
                닫기 및 확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ Custom/Stored Privacy Policy Display Modal */}
      {showPrivacyPolicyModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in animate-duration-150">
          <div className="bg-white rounded-3xl border border-stone-150 shadow-xl max-w-xl w-full p-6 sm:p-8 space-y-6 relative overflow-hidden animate-scale-up font-sans flex flex-col max-h-[85vh]">
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
            
            <div className="flex items-center justify-between pb-3 border-b border-stone-105">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-650 rounded-xl border border-emerald-100">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-950 font-sans tracking-tight">
                    개인정보처리방침
                  </h3>
                  <p className="text-[10px] text-stone-400 font-bold">인비 타자 챌린지 개인정보 보호 및 규정 안내</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPrivacyPolicyModal(false)}
                className="p-1.5 px-3 rounded-lg border border-stone-200 text-xs font-bold text-stone-500 hover:bg-stone-50 cursor-pointer"
              >
                닫기
              </button>
            </div>

            <div className="space-y-4 text-xs tracking-tight text-stone-605 leading-relaxed font-sans overflow-y-auto flex-1 pr-2">
              <div className="whitespace-pre-wrap font-medium p-4.5 bg-stone-50 border border-stone-150 rounded-2xl leading-relaxed font-sans text-stone-750">
                {localStorage.getItem('privacy_policy_text') || `[인비 챌린지 개인정보처리방침 (기본값)]

본 프로그램(이하 '인비 챌린지')은 학생들의 타자 수련 능력 향상도 관리를 위해 양질의 교육용 정보서비스로 기획 및 구성 되었습니다. 정보 보호 책임하에 최소한의 안전 조치 및 정보보호 법령상의 규정을 철저히 준수하고 아래와 같이 개인정보처리방침을 공개합니다.

1. 수집 및 이용 목적
- 본인 대시보드 로그인 인증 및 식별
- 학년별/학급별 통계 및 전교생 수준 분포 분석
- 명예의 전당 및 MVP 수상 기록 매칭 및 관리

2. 수집하는 개인정보 항목
- 학번, 이름, 생년월일, 월별 타자 속도, 정확도, 평가 기준, 급수 취득 정보

3. 개인정보의 보유 및 이용 기간
- 학생 수집 데이터는 학년도 말(또는 운영 만기 시점)까지 보관 후, 복구 불가능한 영구 삭제 기법을 준수하여 자동 파기 처리됩니다.

4. 동의권 및 불이익 고지
- 학생 가입자 및 이용자는 개인정보 수집 및 처리 동의를 거부하실 권리가 있습니다. 단, 동의를 거부하는 경우 개인 타자 분석 시스템 내 실시간 순위 산정, 공로 인증서 발급 등의 대시보드의 사용 권한이 일부 제한될 수 있습니다.`}
              </div>
            </div>

            <div className="pt-2 border-t border-stone-105 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPrivacyPolicyModal(false)}
                className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all cursor-pointer shadow-2xs active:scale-98 text-center"
              >
                확인 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

