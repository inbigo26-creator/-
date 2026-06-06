import React, { useState, useMemo } from 'react';
import { TypingRecord, StudentAuth } from '../types';
import { getMonthNumber, parseStudentIdInfo, normalizeDepartment } from '../data';
import { 
  Award, TrendingUp, BarChart2, CheckCircle, Users, Lightbulb, 
  Settings, HelpCircle, Flame, Calendar, Trophy, AlertCircle, 
  ChevronRight, RefreshCw, Star, Info, UserCheck, ShieldAlert,
  Search
} from 'lucide-react';

interface TeacherAnalyticsProps {
  authDb: StudentAuth[];
  englishDb: TypingRecord[];
  koreanDb: TypingRecord[];
  onShowSettings: () => void;
  spreadsheetId: string;
}

type ActiveTab = 'achievement' | 'class_rankings' | 'monthly_snacks' | 'final_awards' | 'growth_trends' | 'integrated_stats';

const isExcludedStudentName = (name: string): boolean => {
  if (!name) return false;
  const n = name.trim();
  return n.includes('(자퇴)') || n.includes('(위탁)') || n.includes('*');
};

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

const cleanStudentId = (id: string) => String(id || '').trim().replace(/[^0-9A-Za-z]/g, '');

const isDeptMatch = (dbDept: string, targetDept: string) => {
  if (!dbDept || !targetDept) return false;
  return normalizeDepartment(dbDept) === normalizeDepartment(targetDept);
};

