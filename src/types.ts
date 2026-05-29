/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StudentAuth {
  studentId: string; // 학번 (5자리)
  name: string;      // 이름
  pin: string;       // 인증번호 (4자리)
}

export interface TypingRecord {
  studentId: string; // 학번
  name: string;      // 이름
  grade: string;     // 학년
  department: string;// 과
  month: string;     // 월 (예: 3월, 4월, 5월 등)
  speed: number;     // 타수 (영타 또는 한타)
  type: 'english' | 'korean';
}

export interface LevelRule {
  type: string;
  level: string;     // 급수 (예: Bronze, Silver, Gold, ...)
  minVal: number;    // 최소 타수
}

export interface StudentStats {
  history: TypingRecord[];
  latestSpeed: number;
  maxSpeed: number;
  growth: number; // 이전 달 대비 성장량
  currentLevel: string;
  nextLevel: string | null;
  nextLevelNeeded: number | null;
  percentToNext: number; // 0-100%
}

export interface SpreadsheetConfig {
  spreadsheetId: string;
  isCustom: boolean;
}
