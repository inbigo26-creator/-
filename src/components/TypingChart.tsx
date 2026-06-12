/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TypingRecord } from '../types';

interface TypingChartProps {
  history: TypingRecord[];
  type: 'english' | 'korean';
  gradeAverage?: number;
  schoolAverage?: number;
}

export const TypingChart: React.FC<TypingChartProps> = ({ 
  history, 
  type,
  gradeAverage,
  schoolAverage
}) => {
  if (history.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
        <p className="text-gray-400 font-sans text-sm">표시할 타자 기록이 없습니다.</p>
      </div>
    );
  }

  // --- CHART CONFIGURATION (초보자용 설정 가이드) ---
  // 이 부분의 수치를 변경하여 그래프 크기와 여백을 자유롭게 조절할 수 있습니다.
  const chartWidth = 500;   // 가로 너비
  const chartHeight = 240;  // 세로 높이
  const paddingLeft = 45;   // 왼쪽 여백 (Y축 숫자가 들어갈 공간)
  const paddingRight = 20;  // 오른쪽 여백
  const paddingTop = 30;    // 위쪽 여백 (그래프 상단 여유 공간)
  const paddingBottom = 35; // 아래쪽 여백 (X축 월 이름이 들어갈 공간)

  // 그래프가 그려질 실제 공간 (수식 계산용)
  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  // 1. 최대 속도 및 Y축 최소/최대값 정하기
  const speeds = history.map(r => r.speed);
  // 최하 50타수 기준 및 평균값들도 스케일에 포함하여 눈금선 이탈 방지
  const maxSpeedValue = Math.max(...speeds, gradeAverage || 0, schoolAverage || 0, 50); 
  const minSpeedValue = 0;

  // Y축을 눈금 4칸으로 나누기 위한 기준값 계산
  const yAxisTicksCount = 4;
  const rawInterval = maxSpeedValue / yAxisTicksCount;
  // 소수점 1의 자리에서 반올림하여 깔끔한 단위(예: 100, 150 등)로 맞추기
  const yInterval = Math.ceil(rawInterval / 20) * 20;
  const yMax = yInterval * yAxisTicksCount;

  // 2. 가로(X축) 간격 구하기
  const dataCount = history.length;
  const getX = (index: number) => {
    if (dataCount <= 1) return paddingLeft + graphWidth / 2;
    return paddingLeft + (index / (dataCount - 1)) * graphWidth;
  };

  // 3. 세로(Y축) 간격 구하기
  const getY = (speed: number) => {
    const ratio = (speed - minSpeedValue) / (yMax - minSpeedValue);
    // SVG 좌표계는 위가 0이고 아래가 높이기 때문에 graphHeight에서 차감하여 그립니다.
    return paddingTop + graphHeight - ratio * graphHeight;
  };

  // 4. 선(Line Path) 그리기용 가이드 루트 생성
  const points = history.map((r, i) => ({
    x: getX(i),
    y: getY(r.speed),
    month: r.month,
    speed: r.speed
  }));

  let linePathD = '';
  let areaPathD = '';

  if (points.length > 0) {
    // 단순 직선 연결 루트 생성
    linePathD = `M ${points[0].x} ${points[0].y} ` + 
      points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

    // 면적 채우기용(Area Fill) 그라데이션 루트 생성
    areaPathD = `${linePathD} L ${points[points.length - 1].x} ${paddingTop + graphHeight} L ${points[0].x} ${paddingTop + graphHeight} Z`;
  }

  const isEnglish = type === 'english';
  const strokeColor = isEnglish ? '#10b981' : '#16a34a'; // 영타는 에메랄드 새싹색, 한타는 초록 숲색
  const areaGradientId = `chart-area-grad-${type}`;

  return (
    <div className="w-full bg-white rounded-3xl p-6 border border-emerald-100 shadow-sm bg-linear-to-b from-white to-emerald-50/5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 font-sans">
          <span className={`w-2 h-2 rounded-full inline-block ${isEnglish ? 'bg-emerald-500' : 'bg-green-500'}`}></span>
          {isEnglish ? 'English Trend' : 'Korean Trend'}
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          {gradeAverage !== undefined && gradeAverage > 0 && (
            <span className="text-[10px] bg-indigo-50/75 text-indigo-700 border border-indigo-100/60 px-2.5 py-0.5 rounded-full font-sans font-bold flex items-center gap-1 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block"></span>
              학년 평균: {gradeAverage}타
            </span>
          )}
          {schoolAverage !== undefined && schoolAverage > 0 && (
            <span className="text-[10px] bg-orange-50/75 text-orange-700 border border-orange-100/60 px-2.5 py-0.5 rounded-full font-sans font-bold flex items-center gap-1 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block"></span>
              전체 평균: {schoolAverage}타
            </span>
          )}
          <span className="text-xs text-slate-500 font-mono font-bold bg-slate-50/80 border border-slate-150 px-2 py-0.5 rounded-lg shrink-0">기록: {dataCount}회</span>
        </div>
      </div>

      {/* SVG 그래프 내부 렌더러 */}
      <div className="relative w-full overflow-hidden">
        <svg 
          viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            {/* 배경 면적 채우기용 그라데이션 */}
            <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.15" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* 1. 세로 Y축 보조 눈금선 및 숫자 패킹 */}
          {Array.from({ length: yAxisTicksCount + 1 }).map((_, idx) => {
            const tickValue = idx * yInterval;
            const yPos = getY(tickValue);
            return (
              <g key={`y-${idx}`} className="opacity-70 transition-all">
                <line 
                  x1={paddingLeft} 
                  y1={yPos} 
                  x2={chartWidth - paddingRight} 
                  y2={yPos} 
                  stroke="#f1f5f9" 
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text 
                  x={paddingLeft - 8} 
                  y={yPos + 4} 
                  textAnchor="end" 
                  className="fill-gray-400 font-mono text-[10px] font-medium"
                >
                  {tickValue}
                </text>
              </g>
            );
          })}

          {/* 학년별 평균 기준선 */}
          {gradeAverage !== undefined && gradeAverage > 0 && (
            <line 
              x1={paddingLeft} 
              y1={getY(gradeAverage)} 
              x2={chartWidth - paddingRight} 
              y2={getY(gradeAverage)} 
              stroke="#6366f1" 
              strokeWidth="1"
              strokeDasharray="3 3"
              className="opacity-30"
            />
          )}

          {/* 전체 평균 기준선 */}
          {schoolAverage !== undefined && schoolAverage > 0 && (
            <line 
              x1={paddingLeft} 
              y1={getY(schoolAverage)} 
              x2={chartWidth - paddingRight} 
              y2={getY(schoolAverage)} 
              stroke="#f97316" 
              strokeWidth="1"
              strokeDasharray="3 3"
              className="opacity-30"
            />
          )}

          {/* 2. 면적 그라데이션 채우기 */}
          {areaPathD && (
            <path 
              d={areaPathD} 
              fill={`url(#${areaGradientId})`} 
              className="animate-pulse-slow"
              style={{ animationDuration: '3s' }}
            />
          )}

          {/* 3. 트렌드 선 그리기 */}
          {linePathD && (
            <path 
              d={linePathD} 
              fill="none" 
              stroke={strokeColor} 
              strokeWidth="3.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          )}

          {/* 4. 노드별 데이터 서클 및 텍스트 핀 매핑 */}
          {points.map((p, idx) => {
            const hasGradeAvg = gradeAverage !== undefined && gradeAverage > 0;
            const hasSchoolAvg = schoolAverage !== undefined && schoolAverage > 0;
            const yGrade = hasGradeAvg ? getY(gradeAverage) : 0;
            const ySchool = hasSchoolAvg ? getY(schoolAverage) : 0;

            return (
              <g key={`point-${idx}`} className="group cursor-pointer">
                {/* 학년 평균 도트 (내 점수보다 작게 표기) */}
                {hasGradeAvg && (
                  <circle 
                    cx={p.x} 
                    cy={yGrade} 
                    r="3" 
                    fill="#ffffff" 
                    stroke="#818cf8" 
                    strokeWidth="1.5"
                    className="opacity-60 transition-opacity group-hover:opacity-100"
                  />
                )}

                {/* 전체 평균 도트 (내 점수보다 작게 표기) */}
                {hasSchoolAvg && (
                  <circle 
                    cx={p.x} 
                    cy={ySchool} 
                    r="3" 
                    fill="#ffffff" 
                    stroke="#fb923c" 
                    strokeWidth="1.5"
                    className="opacity-60 transition-opacity group-hover:opacity-100"
                  />
                )}

                {/* 노드 백그라운드 후광 효과 */}
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r="7" 
                  fill={strokeColor} 
                  className="opacity-0 group-hover:opacity-20 transition-all duration-200" 
                />
                
                {/* 리얼 데이터 도트 */}
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r="4.5" 
                  fill="#ffffff" 
                  stroke={strokeColor} 
                  strokeWidth="2.5" 
                  className="transition-transform duration-200 hover:scale-125 font-bold"
                />

                {/* 각 포인트별 현재 속도 숫자 표시 */}
                <text 
                  x={p.x} 
                  y={p.y - 12} 
                  textAnchor="middle" 
                  className="fill-gray-700 font-mono text-[11px] font-bold"
                >
                  {p.speed}
                </text>

                {/* X축 월 이름 표시 */}
                <text 
                  x={p.x} 
                  y={paddingTop + graphHeight + 18} 
                  textAnchor="middle" 
                  className="fill-gray-400 font-sans text-[11px] font-medium"
                >
                  {p.month}
                </text>
              </g>
            );
          })}

          {/* 하단 바닥 기준축 그리기 */}
          <line 
            x1={paddingLeft} 
            y1={paddingTop + graphHeight} 
            x2={chartWidth - paddingRight} 
            y2={paddingTop + graphHeight} 
            stroke="#e2e8f0" 
            strokeWidth="1.5"
          />
        </svg>
      </div>
    </div>
  );
};