export function TeacherAnalytics({ 
  authDb, 
  englishDb, 
  koreanDb, 
  onShowSettings,
  spreadsheetId
}: TeacherAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('achievement');
  const [selectedMonth, setSelectedMonth] = useState<string>('6월');

  // Bottom student grid lookup filters
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Unified student base list (to prevent omissions, we union authDb + raw record student IDs)
  const students = useMemo(() => {
    const studentMap = new Map<string, { studentId: string; name: string; department: string; grade: string }>();

    // Add from authDb
    authDb.forEach(s => {
      const info = parseStudentIdInfo(s.studentId);
      studentMap.set(s.studentId, {
        studentId: s.studentId,
        name: s.name,
        department: normalizeDepartment(info.department),
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
          department: normalizeDepartment(r.department || info.department),
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
          department: normalizeDepartment(r.department || info.department),
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
      const isExcluded = isExcludedStudentName(s.name);
      
      // Find latest English speed
      const sEng = englishDb.filter(r => cleanStudentId(r.studentId) === cleanStudentId(s.studentId))
        .sort((a,b) => getMonthNumber(a.month) - getMonthNumber(b.month));
      const engSpeed = sEng.length > 0 ? sEng[sEng.length - 1].speed : 0;
      
      // Find latest Korean speed
      const sKor = koreanDb.filter(r => cleanStudentId(r.studentId) === cleanStudentId(s.studentId))
        .sort((a,b) => getMonthNumber(a.month) - getMonthNumber(b.month));
      const korSpeed = sKor.length > 0 ? sKor[sKor.length - 1].speed : 0;

      const korPoints = getKoreanLevelPoints(korSpeed);
      const engPoints = getEnglishLevelPoints(engSpeed);
      // Final Certified Level is governed by the lower denominator
      const finalPoints = Math.min(korPoints, engPoints);

      // Determine month of achieving this level
      let levelAchievedMonth = '-';
      if (finalPoints > 0 && !isExcluded) {
        for (const m of sortedMonths) {
          // English speed in or before month m
          const engRecsUpToM = sEng.filter(r => getMonthNumber(r.month) <= getMonthNumber(m));
          const engSpeedAtM = engRecsUpToM.length > 0 ? engRecsUpToM[engRecsUpToM.length - 1].speed : 0;
          
          // Korean speed in or before month m
          const korRecsUpToM = sKor.filter(r => getMonthNumber(r.month) <= getMonthNumber(m));
          const korSpeedAtM = korRecsUpToM.length > 0 ? korRecsUpToM[korRecsUpToM.length - 1].speed : 0;
          
          const ep = getEnglishLevelPoints(engSpeedAtM);
          const kp = getKoreanLevelPoints(korSpeedAtM);
          
          if (Math.min(ep, kp) >= finalPoints) {
            levelAchievedMonth = m;
            break;
          }
        }
      }

      return {
        ...s,
        korSpeed,
        engSpeed,
        maxKorSpeed: sKor.length > 0 ? Math.max(...sKor.map(r => r.speed), 0) : 0,
        maxEngSpeed: sEng.length > 0 ? Math.max(...sEng.map(r => r.speed), 0) : 0,
        korPoints,
        engPoints,
        finalPoints,
        isCertified: finalPoints > 0 && !isExcluded,
        levelAchievedMonth,
        isExcluded
      };
    });
  }, [students, englishDb, koreanDb, sortedMonths]);

  const availableDepts = useMemo(() => {
    const rawDepts = studentCertificates.map(s => s.department).filter(Boolean);
    const normalized = rawDepts.map(d => normalizeDepartment(d));
    return Array.from(new Set(normalized));
  }, [studentCertificates]);

  const availableAchievementMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    studentCertificates.forEach(s => {
      if (s.levelAchievedMonth && s.levelAchievedMonth !== '-') {
        monthsSet.add(s.levelAchievedMonth);
      }
    });
    return Array.from(monthsSet).sort((a,b) => getMonthNumber(a) - getMonthNumber(b));
  }, [studentCertificates]);

  // Filtered student list for bottom grid
  const filteredStudents = useMemo(() => {
    return studentCertificates.filter(s => {
      if (filterGrade !== 'all') {
        const sGradeNum = String(s.grade || '').replace(/[^0-9]/g, '');
        const targetGradeNum = String(filterGrade).replace(/[^0-9]/g, '');
        if (sGradeNum !== targetGradeNum) return false;
      }
      if (filterDept !== 'all' && !isDeptMatch(s.department, filterDept)) return false;
      if (filterMonth !== 'all') {
        if (filterMonth === '미달') {
          if (s.levelAchievedMonth !== '-') return false;
        } else {
          if (s.levelAchievedMonth !== filterMonth) return false;
        }
      }
      if (filterLevel !== 'all') {
        // finalPoints matches level (3 = 1급, 2 = 2급, 1 = 3급, 0 = 미달)
        if (filterLevel === '1' && s.finalPoints !== 3) return false;
        if (filterLevel === '2' && s.finalPoints !== 2) return false;
        if (filterLevel === '3' && s.finalPoints !== 1) return false;
        if (filterLevel === '0' && s.finalPoints !== 0) return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesId = s.studentId.includes(q);
        if (!matchesName && !matchesId) return false;
      }
      return true;
    });
  }, [studentCertificates, filterGrade, filterDept, filterMonth, filterLevel, searchQuery]);

  // 🟠 AGGREGATES: SCHOOL, GRADE AND DEPARTMENT STATISTICS
  const aggregateStats = useMemo(() => {
    const validStudents = studentCertificates.filter(s => !s.isExcluded);
    const totalCount = validStudents.length;
    const certifiedCount = validStudents.filter(s => s.isCertified).length;
    const certRate = totalCount > 0 ? parseFloat(((certifiedCount / totalCount) * 100).toFixed(1)) : 0;

    // School level counts
    const level1Count = validStudents.filter(s => s.finalPoints === 3).length;
    const level2Count = validStudents.filter(s => s.finalPoints === 2).length;
    const level3Count = validStudents.filter(s => s.finalPoints === 1).length;
    const failCount = totalCount - certifiedCount;

    // Averages
    const avgKor = totalCount > 0 ? Math.round(validStudents.reduce((sum, s) => sum + s.korSpeed, 0) / totalCount) : 0;
    const avgEng = totalCount > 0 ? Math.round(validStudents.reduce((sum, s) => sum + s.engSpeed, 0) / totalCount) : 0;

    // Grade comparison
    const grades = ['1', '2', '3'];
    const gradeStats = grades.map(g => {
      const list = validStudents.filter(s => {
        const sGradeNum = String(s.grade || '').replace(/[^0-9]/g, '');
        const targetGradeNum = String(g).replace(/[^0-9]/g, '');
        return sGradeNum === targetGradeNum;
      });
      const total = list.length;
      const certified = list.filter(s => s.isCertified).length;
      const rate = total > 0 ? parseFloat(((certified / total) * 105).toFixed(1)) : 0; // wait, let's keep it (certified / total) * 100
      const actualRate = total > 0 ? parseFloat(((certified / total) * 100).toFixed(1)) : 0;
      const korSpeedAvg = total > 0 ? Math.round(list.reduce((sum, s) => sum + s.korSpeed, 0) / total) : 0;
      const engSpeedAvg = total > 0 ? Math.round(list.reduce((sum, s) => sum + s.engSpeed, 0) / total) : 0;
      return { grade: g, total, certified, rate: actualRate, korSpeedAvg, engSpeedAvg };
    });

    // Department comparison
    const depts = Array.from(new Set(validStudents.map(s => {
      if (s.department.includes('항공')) return '항공서비스';
      if (s.department.includes('부사관')) return '부사관경영';
      if (s.department.includes('SNS') || s.department.includes('sns')) return 'SNS마케팅';
      if (s.department.includes('콘텐츠') || s.department.includes('컨텐츠')) return '콘텐츠디자인';
      return s.department;
    }))).filter(Boolean) as string[];
    const deptStats = depts.map(d => {
      const list = validStudents.filter(s => isDeptMatch(s.department, d));
      const total = list.length;
      const certified = list.filter(s => s.isCertified).length;
      const rate = total > 0 ? parseFloat(((certified / total) * 100).toFixed(1)) : 0;
      const korSpeedAvg = total > 0 ? Math.round(list.reduce((sum, s) => sum + s.korSpeed, 0) / total) : 0;
      const engSpeedAvg = total > 0 ? Math.round(list.reduce((sum, s) => sum + s.engSpeed, 0) / total) : 0;
      return { department: d, total, certified, rate, korSpeedAvg, engSpeedAvg };
    }).sort((a, b) => b.rate - a.rate); // Sort by certified achievement rate descending

    // 🏆 Class-level Unified rankings: Grade & Dept combinations (3 Grades * 4 Main Departments = 12 combinations)
    const activeGrades = ['1', '2', '3'];
    const activeDepts = ['항공서비스', '부사관경영', 'SNS마케팅', '콘텐츠디자인'];
    const classCombinedStats: {
      grade: string;
      department: string;
      displayName: string;
      total: number;
      korRate: number;
      engRate: number;
      korSpeedAvg: number;
      engSpeedAvg: number;
    }[] = [];

    activeGrades.forEach(g => {
      activeDepts.forEach(d => {
        const list = validStudents.filter(s => {
          const sGradeNum = String(s.grade || '').replace(/[^0-9]/g, '');
          const targetGradeNum = String(g).replace(/[^0-9]/g, '');
          return sGradeNum === targetGradeNum && isDeptMatch(s.department, d);
        });
        const total = list.length;
        const korSpeedAvg = total > 0 ? Math.round(list.reduce((sum, s) => sum + s.maxKorSpeed, 0) / total) : 0;
        const engSpeedAvg = total > 0 ? Math.round(list.reduce((sum, s) => sum + s.maxEngSpeed, 0) / total) : 0;
        
        // Korean certificate achievement is speed >= 150 (Level 3+)
        const korLevelCount = list.filter(s => s.maxKorSpeed >= 150).length;
        // English certificate achievement is speed >= 100 (Level 3+)
        const engLevelCount = list.filter(s => s.maxEngSpeed >= 100).length;

        const korRate = total > 0 ? parseFloat(((korLevelCount / total) * 100).toFixed(1)) : 0;
        const engRate = total > 0 ? parseFloat(((engLevelCount / total) * 100).toFixed(1)) : 0;

        classCombinedStats.push({
          grade: g,
          department: d,
          displayName: `${g}학년 ${d}`,
          total,
          korRate,
          engRate,
          korSpeedAvg,
          engSpeedAvg
        });
      });
    });

    const korRankings = [...classCombinedStats].sort((a, b) => b.korSpeedAvg - a.korSpeedAvg || b.total - a.total);
    const engRankings = [...classCombinedStats].sort((a, b) => b.engSpeedAvg - a.engSpeedAvg || b.total - a.total);

    // ③ FAILURE REASON ANALYTICS (Bottlenecks)
    const fails = validStudents.filter(s => !s.isCertified);
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
      combinedStats: classCombinedStats,
      korRankings,
      engRankings,
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
      const rawKorSpeedCandidates = korThisMonth.map(r => {
        const info = parseStudentIdInfo(r.studentId);
        const rGrade = r.grade && r.grade !== '기타' ? r.grade : info.grade;
        const rDept = normalizeDepartment(r.department && r.department !== '기타' && r.department !== '공통' ? r.department : info.department);
        return {
          studentId: r.studentId,
          name: r.name,
          grade: rGrade,
          department: rDept,
          value: r.speed
        };
      }).sort((a,b) => b.value - a.value);

      // 2. English Speed candidates
      const rawEngSpeedCandidates = engThisMonth.map(r => {
        const info = parseStudentIdInfo(r.studentId);
        const rGrade = r.grade && r.grade !== '기타' ? r.grade : info.grade;
        const rDept = normalizeDepartment(r.department && r.department !== '기타' && r.department !== '공통' ? r.department : info.department);
        return {
          studentId: r.studentId,
          name: r.name,
          grade: rGrade,
          department: rDept,
          value: r.speed
        };
      }).sort((a,b) => b.value - a.value);

      // 3. Korean Growth Candidates (June/6월 onwards)
      const rawKorGrowthCandidates: Winner[] = [];
      if (prevMonthName) {
        const korPrev = koreanDb.filter(r => r.month === prevMonthName);
        korThisMonth.forEach(curr => {
          const prev = korPrev.find(p => cleanStudentId(p.studentId) === cleanStudentId(curr.studentId));
          if (prev) {
            const diff = curr.speed - prev.speed;
            if (diff > 0) {
              const info = parseStudentIdInfo(curr.studentId);
              const rGrade = curr.grade && curr.grade !== '기타' ? curr.grade : info.grade;
              const rDept = normalizeDepartment(curr.department && curr.department !== '기타' && curr.department !== '공통' ? curr.department : info.department);
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

      // 4. English Growth Candidates (June/6월 onwards)
      const rawEngGrowthCandidates: Winner[] = [];
      if (prevMonthName) {
        const engPrev = englishDb.filter(r => r.month === prevMonthName);
        engThisMonth.forEach(curr => {
          const prev = engPrev.find(p => cleanStudentId(p.studentId) === cleanStudentId(curr.studentId));
          if (prev) {
            const diff = curr.speed - prev.speed;
            if (diff > 0) {
              const info = parseStudentIdInfo(curr.studentId);
              const rGrade = curr.grade && curr.grade !== '기타' ? curr.grade : info.grade;
              const rDept = normalizeDepartment(curr.department && curr.department !== '기타' && curr.department !== '공통' ? curr.department : info.department);
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

      // Selection logic prioritizing Top-1 for Speed (Kor/Eng) and Top-1 for Growth (Kor/Eng) per Grade (1, 2, 3)
      // total = up to 12 students. Avoid duplicating any student *within* this month + *across prior months*.
      const selectedWinners: typeof historyMap[string]['winners'] = [];
      const localSelectedSet = new Set<string>();

      const trySelectWinnerForGrade = (list: Winner[], gradeVal: string, reasonTag: string) => {
        for (let i = 0; i < list.length; i++) {
          const s = list[i];
          const cleanId = cleanStudentId(s.studentId);
          const sGradeNum = String(s.grade).replace(/[^0-9]/g, '');
          const targetGradeNum = String(gradeVal).replace(/[^0-9]/g, '');

          if (sGradeNum !== targetGradeNum) continue;
          if (isExcludedStudentName(s.name)) continue;

          // Filter out if they won in past months or are already selected this month
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
            break; // selected 1 for this grade & category combination, we are done
          }
        }
      };

      // Select chronologically:
      // A. Korean Speed (학년별 1명씩 = 총 3명)
      ['1', '2', '3'].forEach(g => {
        trySelectWinnerForGrade(rawKorSpeedCandidates, g, '한글 최고 속도');
      });

      // B. English Speed (학년별 1명씩 = 총 3명)
      ['1', '2', '3'].forEach(g => {
        trySelectWinnerForGrade(rawEngSpeedCandidates, g, '영어 최고 속도');
      });

      // C. Korean Growth (6월부터 학년별 1명씩 = 총 3명)
      if (prevMonthName) {
        ['1', '2', '3'].forEach(g => {
          trySelectWinnerForGrade(rawKorGrowthCandidates, g, '한글 최고 향상도');
        });
      }

      // D. English Growth (6월부터 학년별 1명씩 = 총 3명)
      if (prevMonthName) {
        ['1', '2', '3'].forEach(g => {
          trySelectWinnerForGrade(rawEngGrowthCandidates, g, '영어 최고 향상도');
        });
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
      const cleanId = cleanStudentId(sid);
      const sKor = koreanDb.filter(r => cleanStudentId(r.studentId) === cleanId).sort((a,b) => getMonthNumber(a.month) - getMonthNumber(b.month));
      const sEng = englishDb.filter(r => cleanStudentId(r.studentId) === cleanId).sort((a,b) => getMonthNumber(a.month) - getMonthNumber(b.month));

      const info = parseStudentIdInfo(sid);

      if (sKor.length > 0) {
        const maxVal = Math.max(...sKor.map(r => r.speed));
        const rGrade = sKor[0].grade && sKor[0].grade !== '기타' ? sKor[0].grade : info.grade;
        const rDept = normalizeDepartment(sKor[0].department && sKor[0].department !== '기타' && sKor[0].department !== '공통' ? sKor[0].department : info.department);

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
        const rGrade = sEng[0].grade && sEng[0].grade !== '기타' ? sEng[0].grade : info.grade;
        const rDept = normalizeDepartment(sEng[0].department && sEng[0].department !== '기타' && sEng[0].department !== '공통' ? sEng[0].department : info.department);

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
      // Sort the final 3 winners by grade ascending
      return result.sort((a, b) => a.grade.localeCompare(b.grade));
    };

    return {
      korSpeed: getTopPerGrade(korSpeeds),
      engSpeed: getTopPerGrade(engSpeeds),
      korGrowth: getTopPerGrade(korGrowths),
      engGrowth: getTopPerGrade(engGrowths)
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

  // ✨ 5. INTEGRATED STATS PRECOMPUTED MATRIX
  const integratedStats = useMemo(() => {
    const listMonths = ['5월', '6월', '7월', '8월', '9월', '10월'];
    const listGrades = ['1', '2', '3'];
    const listDepts = ['항공서비스', '부사관경영', 'SNS마케팅', '콘텐츠디자인'];

    const getAverageForCell = (lang: 'english' | 'korean', grade: string, dept: string, mStr: string) => {
      const db = lang === 'english' ? englishDb : koreanDb;
      const targetGradeNum = String(grade).replace(/[^0-9]/g, '');

      const filtered = db.filter(r => {
        const info = parseStudentIdInfo(r.studentId);
        const rGradeRaw = r.grade || info.grade;
        const rGradeNum = String(rGradeRaw).replace(/[^0-9]/g, '');
        const rDept = r.department && r.department !== '기타' && r.department !== '공통' ? r.department : info.department;

        return (
          rGradeNum === targetGradeNum && 
          !isExcludedStudentName(r.name) &&
          isDeptMatch(rDept, dept) && 
          getMonthNumber(r.month) === getMonthNumber(mStr)
        );
      });
      if (filtered.length === 0) return 0;
      const sum = filtered.reduce((acc, r) => acc + r.speed, 0);
      return Math.round(sum / filtered.length);
    };

    const getGradeAverage = (lang: 'english' | 'korean', grade: string, mStr: string) => {
      const db = lang === 'english' ? englishDb : koreanDb;
      const targetGradeNum = String(grade).replace(/[^0-9]/g, '');

      const filtered = db.filter(r => {
        const info = parseStudentIdInfo(r.studentId);
        const rGradeRaw = r.grade || info.grade;
        const rGradeNum = String(rGradeRaw).replace(/[^0-9]/g, '');

        return (
          rGradeNum === targetGradeNum && 
          !isExcludedStudentName(r.name) &&
          getMonthNumber(r.month) === getMonthNumber(mStr)
        );
      });
      if (filtered.length === 0) return 0;
      const sum = filtered.reduce((acc, r) => acc + r.speed, 0);
      return Math.round(sum / filtered.length);
    };

    const flexOverallAverage = (lang: 'english' | 'korean', mStr: string) => {
      const db = lang === 'english' ? englishDb : koreanDb;
      const filtered = db.filter(r => 
        !isExcludedStudentName(r.name) &&
        getMonthNumber(r.month) === getMonthNumber(mStr)
      );
      if (filtered.length === 0) return 0;
      const sum = filtered.reduce((acc, r) => acc + r.speed, 0);
      return Math.round(sum / filtered.length);
    };

    // Compact layout mapping -> full display per request
    const mapDisplayName = (d: string) => {
      if (d === '항공' || d === '항공서비스') return '항공서비스';
      if (d === '부사관' || d === '부사관경영') return '부사관경영';
      if (d === 'SNS' || d === 'SNS마케팅') return 'SNS마케팅';
      if (d === '콘텐츠' || d === '콘텐츠디자인' || d === '컨텐츠') return '콘텐츠디자인';
      return d;
    };

    // Prepare grid data for english and korean
    const compileGrid = (lang: 'english' | 'korean') => {
      const rows: { grade: string; dept: string; label: string; values: number[] }[] = [];
      
      // 12 department rows
      listGrades.forEach(g => {
        listDepts.forEach(d => {
          const values = listMonths.map(m => getAverageForCell(lang, g, d, m));
          rows.push({
            grade: g,
            dept: d,
            label: `${g}학년 ${mapDisplayName(d)}`,
            values
          });
        });
      });

      // 3 Grade average rows
      const gradeAverages = listGrades.map(g => {
        const values = listMonths.map(m => getGradeAverage(lang, g, m));
        return {
          label: `${g}학년 평균`,
          values
        };
      });

      // Total average row
      const overallAverage = {
        label: '전체 평균',
        values: listMonths.map(m => flexOverallAverage(lang, m))
      };

      return {
        rows,
        gradeAverages,
        overallAverage
      };
    };

    return {
      months: listMonths,
      english: compileGrid('english'),
      korean: compileGrid('korean')
    };
  }, [englishDb, koreanDb]);

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
              : 'border-transparent text-stone-400 hover:text-stone-750'
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
          <span>인비 챌린지 타자 성장 그래프</span>
        </button>

        <button
          onClick={() => setActiveTab('integrated_stats')}
          className={`px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
            activeTab === 'integrated_stats' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-stone-400 hover:text-stone-700'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>학년·학과 통합 수련현황</span>
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

              {/* Grid 2 Column: Left Bottleneck | Right Level Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left Column: Failure bottleneck analysis */}
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
                            <span>한글/영어 모두 미달 (복합 누적 요인)</span>
                            <span className="font-mono text-rose-600">{aggregateStats.bottleneck.bothRate}% <span className="text-stone-400 font-normal">({aggregateStats.bottleneck.bothCount}명)</span></span>
                          </div>
                          <div className="h-3.5 w-full bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full bg-stone-400 rounded-full" style={{ width: `${aggregateStats.bottleneck.bothRate}%` }} />
                          </div>
                          <p className="text-[10px] text-stone-400">한글(150타 미만) 및 영어(100타 미만) 둘 다 최저 미충족</p>
                        </div>

                      </div>

                    </div>
                  )}
                </div>

                {/* Right Column: Level Distribution Ratios Card */}
                <div className="bg-white rounded-2xl border border-stone-200/60 p-6 space-y-4 shadow-2xs flex flex-col justify-between">
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-stone-900 tracking-wider uppercase pb-2 border-b border-stone-100">
                      인비 챌린지 최종 자격급수 보유 통계
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-4 bg-rose-50 border border-slate-100 rounded-2xl animate-fade-in">
                        <span className="text-[11px] font-bold text-rose-600 block">1급 인증 🥇</span>
                        <span className="text-2xl font-black text-rose-800 font-mono mt-0.5 inline-block">{aggregateStats.level1Count}명</span>
                      </div>
                      <div className="p-4 bg-amber-50 border border-slate-100 rounded-2xl animate-fade-in">
                        <span className="text-[11px] font-bold text-amber-600 block">2급 인증 🥈</span>
                        <span className="text-2xl font-black text-amber-800 font-mono mt-0.5 inline-block">{aggregateStats.level2Count}명</span>
                      </div>
                      <div className="p-4 bg-emerald-50 border border-slate-100 rounded-2xl animate-fade-in">
                        <span className="text-[11px] font-bold text-emerald-600 block">3급 인증 🥉</span>
                        <span className="text-2xl font-black text-emerald-800 font-mono mt-0.5 inline-block">{aggregateStats.level3Count}명</span>
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl animate-fade-in">
                        <span className="text-[11px] font-bold text-slate-550 block">급수 없음 🚫</span>
                        <span className="text-2xl font-black text-slate-700 font-mono mt-0.5 inline-block">{aggregateStats.failCount}명</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-[11px] text-indigo-850 font-medium leading-relaxed font-sans mt-4">
                    💡 <strong>인증 달성 팁:</strong> 학생들의 한글 타수와 영어 타수 모두가 자격 기준을 통과해야 인증서가 정상 발급됩니다. 미달 요인 학생들을 파악하여 지도해 보세요.
                  </div>
                </div>

              </div>

              {/* Student detail lookup table inside teacher area */}
              <div id="student-record-master" className="bg-white rounded-2xl border border-stone-200/60 p-6 space-y-6 shadow-2xs overflow-hidden">
                
                {/* Header with KPI count */}
                <div className="flex justify-between items-center flex-wrap gap-3 pb-3 border-b border-stone-100">
                  <div className="space-y-1">
                    <h4 className="text-[13px] font-black text-stone-900 tracking-wider uppercase flex items-center gap-1.5 font-sans">
                      <UserCheck className="h-4 w-4 text-indigo-600" />
                      전교(학년/학과) 학생 타자 급수 명단
                    </h4>
                    <p className="text-[11px] text-stone-400 font-sans">전체 학생의 한글/영어 누적 최고 성적 대조서입니다.</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-stone-400 font-bold block">조건 필터링 결과</span>
                    <strong className="text-lg font-mono font-black text-indigo-700">{filteredStudents.length} </strong>
                    <span className="text-xs text-stone-500 font-bold">/ {studentCertificates.length}명</span>
                  </div>
                </div>

                {/* Unified Interactive Filter Console */}
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                  
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    
                    {/* Grade Selector Group */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-stone-450 uppercase tracking-wider block">학년 선택 필터</span>
                      <div className="flex gap-1">
                        {['all', '1', '2', '3'].map((g) => (
                          <button
                            key={g}
                            onClick={() => setFilterGrade(g)}
                            className={`flex-1 py-1.5 text-xs font-black rounded-lg border transition-all ${
                              filterGrade === g 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' 
                                : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                            }`}
                          >
                            {g === 'all' ? '전체' : `${g}학년`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Department Dropdown / Badges */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-stone-450 uppercase tracking-wider block">학과 선택 필터</span>
                      <select
                        value={filterDept}
                        onChange={(e) => setFilterDept(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs font-bold text-stone-700 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="all">전체 학과</option>
                        {availableDepts.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    {/* Achievement Month Filter */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-stone-450 uppercase tracking-wider block font-sans">인증 달성월 필터</span>
                      <select
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs font-bold text-stone-700 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="all">전체 (달성+미달)</option>
                        <option value="미달">미달성 상태</option>
                        {availableAchievementMonths.map((m) => (
                          <option key={m} value={m}>{m} 달성자</option>
                        ))}
                      </select>
                    </div>

                    {/* Certificate Level (급수) Filter */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-stone-450 uppercase tracking-wider block font-sans">급수 취득 필터</span>
                      <select
                        value={filterLevel}
                        onChange={(e) => setFilterLevel(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs font-bold text-stone-700 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="all">전체 급수</option>
                        <option value="1">1급 취득자</option>
                        <option value="2">2급 취득자</option>
                        <option value="3">3급 취득자</option>
                        <option value="0">급수 미취득</option>
                      </select>
                    </div>

                    {/* Search Field */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-stone-450 uppercase tracking-wider block font-sans">이름 / 학번 검색</span>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-stone-400">
                          <Search className="h-3.5 w-3.5" />
                        </span>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="학생 이름 또는 학번 검색..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-stone-200 rounded-lg bg-white placeholder-stone-400 text-stone-700 focus:outline-none focus:border-indigo-500 font-bold font-sans"
                        />
                      </div>
                    </div>

                  </div>

                </div>

                <div className="overflow-x-auto min-w-full rounded-xl border border-stone-100 font-sans">
                  <table className="w-full text-xs text-left text-stone-600">
                    <thead className="bg-stone-50 text-[10px] text-stone-400 uppercase tracking-wider border-b border-stone-100">
                      <tr>
                        <th className="py-2.5 px-3 text-center">학번</th>
                        <th className="py-2.5 px-3">이름</th>
                        <th className="py-2.5 px-3">학년/학과</th>
                        <th className="py-2.5 px-3">한글 타수(급수)</th>
                        <th className="py-2.5 px-3">영어 타수(급수)</th>
                        <th className="py-2.5 px-3 text-center">최종 인증 획득월</th>
                        <th className="py-2.5 px-3 text-right">최종 인증 등급 (급수 및 타수)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-stone-400 font-semibold">
                            지정한 조건 조회의 필터 결과와 부합하는 학생이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((s, idx) => {
                          let displayFinal = '';
                          if (s.finalPoints === 3) displayFinal = '🥇 타자 1급';
                          else if (s.finalPoints === 2) displayFinal = '🥈 타자 2급';
                          else if (s.finalPoints === 1) displayFinal = '🥉 타자 3급';
                          else displayFinal = '급수 없음 (연습 중)';

                          return (
                            <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-2.5 px-3 text-center font-mono text-stone-900 font-extrabold">{s.studentId}</td>
                              <td className="py-2.5 px-3 font-bold text-stone-850 text-[13px]">{s.name}</td>
                              <td className="py-2.5 px-3 text-stone-500 font-medium">{s.grade}학년 / {s.department}</td>
                              <td className="py-2.5 px-3">
                                <span className="font-mono font-bold text-amber-700 text-[12.5px]">{s.korSpeed}타</span>
                                <span className={`ml-1 px-1.5 py-0.2 text-[9.5px] rounded-md font-bold ${
                                  s.korPoints === 3 ? 'bg-amber-50 text-amber-700' :
                                  s.korPoints === 2 ? 'bg-slate-100 text-slate-700' :
                                  s.korPoints === 1 ? 'bg-orange-50 text-orange-700' :
                                  'bg-stone-100 text-stone-400'
                                }`}>
                                  {getLevelName(s.korPoints)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-mono font-bold text-violet-755 text-[12.5px]">{s.engSpeed}타</span>
                                <span className={`ml-1 px-1.5 py-0.2 text-[9.5px] rounded-md font-bold ${
                                  s.engPoints === 3 ? 'bg-amber-50 text-amber-700' :
                                  s.engPoints === 2 ? 'bg-slate-105 text-slate-700' :
                                  s.engPoints === 1 ? 'bg-orange-50 text-orange-705' :
                                  'bg-stone-100 text-stone-400'
                                }`}>
                                  {getLevelName(s.engPoints)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {s.levelAchievedMonth !== '-' ? (
                                  <span className="font-black text-indigo-755 bg-indigo-50 border border-indigo-100/60 px-2 py-0.5 rounded-md text-[10.5px]">
                                    {s.levelAchievedMonth} 달성
                                  </span>
                                ) : (
                                  <span className="text-stone-350 text-[11px]">-</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span className={`inline-block px-3 py-1.5 font-black rounded-lg border text-[13.5px] leading-tight ${
                                  s.finalPoints === 3 ? 'bg-amber-50 text-amber-850 border-amber-200' :
                                  s.finalPoints === 2 ? 'bg-slate-50 text-slate-800 border-slate-200' :
                                  s.finalPoints === 1 ? 'bg-orange-50/80 text-orange-850 border-orange-200' :
                                  'bg-stone-50 text-stone-400 border-stone-200/80'
                                }`}>
                                  {displayFinal}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
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
                  매달 시상 시 <strong>이미 이전 달에 한 번이라도 간식을 받은 학생은 순위권에서 제외</strong>됩니다. 
                  보상은 다음 순위 학생(4위, 5위...)에게 돌아갑니다. 
                  아래에서 월(5월~10월)을 누르시면 해당 월의 <strong>간식 당첨 학생 6명</strong> 및 사유와 제외된 후보 명단을 확인하실 수 있습니다.
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
                      한글 타자 최고 타수 (최종 3명)
                    </h4>

                    <div className="space-y-2.5">
                      {cumulativeFinalAwards.korSpeed.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-rose-50/40 border border-rose-100 flex-row text-xs">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-rose-200 text-rose-800 text-[10px] font-black">
                              {s.grade}학년 1위
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
                      영어 타자 최고 타수 (최종 3명)
                    </h4>

                    <div className="space-y-2.5">
                      {cumulativeFinalAwards.engSpeed.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/40 border border-indigo-100 flex-row text-xs">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-200 text-indigo-850 text-[10px] font-black">
                              {s.grade}학년 1위
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
                      한글 타자 최고 향상 (최종 3명)
                    </h4>

                    <div className="space-y-2.5">
                      {cumulativeFinalAwards.korGrowth.length === 0 ? (
                        <p className="text-center text-xs text-stone-400 py-8 leading-normal">성장 기록 측정을 위한 2회차 이상의<br/>기록 입력 축적이 필요합니다.</p>
                      ) : (
                        cumulativeFinalAwards.korGrowth.map((s, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/40 border border-emerald-100 flex-row text-xs">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-200 text-emerald-800 text-[10px] font-black">
                                {s.grade}학년 1위
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
                      영어 타자 최고 향상 (최종 3명)
                    </h4>

                    <div className="space-y-2.5">
                      {cumulativeFinalAwards.engGrowth.length === 0 ? (
                        <p className="text-center text-xs text-stone-400 py-8 leading-normal">성장 기록 측정을 위한 2회차 이상의<br/>기록 입력 축적이 필요합니다.</p>
                      ) : (
                        cumulativeFinalAwards.engGrowth.map((s, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/40 border border-emerald-100 flex-row text-xs">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-200 text-emerald-800 text-[10px] font-black">
                                {s.grade}학년 1위
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
                  <h4 className="text-xs font-black text-stone-900 tracking-wider uppercase font-sans">
                    학기 수련 타자 프로그램 도입 전교생 효과 분석 흐름
                  </h4>
                  <p className="text-[10px] text-stone-400 font-medium font-sans">5월 기준 우상향 선 차트 및 각 월별 실제 수련 실적 바 차트 연계</p>
                </div>
                <span className="inline-flex items-center gap-1 bg-emerald-55 text-emerald-700 text-[9px] border px-2.5 py-1 rounded-lg font-black font-sans">
                  인비 챌린지 검정 효과 분석 입증용 🚀
                </span>
              </div>

              {/* Graphical Plot container */}
              {growthTrendsTimeline.length < 2 ? (
                <div className="text-center py-16 text-stone-400 text-xs font-sans">
                  최소 2개 이상의 월별 훈련 기록이 입력되면 성장 우상향 곡선이 즉각 표기됩니다.
                </div>
              ) : (
                <div className="space-y-6">
                  
                  {/* Interactive Indicator */}
                  <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs flex flex-col md:flex-row md:justify-between md:items-center gap-2 text-[11px] font-medium leading-relaxed font-sans text-indigo-900/90">
                    <p>
                      💡 <strong>전교생 분석 결과:</strong> 5월 도입 이래, 평균 한글 타수는 
                      <strong className="text-indigo-650 mx-1 font-mono font-bold">
                        {growthTrendsTimeline[0].korAvg}타 ➡️ {growthTrendsTimeline[growthTrendsTimeline.length - 1].korAvg}타
                      </strong> 
                      ({growthTrendsTimeline[growthTrendsTimeline.length - 1].korAvg - growthTrendsTimeline[0].korAvg}타 우상향), 
                      영문 타수는 
                      <strong className="text-indigo-650 mx-1 font-mono font-bold">
                        {growthTrendsTimeline[0].engAvg}타 ➡️ {growthTrendsTimeline[growthTrendsTimeline.length - 1].engAvg}타
                      </strong> 
                      ({growthTrendsTimeline[growthTrendsTimeline.length - 1].engAvg - growthTrendsTimeline[0].engAvg}타 우상향)으로 집계되었습니다. 
                      타자 훈련 검정 체계 연동 효과가 완벽히 입증되고 있습니다.
                    </p>
                  </div>

                  {/* 2-Column Bento Layout for Trend Graph & May baseline analysis stats */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left/Middle Column: Large hybrid SVG graph */}
                    <div id="growth-hybrid-graph-container" className="lg:col-span-2 relative bg-slate-50 border border-slate-100 rounded-2xl p-6 h-76 flex flex-col justify-between select-none">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider font-sans">성장 곡선 및 월별 수련 결과 (라인 + 막대 하이브리드)</span>
                        <div className="flex gap-3 text-[9px] font-black font-sans">
                          <span className="flex items-center gap-1 text-purple-700">🟣 한글선</span>
                          <span className="flex items-center gap-1 text-indigo-700">🔵 영어선</span>
                          <span className="flex items-center gap-1 text-stone-400">📊 월실제막대 (5월 포함)</span>
                        </div>
                      </div>

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
                              return { x, y, val: t.korAvg };
                            });

                            const engPoints = growthTrendsTimeline.map((t, idx) => {
                              const x = (idx / (growthTrendsTimeline.length - 1)) * 100;
                              const y = 100 - (((t.engAvg - minSpeed) / range) * 100);
                              return { x, y, val: t.engAvg };
                            });

                            const korD = korPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                            const engD = engPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                            return (
                              <>
                                {/* Translucent Bar Columns for exact month values (including May) in the background */}
                                {korPoints.map((p, idx) => (
                                  <rect
                                    key={`kor-bar-${idx}`}
                                    x={Math.max(0, p.x - 2.8)}
                                    y={Math.min(100, p.y)}
                                    width="2.2"
                                    height={Math.max(0, 100 - p.y)}
                                    fill="#b084f4"
                                    opacity="0.18"
                                    rx="0.5"
                                  />
                                ))}
                                {engPoints.map((p, idx) => (
                                  <rect
                                    key={`eng-bar-${idx}`}
                                    x={Math.min(98, p.x + 0.6)}
                                    y={Math.min(100, p.y)}
                                    width="2.2"
                                    height={Math.max(0, 100 - p.y)}
                                    fill="#6366f1"
                                    opacity="0.18"
                                    rx="0.5"
                                  />
                                ))}

                                {/* Han/Kor Area and Line - styled beautifully in purple */}
                                <path d={`${korD} L 100 100 L 0 100 Z`} fill="url(#purpleLinearGrad2)" opacity="0.06" />
                                <path d={korD} fill="none" stroke="#9333ea" strokeWidth="2.5" strokeLinecap="round" />

                                {/* Eng Area and Line - styled in indigo */}
                                <path d={`${engD} L 100 100 L 0 100 Z`} fill="url(#indigoLinearGrad2)" opacity="0.06" />
                                <path d={engD} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" />

                                {/* Interactive dots with tooltip markings for Purple (Han) */}
                                {korPoints.map((p, idx) => (
                                  <g key={`kp-dot-${idx}`}>
                                    <circle cx={p.x} cy={p.y} r="3.5" fill="#9333ea" stroke="white" strokeWidth="1.5" />
                                    {/* May Highlight Flag */}
                                    {idx === 0 && (
                                      <g>
                                        <rect x="0.5" y={p.y - 12} width="16" height="7.5" fill="#9333ea" rx="1.5" />
                                        <text x="8" y={p.y - 7} fill="white" fontSize="4.5" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">시작점</text>
                                      </g>
                                    )}
                                  </g>
                                ))}

                                {/* Interactive dots for Indigo (Eng) */}
                                {engPoints.map((p, idx) => (
                                  <g key={`ep-dot-${idx}`}>
                                    <circle cx={p.x} cy={p.y} r="3.5" fill="#4f46e5" stroke="white" strokeWidth="1.5" />
                                    {/* May Highlight Flag */}
                                    {idx === 0 && (
                                      <g>
                                        <rect x="0.5" y={p.y + 4} width="16" height="7.5" fill="#4f46e5" rx="1.5" />
                                        <text x="8" y={p.y + 9} fill="white" fontSize="4.5" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">5월 영어</text>
                                      </g>
                                    )}
                                  </g>
                                ))}

                                {/* Grad Gradients */}
                                <defs>
                                  <linearGradient id="purpleLinearGrad2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#9333ea" />
                                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                                  </linearGradient>
                                  <linearGradient id="indigoLinearGrad2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#4f46e5" />
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
                              <span className="text-purple-700 font-extrabold">{t.month === '5월' ? '⭐ ' : ''}한: {t.korAvg}타</span>
                              <span className="text-indigo-700 font-extrabold">영: {t.engAvg}타</span>
                            </div>
                            <span className={`text-[10px] font-bold block ${t.month === '5월' ? 'text-indigo-600 font-black' : 'text-stone-400'}`}>
                              {t.month === '5월' ? '5월 (도입)' : t.month}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Column: Prominent May Baseline Result Card */}
                    <div id="may-baseline-results-widget" className="bg-gradient-to-br from-indigo-50/40 to-stone-50 border border-stone-200/85 rounded-2xl p-4 space-y-4 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 pb-1 border-b border-indigo-100/60">
                          <span className="text-xs">📅</span>
                          <h5 className="text-[11.5px] font-black text-slate-800 uppercase tracking-wider font-sans">
                            도입월(현재 5월) 실적 결과 심층 분석
                          </h5>
                        </div>

                        <p className="text-[11px] text-stone-500 leading-relaxed font-sans">
                          프로그램 도입 최초 시점인 <strong>5월 검정 결과</strong>는 수련 전 기준 성적(Baseline) 역할을 수행하며, 학생 성장 곡선의 시작 좌표가 됩니다.
                        </p>

                        {/* May Key Metrics Indicators */}
                        <div className="grid grid-cols-2 gap-2 font-sans">
                          <div className="p-2.5 bg-white border border-stone-150 rounded-xl">
                            <span className="text-[9.5px] font-bold text-purple-600 block">5월 한글 평균</span>
                            <span className="text-sm font-black font-mono text-purple-950">
                              {growthTrendsTimeline.find(t => t.month === '5월')?.korAvg || 0}타
                            </span>
                          </div>
                          <div className="p-2.5 bg-white border border-stone-150 rounded-xl">
                            <span className="text-[9.5px] font-bold text-indigo-600 block">5월 영어 평균</span>
                            <span className="text-sm font-black font-mono text-indigo-950">
                              {growthTrendsTimeline.find(t => t.month === '5월')?.engAvg || 0}타
                            </span>
                          </div>
                        </div>

                        {/* 5월 급수 취득 비중 */}
                        <div className="p-3 bg-white border border-stone-150 rounded-xl space-y-1.5 font-sans">
                          <span className="text-[10px] font-extrabold text-stone-500 block">🏆 5월 인증 통과 우수생 비율</span>
                          <div className="space-y-1 text-[10px]">
                            {(() => {
                              const mayAchievers = studentCertificates.filter(s => s.achievementMonth === '5월');
                              const totalCount = studentCertificates.length || 1;
                              const ratioOfTotal = Math.round((mayAchievers.length / totalCount) * 100);
                              
                              const num1 = mayAchievers.filter(s => s.finalLevel === '1급').length;
                              const num2 = mayAchievers.filter(s => s.finalLevel === '2급').length;
                              const num3 = mayAchievers.filter(s => s.finalLevel === '3급').length;

                              return (
                                <>
                                  <div className="flex justify-between items-center text-stone-700">
                                    <span>5월 인증서 취득</span>
                                    <span className="font-extrabold font-mono text-stone-900">{mayAchievers.length}명 ({ratioOfTotal}%)</span>
                                  </div>
                                  <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden mt-0.5">
                                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${ratioOfTotal}%` }} />
                                  </div>
                                  <div className="flex justify-between text-[8.5px] text-stone-400 font-bold pt-1">
                                    <span>1급: {num1}명</span>
                                    <span>2급: {num2}명</span>
                                    <span>3급: {num3}명</span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="text-[9.5px] font-bold text-stone-400 bg-stone-100/50 p-2 rounded-lg font-sans border border-dashed text-center">
                        ✔️ 5월 기준 결과는 매칭 필터의 기준축입니다.
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          )}

              {/* 📊 TAB 5: INTEGRATED RESULTS PANEL BY GRADE & DEPT */}
              {activeTab === 'integrated_stats' && (
                <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-6 shadow-xs animate-fade-in">
                  <div className="flex justify-between items-center pb-3 border-b border-stone-100">
                    <div>
                      <h4 className="text-sm font-black text-stone-900 tracking-wider uppercase">
                        학년·학과 통합 수련 현황 (랭킹 및 누적 통계)
                      </h4>
                      <p className="text-[10.5px] text-stone-400 font-medium">학년·학과별 최고 타수 기준 평균 랭킹 및 5월~10월 월별 실시간 평균 수집 현황을 모니터링합니다.</p>
                    </div>
                    <div className="shrink-0 text-right bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-xl font-sans text-[10px] text-purple-755 font-bold">
                      <span>2026 전체 통합 통계</span>
                    </div>
                  </div>

                  {/* 👑 학년·학과별 최고 타수 평균 랭킹 (재적 인원 기준) */}
                  <div className="bg-amber-50/50 border border-amber-200/65 rounded-2xl p-5 space-y-2 text-xs">
                    <span className="font-black text-amber-850 flex items-center gap-1.5 uppercase font-sans">
                      <Trophy className="h-4 w-4 text-amber-600 animate-bounce" />
                      ★ 학급별 평균 수련 랭킹 정렬 안내 (개별 최고타수 기준)
                    </span>
                    <p className="text-[11.2px] text-amber-800 font-medium leading-relaxed font-sans">
                      각 학생의 <strong>전체 기간 최고 타수</strong>를 기준으로 산출한 반별 평균속도 랭킹입니다. 한글(150타 이상), 영어(100타 이상) 급수 취득 비율이 개별 표시되며 재적 인원만 정밀 산정됩니다.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-stone-50/40 p-4 border border-stone-150 rounded-2xl">
                    
                    {/* 1. Korean Rankings (Purple) */}
                    <div className="bg-white rounded-xl border border-purple-200/60 p-5 space-y-3.5 shadow-2xs">
                      <div className="flex justify-between items-center pb-2 border-b border-purple-100">
                        <h4 className="text-xs font-black text-purple-900 tracking-wider uppercase flex items-center gap-1.5">
                          <Trophy className="h-3.5 w-3.5 text-purple-600 animate-pulse" />
                          한글 타자 학급 순위 (최고 타수 평균)
                        </h4>
                      </div>

                      <div className="divide-y divide-purple-100 max-h-[380px] overflow-y-auto pr-1 space-y-2.5 font-sans">
                        {aggregateStats.korRankings.map((item, idx) => {
                          const medalEmoji = idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
                          return (
                            <div key={idx} className="pt-2.5 first:pt-0 space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="flex items-center gap-1.5">
                                  <span className={`w-5 h-5 rounded-md border text-[10px] font-black flex items-center justify-center ${
                                    idx === 0 ? 'bg-purple-100 border-purple-200 text-purple-800' : 
                                    idx === 1 ? 'bg-slate-100 border-slate-200 text-slate-750' : 
                                    idx === 2 ? 'bg-orange-50 border-orange-100 text-orange-750' : 
                                    'bg-stone-50 border-stone-150 text-stone-600'
                                  }`}>
                                    {idx + 1}
                                  </span>
                                  <span className="font-black text-stone-850 text-[12px] font-sans">
                                    {item.displayName} {medalEmoji}
                                  </span>
                                </span>
                                <span className="font-mono font-extrabold text-purple-700 bg-purple-55 px-2 py-0.5 rounded border border-purple-100/70 text-[11px]">
                                  평균: {item.korSpeedAvg}타
                                </span>
                              </div>

                              <div className="h-1.5 w-full bg-slate-100 border border-slate-150 rounded-full overflow-hidden font-sans">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 bg-purple-600`} 
                                  style={{ width: `${Math.min(100, (item.korSpeedAvg / 450) * 100)}%` }}
                                />
                              </div>

                              <div className="flex justify-between text-[10px] text-stone-450 font-mono pl-6 font-sans">
                                <span className="font-sans font-bold">재적 인원: {item.total}명</span>
                                <span className="text-purple-600 font-extrabold font-sans">한글 급수 취득 비율: {item.korRate}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. English Rankings (Indigo) */}
                    <div className="bg-white rounded-xl border border-indigo-200/60 p-5 space-y-3.5 shadow-2xs">
                      <div className="flex justify-between items-center pb-2 border-b border-indigo-100">
                        <h4 className="text-xs font-black text-indigo-900 tracking-wider uppercase flex items-center gap-1.5">
                          <Trophy className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
                          영어 타자 학급 순위 (최고 타수 평균)
                        </h4>
                      </div>

                      <div className="divide-y divide-indigo-100 max-h-[380px] overflow-y-auto pr-1 space-y-2.5 font-sans">
                        {aggregateStats.engRankings.map((item, idx) => {
                          const medalEmoji = idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
                          return (
                            <div key={idx} className="pt-2.5 first:pt-0 space-y-1 font-sans">
                              <div className="flex justify-between items-center text-xs">
                                <span className="flex items-center gap-1.5 font-sans">
                                  <span className={`w-5 h-5 rounded-md border text-[10px] font-black flex items-center justify-center ${
                                    idx === 0 ? 'bg-indigo-100 border-indigo-200 text-indigo-800' : 
                                    idx === 1 ? 'bg-slate-100 border-slate-200 text-slate-750' : 
                                    idx === 2 ? 'bg-orange-50 border-orange-100 text-orange-750' : 
                                    'bg-stone-50 border-stone-150 text-stone-600'
                                  }`}>
                                    {idx + 1}
                                  </span>
                                  <span className="font-black text-stone-850 text-[12px] font-sans">
                                    {item.displayName} {medalEmoji}
                                  </span>
                                </span>
                                <span className="font-mono font-extrabold text-indigo-700 bg-indigo-55 px-2 py-0.5 rounded border border-indigo-100/70 text-[11px]">
                                  평균: {item.engSpeedAvg}타
                                </span>
                              </div>

                              <div className="h-1.5 w-full bg-slate-100 border border-slate-150 rounded-full overflow-hidden font-sans">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 bg-indigo-600`} 
                                  style={{ width: `${Math.min(100, (item.engSpeedAvg / 250) * 100)}%` }}
                                />
                              </div>

                              <div className="flex justify-between text-[10px] text-stone-450 font-mono pl-6 font-sans">
                                <span className="font-sans font-bold">재적 인원: {item.total}명</span>
                                <span className="text-indigo-600 font-extrabold font-sans">영어 급수 취득 비율: {item.engRate}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                  {/* Stacked Full Width Layout (No more cramming into col-span-2 side-by-side, no horizontal scrolls!) */}
                  <div className="space-y-8 col-span-2">
                    
                    {/* 1. KOREAN SECTION (PLACED FIRST) - SEAMLESS ELEGANT PURPLE */}
                    <div className="border border-purple-100 rounded-2xl p-4 bg-purple-50/10 space-y-3">
                      <div className="flex items-center gap-2 border-b border-purple-100/50 pb-2">
                        <span className="w-2.5 h-2.5 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-full animate-pulse" />
                        <h5 className="text-xs font-black text-stone-850 tracking-wider flex items-center gap-1">
                          한글 타수 현황판 <span className="text-[10px] text-purple-600 font-bold font-mono">(Korean Typing Speed)</span>
                        </h5>
                      </div>
                      
                      <div className="overflow-x-auto rounded-xl border border-purple-100/70 shadow-2xs">
                        <table className="w-full text-left text-xs text-stone-700 border-collapse table-auto">
                          <thead>
                            <tr className="bg-purple-50/70 text-purple-950 font-bold border-b border-purple-150 text-[11px]">
                              <th className="py-3 px-3 text-center border-r border-purple-150 font-black">학년/학과</th>
                              {integratedStats.months.map((m, idx) => (
                                <th key={idx} className="py-3 px-2 text-center font-black">{m}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-100/70">
                            {/* 12 Departments */}
                            {integratedStats.korean.rows.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-purple-50/40 transition-colors">
                                <td className="py-2.5 px-3 bg-purple-50/20 text-stone-800 font-bold text-[11px] border-r border-purple-100 font-sans truncate text-center">
                                  {row.label}
                                </td>
                                {row.values.map((val, vIdx) => (
                                  <td key={vIdx} className="py-2.5 px-2 text-center font-mono text-[12px]">
                                    {val > 0 ? (
                                      <span className="font-bold text-purple-950">{val}타</span>
                                    ) : (
                                      <span className="text-stone-300">-</span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}

                            {/* Spacer line */}
                            <tr className="bg-purple-100/30 font-bold">
                              <td colSpan={7} className="py-[1px] px-0 bg-purple-150"></td>
                            </tr>

                            {/* Grade Averages */}
                            {integratedStats.korean.gradeAverages.map((row, rIdx) => (
                              <tr key={rIdx} className="bg-purple-50/50 hover:bg-purple-100/30 transition-colors border-t border-purple-100 font-bold">
                                <td className="py-2.5 px-3 bg-purple-105/20 text-purple-800 font-black text-[11px] border-r border-purple-100 text-center font-sans">
                                  {row.label}
                                </td>
                                {row.values.map((val, vIdx) => (
                                  <td key={vIdx} className="py-2.5 px-2 text-center font-mono text-[12px] text-purple-900 font-extrabold">
                                    {val > 0 ? `${val}타` : '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}

                            {/* Overall Average */}
                            <tr className="bg-gradient-to-r from-purple-700 to-indigo-750 font-black text-white text-[11.5px] border-t-2 border-purple-800">
                              <td className="py-3 px-3 bg-purple-850 text-white font-black text-[11px] border-r border-purple-800 text-center font-sans tracking-wide">
                                {integratedStats.korean.overallAverage.label}
                              </td>
                              {integratedStats.korean.overallAverage.values.map((val, vIdx) => (
                                <td key={vIdx} className="py-3 px-2 text-center font-mono text-[12px] text-white font-black">
                                  {val > 0 ? `${val}타` : '-'}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 2. ENGLISH SECTION (PLACED SECOND) - SEAMLESS ELEGANT INDIGO */}
                    <div className="border border-stone-200 rounded-2xl p-4 bg-stone-55/10 space-y-3">
                      <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
                        <span className="w-2.5 h-2.5 bg-gradient-to-tr from-indigo-600 to-sky-500 rounded-full animate-pulse" />
                        <h5 className="text-xs font-black text-stone-850 tracking-wider flex items-center gap-1">
                          영어 타수 현황판 <span className="text-[10px] text-indigo-600 font-bold font-mono">(English Typing Speed)</span>
                        </h5>
                      </div>
                      
                      <div className="overflow-x-auto rounded-xl border border-stone-200 shadow-2xs">
                        <table className="w-full text-left text-xs text-stone-700 border-collapse table-auto">
                          <thead>
                            <tr className="bg-stone-50 text-stone-600 font-bold border-b border-stone-200 text-[11px]">
                              <th className="py-3 px-3 text-center border-r border-stone-200 font-black">학년/학과</th>
                              {integratedStats.months.map((m, idx) => (
                                <th key={idx} className="py-3 px-2 text-center font-black">{m}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-150">
                            {/* 12 Departments */}
                            {integratedStats.english.rows.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-indigo-50/20 transition-colors">
                                <td className="py-2.5 px-3 bg-stone-50 text-stone-800 font-bold text-[11px] border-r border-stone-150 font-sans truncate text-center">
                                  {row.label}
                                </td>
                                {row.values.map((val, vIdx) => (
                                  <td key={vIdx} className="py-2.5 px-2 text-center font-mono text-[12px]">
                                    {val > 0 ? (
                                      <span className="font-bold text-indigo-950">{val}타</span>
                                    ) : (
                                      <span className="text-stone-300">-</span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}

                            {/* Spacer line */}
                            <tr className="bg-stone-100/40">
                              <td colSpan={7} className="py-[1px] px-0 bg-stone-200"></td>
                            </tr>

                            {/* Grade Averages */}
                            {integratedStats.english.gradeAverages.map((row, rIdx) => (
                              <tr key={rIdx} className="bg-indigo-50/35 hover:bg-indigo-50/50 transition-colors border-t border-stone-200 font-bold">
                                <td className="py-2.5 px-3 bg-indigo-100/20 text-indigo-800 font-black text-[11px] border-r border-stone-150 text-center font-sans">
                                  {row.label}
                                </td>
                                {row.values.map((val, vIdx) => (
                                  <td key={vIdx} className="py-2.5 px-2 text-center font-mono text-[12px] text-indigo-900 font-extrabold">
                                    {val > 0 ? `${val}타` : '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}

                            {/* Overall Average */}
                            <tr className="bg-gradient-to-r from-indigo-700 to-sky-700 font-black text-white text-[11.5px] border-t-2 border-indigo-700">
                              <td className="py-3 px-3 bg-indigo-850 text-white font-black text-[11px] border-r border-indigo-700 text-center font-sans tracking-wide">
                                {integratedStats.english.overallAverage.label}
                              </td>
                              {integratedStats.english.overallAverage.values.map((val, vIdx) => (
                                <td key={vIdx} className="py-3 px-2 text-center font-mono text-[12px] text-white font-black">
                                  {val > 0 ? `${val}타` : '-'}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                </div>
              )}

        </div>
      )}

    </div>
  );
}
