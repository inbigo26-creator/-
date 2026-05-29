/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  BookOpen, Sheet, Server, HelpCircle, Lightbulb, 
  CheckCircle, ArrowRight, Table, AlertTriangle, MessageSquareCode,
  Sprout
} from 'lucide-react';

interface GuideModalProps {
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'structure' | 'deploy' | 'trouble' | 'ideas'>('structure');

  const tabs = [
    { id: 'structure', label: '1. 파일 및 시트 통합 설계', icon: Sheet },
    { id: 'deploy', label: '2. 구글 웹앱 배포 방법', icon: Server },
    { id: 'trouble', label: '3. 오류 해결 체크리스트', icon: HelpCircle },
    { id: 'ideas', label: '4. 기능 확장 아이디어', icon: Lightbulb }
  ] as const;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="relative bg-white rounded-3xl w-full max-w-2xl border border-emerald-100 shadow-xl overflow-hidden flex flex-col my-8">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-emerald-50 flex items-center justify-between bg-emerald-50/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-805 tracking-tight">마스터 통합 구축 가이드북</h2>
              <p className="text-xs text-emerald-600 font-semibold">24개 학급별 시트를 통합하는 고효율 설계 매뉴얼</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 px-3 rounded-lg border border-emerald-200 text-xs font-bold text-emerald-600 hover:bg-emerald-50 cursor-pointer transition-colors"
          >
            닫기
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-emerald-50 bg-stone-50/50 p-2 overflow-x-auto gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === tab.id 
                    ? 'bg-emerald-600 text-white shadow-xs border border-emerald-500' 
                    : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100/30'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Area */}
        <div className="p-6 flex-1 overflow-y-auto max-h-[60vh] space-y-6 text-sm text-stone-700 leading-relaxed">
          
