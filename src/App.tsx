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
  saveConsentToSpreadsheet
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

const isExcludedStudentName = (name: string): boolean => {
  if (!name) return false;
  const n = name.trim();
  return n.includes('(자퇴)') || n.includes('(위탁)') || n.includes('*');
};

const cleanStudentId = (id: string) => String(id || '').trim().replace(/[^0-9A-Za-z]/g, '');

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
  const [showPrivacyOnlyModal, setShowPrivacyOnlyModal] = useState(false);

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

  // 📋 Calculate student-level latest speed averages (excluding special status students) for school & grade comparison
  const statsAverages = React.useMemo(() => {
    // 1. Get unique student set from authDb
    const studentMap = new Map<string, { studentId: string; name: string; grade: string }>();
    authDb.forEach(s => {
      const info = parseStudentIdInfo(s.studentId);
      studentMap.set(cleanStudentId(s.studentId), {
        studentId: s.studentId,
        name: s.name,
        grade: info.grade
      });
    });

    const validStudents = Array.from(studentMap.values()).filter(s => !isExcludedStudentName(s.name));

    // 2. Map latest Korean and English speeds
    const studentsWithLatestSpeeds = validStudents.map(s => {
      const cleanId = cleanStudentId(s.studentId);
      
      const sEng = englishDb.filter(r => cleanStudentId(r.studentId) === cleanId)
        .sort((a,b) => getMonthNumber(a.month) - getMonthNumber(b.month));
      const engSpeed = sEng.length > 0 ? sEng[sEng.length - 1].speed : 0;

      const sKor = koreanDb.filter(r => cleanStudentId(r.studentId) === cleanId)
        .sort((a,b) => getMonthNumber(a.month) - getMonthNumber(b.month));
      const korSpeed = sKor.length > 0 ? sKor[sKor.length - 1].speed : 0;

      return {
        ...s,
        engSpeed,
        korSpeed
      };
    });

    // 3. Compute Korean Averages
    const korSchoolCount = studentsWithLatestSpeeds.length;
    const korSchoolAvg = korSchoolCount > 0 ? Math.round(studentsWithLatestSpeeds.reduce((sum, s) => sum + s.korSpeed, 0) / korSchoolCount) : 0;

    const korGradeAvg: { [grade: string]: number } = { '1': 0, '2': 0, '3': 0 };
    ['1', '2', '3'].forEach(g => {
      const list = studentsWithLatestSpeeds.filter(s => s.grade === g);
      korGradeAvg[g] = list.length > 0 ? Math.round(list.reduce((sum, s) => sum + s.korSpeed, 0) / list.length) : 0;
    });

    // 4. Compute English Averages
    const engSchoolCount = studentsWithLatestSpeeds.length;
    const engSchoolAvg = engSchoolCount > 0 ? Math.round(studentsWithLatestSpeeds.reduce((sum, s) => sum + s.engSpeed, 0) / engSchoolCount) : 0;

    const engGradeAvg: { [grade: string]: number } = { '1': 0, '2': 0, '3': 0 };
    ['1', '2', '3'].forEach(g => {
      const list = studentsWithLatestSpeeds.filter(s => s.grade === g);
      engGradeAvg[g] = list.length > 0 ? Math.round(list.reduce((sum, s) => sum + s.engSpeed, 0) / list.length) : 0;
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
      const korThisMonth = koreanDb.filter(r => r.month === month);
      const engThisMonth = englishDb.filter(r => r.month === month);
      const prevMonthName = monthIdx > 0 ? sortedMonths[monthIdx - 1] : null;

      // Kor Speed
      const rawKorSpeedCandidates = korThisMonth.map(r => ({
        studentId: r.studentId,
        name: r.name,
        grade: r.grade,
        department: r.department,
        value: r.speed
      })).sort((a,b) => b.value - a.value);

      // Eng Speed
      const rawEngSpeedCandidates = engThisMonth.map(r => ({
        studentId: r.studentId,
        name: r.name,
        grade: r.grade,
        department: r.department,
        value: r.speed
      })).sort((a,b) => b.value - a.value);

      // Kor Growth
      const rawKorGrowthCandidates: Winner[] = [];
      if (prevMonthName) {
        const korPrev = koreanDb.filter(r => r.month === prevMonthName);
        korThisMonth.forEach(curr => {
          const prev = korPrev.find(p => cleanStudentId(p.studentId) === cleanStudentId(curr.studentId));
          if (prev) {
            const diff = curr.speed - prev.speed;
            if (diff > 0) {
              rawKorGrowthCandidates.push({
                studentId: curr.studentId,
                name: curr.name,
                grade: curr.grade,
                department: curr.department,
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
              rawEngGrowthCandidates.push({
                studentId: curr.studentId,
                name: curr.name,
                grade: curr.grade,
                department: curr.department,
                value: diff
              });
            }
          }
        });
      }
      rawEngGrowthCandidates.sort((a,b) => b.value - a.value);

      const selectedWinners: { studentId: string; name: string; department: string; grade: string; reason: string; value: number }[] = [];
      const localSelectedSet = new Set<string>();

      const trySelectWinnerForGrade = (list: Winner[], gradeVal: string, reasonTag: string) => {
        for (let i = 0; i < list.length; i++) {
          const s = list[i];
          if (String(s.grade) !== String(gradeVal)) continue;
          if (isExcludedStudentName(s.name)) continue;

          if (!cumulativeSnackWinners.has(s.studentId) && !localSelectedSet.has(s.studentId)) {
            selectedWinners.push({
              studentId: s.studentId,
              name: s.name,
              department: s.department,
              grade: s.grade,
              reason: `${gradeVal}학년 ${reasonTag}`,
              value: s.value
            });
            localSelectedSet.add(s.studentId);
            cumulativeSnackWinners.add(s.studentId);
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

      historyMap[month] = {
        winners: selectedWinners
      };
    });

    return historyMap;
  }, [englishDb, koreanDb, sortedMonths]);

  // 🟢 3. Calculate Cumulative Periodic Final Awards (5월~10월)
  const cumulativeFinalAwards = React.useMemo(() => {
    const studentIds = Array.from(new Set([...englishDb.map(r => r.studentId), ...koreanDb.map(r => r.studentId)]));

    const korSpeeds: { studentId: string; name: string; department: string; grade: string; value: number }[] = [];
    const engSpeeds: typeof korSpeeds = [];
    const korGrowths: typeof korSpeeds = [];
    const engGrowths: typeof korSpeeds = [];

    studentIds.forEach(sid => {
      const sKor = koreanDb.filter(r => cleanStudentId(r.studentId) === cleanStudentId(sid)).sort((a,b) => getMonthNumber(a.month) - getMonthNumber(b.month));
      const sEng = englishDb.filter(r => cleanStudentId(r.studentId) === cleanStudentId(sid)).sort((a,b) => getMonthNumber(a.month) - getMonthNumber(b.month));

      if (sKor.length > 0) {
        const maxVal = Math.max(...sKor.map(r => r.speed));
         korSpeeds.push({
           studentId: sid,
           name: sKor[0].name,
           department: sKor[0].department,
           grade: sKor[0].grade,
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
               department: sKor[0].department,
               grade: sKor[0].grade,
               value: improvement
             });
           }
         }
      }

      if (sEng.length > 0) {
        const maxVal = Math.max(...sEng.map(r => r.speed));
         engSpeeds.push({
           studentId: sid,
           name: sEng[0].name,
           department: sEng[0].department,
           grade: sEng[0].grade,
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
               department: sEng[0].department,
               grade: sEng[0].grade,
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
          .filter(s => String(s.grade) === String(g) && !isExcludedStudentName(s.name))
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
      setPrivacyDb(data.privacy || []);
      
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
  const handleStudentLogin = async (e: React.FormEvent) => {
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
      // 1. Always pull fresh live database data directly during login to verify correct credentials and live privacy status!
      clearDataCache();
      const freshData = await fetchSpreadsheetData(spreadsheetId, googleToken, appsScriptUrl);
      
      // Update in-memory react-state with latest fetched values
      setAuthDb(freshData.auth);
      setEnglishDb(freshData.english);
      setKoreanDb(freshData.korean);
      setLevelRulesDb(freshData.levels);
      setPrivacyDb(freshData.privacy || []);

      // Find matching credentials in freshData.auth DB with robust normalization
      const currentAuth = freshData.auth.find(
        (a) => normalizeValue(a.studentId) === normalizeValue(studentIdInput) && normalizeValue(a.pin) === normalizeValue(pinInput)
      );

      if (!currentAuth) {
        setAuthError('입력하신 학번 또는 인증번호가 일치하지 않습니다. 다시 확인해 드립니다.');
        setIsAuthenticating(false);
        return;
      }

      // Compute statistics for authenticated student ID using the fresh database
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
      
      // Google Sheets replication delay bypass: Prioritize local storage verification for the current device/browser session
      const localConsented = localStorage.getItem('privacy_consent_' + normId) === 'true';
      
      // Search from the end of the array to prioritize the latest record in case there are multiple rows for this student
      const sheetRecord = [...(freshData.privacy || [])].reverse().find(p => normalizeValue(p.studentId) === normId);
      
      // Determine consent status with clear logging
      let hasConsented = false;
      if (localConsented) {
        hasConsented = true;
        console.log(`[통계 및 동의 디버그] 학번: ${normId}, 브라우저 로컬 스토리지에 동의 기록이 존재하여 직시 승인합니다.`);
      } else if (sheetRecord) {
        hasConsented = sheetRecord.agreed;
        console.log(`[통계 및 동의 디버그] 학번: ${normId}, 시트 기록 발견됨 - 동의 여부(agreed): ${sheetRecord.agreed}`);
      } else {
        hasConsented = false;
        console.log(`[통계 및 동의 디버그] 학번: ${normId}, 시트 및 로컬 동의 기록 없음.`);
      }

      if (!hasConsented) {
        console.log(`[통계 및 동의 디버그] 학번: ${normId} - 동의 미완료(N) 상태이므로 동의 수집 팝업(Pending)을 표시합니다.`);
        setPendingSession(session);
        setPrivacyCheckboxChecked(false);
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
      setAuthError('통합 타자 계산 및 스프레드시트 연동 중 오류가 발생하였습니다: ' + (err.message || err));
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
      setConsentError(err.message || '동의 상태를 연동 저장하지 못했습니다. 관리자 설정 및 네트워크를 확인해 주세요.');
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
                    <p className="text-2xl sm:text-[27px] text-emerald-700 font-extrabold mt-2 tracking-tight leading-snug">
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
                      className="px-4.5 py-2.5 text-[11px] font-black text-slate-600 hover:text-indigo-700 bg-stone-55 hover:bg-indigo-50 border border-slate-200 rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs w-full"
                    >
                      <Lock className="h-4 w-4 text-slate-500" />
                      선생님 로그인 (결과 통계 확인)
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
                  📊 수련 성장
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

              {studentTab === 'hall_of_fame' && (
                <div className="space-y-8 animate-fade-in font-sans">
                  {/* 🍿 1. Monthly Snack Awards Column */}
                  <div className="bg-white rounded-3xl border border-rose-100 p-6 space-y-6 shadow-sm">
                    <div className="flex items-center gap-3 pb-3 border-b border-rose-100">
                      <span className="p-2 bg-rose-50 text-rose-600 rounded-xl text-lg">🍿</span>
                      <div>
                        <h3 className="text-sm font-black text-slate-800 tracking-wide font-sans">
                          월별 명예의 전당 (5월~10월)
                        </h3>
                        <p className="text-[10px] text-stone-400 font-bold font-sans">
                          [안내] 월별 명예의 전당 선정자는 이후 대상에서 제외됩니다. (이름 비공개)
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-sans">
                      {sortedMonths.map((m) => {
                        const winners = monthlySnackWinnersHistory[m]?.winners || [];
                        return (
                          <div key={m} className="bg-stone-50/60 border border-stone-200/80 rounded-2xl p-4 space-y-3 hover:border-rose-300 transition-colors shadow-3xs">
                            <div className="flex justify-between items-center pb-2 border-b border-stone-200/40">
                              <span className="text-[10.5px] font-black text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded-lg">{m} 간식 수상자</span>
                              <span className="text-[10px] font-bold text-stone-400 font-mono">{winners.length}명</span>
                            </div>
                            {winners.length === 0 ? (
                              <p className="text-[10px] text-stone-400 text-center py-6 font-medium">이 달의 시상 데이터가 없습니다.</p>
                            ) : (
                              <div className="space-y-2">
                                {winners.map((w, idx) => (
                                  <div key={idx} className="flex flex-col gap-0.5 p-2.5 bg-white rounded-xl border border-stone-150 text-[11px]">
                                    <div className="flex justify-between items-center font-bold">
                                      <span className="text-stone-800 font-black">{w.grade}학년 {w.department}과</span>
                                      <span className="text-rose-600 font-black font-mono text-xs">{w.value}타</span>
                                    </div>
                                    <span className="text-[9px] font-bold text-stone-400 block">{w.reason}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 👑 2. Cumulative Final Awards Block */}
                  <div className="bg-white rounded-3xl border border-amber-100 p-6 space-y-6 shadow-sm">
                    <div className="flex items-center gap-3 pb-3 border-b border-amber-100">
                      <span className="p-2 bg-amber-50 text-amber-600 rounded-xl text-lg">👑</span>
                      <div>
                        <h3 className="text-sm font-black text-slate-800 tracking-wide font-sans">
                          최종 종합 (5월~10월) 명예의 전당
                        </h3>
                        <p className="text-[10px] text-stone-400 font-bold font-sans">
                          전 기간 중 각 학년별/부문별 최고 실적 및 최대 성장을 이루어낸 자랑스런 영광의 수상자입니다.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-sans text-xs">
                      {/* 한글 최고 속도상 */}
                      <div className="p-4 bg-gradient-to-b from-purple-50/20 to-white border border-purple-100 rounded-2xl space-y-3.5">
                        <span className="text-[10px] font-black text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-lg block text-center">한글 최고 속도상</span>
                        <div className="space-y-2">
                          {cumulativeFinalAwards.korSpeed.map((w, idx) => (
                            <div key={idx} className="p-2.5 bg-white border border-stone-150 rounded-xl">
                              <p className="text-[9.5px] font-bold text-stone-400 uppercase tracking-wider">{w.grade}학년 대표</p>
                              <div className="flex justify-between items-center font-black mt-0.5">
                                <span className="text-stone-800">{w.department}</span>
                                <span className="text-purple-600 font-mono font-black">{w.value}타</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 영어 최고 속도상 */}
                      <div className="p-4 bg-gradient-to-b from-indigo-50/20 to-white border border-indigo-100 rounded-2xl space-y-3.5">
                        <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg block text-center">영어 최고 속도상</span>
                        <div className="space-y-2">
                          {cumulativeFinalAwards.engSpeed.map((w, idx) => (
                            <div key={idx} className="p-2.5 bg-white border border-stone-150 rounded-xl">
                              <p className="text-[9.5px] font-bold text-stone-400 uppercase tracking-wider">{w.grade}학년 대표</p>
                              <div className="flex justify-between items-center font-black mt-0.5">
                                <span className="text-stone-800">{w.department}</span>
                                <span className="text-indigo-650 font-mono font-black">{w.value}타</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 한글 최고 성장상 */}
                      <div className="p-4 bg-gradient-to-b from-emerald-50/20 to-white border border-emerald-100 rounded-2xl space-y-3.5">
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg block text-center">한글 최고 성장상</span>
                        <div className="space-y-2">
                          {cumulativeFinalAwards.korGrowth.map((w, idx) => (
                            <div key={idx} className="p-2.5 bg-white border border-stone-150 rounded-xl">
                              <p className="text-[9.5px] font-bold text-stone-400 uppercase tracking-wider">{w.grade}학년 대표</p>
                              <div className="flex justify-between items-center font-black mt-0.5">
                                <span className="text-stone-800">{w.department}</span>
                                <span className="text-emerald-600 font-mono font-black">+{w.value}타</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 영어 최고 성장상 */}
                      <div className="p-4 bg-gradient-to-b from-rose-50/20 to-white border border-rose-100 rounded-2xl space-y-3.5">
                        <span className="text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg block text-center">영어 최고 성장상</span>
                        <div className="space-y-2">
                          {cumulativeFinalAwards.engGrowth.map((w, idx) => (
                            <div key={idx} className="p-2.5 bg-white border border-stone-150 rounded-xl">
                              <p className="text-[9.5px] font-bold text-stone-400 uppercase tracking-wider">{w.grade}학년 대표</p>
                              <div className="flex justify-between items-center font-black mt-0.5">
                                <span className="text-stone-800">{w.department}</span>
                                <span className="text-rose-600 font-mono font-black">+{w.value}타</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {studentTab === 'my_stats' && (
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
                    />
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

                  {/* 동의 완료 확인 카드 (시트 기준 동적 렌더링) */}
                  {(() => {
                    const normId = normalizeValue(studentSession.id);
                    const sheetRecord = privacyDb.find(p => normalizeValue(p.studentId) === normId);
                    // If no record exists yet, default to false. If exists, respect its agreed status.
                    const isAgreed = sheetRecord ? sheetRecord.agreed : false;

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
                      동의 주체: {studentSession.id} {studentSession.name}
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
          <p className="font-medium tracking-wide">
            Copyright © 2026 INBIGO. All rights reserved. | Version 1.0.0
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
                  placeholder="학교 비밀번호 4자리"
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
                  <span className="font-black text-indigo-805 font-sans">수집 일로부터 해당 학년도 종료 시까지 (학기가 종료된 후 데이터는 복구 불가능하도록 자동 파기됩니다.)</span>
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

    </div>
  );
}

