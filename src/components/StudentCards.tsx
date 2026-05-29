/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { StudentStats } from '../types';
import { Trophy, Flame, ChevronUp, ChevronDown, Award, Minus, Zap, Sprout } from 'lucide-react';

interface StudentCardsProps {
  stats: StudentStats;
  title: string;
  type: 'english' | 'korean';
}

const getRankColorClasses = (level: string) => {
  const l = level.toLowerCase();
  if (l.includes('gold')) {
    return 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-100';
  }
  if (l.includes('silver')) {
    return 'bg-slate-100 text-slate-700 border-slate-200 ring-slate-100';
  }
  if (l.includes('bronze')) {
    return 'bg-orange-50 text-orange-700 border-orange-200 ring-orange-100';
  }
  if (l.includes('platinum')) {
    return 'bg-teal-50 text-teal-700 border-teal-200 ring-teal-100';
  }
  if (l.includes('diamond')) {
    return 'bg-cyan-50 text-cyan-700 border-cyan-200 ring-cyan-100';
  }
  return 'bg-gray-50 text-gray-600 border-gray-200 ring-gray-50';
};

export const StudentStatsCard: React.FC<StudentCardsProps> = ({ stats, title, type }) => {
  const { latestSpeed, maxSpeed, growth, currentLevel, nextLevel, nextLevelNeeded, percentToNext } = stats;

  const isPositiveGrowth = growth > 0;
  const isNegativeGrowth = growth < 0;
  const isZeroGrowth = growth === 0;

  const isEnglish = type === 'english';
  const unit = '타/분';

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 bg-linear-to-b from-white to-emerald-50/5 hover:shadow-md transition-shadow">
      {/* Header section matching Sleek design exactly */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className={`font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-1 ${
            isEnglish ? 'text-emerald-600 font-bold' : 'text-green-600 font-bold'
          }`}>
            <Sprout className="h-3.5 w-3.5 animate-pulse text-emerald-500 shrink-0" />
            {isEnglish ? 'English Typing' : 'Korean Typing'}
          </h3>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
        </div>
        
        {/* Tier stamp badge styled as a premium pill */}
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tight shrink-0 ${
          currentLevel.toLowerCase().includes('gold') || currentLevel.includes('1급') ? 'bg-amber-100 text-amber-800 border border-amber-200' :
          currentLevel.toLowerCase().includes('silver') || currentLevel.includes('2급') ? 'bg-slate-200 text-slate-700 border border-slate-300' :
          currentLevel.toLowerCase().includes('bronze') || currentLevel.includes('3급') ? 'bg-orange-100 text-orange-800 border border-orange-200' :
          currentLevel.toLowerCase().includes('platinum') ? 'bg-teal-100 text-teal-800 border border-teal-200' :
          currentLevel.toLowerCase().includes('diamond') ? 'bg-cyan-100 text-cyan-850 border border-cyan-200' :
          'bg-stone-100 text-stone-700 border border-stone-200'
        }`}>
          {currentLevel}
        </span>
      </div>

      <div className="space-y-6">
        {/* Stats segment with 3 columns */}
        <div className="grid grid-cols-3 gap-3">
          {/* Latest speed */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 text-center md:text-left">
            <p className="text-[11px] text-stone-500 font-bold mb-1 uppercase tracking-wide">최신 기록</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
              {latestSpeed}
              <span className="text-[11px] font-normal text-stone-400 ml-0.5">{unit}</span>
            </p>
          </div>

          {/* Highest speed */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 text-center md:text-left">
            <p className="text-[11px] text-stone-500 font-bold mb-1 uppercase tracking-wide inline-flex items-center gap-1">
              <Trophy className="h-3 w-3 text-amber-500 shrink-0" />
              최고
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
              {maxSpeed}
              <span className="text-[11px] font-normal text-stone-400 ml-0.5">{unit}</span>
            </p>
          </div>

          {/* Growth */}
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100/50 text-center md:text-left flex flex-col justify-between">
            <p className="text-[11px] text-emerald-700 font-bold mb-1 uppercase tracking-wide">성장</p>
            {isPositiveGrowth && (
              <p className="text-xl sm:text-2xl font-black text-emerald-600 font-mono tracking-tight">
                +{growth}
                <span className="text-[11px] font-bold ml-0.5">{unit}</span>
              </p>
            )}
            {isNegativeGrowth && (
              <p className="text-xl sm:text-2xl font-black text-rose-600 font-mono tracking-tight">
                -{Math.abs(growth)}
                <span className="text-[11px] font-bold ml-0.5">{unit}</span>
              </p>
            )}
            {isZeroGrowth && (
              <p className="text-xl sm:text-2xl font-black text-slate-400 font-mono tracking-tight">
                0
                <span className="text-[11px] font-semibold ml-0.5">{unit}</span>
              </p>
            )}
          </div>
        </div>

        {/* Progress block bar */}
        {nextLevel ? (
          <div className="space-y-3">
            <div className="flex justify-between items-end text-xs font-bold uppercase tracking-widest text-slate-400">
              <span className="flex items-center gap-1">
                <Award className={`h-4 w-4 ${isEnglish ? 'text-emerald-500' : 'text-green-500'}`} />
                Next Level: {nextLevel}
              </span>
              <span>{nextLevelNeeded && nextLevelNeeded > 0 ? `${nextLevelNeeded} ${unit} 남음` : '최고등급 달성'}</span>
            </div>
            
            <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  isEnglish ? 'bg-emerald-500' : 'bg-green-500'
                }`}
                style={{ width: `${percentToNext}%` }}
              />
            </div>
            
            <p className="text-[11px] text-stone-500 text-center leading-relaxed">
              목표 등급까지 {percentToNext}% 완료
            </p>
          </div>
        ) : (
          <div className="p-3 bg-emerald-50/20 border border-emerald-100 rounded-2xl text-center">
            <span className="text-xs text-emerald-600 font-bold block">
              🎉 최고 등급 달성! 타자 성장 마스터완료
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
