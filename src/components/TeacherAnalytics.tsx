import React, { useState, useMemo } from 'react';
import { TypingRecord, StudentAuth } from '../types';
import { getMonthNumber, parseStudentIdInfo } from '../data';
import { 
  Award, TrendingUp, BarChart2, CheckCircle, Users, Lightbulb, 
  Settings, HelpCircle, Flame, Calendar, Trophy, AlertCircle, 
  ChevronRight, RefreshCw, Star, Info, UserCheck, ShieldAlert
} from 'lucide-react';

interface TeacherAnalyticsProps {
  authDb: StudentAuth[];
  englishDb: TypingRecord[];
  koreanDb: TypingRecord[];
  onShowSettings: () => void;
  spreadsheetId: string;
}

type ActiveTab = 'achievement' | 'monthly_snacks' | 'final_awards' | 'growth_trends';

interface Winner {
  studentId: string;
  name: string;
  grade: string;
  department: string;
  value: number;
}

// 🔴 LEVEL STANDARD DEFINITIONS
// Korean: 1급 >= 350, 2급 >= 250, 3급 >= 150
// English: 1급 >= 200, 2급 >= 150, 3급 >= 100
// Points mapped: 3 = 1급, 2 = 2급, 1 = 3급, 0 = 미달

function getKoreanLevelPoints(speed: number): number {
  if (speed >= 350) return 3;
  if (speed >= 250) return 2;
  if (speed >= 150) return 1;
  return 0;
}

function getEnglishLevelPoints(speed: number): number {
  if (speed >= 200) return 3;
  if (speed >= 150) return 2;
  if (speed >= 100) return 1;
  return 0;
}

function getLevelName(points: number): string {
  if (points === 3) return '1급';
  if (points === 2) return '2급';
  if (points === 1) return '3급';
  return '미달';
}

function getLevelColorBadge(points: number): string {
  if (points === 3) return 'bg-rose-100 text-rose-700 border-rose-200';
  if (points === 2) return 'bg-amber-100 text-amber-700 border-amber-200';
  if (points === 1) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  return 'bg-stone-105 text-stone-500 border-stone-200';
}