          {/* TAB 1: File structures & designs */}
          {activeTab === 'structure' && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100 mb-4">
                  <h4 className="font-extrabold text-emerald-800 text-xs mb-1.5 flex items-center gap-1">
                    <Lightbulb className="h-4 w-4" />
                    💡 24개 개별 학급 시트를 단 하나의 '통합 시트'로 자동 연동하는 비결
                  </h4>
                  <p className="text-xs text-emerald-700 leading-relaxed font-sans">
                    본교의 24개 학급(예: 1학년 1~8반, 2학년 1~8반, 3학년 1~8반) 담당 교사분들이 각자 별도의 스프레드시트에 학생 점수를 입력하더라도, 본 성장 대시보드에서는 마스터 시트를 통해 실시간으로 자동 종합하여 처리할 수 있습니다. 
                  </p>
                  
                  <div className="mt-4 space-y-3.5 pl-3.5 border-l-2 border-emerald-300 text-xs text-stone-650 font-sans">
                    <p className="space-y-1">
                      <strong className="text-stone-900">방법 1: IMPORTRANGE & QUERY 함수를 통한 완전 자동 실시간 동기화 (추천)</strong><br />
                      마스터 스프레드시트의 <code>english_all</code>, <code>korean_all</code> 시트의 2행에 아래와 같이 입력하여 24개 시트를 수직(세로)으로 쌓아 올릴 수 있습니다.
                      
                      <div className="bg-emerald-950 text-emerald-300 font-mono p-3 rounded-xl my-2 overflow-x-auto text-[11px] font-semibold select-all break-all">
                        =QUERY(&#123;
                        IMPORTRANGE("1반시트ID", "english_all!A2:F50");
                        IMPORTRANGE("2반시트ID", "english_all!A2:F50");
                        ...
                        IMPORTRANGE("24반시트ID", "english_all!A2:F50")
                        &#125;, "where Col1 is not null", 0)
                      </div>

                      {/* Spreadsheet ID Explainer */}
                      <div className="p-3.5 bg-amber-50/70 border border-amber-200/60 rounded-xl my-2 text-stone-700">
                        <p className="font-extrabold text-stone-900 mb-1 flex items-center gap-1">
                          <Sprout className="h-4 w-4 text-emerald-500 animate-pulse shrink-0" />
                          💡 꼭 알아두기: "시트 ID"란 무엇이고 어디서 찾나요?
                        </p>
                        <p className="leading-relaxed text-[11px] text-stone-500 font-medium">
                          웹 브라우저로 각 학급별 구글 스프레드시트에 접속했을 때, 주소창(URL)을 유심히 보시면 다음과 같습니다:<br />
                          <span className="text-stone-800 font-mono block my-1.5 p-2 bg-white border border-stone-200 rounded-lg select-all text-[10px] sm:text-[10.5px] leading-tight break-all">
                            https://docs.google.com/spreadsheets/d/<span className="bg-amber-100 text-stone-900 px-1 font-bold rounded">1A2B3C4D5E6F7G8H9I0J_xyz-abcdef777</span>/edit#gid=0
                          </span>
                          여기서 <code>/d/</code> 와 <code>/edit</code> 사이에 자리 잡고 있는 <strong className="text-stone-850">44자리 내외의 복잡한 문자 및 숫자 문자열 조합</strong>(위 노랗게 하이라이트 표시된 부분)이 바로 고유한 <strong className="text-emerald-700">"시트 ID"</strong>입니다!<br />
                          이 ID 값을 정확히 따서 <code>IMPORTRANGE("이곳에_입력", "시트명!A2:F50")</code> 에 입력해주시면 스프레드시트 간 실시간 통합 연동이 즉시 완성됩니다.
                        </p>
                      </div>

                      <span className="text-[10px] text-emerald-600 block leading-tight mt-1 font-medium">
                        ※ 중괄호 <code>&#123;&#125;</code>와 세미콜론(;)을 이용해 여러 시트 범위를 세로로 합쳐 넣을 수 있습니다. 마스터 시트에서 최초 입력 시 각 반 시트에 '엑세스 허용' 버튼을 1회만 클릭해주면 학생 정보와 타자(타/분) 점수가 상시 자동 갱신됩니다!
                      </span>
                    </p>
                    
                    <p>
                      <strong className="text-stone-900">방법 2: CSV 내보내기/정기 복사-붙여넣기</strong><br />
                      주기적으로 (각 달의 말일 등) 담임교사로부터 5열 양식(학번, 이름, 학년, 과, 월, 타자수) 데이터를 취합하여 마스터 스프레드시트에 단순 덧붙여 넣기 형태로 업데이트합니다.
                    </p>
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <Table className="h-4.5 w-4.5 text-emerald-600" />
                  마스터 스프레드시트 4가지 탭 상세 설계양식
                </h3>
                <p className="text-xs text-stone-500">
                  교사용 설정 창에 입력한 마스터 스프레드시트 내에 아래 네 가지 시트명(Sheet Name)이 반드시 준비되어야 연동이 완료됩니다.
                </p>
              </div>

              {/* Sheet Card Grid */}
              <div className="space-y-4">
                
                {/* 1. students_auth */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60">
                  <span className="font-mono text-xs font-bold text-emerald-600">설정시트 1</span>
                  <h4 className="font-bold text-stone-850 text-xs mt-0.5 mb-2">학생 인증용 시트 (시트명: students_auth)</h4>
                  <p className="text-xs text-stone-500 mb-3">학생들의 로그인을 허용할 5자리 학번과 4자리 비밀번호(예: 전화번호 뒷자리)를 지정하는 테이블입니다.</p>
                  <table className="w-full text-center border border-stone-200 font-mono text-[11px] bg-white rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-stone-100 text-stone-605">
                        <th className="py-1 px-2 border-b border-stone-200">학번</th>
                        <th className="py-1 px-2 border-b border-stone-200">이름</th>
                        <th className="py-1 px-2 border-b border-stone-200">인증번호</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-stone-700">
                        <td className="py-1 px-2 border-b border-stone-150">10101</td>
                        <td className="py-1 px-2 border-b border-stone-150">홍길동</td>
                        <td className="py-1 px-2 border-b border-stone-150">4821</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 2. english_all */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60">
                  <span className="font-mono text-xs font-bold text-emerald-600">설정시트 2</span>
                  <h4 className="font-bold text-stone-850 text-xs mt-0.5 mb-2">영어 통합 타자 기록 (시트명: english_all)</h4>
                  <p className="text-xs text-stone-500 mb-3">전체 학급에서 취합하여 병합된 영어 타자(타/분) 기록 데이터셋입니다.</p>
                  <table className="w-full text-center border border-stone-200 font-mono text-[11px] bg-white rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-stone-100 text-stone-605">
                        <th className="py-1 px-2 border-b border-stone-200">학번</th>
                        <th className="py-1 px-2 border-b border-stone-200">이름</th>
                        <th className="py-1 px-2 border-b border-stone-200">학년</th>
                        <th className="py-1 px-2 border-b border-stone-200">과</th>
                        <th className="py-1 px-2 border-b border-stone-200">월</th>
                        <th className="py-1 px-2 border-b border-stone-200">영타</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-stone-700">
                        <td className="py-1 px-2 border-b border-stone-150">10101</td>
                        <td className="py-1 px-2 border-b border-stone-150">홍길동</td>
                        <td className="py-1 px-2 border-b border-stone-150">1</td>
                        <td className="py-1 px-2 border-b border-stone-150">관광</td>
                        <td className="py-1 px-2 border-b border-stone-150">3월</td>
                        <td className="py-1 px-2 border-b border-stone-150 text-emerald-650 font-bold">210</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. korean_all */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60">
                  <span className="font-mono text-xs font-bold text-emerald-600">설정시트 3</span>
                  <h4 className="font-bold text-stone-850 text-xs mt-0.5 mb-2">한글 통합 타자 기록 (시트명: korean_all)</h4>
                  <p className="text-xs text-stone-500 mb-3">전체 학급에서 수집 및 연합된 한글 한타 속도(타/분) 정보 시트입니다.</p>
                  <table className="w-full text-center border border-stone-200 font-mono text-[11px] bg-white rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-stone-100 text-stone-605">
                        <th className="py-1 px-2 border-b border-stone-200">학번</th>
                        <th className="py-1 px-2 border-b border-stone-200">이름</th>
                        <th className="py-1 px-2 border-b border-stone-200">학년</th>
                        <th className="py-1 px-2 border-b border-stone-200">과</th>
                        <th className="py-1 px-2 border-b border-stone-200">월</th>
                        <th className="py-1 px-2 border-b border-stone-200">한타</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-stone-700">
                        <td className="py-1 px-2 border-b border-stone-150">10101</td>
                        <td className="py-1 px-2 border-b border-stone-150">홍길동</td>
                        <td className="py-1 px-2 border-b border-stone-150">1</td>
                        <td className="py-1 px-2 border-b border-stone-150">관광</td>
                        <td className="py-1 px-2 border-b border-stone-150">3월</td>
                        <td className="py-1 px-2 border-b border-stone-150 text-green-650 font-bold">420</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 4. level_rule */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60">
                  <span className="font-mono text-xs font-bold text-emerald-600">설정시트 4</span>
                  <h4 className="font-bold text-stone-850 text-xs mt-0.5 mb-2">타자 등급 기준표 (시트명: level_rule)</h4>
                  <p className="text-xs text-stone-500 mb-3">학생들의 타자 속도 별 최종 영예 급수(1급 ~ 3급)를 설정하는 마일스톤 테이블입니다.</p>
                  <table className="w-full text-center border border-stone-200 font-mono text-[11px] bg-white rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-stone-100 text-stone-605">
                        <th className="py-1 px-2 border-b border-stone-200">타입</th>
                        <th className="py-1 px-2 border-b border-stone-200">급수</th>
                        <th className="py-1 px-2 border-b border-stone-200">최소값</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-stone-700">
                        <td className="py-1 px-2 border-b border-stone-150">영어</td>
                        <td className="py-1 px-2 border-b border-stone-150">1급(Gold)</td>
                        <td className="py-1 px-2 border-b border-stone-150">350</td>
                      </tr>
                      <tr className="text-stone-700">
                        <td className="py-1 px-2 border-b border-stone-150">한글</td>
                        <td className="py-1 px-2 border-b border-stone-150">1급(Gold)</td>
                        <td className="py-1 px-2 border-b border-stone-150">650</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: GAS Web application deploy guide */}
          {activeTab === 'deploy' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-base font-bold text-slate-805 flex items-center gap-1.5 font-sans">
                <Server className="h-4.5 w-4.5 text-emerald-600" />
                구글 앱스 스크립트(GAS)를 활용한 학생 전용 URL 생성 및 배포방법
              </h3>

              <div className="space-y-4 font-semibold text-xs text-stone-600 leading-relaxed font-sans">
                <div className="flex items-start gap-2.5">
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-mono font-bold">1</div>
                  <div className="space-y-1">
                    <p className="font-extrabold text-stone-850">Apps Script 창 열기</p>
                    <p className="text-stone-500 font-medium">위 구성으로 작성한 구글 스프레드시트 상단 메뉴에서 <strong>[확장 프로그램] &gt; [Apps Script]</strong>를 클릭합니다.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-mono font-bold">2</div>
                  <div className="space-y-1">
                    <p className="font-extrabold text-stone-850">서버 코드(Code.gs) 붙여넣기</p>
                    <p className="text-stone-500 font-medium">
                      왼쪽 리스트의 <code>Code.gs</code> 파일 내부의 내용 전체를 지우고, 본 웹앱의 [교사 연동 설정] 창 하단에서 복사한 <strong>Code.gs 코드</strong>를 통째로 붙여넣은 뒤 저장합니다.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-mono font-bold">3</div>
                  <div className="space-y-1">
                    <p className="font-extrabold text-stone-850">모바일 뷰어 파일(index.html) 생성</p>
                    <p className="text-stone-500 font-medium">
                      Apps Script 화면 내에서 <strong>[+] 옆 화살표 &gt; [HTML]</strong>을 눌러 새 파일을 만들고 파일명을 <code>index</code>로 저장합니다(뒤에 .html은 자동으로 붙습니다).
                      그 다음 복사해 온 <strong>index.html 코드</strong>를 붙여넣고 저장합니다.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-mono font-bold">4</div>
                  <div className="space-y-1">
                    <p className="font-extrabold text-stone-850">웹앱으로 배포 등록</p>
                    <p className="text-stone-500 font-medium leading-relaxed">
                      우측 상단 <strong>[배포] &gt; [새 배포]</strong> 버튼을 누릅니다. <br />
                      • 유형 선택(톱니바퀴): <code>웹 앱</code>을 체크합니다. <br />
                      • 다음 사용자 권한으로 실행: <strong>'나(교사 구글 계정)'</strong>로 설정합니다.<br />
                      • 액세스 권한이 있는 사용자: 반드시 <strong>'모든 사람(Anyone)'</strong>으로 설정해야 학생들이 로그인을 요구받지 않고 바로 이용할 수 있습니다.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-mono font-bold">5</div>
                  <div className="space-y-1">
                    <p className="font-extrabold text-stone-850">최종 배포 주소(URL) 확인</p>
                    <p className="text-stone-500 font-medium font-sans">
                      [배포]를 완료하면 <code>https://script.google.com/macros/s/.../exec</code> 형식의 웹앱 주소가 배포됩니다. 이 주소를 QR코드나 단축링크로 가공하여 학생 스마트폰 메시지나 단체 카톡방, 가정통신문, 교실 칠판에 적어주면 곧바로 운영 개시됩니다!
                    </p>
                  </div>
                </div>
              </div>

              {/* Vercel + GitHub Deployment Guide */}
              <div className="p-4.5 rounded-2xl bg-emerald-50/20 border border-emerald-100/50 space-y-3 mt-6">
                <h4 className="font-extrabold text-emerald-900 text-xs flex items-center gap-1.5 leading-none">
                  <span className="p-1 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Sprout className="h-4 w-4 animate-bounce" />
                  </span>
                  🖥️ GitHub & Vercel 초고속 전 세계 배포 가이드
                </h4>
                <p className="text-stone-500 leading-relaxed text-[11px] font-medium font-sans">
                  담임 교사 및 학생들을 위한 웹 대시보드를 무료로 무제한 호스팅하여 <strong>Vercel 고유 주소(https://your-project.vercel.app)</strong>로 배포하는 상세 방법입니다.
                </p>
                <div className="space-y-2.5 pl-2 font-semibold text-xs text-stone-600 leading-relaxed font-sans">
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-700 font-extrabold min-w-[70px]">1단계.</span>
                    <span className="text-stone-500 font-medium font-sans">본 대시보드의 소스코드가 저장된 깃허브 원격 저장소(GitHub Repository)를 구성하고 <code>main</code> 브랜치로 푸시(Push)합니다.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-700 font-extrabold min-w-[70px]">2단계.</span>
                    <span className="text-stone-500 font-medium font-sans"><a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-emerald-700 underline font-extrabold hover:text-emerald-800">Vercel 웹사이트</a>에서 <strong>GitHub 계정으로 로그인 (Sign In)</strong> 또는 가입한 후, Vercel 대시보드 화면에서 <strong>[Add New] &gt; [Project]</strong>를 누릅니다.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-700 font-extrabold min-w-[70px]">3단계.</span>
                    <span className="text-stone-500 font-medium font-sans">원격 깃허브 레포지토리 목록에서 이 프로젝트 저장소 옆의 <strong>[Import]</strong> 버튼을 클릭합니다.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-700 font-extrabold min-w-[70px]">4단계.</span>
                    <span className="text-stone-500 font-medium font-sans">Vite 및 React 빌드 옵션이 사전 감지됩니다. Build Command (<code>npm run build</code>)와 Output Directory (<code>dist</code>)가 별도 수정 없이 기본값 그대로 되어 있다면 즉시 <strong>[Deploy]</strong> 버튼을 실행합니다.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-700 font-extrabold min-w-[70px]">5단계.</span>
                    <span className="text-stone-500 font-medium font-sans">약 30초~1분 뒤, 배포 완료 축하와 함께 고유 웹 사이트 도메인이 부여됩니다! 해당 주소로 모바일이나 브라우저에서 편하게 접속해 학생 성장 대시보드로 활용하세요!</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: Connection diagnose & troubleshootings */}
          {activeTab === 'trouble' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-base font-bold text-slate-805 flex items-center gap-1.5 flex-wrap font-sans">
                <AlertTriangle className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
                오류 발생 시 점검 체크리스트
              </h3>

              <div className="space-y-4 font-sans">
                <div className="p-4.5 rounded-2xl bg-rose-50/20 border border-rose-100/40 space-y-3">
                  <h4 className="font-bold text-rose-900 text-xs flex items-center gap-1.5">
                    ❌ 조회할 때 '서버 통신 실패' 등의 오류 문구가 뜨는 경우
                  </h4>
                  <ul className="text-xs text-rose-800 space-y-2 font-medium list-disc pl-4 leading-relaxed">
                    <li>스프레드시트 탭 네 가지 이름이 <code>students_auth</code>, <code>english_all</code>, <code>korean_all</code>, <code>level_rule</code>과 정확하게 일치하는지 철자를 체크하세요.</li>
                    <li>각 시트의 1행(헤더 행)에 들어가는 컬럼명들('학번', '이름', '인증번호', '월', '영타', '한타', '타입', '급수', '최소값')이 띄어쓰기 없이 정확히 작성되어 있는지 검사하세요.</li>
                    <li>스프레드시트 ID 또는 URL이 올바른 수치인지, 구글 시트 우측 상단 [공유]를 눌러 <strong>'링크가 있는 모든 사용자(뷰어)'</strong> 권한으로 퍼블릭 허용되어 있는지 최종 점검해야 합니다.</li>
                  </ul>
                </div>

                <div className="p-4.5 rounded-2xl bg-emerald-50/20 border border-emerald-100/45 space-y-3">
                  <h4 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                    📱 모바일 뷰어 최적화 팁
                  </h4>
                  <p className="text-xs text-emerald-805 font-medium leading-relaxed">
                    본 시스템은 모바일 스케일링 디자인이 기본 적용되어 있습니다. Apps Script index.html의 상단에 정의된 메타태그(viewport)가 올바른 너비 배속을 유지해 주므로, 글씨 크기가 너무 크거나 찌그러지지 않고 한 눈에 들어옵니다. 모바일 홈화면에 단축 버튼으로 추가해두면 네이티브 앱 형태로 동작하게 됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Future features expansion */}
          {activeTab === 'ideas' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                <Lightbulb className="h-4.5 w-4.5 text-amber-500" />
                고등학교 교사들을 위한 향후 기능 확장 가상 아이디어
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="p-4 rounded-2xl bg-amber-50/30 border border-amber-100/40 space-y-2">
                  <h4 className="font-bold text-gray-800 text-xs">🎮 1. 익명 기반 전교 타수 랭킹보드</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    학생의 실제 학번을 가리고 "홍*동" 또는 학번 끝자리로 표시하여, 실시간으로 한타/영타의 왕좌 자리를 노리는 전교 탑 30위 명예의 전당 탭을 추가해 타자 자율연습 동기를 대폭 인상시킬 수 있습니다.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/30 border border-amber-100/40 space-y-2">
                  <h4 className="font-bold text-gray-800 text-xs">🏆 2. 종이 인증서/성장 배지 자가 발송</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    다음 등급(Gold, Diamond 등) 달성 성공 시, 교실 프린터나 PDF 양식으로 즉석 '타자 챔피언 임명장'을 출력할 수 있는 상장 다운로드 단축 기능을 버튼으로 융합해 재미를 배가해줄 수 있습니다.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/30 border border-amber-100/40 space-y-2">
                  <h4 className="font-bold text-gray-800 text-xs">📈 3. 학급 평균 타수 매치업 투표</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    어느 학과(디자인과 vs 관광과)나 학급의 3월 대비 성장 누적 총량이 더 큰지 비교용 배틀 게이지를 대시보드에 연계하여, 학급 단체 단결 타자 경쟁을 부추깁니다.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/30 border border-amber-100/40 space-y-2">
                  <h4 className="font-bold text-gray-800 text-xs">💬 4. 실시간 카카오 가상 일일 코칭 서비스</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Apps Script와 카카오 인프라를 연계해 매달 속도 하락 구간이 있는 학생에게 격려의 따스한 맞춤 알림 성찰 메시지를 전달하도록 응용해 볼 수 있습니다.
                  </p>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-gray-50 bg-gray-50/50 flex items-center justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2 px-5 py-2.5 rounded-xl bg-gray-950 hover:bg-gray-900 transition-colors text-xs font-semibold text-white tracking-wide cursor-pointer"
          >
            본문 이해완료
          </button>
        </div>

      </div>
    </div>
  );
};
