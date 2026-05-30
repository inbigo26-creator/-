import React, { useState, useMemo } from 'react';
import { TypingRecord, StudentAuth } from '../types';
import { getMonthNumber, parseStudentIdInfo } from '../data';
import { 
  Award, TrendingUp, BarChart2, Briefcase, Calendar, 
  MapPin, CheckCircle, Users, Lightbulb, Settings, 
  ArrowUpRight, ArrowRight, ShieldCheck, ChevronRight
} from 'lucide-react';

interface TeacherAnalyticsProps {
  authDb: StudentAuth[];
  englishDb: TypingRecord[];
  koreanDb: TypingRecord[];
  onShowSettings: () => void;
  spreadsheetId: string;
}

type DataTypeFilter = 'combined' | 'korean' | 'english';

export function TeacherAnalytics({ 
  authDb, 
  englishDb, 
  koreanDb, 
  onShowSettings,
  spreadsheetId
}: TeacherAnalyticsProps) {
  const [dataType, setDataType] = useState<DataTypeFilter>('korean');

  // Unified lists
  const allRecords = useMemo(() => {
    const list: (TypingRecord & { category: string })[] = [
      ...englishDb.map(r => ({ ...r, category: 'english' })),
      ...koreanDb.map(r => ({ ...r, category: 'korean' }))
    ];
    return list;
  }, [englishDb, koreanDb]);

  // General Statistics & Derived Data
  const stats = useMemo(() => {
    // Determine active records based on selected data type
    const activeRecords: (TypingRecord & { category: string })[] = dataType === 'combined' 
      ? allRecords 
      : allRecords.filter(r => r.category === dataType);

    if (activeRecords.length === 0) {
      return {
        hasData: false,
        totalRecords: 0,
        gradeStats: [],
        deptStats: [],
        monthTrend: [],
        crossStats: [],
        insights: [],
        gradeGrowth: [],
        deptGrowth: [],
        topGrowthGroups: []
      };
    }

    // --- Helper lists ---
    const grades = Array.from(new Set(activeRecords.map(r => r.grade))).filter(Boolean).sort();
    const depts = Array.from(new Set(activeRecords.map(r => r.department))).filter(Boolean);

    // --- 1. [학년별 비교] Average Typing Speed ---
    const gradeStats = grades.map(g => {
      const gRecords = activeRecords.filter(r => r.grade === g);
      const avgSpeed = gRecords.length > 0 
        ? Math.round(gRecords.reduce((sum, r) => sum + r.speed, 0) / gRecords.length)
        : 0;
      return { grade: g, average: avgSpeed, count: gRecords.length };
    });

    const fastestGrade = [...gradeStats].sort((a,b) => b.average - a.average)[0]?.grade || '없음';

    // --- 2. [학과별 비교] Average Typing Speed ---
    const deptStats = depts.map(d => {
      const dRecords = activeRecords.filter(r => r.department === d);
      const avgSpeed = dRecords.length > 0
        ? Math.round(dRecords.reduce((sum, r) => sum + r.speed, 0) / dRecords.length)
        : 0;
      return { department: d, average: avgSpeed, count: dRecords.length };
    }).sort((a, b) => b.average - a.average);

    const highestDept = deptStats[0]?.department || '없음';
    const lowestDept = deptStats[deptStats.length - 1]?.department || '없음';
    const deptVariance = (deptStats[0]?.average || 0) - (deptStats[deptStats.length - 1]?.average || 0);

    // --- 3. [성장 추이] Month-by-month averages ---
    const months: string[] = Array.from(new Set(activeRecords.map(r => r.month as string)))
      .sort((a: string, b: string) => getMonthNumber(a) - getMonthNumber(b));

    const monthTrend = months.map((m: string) => {
      const mRecords = activeRecords.filter(r => r.month === m);
      const avgSpeed = mRecords.length > 0
        ? Math.round(mRecords.reduce((sum, r) => sum + r.speed, 0) / mRecords.length)
        : 0;
      return { month: m, average: avgSpeed };
    });

    // --- 4. [성장률 분석] (First Month Speed vs Last Month Speed per student) ---
    // First, group records by studentId to find their individual first and last month speeds
    const studentIds = Array.from(new Set(activeRecords.map(r => r.studentId)));
    
    interface StudentGrowth {
      studentId: string;
      name: string;
      grade: string;
      department: string;
      firstSpeed: number;
      lastSpeed: number;
      growth: number;
      hasMultipleMonths: boolean;
    }

    const studentGrowths: StudentGrowth[] = studentIds.map(sid => {
      const sRecords = [...activeRecords.filter(r => r.studentId === sid)].sort(
        (a, b) => getMonthNumber(a.month) - getMonthNumber(b.month)
      );

      if (sRecords.length === 0) return null;

      const first = sRecords[0];
      const last = sRecords[sRecords.length - 1];
      const growthVal = last.speed - first.speed;

      return {
        studentId: sid,
        name: first.name,
        grade: first.grade,
        department: first.department,
        firstSpeed: first.speed,
        lastSpeed: last.speed,
        growth: growthVal,
        hasMultipleMonths: sRecords.length > 1
      };
    }).filter(g => g !== null) as StudentGrowth[];

    // --- 4.1. 학년별 평균 성장도 ---
    const gradeGrowth = grades.map(g => {
      // Filter student growths
      const gGrowths = studentGrowths.filter(s => s.grade === g);
      const avgGrowth = gGrowths.length > 0
        ? Math.round(gGrowths.reduce((sum, s) => sum + s.growth, 0) / gGrowths.length)
        : 0;
      return { grade: g, averageGrowth: avgGrowth, count: gGrowths.length };
    });

    const highestGrowthGrade = [...gradeGrowth].sort((a, b) => b.averageGrowth - a.averageGrowth)[0]?.grade || '없음';

    // --- 4.2. 학과별 평균 성장도 ---
    const deptGrowth = depts.map(d => {
      const dGrowths = studentGrowths.filter(s => s.department === d);
      const avgGrowth = dGrowths.length > 0
        ? Math.round(dGrowths.reduce((sum, s) => sum + s.growth, 0) / dGrowths.length)
        : 0;
      return { department: d, averageGrowth: avgGrowth, count: dGrowths.length };
    }).sort((a, b) => b.averageGrowth - a.averageGrowth);

    // --- 4.3. 학년 + 학과 조합 최고의 성장 그룹 상위 3개 ---
    const groupCombinations: { [key: string]: StudentGrowth[] } = {};
    studentGrowths.forEach(s => {
      const combKey = `${s.grade}학년 ${s.department}`;
      if (!groupCombinations[combKey]) {
        groupCombinations[combKey] = [];
      }
      groupCombinations[combKey].push(s);
    });

    const topGrowthGroups = Object.keys(groupCombinations).map(key => {
      const sList = groupCombinations[key];
      const avgGrowth = sList.length > 0
        ? Math.round(sList.reduce((sum, s) => sum + s.growth, 0) / sList.length)
        : 0;
      return { groupName: key, averageGrowth: avgGrowth, studentCount: sList.length };
    })
    .filter(g => g.studentCount >= 1) // Only count groups that have at least 1 student
    .sort((a, b) => b.averageGrowth - a.averageGrowth)
    .slice(0, 3);

    // --- 5. [교차 분석] 학년 내에서 어떤 과가 가장 성장이 빠른지 세부 분석 ---
    const crossStats = gradeStats.map(gStat => {
      const g = gStat.grade;
      const gDeptsGrowths = depts.map(d => {
        const combGrowths = studentGrowths.filter(s => s.grade === g && s.department === d);
        const avgGrowth = combGrowths.length > 0
          ? Math.round(combGrowths.reduce((sum, s) => sum + s.growth, 0) / combGrowths.length)
          : 0;
        return { department: d, averageGrowth: avgGrowth, count: combGrowths.length };
      }).filter(d => d.count > 0)
      .sort((a, b) => b.averageGrowth - a.averageGrowth);

      return {
        grade: g,
        bestDept: gDeptsGrowths[0]?.department || '없음',
        bestGrowth: gDeptsGrowths[0]?.averageGrowth || 0,
        allDeptGrowths: gDeptsGrowths
      };
    });

    // --- 6. [인사이트 발견 3가지] ---
    const insights: string[] = [];
    
    // Insight 1: Month with highest growth surge
    if (monthTrend.length > 1) {
      let maxSurge = -999;
      let surgeMonth = '';
      for (let i = 1; i < monthTrend.length; i++) {
        const surge = monthTrend[i].average - monthTrend[i-1].average;
        if (surge > maxSurge) {
          maxSurge = surge;
          surgeMonth = monthTrend[i].month;
        }
      }
      if (maxSurge > 0) {
        insights.push(`🤖 [성장 급증기] 시간이 지남에 따라 학생들의 비약적 집중 수련으로 **${surgeMonth}**에 평균 타속이 전월 대비 **+${maxSurge}타** 급상승하는 훈련 임계점 돌풍이 감지되었습니다.`);
      } else {
        insights.push(`📈 [꾸준한 연마] 장기 훈련에 접어들며 전체 학생들의 평균 타자 성정량이 침체 없이 점진적 우상향 곡선을 완성하고 있습니다.`);
      }
    } else {
      insights.push(`📊 [기준점 설립] 현재 첫 학급 데이터가 기준점으로 원활히 등록되어 있으며, 다음 달 기록이 취합되는 즉시 월별 실시간 경사도 추적이 활성화됩니다.`);
    }

    // Insight 2: Department comparative variance
    if (deptVariance > 70) {
      insights.push(`💼 [학과 간 격차] 현재 학과별 타가 속도 편차가 **${deptVariance}타**로 다소 마이너 균열이 있습니다. 속도가 상대적으로 고전 중인 **${lowestDept}**에 타자 정석 운지법 보충 피드백 지도를 추천합니다.`);
    } else {
      insights.push(`✨ [고른 숙련도] 학과 평균 편차가 **${deptVariance}타** 내외로 매우 균일합니다. 전 학생 진로 학급에서 균형 잡힌 타이핑 문해 수련 및 정비 환경이 잘 정착되어 있습니다.`);
    }

    // Insight 3: Outstanding combination group
    if (topGrowthGroups.length > 0) {
      insights.push(`🥇 [최고 성장 러너] 첫 수련 시작 이래 격가 변화량이 가장 높은 핵심 연마 그룹은 **${topGrowthGroups[0].groupName}** (**+${topGrowthGroups[0].averageGrowth}타** 폭풍 성장)으로 밝혀졌습니다.`);
    } else {
      insights.push(`🏆 디지털 문해 기반을 다지기 위해 학과별 타자 정밀 조율 트랙이 성공적으로 동기화되었습니다.`);
    }

    return {
      hasData: true,
      totalRecords: activeRecords.length,
      gradeStats,
      deptStats,
      monthTrend,
      crossStats,
      insights,
      gradeGrowth,
      deptGrowth,
      topGrowthGroups,
      lowestDept,
      highestDept,
      deptVariance,
      fastestGrade,
      highestGrowthGrade
    };
  }, [dataType, allRecords]);

  return (
    <div className="w-full max-w-5xl space-y-8 animate-fade-in py-2">
      
      {/* 🚀 Top Indicator and Banner */}
      <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-indigo-600" />
        
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 border border-indigo-150 text-indigo-700 text-[10px] font-bold rounded-lg uppercase tracking-wider">
              <Award className="h-3 w-3 text-indigo-600 animate-pulse" />
              학교 타자 프로젝트 교사 통계 분석
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-55/40 text-indigo-700 border border-indigo-100/30 text-[10px] font-bold rounded-lg font-mono">
              연동 시트 ID: {spreadsheetId?.substring(0, 10)}...
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight font-sans">
            실시간 수련 성장도 분석 대시보드
          </h2>
          <p className="text-xs text-stone-400 font-medium tracking-tight font-sans">
            전체 수집 데이터의 학년별, 학과별 비교 및 월간 성장 추이 빅데이터 연동 분석입니다.
          </p>
        </div>

        {/* Action button and quick settings link */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onShowSettings}
            className="px-4.5 py-2.5 rounded-2xl text-xs font-black text-white bg-slate-800 hover:bg-slate-900 shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-slate-750"
          >
            <Settings className="h-4 w-4" />
            <span>설정 및 연동 관리</span>
          </button>
        </div>
      </div>

      {/* 📊 Selector Tabs (한글 / 영어 / 전체) */}
      <div className="flex justify-between items-center bg-white p-2 border border-stone-200/50 rounded-2xl max-w-sm mx-auto shadow-2xs">
        <button
          onClick={() => setDataType('korean')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            dataType === 'korean' 
              ? 'bg-indigo-600 text-white shadow-xs' 
              : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50'
          }`}
        >
          한글 타자 통계
        </button>
        <button
          onClick={() => setDataType('english')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            dataType === 'english' 
              ? 'bg-indigo-600 text-white shadow-xs' 
              : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50'
          }`}
        >
          영어 타자 통계
        </button>
        <button
          onClick={() => setDataType('combined')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            dataType === 'combined' 
              ? 'bg-indigo-600 text-white shadow-xs' 
              : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50'
          }`}
        >
          통합 평균
        </button>
      </div>

      {/* --- Main Contents --- */}
      {!stats.hasData ? (
        <div className="text-center py-16 px-6 bg-white rounded-3xl border border-dashed border-stone-300 max-w-md mx-auto">
          <TrendingUp className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <p className="text-sm font-extrabold text-stone-700 mb-1">연동된 타자 평가 데이터가 부족합니다.</p>
          <p className="text-xs text-stone-400">등록된 구글 시트에 "english_all"과 "korean_all"에 월별 타수 데이터가 포함되어 있는지 확인해 주세요.</p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* 🎯 Bento Section 1: Dynamic KPI Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-white rounded-2xl border border-stone-200/60 p-5 flex items-center gap-4 shadow-2xs">
              <div className="p-3.5 bg-indigo-55 text-indigo-700 rounded-2xl border border-indigo-110/30">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] text-stone-400 font-extrabold uppercase tracking-wider">누적 수집 데이터</p>
                <h3 className="text-2xl font-black text-stone-900 tracking-tight font-mono mt-0.5">{stats.totalRecords}개</h3>
                <p className="text-[10.5px] font-bold text-stone-500 mt-1">학년·계열 통합 매트릭스</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200/60 p-5 flex items-center gap-4 shadow-2xs">
              <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
                <Award className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] text-stone-400 font-extrabold uppercase tracking-wider">최고 평속 학년</p>
                <h3 className="text-2xl font-black text-amber-700 tracking-tight mt-0.5">{stats.fastestGrade}학년</h3>
                <p className="text-[10.5px] font-bold text-stone-500 mt-1">학년별 최고 퍼포머 클래스</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200/60 p-5 flex items-center gap-4 shadow-2xs">
              <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] text-stone-400 font-extrabold uppercase tracking-wider">최고 평균 성장 학과</p>
                <h3 className="text-lg font-black text-stone-900 truncate tracking-tight mt-0.5 max-w-[180px]">{stats.deptGrowth[0]?.department || '없음'}</h3>
                <p className="text-[10.5px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
                  평균 성장: <span className="font-mono font-bold">+{stats.deptGrowth[0]?.averageGrowth || 0}타</span>
                </p>
              </div>
            </div>

          </div>

          {/* 📈 Section 2: Visual Charts & Graph Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* 1. [학년별 비교] & [교차 분석] Visual Card */}
            <div className="bg-white rounded-3xl border border-stone-200/60 p-6 space-y-6 shadow-sm">
              <div className="flex justify-between items-center">
                <h3 className="text-[14.5px] font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span className="p-1 px-1.5 bg-indigo-50 border border-indigo-100/50 text-indigo-700 text-[10.5px] rounded-lg">분석 항목 1</span>
                  학년별 평균 타자 비교 및 우수집단
                </h3>
                <span className="text-[11px] text-indigo-700 font-bold bg-indigo-50/50 border border-indigo-100/30 px-2 py-0.5 rounded-lg">
                  최고: {stats.fastestGrade}학년
                </span>
              </div>

              {/* Progress-style Bar Graph for Grades */}
              <div className="space-y-4 pt-2">
                {stats.gradeStats.map((item, index) => {
                  const maxPercent = Math.max(...stats.gradeStats.map(g => g.average)) || 1;
                  const ratio = Math.min(100, Math.round((item.average / maxPercent) * 100));
                  const isTop = item.grade === stats.fastestGrade;

                  return (
                    <div key={index} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-800">
                        <span className="flex items-center gap-1.5">
                          <span>{item.grade}학년</span>
                          {isTop && <span className="text-[9.5px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-sm">FASTEST 🥇</span>}
                        </span>
                        <span className="font-mono text-stone-500 font-extrabold">{item.average}타 <span className="text-[10px] font-normal">({item.count}개 데이터)</span></span>
                      </div>
                      <div className="h-6 w-full bg-slate-100 rounded-lg overflow-hidden flex">
                        <div 
                          className={`h-full rounded-lg transition-all duration-500 flex items-center pl-2.5 ${isTop ? 'bg-indigo-600 text-white' : 'bg-slate-400 text-slate-900'}`}
                          style={{ width: `${ratio}%` }}
                        >
                          <span className="text-[10px] font-bold truncate">{(item.average)}타</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* [교차 분석] 학년별 학과 최고 성장 분석 디스플레이 */}
              <div className="pt-4 border-t border-stone-200/60 space-y-3">
                <span className="text-[11.5px] text-stone-400 font-extrabold flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-indigo-600" />
                  학년별 세부 교차 분석 (학년별 내 최고 성장 학과)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {stats.crossStats.map((item, index) => (
                    <div key={index} className="p-3 bg-stone-50 border border-stone-150 rounded-xl space-y-2">
                      <span className="font-bold text-stone-850">Grade {item.grade}</span>
                      <p className="text-indigo-750 font-extrabold truncate">{item.bestDept}</p>
                      <span className="inline-block text-[10px] text-emerald-600 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded">
                        성장률 +{item.bestGrowth}타
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. [학과별 비교] Visual Card */}
            <div className="bg-white rounded-3xl border border-stone-200/60 p-6 space-y-6 shadow-sm">
              <div className="flex justify-between items-center">
                <h3 className="text-[14.5px] font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span className="p-1 px-1.5 bg-violet-50 border border-violet-100/50 text-violet-700 text-[10.5px] rounded-lg">분석 항목 2</span>
                  학과별(계열별) 평균 타자 속도 비교
                </h3>
              </div>

              <div className="space-y-4 pt-1">
                {stats.deptStats.map((item, index) => {
                  const maxPercent = Math.max(...stats.deptStats.map(d => d.average)) || 1;
                  const ratio = Math.min(100, Math.round((item.average / maxPercent) * 100));
                  const isGold = index === 0;

                  return (
                    <div key={index} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-stone-800">
                        <span className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{item.department}</span>
                          {isGold && <span className="text-[9px] px-1 bg-amber-100 text-amber-700 rounded-sm">1위</span>}
                        </span>
                        <span className="font-mono font-bold text-stone-550">{item.average}타</span>
                      </div>
                      <div className="h-3 w-full bg-slate-50 border border-stone-150/40 rounded-full overflow-hidden flex">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${isGold ? 'bg-indigo-600' : 'bg-slate-350'}`}
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 편차 분석 */}
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-205 text-xs space-y-1 mt-2">
                <span className="flex items-center gap-1 font-bold text-amber-850">
                  <Lightbulb className="h-4 w-4 text-amber-600 shrink-0" />
                  학과 연동 편차 분석 (Variance)
                </span>
                <p className="text-amber-800/90 leading-normal font-medium">
                  학과별 최고 평균은 **{stats.highestDept} ({stats.deptStats[0]?.average || 0}타)**이며, 
                  최조는 **{stats.lowestDept} ({stats.deptStats[stats.deptStats.length - 1]?.average || 0}타)**로, 
                  과별 성능 편차량은 약 <strong>{stats.deptVariance}타</strong>입니다. 
                  {stats.deptVariance > 75 
                    ? " 편차 폭이 넓기 때문에 학급 간 연습 기회 불균형 방치 조치가 권고됩니다." 
                    : " 전학과 고르게 고도의 비약적인 상향 평준화 분포가 이루어져 있습니다."
                  }
                </p>
              </div>
            </div>

          </div>

          {/* 3. [성장 추이] & [성장률 그룹 분석] Card Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* [성장 추이] 전체 월별 평균 타자 속도 변화 */}
            <div className="bg-white rounded-3xl border border-stone-200/60 p-6 space-y-6 shadow-sm">
              <div className="flex justify-between items-center">
                <h3 className="text-[14.5px] font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span className="p-1 px-1.5 bg-emerald-50 border border-emerald-100/50 text-emerald-700 text-[10.5px] rounded-lg">분석 항목 3</span>
                  월별 평균 타자 성장 곡선 추이
                </h3>
              </div>

              {/* Elegant Custom SVG Line Chart */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 flex flex-col justify-between h-56 relative select-none">
                
                {stats.monthTrend.length < 2 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <Calendar className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-xs text-slate-500 font-bold">성장 추세 조율 중</p>
                    <p className="text-[10px] text-slate-400 mt-1">최소 2개월 이상의 데이터 연산이 충족될 때 추이선이 렌더링됩니다.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 w-full relative">
                      {/* Grid Lines */}
                      <div className="absolute inset-x-0 top-0 border-t border-slate-200" />
                      <div className="absolute inset-x-0 top-1/3 border-t border-dashed border-slate-205" />
                      <div className="absolute inset-x-0 top-2/3 border-t border-dashed border-slate-205" />
                      <div className="absolute inset-x-0 bottom-0 border-b border-slate-200" />

                      {/* SVG Line Graph */}
                      <svg className="w-full h-full absolute inset-0 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {(() => {
                          const maxSpeed = Math.max(...stats.monthTrend.map(t => t.average)) * 1.15;
                          const minSpeed = Math.min(...stats.monthTrend.map(t => t.average)) * 0.85;
                          const speedRange = (maxSpeed - minSpeed) || 1;

                          const points = stats.monthTrend.map((t, idx) => {
                            const x = (idx / (stats.monthTrend.length - 1)) * 100;
                            const y = 100 - (((t.average - minSpeed) / speedRange) * 100);
                            return { x, y, val: t.average, label: t.month };
                          });

                          const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                          return (
                            <>
                              {/* Draw area under path */}
                              <path
                                d={`${pathD} L 100 100 L 0 100 Z`}
                                fill="url(#indigoGrad)"
                                opacity="0.15"
                              />
                              
                              {/* Glowing Line */}
                              <path
                                d={pathD}
                                fill="none"
                                stroke="#4f46e5"
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />

                              {/* Interactive Data Nodes */}
                              {points.map((p, idx) => (
                                <g key={idx} className="cursor-pointer group">
                                  <circle
                                    cx={p.x}
                                    cy={p.y}
                                    r="4.5"
                                    fill="#4f46e5"
                                    stroke="white"
                                    strokeWidth="2.5"
                                  />
                                </g>
                              ))}

                              {/* Gradient definition */}
                              <defs>
                                <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#4f46e5" />
                                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                            </>
                          );
                        })()}
                      </svg>
                    </div>

                    {/* X-axis labels */}
                    <div className="flex justify-between items-center text-[11px] font-mono font-extrabold text-slate-500 pt-2.5 border-t border-slate-100">
                      {stats.monthTrend.map((t, idx) => (
                        <div key={idx} className="text-center font-semibold">
                          <p className="text-slate-700">{t.average}타</p>
                          <p className="text-slate-400 text-[10px] mt-0.5">{t.month}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

              </div>
            </div>

            {/* [성장률 분석] - First 대비 마지막 달 실력 수급 향상 그룹 탑클래스 */}
            <div className="bg-white rounded-3xl border border-stone-200/60 p-6 space-y-6 shadow-sm">
              <div className="flex justify-between items-center">
                <h3 className="text-[14.5px] font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span className="p-1 px-1.5 bg-rose-50 border border-rose-100/50 text-rose-700 text-[10.5px] rounded-lg">분석 항목 4</span>
                  첫 달 대비 마지막 달 최고의 수련 성장 집단
                </h3>
              </div>

              {/* comparative rankings list */}
              <div className="space-y-4">
                
                {/* 1. Grade comparative progress growth */}
                <div className="space-y-2">
                  <span className="text-[11px] uppercase tracking-widest text-stone-400 font-extrabold flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-rose-500" />
                    학년별 평균 실질 성장량 (마지막 달 속도 - 첫 달)
                  </span>
                  <div className="grid grid-cols-3 gap-2.5">
                    {stats.gradeGrowth.map((g, idx) => (
                      <div key={idx} className="bg-stone-50 border border-stone-150 p-2.5 rounded-xl text-center">
                        <p className="text-[10px] font-bold text-stone-500">{g.grade}학년</p>
                        <p className="text-sm font-black text-indigo-700 font-mono mt-0.5 animate-pulse">+{g.averageGrowth}타</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Dept comparative growth rankings */}
                <div className="space-y-2">
                  <span className="text-[11px] uppercase tracking-widest text-stone-400 font-extrabold flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-rose-500" />
                    학과별 평균 실질 성장량 랭킹
                  </span>
                  <div className="space-y-1.5">
                    {stats.deptGrowth.map((d, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-150 text-xs font-semibold">
                        <span className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                            idx === 0 ? 'bg-amber-100 text-amber-700' :
                            idx === 1 ? 'bg-slate-200 text-slate-700' :
                            idx === 2 ? 'bg-amber-50 text-amber-800' : 'bg-stone-200 text-stone-600'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="text-slate-800 font-bold">{d.department}</span>
                        </span>
                        <span className="font-mono text-emerald-600 font-bold">+{d.averageGrowth}타</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Combination absolute Top 3 growth groups */}
                <div className="space-y-2">
                  <span className="text-[11px] uppercase tracking-widest text-stone-400 font-extrabold flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-rose-500" />
                    학년 & 학과 조합 최고의 성장 그룹 Top 3
                  </span>
                  <div className="space-y-1.5">
                    {stats.topGrowthGroups.length === 0 ? (
                      <p className="text-stone-400 text-xs text-center py-2">수련 데이터 축적이 진행 중입니다.</p>
                    ) : (
                      stats.topGrowthGroups.map((g, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-100 flex-row text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-indigo-700 font-black">#0{idx + 1}</span>
                            <span className="font-bold text-slate-900">{g.groupName}</span>
                          </div>
                          <div className="text-right flex items-center gap-2.5">
                            <span className="text-[10px] text-stone-400 font-bold font-sans">누적 {g.studentCount}명</span>
                            <span className="font-mono text-emerald-600 font-extrabold">+{g.averageGrowth}타 성장</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* 🧐 Section 3: AI/Insight Generator highlights */}
          <div className="bg-white rounded-3xl border border-stone-200/60 p-6 space-y-4 shadow-sm">
            <h3 className="text-[14.5px] font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-indigo-600" />
              스마트 타자 지표 종합 분석 리포트 (핵심 인사이트 3선)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium leading-relaxed text-stone-600">
              {stats.insights.map((insight, index) => (
                <div key={index} className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-110/30 space-y-1.5">
                  <span className="text-[11.5px] text-indigo-850 font-bold block">인사이트 0{index + 1}</span>
                  <p 
                    className="text-stone-750 font-semibold"
                    dangerouslySetInnerHTML={{ __html: insight }}
                  />
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
