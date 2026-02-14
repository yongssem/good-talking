/**
 * ============================================
 *  부부 대화 분석 앱 - Google Apps Script 백엔드
 * ============================================
 * 
 * [설정 방법]
 * 1. Google Sheets에서 '확장 프로그램' > 'Apps Script' 클릭
 * 2. 이 코드를 전체 복사하여 Code.gs에 붙여넣기
 * 3. '배포' > '새 배포' > '웹 앱' 선택
 * 4. 액세스 권한: "모든 사용자" 로 설정
 * 5. 배포 후 나오는 URL을 프론트엔드 app.js의 API_URL에 입력
 */

// 시트 이름 상수
const SHEET_NAME = 'Conflict_Log';

/**
 * 스프레드시트 및 시트 초기화
 * Conflict_Log 시트가 없으면 헤더와 함께 자동 생성
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // 헤더 행 설정
    const headers = ['ID', '발생일시', '발생날짜', '발화자', '내용', '카테고리', '감정점수'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // 헤더 스타일 적용
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4a90d9');
    headerRange.setFontColor('#ffffff');

    // 열 너비 조정
    sheet.setColumnWidth(1, 120); // ID
    sheet.setColumnWidth(2, 160); // 발생일시
    sheet.setColumnWidth(3, 110); // 발생날짜
    sheet.setColumnWidth(4, 80);  // 발화자
    sheet.setColumnWidth(5, 300); // 내용
    sheet.setColumnWidth(6, 80);  // 카테고리
    sheet.setColumnWidth(7, 80);  // 감정점수

    // 첫 번째 행 고정
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * 고유 ID 생성 (UUID v4 간이 버전)
 */
function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id + '-' + new Date().getTime().toString(36);
}

/**
 * 날짜를 한국 시간 문자열로 변환
 */
function formatDateTime(date) {
  return Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
}

function formatDate(date) {
  return Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM-dd');
}

/**
 * GET 요청 처리 - 데이터 조회
 * 모든 Conflict_Log 레코드를 JSON으로 반환
 */
function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();

    // 데이터가 없으면 빈 배열 반환
    if (lastRow <= 1) {
      return createJsonResponse({ success: true, data: [] });
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 7).getDisplayValues();
    const records = data.map(function(row) {
      return {
        id: row[0],
        발생일시: row[1],
        발생날짜: row[2],
        발화자: row[3],
        내용: row[4],
        카테고리: row[5],
        감정점수: row[6]
      };
    });

    return createJsonResponse({ success: true, data: records });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

/**
 * POST 요청 처리 - 새 기록 추가 및 삭제
 */
function doPost(e) {
  try {
    const sheet = getOrCreateSheet();
    const params = JSON.parse(e.postData.contents);

    // 삭제 요청 처리
    if (params.action === 'delete') {
      const idToDelete = String(params.id).trim(); // 문자열 변환 및 공백 제거
      const data = sheet.getDataRange().getDisplayValues(); // 화면에 보이는 값(문자열)으로 가져오기
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString().trim() === idToDelete) {
          sheet.deleteRow(i + 1);
          return createJsonResponse({ success: true, message: '기록이 삭제되었습니다.' });
        }
      }
      return createJsonResponse({ success: false, error: '해당 ID를 찾을 수 없습니다. (ID: ' + idToDelete + ')' });
    }

    // 필수 필드 검증
    if (!params.발화자 || !params.내용 || !params.카테고리 || !params.감정점수) {
      return createJsonResponse({ success: false, error: '필수 항목이 누락되었습니다.' });
    }

    // 자동 생성 필드
    const now = new Date();
    const id = generateId();
    const dateTime = formatDateTime(now);
    const dateOnly = formatDate(now);

    // 새 행 추가
    const newRow = [
      id,
      dateTime,
      dateOnly,
      params.발화자,
      params.내용,
      params.카테고리,
      Number(params.감정점수)
    ];

    sheet.appendRow(newRow);

    return createJsonResponse({
      success: true,
      message: '기록이 저장되었습니다.',
      data: {
        id: id,
        발생일시: dateTime,
        발생날짜: dateOnly,
        발화자: params.발화자,
        내용: params.내용,
        카테고리: params.카테고리,
        감정점수: Number(params.감정점수)
      }
    });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

/**
 * JSON 응답 생성 헬퍼
 * CORS 처리 포함
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 테스트용: 시트 초기화 함수
 * Apps Script 에디터에서 수동 실행하면 시트가 생성됩니다.
 */
function initSheet() {
  getOrCreateSheet();
  Logger.log('Conflict_Log 시트가 준비되었습니다.');
}