export function TeacherAnalytics({ 
  authDb, 
  englishDb, 
  koreanDb, 
  onShowSettings,
  spreadsheetId
}: TeacherAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('achievement');
  const [selectedMonth, setSelectedMonth] = useState<string>('6월');

  // Unified student base list (to prevent omissions, we union authDb + raw record student IDs)
  const students = useMemo(() => {
    const studentMap = new Map<string, { studentId: string; name: string; department: string; grade: string }>();

    // Add from authDb
    authDb.forEach(s => {
      const info = parseStudentIdInfo(s.studentId);
      studentMap.set(s.studentId, {
        studentId: s.studentId,
        name: s.name,
        department: info.department,
        grade: info.grade
      });
    });

    // Merge English records
    englishDb.forEach(r => {
      if (!studentMap.has(r.studentId)) {
        const info = parseStudentIdInfo(r.studentId);
        studentMap.set(r.studentId, {
          studentId: r.studentId,
          name: r.name,
          department: r.department || info.department,
          grade: r.grade || info.grade
        });
      }
    });

    // Merge Korean records
    koreanDb.forEach(r => {
      if (!studentMap.has(r.studentId)) {
        const info = parseStudentIdInfo(r.studentId);
        studentMap.set(r.studentId, {
          studentId: r.studentId,
          name: r.name,
          department: r.department || info.department,
          grade: r.grade || info.grade
        });
      }
    });

    return Array.from(studentMap.values());
  }, [authDb, englishDb, koreanDb]);

  // Months lists sorted chronologically
  const sortedMonths = useMemo(() => {
    const months = Array.from(new Set([...englishDb.map(r => r.month), ...koreanDb.map(r => r.month)]))
      .filter(Boolean)
      .sort((a, b) => getMonthNumber(a) - getMonthNumber(b));
    
    // Default fallback months if database is empty
    return months.length > 0 ? months : ['5월', '6월', '7월', '8월', '9월', '10월'];
  }, [englishDb, koreanDb]);

  // Automatically select a valid month if the initial '6월' doesn't exist
  React.useEffect(() => {
    if (sortedMonths.length > 0 && !sortedMonths.includes(selectedMonth)) {
      setSelectedMonth(sortedMonths[0]);
    }
  }, [sortedMonths, selectedMonth]);

  // 📋 1. CERTIFICATE CALCULATION MATRIX PER STUDENT
  // Evaluates every student's latest English and Korean speed & level
  const studentCertificates = useMemo(() => {
    return students.map(s => {
      // Find latest English speed
      const sEng = englishDb.filter(r => r.studentId === s.studentId)
        .sort((a,b) => getMonthNumber(a.month) - getMonthNumber(b.month));
      const engSpeed = sEng.length > 0 ? sEng[sEng.length - 1].speed : 0;
      
      // Find latest Korean speed
      const sKor = koreanDb.filter(r => r.studentId === s.studentId)
        .sort((a,b) => getMonthNumber(a.month) - getMonthNumber(b.month));
      const korSpeed = sKor.length > 0 ? sKor[sKor.length - 1].speed : 0;

      const korPoints = getKoreanLevelPoints(korSpeed);
      const engPoints = getEnglishLevelPoints(engSpeed);
      // Final Certified Level is governed by the lower denominator
      const finalPoints = Math.min(korPoints, engPoints);

      return {
        ...s,
        korSpeed,
        engSpeed,
        korPoints,
        engPoints,
        finalPoints,
        isCertified: finalPoints > 0
      };
    });
  }, [students, englishDb, koreanDb]);

  // 🟠 AGGREGATES: SCHOOL, GRADE AND DEPARTMENT STATISTICS
  const aggregateStats = useMemo(() => {
    const totalCount = studentCertificates.length;
    const certifiedCount = studentCertificates.filter(s => s.isCertified).length;
    const certRate = totalCount > 0 ? parseFloat(((certifiedCount / totalCount) * 100).toFixed(1)) : 0;

    // School level counts
    const level1Count = studentCertificates.filter(s => s.finalPoints === 3).length;
    const level2Count = studentCertificates.filter(s => s.finalPoints === 2).length;
    const level3Count = studentCertificates.filter(s => s.finalPoints === 1).length;
    const failCount = totalCount - certifiedCount;

    // Averages
    const avgKor = totalCount > 0 ? Math.round(studentCertificates.reduce((sum, s) => sum + s.korSpeed, 0) / totalCount) : 0;
    const avgEng = totalCount > 0 ? Math.round(studentCertificates.reduce((sum, s) => sum + s.engSpeed, 0) / totalCount) : 0;

    // Grade comparison
    const grades = ['1', '2', '3'];
    const gradeStats = grades.map(g => {
      const list = studentCertificates.filter(s => s.grade === g);
      const total = list.length;
      const certified = list.filter(s => s.isCertified).length;
      const rate = total > 0 ? parseFloat(((certified / total) * 100).toFixed(1)) : 0;
      const korSpeedAvg = total > 0 ? Math.round(list.reduce((sum, s) => sum + s.korSpeed, 0) / total) : 0;
      const engSpeedAvg = total > 0 ? Math.round(list.reduce((sum, s) => sum + s.engSpeed, 0) / total) : 0;
      return { grade: g, total, certified, rate, korSpeedAvg, engSpeedAvg };
    });

    // Department comparison
    const depts = Array.from(new Set(studentCertificates.map(s => s.department))).filter(Boolean);
    const deptStats = depts.map(d => {
      const list = studentCertificates.filter(s => s.department === d);
      const total = list.length;
      const certified = list.filter(s => s.isCertified).length;
      const rate = total > 0 ? parseFloat(((certified / total) * 100).toFixed(1)) : 0;
      const korSpeedAvg = total > 0 ? Math.round(list.reduce((sum, s) => sum + s.korSpeed, 0) / total) : 0;
      const engSpeedAvg = total > 0 ? Math.round(list.reduce((sum, s) => sum + s.engSpeed, 0) / total) : 0;
      return { department: d, total, certified, rate, korSpeedAvg, engSpeedAvg };
    }).sort((a, b) => b.rate - a.rate); // Sort by certified achievement rate descending

    // ③ FAILURE REASON ANALYTICS (Bottlenecks)
    const fails = studentCertificates.filter(s => !s.isCertified);
    const totalFails = fails.length;
    
    // Bottleneck 1: English-only fail (Korean is dynamic certified >= 150, but English is < 100)
    const engBottleneckCount = fails.filter(s => s.korPoints > 0 && s.engPoints === 0).length;
    // Bottleneck 2: Korean-only fail (English >= 100, but Korean < 150)
    const korBottleneckCount = fails.filter(s => s.engPoints > 0 && s.korPoints === 0).length;
    // Bottleneck 3: Both languages fail
    const bothBottleneckCount = fails.filter(s => s.korPoints === 0 && s.engPoints === 0).length;

    const engBottleneckRate = totalFails > 0 ? parseFloat(((engBottleneckCount / totalFails) * 100).toFixed(1)) : 0;
    const korBottleneckRate = totalFails > 0 ? parseFloat(((korBottleneckCount / totalFails) * 100).toFixed(1)) : 0;
    const bothBottleneckRate = totalFails > 0 ? parseFloat(((bothBottleneckCount / totalFails) * 100).toFixed(1)) : 0;

    return {
      totalCount,
      certifiedCount,
      certRate,
      avgKor,
      avgEng,
      level1Count,
      level2Count,
      level3Count,
      failCount,
      gradeStats,
      deptStats,
      bottleneck: {
        korCount: korBottleneckCount,
        engCount: engBottleneckCount,
        bothCount: bothBottleneckCount,
        korRate: korBottleneckRate,
        engRate: engBottleneckRate,
        bothRate: bothBottleneckRate,
        totalFails
      }
    };
  }, [studentCertificates]);

  // 🟡 2. MONTHLY SNACK AWARDS ENGINE (CHRONOLOGICAL PREV-EXCLUSION BLACKLIST)
  const monthlyDataHistory = useMemo(() => {
    const historyMap: {
      [month: string]: {
        winners: { studentId: string; name: string; department: string; grade: string; reason: string; value: number }[];
        blacklistAtStart: Set<string>;
        rawCandidates: {
          korSpeed: Winner[];
          engSpeed: Winner[];
          korGrowth: Winner[];
          engGrowth: Winner[];
        };
      };
    } = {};

    const cumulativeSnackWinners = new Set<string>();

    sortedMonths.forEach((month, monthIdx) => {
      // Save blacklist as it stands before selecting this month's winners
      const blacklistToday = new Set(cumulativeSnackWinners);

      const korThisMonth = koreanDb.filter(r => r.month === month);
      const engThisMonth = englishDb.filter(r => r.month === month);

      const prevMonthName = monthIdx > 0 ? sortedMonths[monthIdx - 1] : null;

      // 1. Korean Speed candidates
      const rawKorSpeedCandidates = korThisMonth.map(r => ({
        studentId: r.studentId,
        name: r.name,
        grade: r.grade,
        department: r.department,
        value: r.speed
      })).sort((a,b) => b.value - a.value);

      // 2. English Speed candidates
      const rawEngSpeedCandidates = engThisMonth.map(r => ({
        studentId: r.studentId,
        name: r.name,
        grade: r.grade,
        department: r.department,
        value: r.speed
      })).sort((a,b) => b.value - a.value);

      // 3. Korean Growth Candidates (June/6월 onwards)
      const rawKorGrowthCandidates: Winner[] = [];
      if (prevMonthName) {
        const korPrev = koreanDb.filter(r => r.month === prevMonthName);
        korThisMonth.forEach(curr => {
          const prev = korPrev.find(p => p.studentId === curr.studentId);
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

      // 4. English Growth Candidates (June/6월 onwards)
      const rawEngGrowthCandidates: Winner[] = [];
      if (prevMonthName) {
        const engPrev = englishDb.filter(r => r.month === prevMonthName);
        engThisMonth.forEach(curr => {
          const prev = engPrev.find(p => p.studentId === curr.studentId);
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

      // Selection logic prioritizing Top-1 for Speed (Kor/Eng) and Top-2 for Growth (Kor/Eng)
      // total = 6 students. Avoid duplicating any student *within* this month + *across prior months*.
      const selectedWinners: typeof historyMap[string]['winners'] = [];
      const localSelectedSet = new Set<string>();

      const trySelectWinner = (list: Winner[], numToTake: number, reasonTag: string) => {
        let count = 0;
        for (let i = 0; i < list.length; i++) {
          const s = list[i];
          // Filter out if they won in past months or are already selected this month
          if (!cumulativeSnackWinners.has(s.studentId) && !localSelectedSet.has(s.studentId)) {
            selectedWinners.push({
              studentId: s.studentId,
              name: s.name,
              department: s.department,
              grade: s.grade,
              reason: `${reasonTag} ${count + 1}위`,
              value: s.value
            });
            localSelectedSet.add(s.studentId);
            cumulativeSnackWinners.add(s.studentId);
            count++;
            if (count >= numToTake) break;
          }
        }
      };

      // Select chronologically:
      // A. Korean Speed Top 1
      trySelectWinner(rawKorSpeedCandidates, 1, '한글 타자 최고 속도');
      // B. English Speed Top 1
      trySelectWinner(rawEngSpeedCandidates, 1, '영어 타자 최고 속도');
      // C. Korean Growth Top 2 (only if June onwards)
      if (prevMonthName) {
        trySelectWinner(rawKorGrowthCandidates, 2, '한글 타자 최고 향상');
      }
      // D. English Growth Top 2 (only if June onwards)
      if (prevMonthName) {
        trySelectWinner(rawEngGrowthCandidates, 2, '영어 타자 최고 향상');
      }

      historyMap[month] = {
        winners: selectedWinners,
        blacklistAtStart: blacklistToday,
        rawCandidates: {
          korSpeed: rawKorSpeedCandidates,
          engSpeed: rawEngSpeedCandidates,
          korGrowth: rawKorGrowthCandidates,
          engGrowth: rawEngGrowthCandidates
        }
      };
    });

    return historyMap;
  }, [englishDb, koreanDb, sortedMonths]);

  // 🟢 3. CUMULATIVE PERIODIC MAIN AWARDS (Double dipping ALLOWED!)
  // Calculated over the entire span 5월 - 10월
  const cumulativeFinalAwards = useMemo(() => {
    const studentIds = Array.from(new Set([...englishDb.map(r => r.studentId), ...koreanDb.map(r => r.studentId)]));

    const korSpeeds: { studentId: string; name: string; department: string; grade: string; value: number }[] = [];
    const engSpeeds: typeof korSpeeds = [];
    const korGrowths: typeof korSpeeds = [];
    const engGrowths: typeof korSpeeds = [];

    studentIds.forEach(sid => {
      const sKor = koreanDb.filter(r => r.studentId === sid).sort((a,b) => getMonthNumber(a.month) - getMonthNumber(b.month));
      const sEng = englishDb.filter(r => r.studentId === sid).sort((a,b) => getMonthNumber(a.month) - getMonthNumber(b.month));

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

    return {
      korSpeed: korSpeeds.sort((a,b) => b.value - a.value).slice(0, 3),
      engSpeed: engSpeeds.sort((a,b) => b.value - a.value).slice(0, 3),
      korGrowth: korGrowths.sort((a,b) => b.value - a.value).slice(0, 3),
      engGrowth: engGrowths.sort((a,b) => b.value - a.value).slice(0, 3)
    };
  }, [englishDb, koreanDb]);

  // ✨ 4. TIME SERIES FOR GRAPH TREND DISPLAY
  const growthTrendsTimeline = useMemo(() => {
    return sortedMonths.map(m => {
      const korRecords = koreanDb.filter(r => r.month === m);
      const engRecords = englishDb.filter(r => r.month === m);

      const korAvg = korRecords.length > 0 ? Math.round(korRecords.reduce((sum, r) => sum + r.speed, 0) / korRecords.length) : 0;
      const engAvg = engRecords.length > 0 ? Math.round(engRecords.reduce((sum, r) => sum + r.speed, 0) / engRecords.length) : 0;

      return {
        month: m,
        korAvg,
        engAvg,
        recordsCount: korRecords.length + engRecords.length
      };
    });
  }, [sortedMonths, koreanDb, englishDb]);

  // Is data sufficient?
  const hasData = studentCertificates.length > 0 && (englishDb.length > 0 || koreanDb.length > 0);

  return (
    <div className="w-full max-w-5xl space-y-8 animate-fade-in py-2">
      
      {/* 🚀 Top Header Section */}
      <div className="bg-white rounded-3xl border border-indigo-100 shadow-xs p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-indigo-600" />
        
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 border border-indigo-150 text-indigo-700 text-[10px] font-bold rounded-lg uppercase tracking-wider">
              <Award className="h-3.5 w-3.5 text-indigo-600 animate-bounce" />
              인비고 타자 챌린지 원격 결과 통계 센터
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 text-[9.5px] font-bold rounded-lg font-mono">
              실시간 데이터 연동 중 🔗
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            교사용 종합 데이터 분석 대시보드
          </h2>
          <p className="text-xs text-stone-400 font-medium font-sans">
            구글 스프레드시트와 직접 소통하여 학급 등급 달성률, 월별 간식 수혜자(중복 제외), 종합 시상을 자동 연산합니다.
          </p>
        </div>

        {/* Settings button */}
        <div className="shrink-0 flex items-center">
          <button
            type="button"
            onClick={onShowSettings}
            className="px-4.5 py-2.5 rounded-2xl text-xs font-extrabold text-white bg-slate-800 hover:bg-slate-900 shadow-xs transition-colors flex items-center gap-2 cursor-pointer border border-slate-755"
          >
            <Settings className="h-4 w-4 text-slate-350" />
            <span>수련 연동 설정</span>
          </button>
        </div>
      </div>

      {/* 🗂️ Interactive Responsive Dashboard Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-1">
        <button
          onClick={() => setActiveTab('achievement')}
          className={`px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
            activeTab === 'achievement' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-stone-400 hover:text-stone-700'
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          <span>기본 분석 & 급수 수집</span>
        </button>

        <button
          onClick={() => setActiveTab('monthly_snacks')}
          className={`px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
            activeTab === 'monthly_snacks' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-stone-400 hover:text-stone-700'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>월별 간식 시상 (중복 배제)</span>
        </button>

        <button
          onClick={() => setActiveTab('final_awards')}
          className={`px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
            activeTab === 'final_awards' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-stone-400 hover:text-stone-700'
          }`}
        >
          <Trophy className="h-4 w-4" />
          <span>5~10월 누적 최종 시상</span>
        </button>

        <button
          onClick={() => setActiveTab('growth_trends')}
          className={`px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
            activeTab === 'growth_trends' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-stone-400 hover:text-stone-700'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>우상향 성장 곡선 그래프</span>
        </button>
      </div>

      {/* Loading state / Empty Data alert */}
      {!hasData ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-stone-300 max-w-lg mx-auto p-8 space-y-4">
          <ShieldAlert className="h-12 w-12 text-stone-300 mx-auto" />
          <div className="space-y-1.5">
            <h4 className="text-base font-black text-stone-750">분석을 구동할 데이터베이스가 고갈되었습니다</h4>
            <p className="text-xs text-stone-400 leading-relaxed">
              연동된 구글 시트의 <code className="font-mono bg-stone-100 text-rose-600 px-1.5 py-0.5 rounded text-[11px]">english_all</code> 혹은 <code className="font-mono bg-stone-100 text-rose-600 px-1.5 py-0.5 rounded text-[11px]">korean_all</code>에 타자 수련 레코드를 입수하여 주십시오.
            </p>
          </div>
          <button 
            onClick={onShowSettings}
            className="px-4 py-2 text-xs font-bold bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-700"
          >
            시트 연동 매뉴얼 보기
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* 📋 TAB 1: BASIC ANALYSIS & LEVEL DISTRIBUTIONS */}
          {activeTab === 'achievement' && (
            <div className="space-y-8 animate-fade-in">
              
              {/* Overall KPI Cards Board */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                <div className="bg-white rounded-2xl border border-stone-200/60 p-5 flex items-center gap-4 shadow-2xs">
                  <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-450 font-bold uppercase tracking-wider">전체 active 학생</p>
                    <h4 className="text-xl font-black text-stone-900 tracking-tight font-mono mt-0.5">{aggregateStats.totalCount}명</h4>
                    <p className="text-[9.5px] font-bold text-stone-400 mt-0.5">자격 인증 및 연동 추적</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-stone-200/60 p-5 flex items-center gap-4 shadow-2xs">
                  <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-450 font-bold uppercase tracking-wider">최종 인증 성공률</p>
                    <h4 className="text-xl font-black text-emerald-700 tracking-tight font-mono mt-0.5">{aggregateStats.certRate}%</h4>
                    <p className="text-[9.5px] font-bold text-stone-400 mt-0.5">{aggregateStats.certifiedCount}명 합격 / {aggregateStats.failCount}명 미달</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-stone-200/60 p-5 flex items-center gap-4 shadow-2xs">
                  <div className="p-3 bg-amber-50 border border-amber-100 text-amber-600 rounded-xl">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-450 font-bold uppercase tracking-wider">평균 한글 속도</p>
                    <h4 className="text-xl font-black text-amber-700 tracking-tight font-mono mt-0.5">{aggregateStats.avgKor}타</h4>
                    <p className="text-[9.5px] font-bold text-stone-400 mt-0.5">전체 학생 가중치 평균속도</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-stone-200/60 p-5 flex items-center gap-4 shadow-2xs">
                  <div className="p-3 bg-violet-50 border border-violet-100 text-violet-600 rounded-xl">
                    <Flame className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-450 font-bold uppercase tracking-wider">평균 영어 속도</p>
                    <h4 className="text-xl font-black text-violet-700 tracking-tight font-mono mt-0.5">{aggregateStats.avgEng}타</h4>
                    <p className="text-[9.5px] font-bold text-stone-400 mt-0.5">전체 학생 가중치 평균속도</p>
                  </div>
                </div>

              </div>

              {/* Grid 2 Column: Left Grade/Dept Rates | Right Failure Reasons */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. Grade comparative & Dept list */}
                <div className="space-y-6">
                  
                  {/* Grade Card */}
                  <div className="bg-white rounded-2xl border border-stone-200/60 p-6 space-y-4 shadow-2xs">
                    <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                      <h4 className="text-xs font-black text-stone-900 tracking-wider uppercase flex items-center gap-1.5">
                        <Star className="h-4 w-4 text-amber-500" />
                        학년별 수련 및 인증서 달성률 비교
                      </h4>
                      <span className="text-[10px] font-bold text-stone-400">최근 기준</span>
                    </div>

                    <div className="space-y-3.5">
                      {aggregateStats.gradeStats.map((g, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-stone-700">{g.grade}학년 (총 {g.total}명)</span>
                            <span className="font-mono font-black text-indigo-700">{g.rate}% 합격 <span className="text-stone-400 font-normal">({g.certified}명)</span></span>
                          </div>
                          
                          <div className="h-5 w-full bg-stone-100 rounded-full overflow-hidden relative flex">
                            <div 
                              className="h-full bg-indigo-600 rounded-full transition-all flex items-center justify-end pr-2" 
                              style={{ width: `${g.rate}%` }}
                            >
                              {g.rate > 10 && <span className="text-[8.5px] font-mono font-black text-white">{g.rate}%</span>}
                            </div>
                          </div>

                          <div className="flex gap-4 text-[10px] text-stone-400 font-mono">
                            <span>한글 평균: <strong className="text-stone-605">{g.korSpeedAvg}타</strong></span>
                            <span>영어 평균: <strong className="text-stone-605">{g.engSpeedAvg}타</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dept Card */}
                  <div className="bg-white rounded-2xl border border-stone-200/60 p-6 space-y-4 shadow-2xs">
                    <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                      <h4 className="text-xs font-black text-stone-900 tracking-wider uppercase flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-indigo-500" />
                        학과별 타자 역량 및 '인증서 달성률' 경쟁 랭킹
                      </h4>
                      <span className="text-[9.5px] px-2 py-0.5 bg-indigo-50 text-indigo-600 font-bold rounded-md">과별 경쟁 유도</span>
                    </div>

                    <div className="space-y-3.5">
                      {aggregateStats.deptStats.map((d, idx) => {
                        const maxRate = Math.max(...aggregateStats.deptStats.map(x => x.rate)) || 100;
                        const relativeWidth = Math.max(10, Math.round((d.rate / maxRate) * 100));
                        
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded bg-stone-100 border text-[9.5px] font-black text-stone-600 flex items-center justify-center">{idx + 1}</span>
                                <span className="font-extrabold text-stone-800">{d.department}</span>
                              </span>
                              <span className="font-mono font-extrabold text-blue-700">{d.rate}% 인증 <span className="text-[10px] text-stone-400">({d.certified}명/{d.total}명)</span></span>
                            </div>

                            <div className="h-2 w-full bg-slate-50 border border-slate-100 rounded-full overflow-hidden flex">
                              <div 
                                className={`h-full rounded-full transition-all ${idx === 0 ? 'bg-gradient-to-r from-indigo-500 to-indigo-600' : 'bg-slate-400'}`} 
                                style={{ width: `${d.rate}%` }}
                              />
                            </div>

                            <div className="flex justify-between text-[9.5px] text-stone-400 font-mono">
                              <span>한/영 평균: {d.korSpeedAvg}타 / {d.engSpeedAvg}타</span>
                              <span className="font-sans text-[9px]">인증 성공률 {idx === 0 ? '👑 전교 1위' : `${idx + 1}위`}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* 2. Bottlenecks & Certified Stats */}
                <div className="space-y-6">
                  
                  {/* Failure bottleneck analysis (낙제점 비율 추이 요인 분석) */}
                  <div className="bg-white rounded-2xl border border-stone-200/60 p-6 space-y-6 shadow-2xs">
                    <div className="pb-2 border-b border-stone-100 flex justify-between items-center">
                      <h4 className="text-xs font-black text-stone-900 tracking-wider uppercase flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-rose-500 animate-pulse" />
                        인증서 미달성 요인 추이 분석 (Bottleneck)
                      </h4>
                      <span className="text-[10px] font-bold text-rose-650 bg-rose-50 px-2 py-0.5 rounded-lg">미달성자 {aggregateStats.bottleneck.totalFails}명 정밀 진단</span>
                    </div>

                    {aggregateStats.bottleneck.totalFails === 0 ? (
                      <div className="text-center py-10 bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6">
                        <Flame className="h-8 w-8 text-emerald-600 mx-auto mb-2 animate-bounce" />
                        <h4 className="text-xs font-black text-emerald-800">훈련 낙제생 전원 극복!</h4>
                        <p className="text-[11.5px] text-emerald-600 mt-1 leading-relaxed">
                          현재 전체 활성 학생이 한문 및 영문 자격 인증인 최저 3급 수준을 동시 만족하고 있습니다.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        
                        {/* Summary Insight */}
                        <div className="p-3.5 bg-stone-50 border border-stone-200/80 rounded-xl text-xs space-y-1">
                          <span className="font-extrabold text-stone-850 flex items-center gap-1.5">
                            <Lightbulb className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                            훈련 교사 보고용 분석 리포트
                          </span>
                          <p className="text-[11.1px] text-stone-600 font-medium leading-relaxed">
                            {(() => {
                              const b = aggregateStats.bottleneck;
                              if (b.engRate > b.korRate && b.engRate > b.bothRate) {
                                return `인비고 미달성 학생의 무려 ${b.engRate}%가 '영어 타수 부족'으로 인해 인증서를 입수하지 못하고 있습니다. 영어 단어 및 문장 타자 훈련 기회를 30% 늘릴 유도가 필요합니다.`;
                              } else if (b.korRate > b.engRate && b.korRate > b.bothRate) {
                                return `인비고 미달성 학생의 ${b.korRate}%가 '한글 타수 미충족'이 병목이며, 한자 및 장문 타이핑 정석 운지법 보충이 지목됩니다.`;
                              } else {
                                return `다수의 학생(${b.bothRate}%)이 한글과 영어 타자 모두에서 최저 수련 등급(100/150타)을 도달하지 못해, 포괄적 기초 타자 집중 훈련이 요청됩니다.`;
                              }
                            })()}
                          </p>
                        </div>

                        {/* Progress bars of bottlenecks */}
                        <div className="space-y-4">
                          
                          {/* English fail bottle */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                              <span>영어 타수만 미달 (영어 병목형)</span>
                              <span className="font-mono text-rose-600">{aggregateStats.bottleneck.engRate}% <span className="text-stone-400 font-normal">({aggregateStats.bottleneck.engCount}명)</span></span>
                            </div>
                            <div className="h-3.5 w-full bg-stone-100 rounded-full overflow-hidden">
                              <div className="h-full bg-rose-500 rounded-full" style={{ width: `${aggregateStats.bottleneck.engRate}%` }} />
                            </div>
                            <p className="text-[10px] text-stone-400">한글은 3급 이상(150타+) 달성했으나 영어 최저 기준(100타) 미달</p>
                          </div>

                          {/* Korean fail bottle */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                              <span>한글 타수만 미달 (한글 병목형)</span>
                              <span className="font-mono text-rose-600">{aggregateStats.bottleneck.korRate}% <span className="text-stone-400 font-normal">({aggregateStats.bottleneck.korCount}명)</span></span>
                            </div>
                            <div className="h-3.5 w-full bg-stone-100 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${aggregateStats.bottleneck.korRate}%` }} />
                            </div>
                            <p className="text-[10px] text-stone-400">영어는 3급 이상(100타+) 달성했으나 한글 최저 기준(150타) 미달</p>
                          </div>

                          {/* Both fail bottle */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                              <span>한글 & 영어 동시 미달 (기초 미달형)</span>
                              <span className="font-mono text-rose-650">{aggregateStats.bottleneck.bothRate}% <span className="text-stone-400 font-normal">({aggregateStats.bottleneck.bothCount}명)</span></span>
                            </div>
                            <div className="h-3.5 w-full bg-stone-100 rounded-full overflow-hidden">
                              <div className="h-full bg-stone-400 rounded-full" style={{ width: `${aggregateStats.bottleneck.bothRate}%` }} />
                            </div>
                            <p className="text-[10px] text-stone-400">한글 150타 및 영어 100타 장벽을 둘 다 넘지 못한 핵심 지도군</p>
                          </div>

                        </div>

                      </div>
                    )}
                  </div>

                  {/* Level Distribution Ratios Card */}
                  <div className="bg-white rounded-2xl border border-stone-200/60 p-6 space-y-4 shadow-2xs">
                    <h4 className="text-xs font-black text-stone-900 tracking-wider uppercase pb-2 border-b border-stone-100">
                      인비 챌린지 최종 자격급수 전교 보유 통계
                    </h4>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                        <span className="text-[10.5px] font-bold text-rose-600 block">1급인증 🥇</span>
                        <span className="text-lg font-black text-rose-800 font-mono mt-0.5 inline-block">{aggregateStats.level1Count}명</span>
                      </div>
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <span className="text-[10.5px] font-bold text-amber-600 block">2급인증 🥈</span>
                        <span className="text-lg font-black text-amber-800 font-mono mt-0.5 inline-block">{aggregateStats.level2Count}명</span>
                      </div>
                      <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <span className="text-[10.5px] font-bold text-emerald-600 block">3급인증 🥉</span>
                        <span className="text-lg font-black text-emerald-800 font-mono mt-0.5 inline-block">{aggregateStats.level3Count}명</span>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <span className="text-[10.5px] font-bold text-slate-550 block">미통과 🚫</span>
                        <span className="text-lg font-black text-slate-700 font-mono mt-0.5 inline-block">{aggregateStats.failCount}명</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

              {/* Student detail lookup table inside teacher area */}
              <div className="bg-white rounded-2xl border border-stone-200/60 p-6 space-y-4 shadow-2xs overflow-hidden">
                <div className="flex justify-between items-center flex-wrap gap-2 pb-2 border-b border-stone-100">
                  <h4 className="text-xs font-black text-stone-900 tracking-wider uppercase">
                    학급별 학생 타자성적 및 등급 대조 명부
                  </h4>
                  <p className="text-[11px] text-stone-400 font-medium">총 {studentCertificates.length}명의 데이터 연결</p>
                </div>

                <div className="overflow-x-auto min-w-full">
                  <table className="w-full text-xs text-left text-stone-600">
                    <thead className="bg-stone-50 text-[10.5px] text-stone-400 uppercase tracking-wider border-b">
                      <tr>
                        <th className="py-2.5 px-3">학번</th>
                        <th className="py-2.5 px-3">이름</th>
                        <th className="py-2.5 px-3">학과</th>
                        <th className="py-2.5 px-3">한글 타수(급수)</th>
                        <th className="py-2.5 px-3">영어 타수(급수)</th>
                        <th className="py-2.5 px-3 text-right">최종 인증</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {studentCertificates.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-mono text-stone-900 font-extrabold">{s.studentId}</td>
                          <td className="py-2 px-3 font-bold text-stone-800">{s.name}</td>
                          <td className="py-2 px-3">{s.department}</td>
                          <td className="py-2 px-3">
                            <span className="font-mono font-bold text-amber-700">{s.korSpeed}타</span>
                            <span className="ml-1 text-[9px] text-stone-400 font-sans">({getLevelName(s.korPoints)})</span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-mono font-bold text-violet-750">{s.engSpeed}타</span>
                            <span className="ml-1 text-[9px] text-stone-400 font-sans">({getLevelName(s.engPoints)})</span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className={`inline-block px-2.5 py-1 text-[10.2px] font-black border rounded-lg ${getLevelColorBadge(s.finalPoints)}`}>
                              {s.finalPoints > 0 ? `${getLevelName(s.finalPoints)} 인증 🎉` : '미달'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* 🟡 TAB 2: MONTHLY SNACK AWARDS (CHRONOLOGICAL ROLL-OVER) */}
          {activeTab === 'monthly_snacks' && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Informative Rule Card */}
              <div className="bg-amber-50/50 border border-amber-200/65 rounded-2xl p-5 space-y-2 text-xs">
                <span className="font-black text-amber-850 flex items-center gap-1.5 uppercase">
                  <Star className="h-4 w-4 text-amber-600 animate-spin" />
                  ★ 중복 수령 방지 및 이월 이력 시스템 연동 로직
                </span>
                <p className="text-[11.2px] text-amber-800 font-medium leading-relaxed">
                  매달 시상 시 <strong>이미 이전 달에 한 번이라도 간식을 받은 학생은 순위권에서 강제 배제(Blacklist 적용)</strong>됩니다. 
                  보상은 후순위 대기 학생(4위, 5위...)에게 공정하게 상속됩니다. 
                  아래에서 월(5월~10월)을 누르시면 해당 월의 <strong>간식 당첨 학생 6명</strong> 및 사유와 제외된 후보 명단을 입체적으로 확인하실 수 있습니다.
                </p>
              </div>

              {/* Month Select Buttons */}
              <div className="flex flex-wrap gap-2 justify-center py-2 bg-stone-50 border border-stone-200/60 rounded-2xl max-w-xl mx-auto p-2">
                {sortedMonths.map((m, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedMonth(m)}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
                      selectedMonth === m 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900 bg-white border border-stone-200/50'
                    }`}
                  >
                    {m} 시상보상 {idx === 0 && '(선배정)'}
                  </button>
                ))}
              </div>

              {/* Monthly Results Display */}
              {monthlyDataHistory[selectedMonth] && (
                <div className="space-y-6">
                  
                  {/* Snack Winners Card */}
                  <div className="bg-white rounded-2xl border border-indigo-100 shadow-xs p-6 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-indigo-50">
                      <h4 className="text-sm font-black text-indigo-950 flex items-center gap-2">
                        <Award className="h-5 w-5 text-indigo-600" />
                        🎁 {selectedMonth} 최종 상속자 및 간식 증정 명단 (총 6명)
                      </h4>
                      <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                        Past Winners Excluded
                      </span>
                    </div>

                    {monthlyDataHistory[selectedMonth].winners.length === 0 ? (
                      <p className="text-center text-stone-400 text-xs py-8">이 달의 당첨 데이터 또는 참가 기록이 충족되지 않았습니다.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {monthlyDataHistory[selectedMonth].winners.map((w, idx) => (
                          <div 
                            key={idx} 
                            className="bg-stone-50 border border-slate-200 relative p-4 rounded-xl space-y-3 shadow-2xs hover:border-indigo-300 transition-colors"
                          >
                            <span className="absolute top-3 right-3 text-lg">🎁</span>
                            <div className="space-y-0.5">
                              <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-black rounded border border-emerald-200">
                                {w.reason}
                              </span>
                              <h4 className="text-base font-black text-stone-900 mt-1.5">{w.name}</h4>
                              <p className="text-[10.5px] text-stone-400 font-bold font-sans">
                                학번 {w.studentId} | {w.grade}학년 {w.department}
                              </p>
                            </div>
                            <div className="pt-2 border-t border-dashed flex justify-between items-center text-xs">
                              <span className="text-stone-400 font-semibold">동작 수치 :</span>
                              <strong className="font-mono text-sm text-indigo-700 font-black">
                                {w.value} {w.reason.includes('향상') ? '타 성정 ▲' : '타 최고'}
                              </strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Candidate Pools for inspection (총 12개 순위 리스트 관리 - 4개 부문 각 Top 5) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Pool 1: Korean Speed Top 5 */}
                    <div className="bg-white rounded-2xl border border-stone-200/60 p-5 space-y-3.5 shadow-2xs">
                      <h4 className="text-xs font-black text-stone-850 border-b pb-2 flex justify-between items-center">
                        <span>한글 최고속도 부문 후보 풀 (Top 5)</span>
                        <span className="text-[10px] text-slate-400 font-semibold">원시 기록</span>
                      </h4>
                      <div className="space-y-2">
                        {monthlyDataHistory[selectedMonth].rawCandidates.korSpeed.slice(0, 5).map((c, idx) => {
                          const isPastWinner = monthlyDataHistory[selectedMonth].blacklistAtStart.has(c.studentId);
                          const isMatchedWinner = monthlyDataHistory[selectedMonth].winners.some(w => w.studentId === c.studentId && w.reason.includes('한글 타자 최고 속도'));
                          
                          return (
                            <div key={idx} className={`flex items-center justify-between p-2 rounded-lg text-xs ${isMatchedWinner ? 'bg-indigo-50/70 border border-indigo-200 font-bold' : 'bg-stone-50 border border-stone-150'}`}>
                              <span className="flex items-center gap-1.5">
                                <span className="font-semibold text-stone-400">#{idx+1}</span>
                                <span className={isPastWinner ? 'line-through text-stone-400' : 'text-stone-800'}>{c.name}({c.studentId})</span>
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-amber-700 font-bold">{c.value}타</span>
                                {isPastWinner && <span className="text-[9px] bg-slate-100 text-slate-500 font-bold border rounded px-1">기합격 이월 ⏭️</span>}
                                {isMatchedWinner && <span className="text-[9px] bg-indigo-100 text-indigo-700 font-black border border-indigo-200 rounded px-1">간식당첨 🎁</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pool 2: English Speed Top 5 */}
                    <div className="bg-white rounded-2xl border border-stone-200/60 p-5 space-y-3.5 shadow-2xs">
                      <h4 className="text-xs font-black text-stone-850 border-b pb-2 flex justify-between items-center">
                        <span>영어 최고속도 부문 후보 풀 (Top 5)</span>
                        <span className="text-[10px] text-slate-400 font-semibold">원시 기록</span>
                      </h4>
                      <div className="space-y-2">
                        {monthlyDataHistory[selectedMonth].rawCandidates.engSpeed.slice(0, 5).map((c, idx) => {
                          const isPastWinner = monthlyDataHistory[selectedMonth].blacklistAtStart.has(c.studentId);
                          const isMatchedWinner = monthlyDataHistory[selectedMonth].winners.some(w => w.studentId === c.studentId && w.reason.includes('영어 타자 최고 속도'));
                          
                          return (
                            <div key={idx} className={`flex items-center justify-between p-2 rounded-lg text-xs ${isMatchedWinner ? 'bg-indigo-50/70 border border-indigo-200 font-bold' : 'bg-stone-50 border border-stone-150'}`}>
                              <span className="flex items-center gap-1.5">
                                <span className="font-semibold text-stone-400">#{idx+1}</span>
                                <span className={isPastWinner ? 'line-through text-stone-400' : 'text-stone-800'}>{c.name}({c.studentId})</span>
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-purple-700 font-bold">{c.value}타</span>
                                {isPastWinner && <span className="text-[9px] bg-slate-100 text-slate-500 font-bold border rounded px-1">기합격 이월 ⏭️</span>}
                                {isMatchedWinner && <span className="text-[9px] bg-indigo-100 text-indigo-700 font-black border border-indigo-200 rounded px-1">간식당첨 🎁</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pool 3: Korean Growth Top 5 */}
                    <div className="bg-white rounded-2xl border border-stone-200/60 p-5 space-y-3.5 shadow-2xs">
                      <h4 className="text-xs font-black text-stone-850 border-b pb-2 flex justify-between items-center">
                        <span>한글 향상도(성장도) 후보 풀 (Top 5)</span>
                        <span className="text-[9.2px] text-stone-450 font-bold">당월 - 전월</span>
                      </h4>
                      <div className="space-y-2">
                        {selectedMonth === '5월' ? (
                          <p className="text-center text-xs text-stone-400 py-6 leading-relaxed">
                            성장(향상)도는 6월부터 측정이 가능한 수치입니다.<br/>5월은 첫 기준점 설정 달입니다.
                          </p>
                        ) : (
                          monthlyDataHistory[selectedMonth].rawCandidates.korGrowth.slice(0, 5).map((c, idx) => {
                            const isPastWinner = monthlyDataHistory[selectedMonth].blacklistAtStart.has(c.studentId);
                            const isMatchedWinner = monthlyDataHistory[selectedMonth].winners.some(w => w.studentId === c.studentId && w.reason.includes('한글 타자 최고 향상'));
                            
                            return (
                              <div key={idx} className={`flex items-center justify-between p-2 rounded-lg text-xs ${isMatchedWinner ? 'bg-indigo-50/70 border border-indigo-200 font-bold' : 'bg-stone-50 border border-stone-150'}`}>
                                <span className="flex items-center gap-1.5">
                                  <span className="font-semibold text-stone-400">#{idx+1}</span>
                                  <span className={isPastWinner ? 'line-through text-stone-400' : 'text-stone-800'}>{c.name}({c.studentId})</span>
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-emerald-600 font-bold">+{c.value}타 성장</span>
                                  {isPastWinner && <span className="text-[9px] bg-slate-100 text-slate-500 font-bold border rounded px-1">기합격 이월 ⏭️</span>}
                                  {isMatchedWinner && <span className="text-[9px] bg-indigo-100 text-indigo-700 font-black border border-indigo-200 rounded px-1">간식당첨 🎁</span>}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Pool 4: English Growth Top 5 */}
                    <div className="bg-white rounded-2xl border border-stone-200/60 p-5 space-y-3.5 shadow-2xs">
                      <h4 className="text-xs font-black text-stone-850 border-b pb-2 flex justify-between items-center">
                        <span>영어 향상도(성장도) 후보 풀 (Top 5)</span>
                        <span className="text-[9.2px] text-stone-450 font-bold">당월 - 전월</span>
                      </h4>
                      <div className="space-y-2">
                        {selectedMonth === '5월' ? (
                          <p className="text-center text-xs text-stone-400 py-6 leading-relaxed">
                            성장(향상)도는 6월부터 측정이 가능한 수치입니다.<br/>5월은 첫 기준점 설정 달입니다.
                          </p>
                        ) : (
                          monthlyDataHistory[selectedMonth].rawCandidates.engGrowth.slice(0, 5).map((c, idx) => {
                            const isPastWinner = monthlyDataHistory[selectedMonth].blacklistAtStart.has(c.studentId);
                            const isMatchedWinner = monthlyDataHistory[selectedMonth].winners.some(w => w.studentId === c.studentId && w.reason.includes('영어 타자 최고 향상'));
                            
                            return (
                              <div key={idx} className={`flex items-center justify-between p-2 rounded-lg text-xs ${isMatchedWinner ? 'bg-indigo-50/70 border border-indigo-200 font-bold' : 'bg-stone-50 border border-stone-150'}`}>
                                <span className="flex items-center gap-1.5">
                                  <span className="font-semibold text-stone-400">#{idx+1}</span>
                                  <span className={isPastWinner ? 'line-through text-stone-400' : 'text-stone-800'}>{c.name}({c.studentId})</span>
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-emerald-600 font-bold">+{c.value}타 성장</span>
                                  {isPastWinner && <span className="text-[9px] bg-slate-100 text-slate-500 font-bold border rounded px-1">기합격 이월 ⏭️</span>}
                                  {isMatchedWinner && <span className="text-[9px] bg-indigo-100 text-indigo-700 font-black border border-indigo-200 rounded px-1">간식당첨 🎁</span>}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                  </div>

                </div>
              )}

            </div>
          )}

          {/* 🟢 TAB 3: CUMULATIVE MAIN SEMESTER AWARDS (NO EXCLUSIONS) */}
          {activeTab === 'final_awards' && (
            <div className="space-y-6 animate-fade-in">
              
              <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-6 sm:p-8 space-y-4 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-44 h-44 bg-indigo-500/20 rounded-full blur-2xl" />
                <div className="space-y-1">
                  <span className="text-amber-400 text-xs font-black uppercase tracking-widest flex items-center gap-1">
                    <Trophy className="h-4 w-4 animate-bounce" />
                    2026학년도 타자 챌린지 5월 ~ 10월 최종 종합 명예의 전당
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight">수련 기간 종합 누적 우승자 시상 보상 체계</h3>
                  <p className="text-slate-300 text-xs max-w-2xl leading-relaxed font-medium">
                    본 시상은 월별 간식 수여 블랙리스트 필터링 제하와 무관하게, 한 학기 동안의 모든 수련 이력을 통합해 오직 순수 성적과 순수 격차 향상도만으로 최종 12명의 선봉 레이서를 선발합니다.
                  </p>
                </div>
              </div>

              {/* Master Board Grid: Speeds Left (Kor vs Eng) | Improvements Right (Kor vs Eng) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* section: Speeds */}
                <div className="space-y-6">
                  
                  {/* Kor Speed */}
                  <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-2xs">
                    <h4 className="text-xs font-black text-rose-700 tracking-wider uppercase border-b pb-2 flex items-center gap-1.5">
                      <Star className="h-4 w-4" />
                      한글 타자 누적 최고 속도 우수생 (최종 3명)
                    </h4>

                    <div className="space-y-2.5">
                      {cumulativeFinalAwards.korSpeed.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-rose-50/40 border border-rose-100 flex-row text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-rose-200 text-rose-800 text-[10px] font-black flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-extrabold text-stone-900">{s.name}</p>
                              <p className="text-[10px] text-stone-400">{s.grade}학년 {s.department}</p>
                            </div>
                          </div>
                          <span className="font-mono text-sm text-rose-700 font-extrabold">{s.value}타 최고</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Eng Speed */}
                  <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-2xs">
                    <h4 className="text-xs font-black text-indigo-700 tracking-wider uppercase border-b pb-2 flex items-center gap-1.5">
                      <Star className="h-4 w-4" />
                      영어 타자 누적 최고 속도 우수생 (최종 3명)
                    </h4>

                    <div className="space-y-2.5">
                      {cumulativeFinalAwards.engSpeed.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/40 border border-indigo-100 flex-row text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-200 text-indigo-800 text-[10px] font-black flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-extrabold text-stone-900">{s.name}</p>
                              <p className="text-[10px] text-stone-400">{s.grade}학년 {s.department}</p>
                            </div>
                          </div>
                          <span className="font-mono text-sm text-indigo-700 font-extrabold">{s.value}타 최고</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* section: Cumulative Improvements (당해 최초 달 기록 대비 최종 달 기록 성장량) */}
                <div className="space-y-6">
                  
                  {/* Kor growth */}
                  <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-2xs">
                    <h4 className="text-xs font-black text-emerald-800 tracking-wider uppercase border-b pb-2 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4" />
                      한글 수련 종합 최다 향상 성장 우수생 (최종 3명)
                    </h4>

                    <div className="space-y-2.5">
                      {cumulativeFinalAwards.korGrowth.length === 0 ? (
                        <p className="text-center text-xs text-stone-400 py-8 leading-normal">성장 기록 측정을 위한 2회차 이상의<br/>기록 입력 축적이 필요합니다.</p>
                      ) : (
                        cumulativeFinalAwards.korGrowth.map((s, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/40 border border-emerald-100 flex-row text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <div>
                                <p className="font-extrabold text-stone-900">{s.name}</p>
                                <p className="text-[10px] text-stone-450">{s.grade}학년 {s.department}</p>
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
                      <TrendingUp className="h-4 w-4" />
                      영어 수련 종합 최다 향상 성장 우수생 (최종 3명)
                    </h4>

                    <div className="space-y-2.5">
                      {cumulativeFinalAwards.engGrowth.length === 0 ? (
                        <p className="text-center text-xs text-stone-400 py-8 leading-normal">성장 기록 측정을 위한 2회차 이상의<br/>기록 입력 축적이 필요합니다.</p>
                      ) : (
                        cumulativeFinalAwards.engGrowth.map((s, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/40 border border-emerald-100 flex-row text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <div>
                                <p className="font-extrabold text-stone-900">{s.name}</p>
                                <p className="text-[10px] text-stone-450">{s.grade}학년 {s.department}</p>
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
          )}

          {/* 📈 TAB 4: TIME-SERIES GROWTH LINE RADIAL GRID */}
          {activeTab === 'growth_trends' && (
            <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-6 shadow-xs animate-fade-in">
              <div className="flex justify-between items-center pb-2 border-b">
                <div>
                  <h4 className="text-xs font-black text-stone-900 tracking-wider uppercase">
                    학기 수련 타자 프로그램 도입 전교생 효과 분석 흐름
                  </h4>
                  <p className="text-[10px] text-stone-400 font-medium">5월 기준 우상향 선 차트 분석 데이터</p>
                </div>
                <span className="inline-flex items-center gap-1 bg-emerald-55 text-emerald-700 text-[9px] border px-2.5 py-1 rounded-lg font-black font-sans">
                  인비 챌린지 검정 효과 분석 입증용 🚀
                </span>
              </div>

              {/* Graphical Plot container */}
              {growthTrendsTimeline.length < 2 ? (
                <div className="text-center py-16 text-stone-400 text-xs">
                  최소 2개 이상의 월별 훈련 기록이 입력되면 성장 우상향 곡선이 즉각 표기됩니다.
                </div>
              ) : (
                <div className="space-y-6">
                  
                  {/* Interactive Indicator */}
                  <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs flex justify-between items-center text-[11px] font-medium leading-relaxed font-sans text-indigo-900/90">
                    <p>
                      💡 <strong>전교생 분석 결과:</strong> 5월 도입 이래, 평균 한글 타수는 
                      <strong className="text-indigo-650 mx-1">
                        {growthTrendsTimeline[0].korAvg}타 ➡️ {growthTrendsTimeline[growthTrendsTimeline.length - 1].korAvg}타
                      </strong> 
                      ({growthTrendsTimeline[growthTrendsTimeline.length - 1].korAvg - growthTrendsTimeline[0].korAvg}타 우상향), 
                      영문 타수는 
                      <strong className="text-indigo-650 mx-1">
                        {growthTrendsTimeline[0].engAvg}타 ➡️ {growthTrendsTimeline[growthTrendsTimeline.length - 1].engAvg}타
                      </strong> 
                      ({growthTrendsTimeline[growthTrendsTimeline.length - 1].engAvg - growthTrendsTimeline[0].engAvg}타 우상향)으로 집계되었습니다. 
                      타자 훈련 검정 체계 연동 효과가 완벽히 입증되고 있습니다.
                    </p>
                  </div>

                  {/* Large custom SVG graph mapping */}
                  <div className="relative bg-slate-50 border border-slate-100 rounded-2xl p-6 h-64 flex flex-col justify-between select-none">
                    <div className="flex-1 w-full relative">
                      {/* Grid Lines */}
                      <div className="absolute inset-x-0 top-0 border-t border-slate-150" />
                      <div className="absolute inset-x-0 top-1/4 border-t border-dashed border-slate-200" />
                      <div className="absolute inset-x-0 top-2/4 border-t border-dashed border-slate-200" />
                      <div className="absolute inset-x-0 top-3/4 border-t border-dashed border-slate-200" />
                      <div className="absolute inset-x-0 bottom-0 border-b border-slate-150" />

                      {/* SVG element */}
                      <svg className="w-full h-full absolute inset-0 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {(() => {
                          const allSpeeds = [
                            ...growthTrendsTimeline.map(t => t.korAvg),
                            ...growthTrendsTimeline.map(t => t.engAvg)
                          ];
                          const maxSpeed = Math.max(...allSpeeds) * 1.15;
                          const minSpeed = Math.min(...allSpeeds) * 0.85;
                          const range = (maxSpeed - minSpeed) || 1;

                          const korPoints = growthTrendsTimeline.map((t, idx) => {
                            const x = (idx / (growthTrendsTimeline.length - 1)) * 100;
                            const y = 100 - (((t.korAvg - minSpeed) / range) * 100);
                            return { x, y };
                          });

                          const engPoints = growthTrendsTimeline.map((t, idx) => {
                            const x = (idx / (growthTrendsTimeline.length - 1)) * 100;
                            const y = 100 - (((t.engAvg - minSpeed) / range) * 100);
                            return { x, y };
                          });

                          const korD = korPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                          const engD = engPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                          return (
                            <>
                              {/* Han/Kor Area and Line */}
                              <path d={`${korD} L 100 100 L 0 100 Z`} fill="url(#amberGrad)" opacity="0.08" />
                              <path d={korD} fill="none" stroke="#d97706" strokeWidth="3" strokeLinecap="round" />

                              {/* Eng Area and Line */}
                              <path d={`${engD} L 100 100 L 0 100 Z`} fill="url(#violetGrad)" opacity="0.08" />
                              <path d={engD} fill="none" stroke="#6d28d9" strokeWidth="3" strokeLinecap="round" />

                              {/* Interactive dots for Amber */}
                              {korPoints.map((p, idx) => (
                                <circle key={`k-${idx}`} cx={p.x} cy={p.y} r="4" fill="#d97706" stroke="white" strokeWidth="2" />
                              ))}

                              {/* Interactive dots for Violet */}
                              {engPoints.map((p, idx) => (
                                <circle key={`e-${idx}`} cx={p.x} cy={p.y} r="4" fill="#6d28d9" stroke="white" strokeWidth="2" />
                              ))}

                              {/* Grad Gradients */}
                              <defs>
                                <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#d97706" />
                                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                                </linearGradient>
                                <linearGradient id="violetGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#6d28d9" />
                                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                            </>
                          );
                        })()}
                      </svg>
                    </div>

                    {/* Timeline Legend label */}
                    <div className="flex justify-between items-center pt-4 border-t border-slate-100 text-[10.5px] font-mono">
                      {growthTrendsTimeline.map((t, idx) => (
                        <div key={idx} className="text-center">
                          <div className="flex flex-col gap-0.5 mb-1 items-center justify-center">
                            <span className="text-amber-700 font-extrabold">한: {t.korAvg}타</span>
                            <span className="text-violet-700 font-extrabold">영: {t.engAvg}타</span>
                          </div>
                          <span className="text-stone-400 font-bold block">{t.month}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Legends visual indicator */}
                  <div className="flex gap-4 justify-center text-xs">
                    <span className="flex items-center gap-1.5 text-amber-700 font-bold">
                      <span className="w-3 h-3 bg-amber-600 rounded-full" />
                      전교생 한글 타자 평균
                    </span>
                    <span className="flex items-center gap-1.5 text-violet-700 font-bold">
                      <span className="w-3 h-3 bg-violet-700 rounded-full" />
                      전교생 영어 타자 평균
                    </span>
                  </div>

                </div>
              )}

            </div>
          )}

        </div>
      )}

    </div>
  );
}
