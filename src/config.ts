/**
 * 💡 학교 구글 스프레드시트 영구 연동 설정 파일
 * 
 * 여기에 본인의 구글 스프레드시트 ID와 Apps Script URL을 입력해두면,
 * 학생들의 휴대폰이나 다른 어떤 PC에서 링크를 타고 접속하더라도
 * 수동으로 연동할 필요 없이 실시간 학교 데이터가 즉시 자동으로 로드됩니다!
 */

// 1. 구글 스프레드시트 ID (스프레드시트 주소창의 'd/'와 '/edit' 사이의 영문 대소문자+기호 조합)
// 예: https://docs.google.com/spreadsheets/d/1abcdefg12345/edit 에서 "1abcdefg12345"가 ID입니다.
export const SCHOOL_SPREADSHEET_ID = '1pmKwrT4XIheljpSZjpsarQe_GFwzWk2lAu71QBiFPeo';

// 2. Apps Script 웹 앱 배포 URL (있을 때만 입력, 없으면 빈값 ''로 유지)
// CORS 보안 우회 장치(Apps Script)를 통해 학생 비밀번호를 즉시 조회하는 연결망 주소입니다.
export const SCHOOL_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzXPZIByuwh6_lfwD-bEc30F6StVWmijV1AKBDRVTuDvwgby_pD0e-XvG1FdqPIKCekmQ/exec';
