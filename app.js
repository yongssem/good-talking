/**
 * ============================================
 *  나쁜말 버튼 - 부부 대화 분석 앱
 *  프론트엔드 메인 스크립트
 * ============================================
 */

// ============================================
// ★ 중요: 아래 URL을 Google Apps Script 배포 URL로 교체하세요!
// ============================================
const API_URL = 'https://script.google.com/macros/s/AKfycbx8PsIG6sMXXefhLIrH8014YLvZkmJIi1jw7JIrPU8WqreXAe57sDZ_N00IDbiA17Nagg/exec';
// 예시: 'https://script.google.com/macros/s/AKfycbx.../exec'

// ============================================
// 상태 관리
// ============================================
const state = {
  currentView: 'home',     // 현재 보이는 뷰
  records: [],             // 전체 기록 데이터
  selectedCategory: null,  // 선택된 카테고리
  selectedScore: 3,        // 선택된 감정점수
  isLoading: false,        // 로딩 상태
  isAdmin: false,          // 관리자 모드 상태
  charts: {                // Chart.js 인스턴스
    donut: null,
    histogram: null
  },
  period: 'daily'          // 히스토그램 기간 (daily/weekly)
};

// ============================================
// 감정점수 레이블 매핑
// ============================================
const SCORE_LABELS = {
  1: '약함',
  2: '조금',
  3: '보통',
  4: '강함',
  5: '매우 강함'
};

// 카테고리 색상 매핑
const CATEGORY_COLORS = {
  '비난': '#ff6b6b',
  '무시': '#ffa94d',
  '욕설': '#e64980',
  '짜증': '#ffd43b',
  '기타': '#69db7c'
};

// 카테고리 이모지 매핑
const CATEGORY_EMOJI = {
  '비난': '😤',
  '무시': '😶',
  '욕설': '🤬',
  '짜증': '😒',
  '기타': '💬'
};

// ============================================
// 초기화
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initForm();
  initTimestamp();
});

// ============================================
// 네비게이션 (SPA 라우팅)
// ============================================
function initNavigation() {
  // 하단 네비게이션 버튼
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      navigateTo(targetView);
    });
  });

  // 홈 > 기록하기 버튼
  const startBtn = document.getElementById('btn-start-record');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (state.isAdmin) {
        // 관리자 모드일 때는 내역 관리(통계) 화면으로 이동
        navigateTo('stats');
      } else {
        // 일반 모드일 때는 기록하기 화면으로 이동
        navigateTo('form');
        resetForm();
        updateTimestamp();
      }
    });
  }

  // 폼 > 뒤로 가기 버튼
  document.getElementById('btn-form-back').addEventListener('click', () => {
    navigateTo('home');
  });
}

/**
 * 뷰 전환 함수
 * @param {string} viewName - 뷰 이름 (home, form, stats)
 */
function navigateTo(viewName) {
  // 모든 뷰 비활성화
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
  });

  // 대상 뷰 활성화
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    // 약간의 딜레이 후 활성화 (애니메이션 효과)
    requestAnimationFrame(() => {
      targetView.classList.add('active');
    });
  }

  // 네비게이션 버튼 상태 업데이트
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // 통계 뷰로 이동 시 차트 업데이트
  if (viewName === 'stats') {
    updateDashboard();
  }

  state.currentView = viewName;
}

// ============================================
// 폼 관련 기능
// ============================================
function initForm() {
  // 카테고리 버튼 이벤트
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // 기존 선택 해제
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('selected'));
      // 새로 선택
      btn.classList.add('selected');
      state.selectedCategory = btn.dataset.value;
      document.getElementById('category').value = btn.dataset.value;
    });
  });

  // 감정점수 버튼 이벤트
  document.querySelectorAll('.score-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const val = parseInt(btn.dataset.value);
      state.selectedScore = val;
      document.getElementById('score').value = val;

      // 점수 표시 업데이트
      const displayValue = document.getElementById('score-display-value');
      const displayLabel = document.getElementById('score-display-label');
      displayValue.textContent = val;
      displayLabel.textContent = SCORE_LABELS[val];

      // 색상 변경 (점수에 따라)
      const colors = ['', '#51cf66', '#94d82d', '#ffd43b', '#ffa94d', '#ff6b6b'];
      displayValue.style.color = colors[val];
    });
  });

  // 기간 토글 이벤트
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.period = btn.dataset.period;
      updateHistogram();
    });
  });

  // 폼 제출 이벤트
  document.getElementById('conflict-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveRecord();
  });
}

/**
 * 폼 초기화
 */
function resetForm() {
  document.getElementById('conflict-form').reset();
  document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('selected'));
  // 기본 감정점수 3 선택
  document.querySelector('.score-btn[data-value="3"]').classList.add('selected');
  state.selectedCategory = null;
  state.selectedScore = 3;
  document.getElementById('score').value = 3;
  document.getElementById('score-display-value').textContent = '3';
  document.getElementById('score-display-label').textContent = '보통';
  document.getElementById('score-display-value').style.color = '#ffd43b';
}

// ============================================
// 타임스탬프 자동 업데이트
// ============================================
let timestampInterval = null;

function initTimestamp() {
  updateTimestamp();
  // 1초마다 업데이트
  timestampInterval = setInterval(updateTimestamp, 1000);
}

function updateTimestamp() {
  const now = new Date();
  const formatted = formatDateTime(now);
  const el = document.getElementById('current-time');
  if (el) el.textContent = formatted;
}

/**
 * 날짜/시간 포맷 (yyyy-MM-dd HH:mm:ss)
 */
function formatDateTime(date) {
  const y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${M}-${d} ${h}:${m}:${s}`;
}

/**
 * 날짜만 포맷 (yyyy-MM-dd)
 */
function formatDate(date) {
  const y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${M}-${d}`;
}

// ============================================
// 데이터 통신 (Google Apps Script API)
// ============================================

/**
 * 데이터 불러오기 (GET)
 */
async function loadData() {
  // API URL이 설정되지 않았으면 데모 데이터 사용
  if (!API_URL) {
    loadDemoData();
    return;
  }

  state.isLoading = true;

  try {
    const response = await fetch(API_URL, {
      redirect: 'follow'
    });
    const result = await response.json();

    if (result.success) {
      state.records = result.data || [];
      updateTodayCount();
      if (state.currentView === 'stats') {
        updateDashboard();
      }
    } else {
      showToast('데이터를 불러오지 못했습니다: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('데이터 로드 실패:', error);
    showToast('서버에 연결할 수 없습니다. 데모 모드로 실행합니다.', 'error');
    loadDemoData();
  } finally {
    state.isLoading = false;
  }
}

/**
 * 새 기록 저장 (POST)
 */
async function saveRecord() {
  // 유효성 검사
  const speaker = document.querySelector('input[name="speaker"]:checked');
  const content = document.getElementById('content').value.trim();
  const category = state.selectedCategory;
  const score = state.selectedScore;

  if (!speaker) {
    showToast('발화자를 선택해주세요', 'error');
    return;
  }
  if (!content) {
    showToast('내용을 입력해주세요', 'error');
    return;
  }
  if (!category) {
    showToast('카테고리를 선택해주세요', 'error');
    return;
  }

  const recordData = {
    발화자: speaker.value,
    내용: content,
    카테고리: category,
    감정점수: score
  };

  // 저장 버튼 비활성화
  const btnSave = document.getElementById('btn-save');
  btnSave.disabled = true;
  btnSave.innerHTML = '<span class="loading-spinner"></span> 저장 중...';

  // API URL이 없으면 로컬 저장
  if (!API_URL) {
    // 데모 모드: 로컬에 추가
    const now = new Date();
    const newRecord = {
      id: 'demo-' + Date.now(),
      발생일시: formatDateTime(now),
      발생날짜: formatDate(now),
      ...recordData,
      감정점수: Number(score)
    };
    state.records.unshift(newRecord);
    saveDemoData();
    showSaveSuccess();
    btnSave.disabled = false;
    btnSave.innerHTML = '💾 기록 저장';
    return;
  }

  try {
    // Google Apps Script는 redirect 옵션이 중요합니다.
    const response = await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors', // CORS 정책으로 인해 응답을 읽지 못하는 경우를 대비
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8' // GAS에서 가장 잘 받아들이는 형상
      },
      redirect: 'follow',
      body: JSON.stringify(recordData)
    });

    // mode: 'no-cors'를 설정하면 response.json()을 사용할 수 없습니다.
    // 하지만 데이터는 서버로 전달되므로, 우선 성공으로 간주하고 화면을 전환합니다.
    // 만약 'no-cors' 없이 성공하고자 한다면 GAS 배포 설정을 확인해야 합니다.

    // 일단 저장이 되었다고 가정하고 UI를 처리합니다 (모바일/웹 호환성)
    showSaveSuccess();

    // 데이터 새로고침
    setTimeout(() => {
      loadData();
    }, 1000);

  } catch (error) {
    console.error('저장 시도 중 에러 발생:', error);
    showToast('저장 중 확인이 어렵습니다. 잠시 후 결과가 반영되는지 확인해주세요.', 'info');

    // 에러가 나더라도 일단 폼은 초기화 시도
    showSaveSuccess();
    setTimeout(() => {
      loadData();
    }, 1000);
  } finally {
    btnSave.disabled = false;
    btnSave.innerHTML = '💾 기록 저장';
  }
}

/**
 * 저장 성공 피드백 표시 (감성적인 스플래시 화면)
 */
function showSaveSuccess() {
  const overlay = document.createElement('div');
  overlay.className = 'save-success-splash';
  overlay.innerHTML = `
    <div class="splash-inner">
      <div class="splash-icon">🏡</div>
      <div class="splash-text">
        <h3>기록 완료! 짝짝짝!</h3>
        <p>우리 가족의 사랑이 +1 쌓였습니다. ❤️</p>
      </div>
      <div class="splash-confetti"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  // 애니메이션 효과를 위해 약간의 지연 후 활성화
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });

  // 2초 후 홈으로 돌아가기
  setTimeout(() => {
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.remove();
      navigateTo('home');
      loadData(); // 최신 데이터로 카운트 업데이트
    }, 500);
  }, 2000);
}

/**
 * 레코드 삭제 (API 요청)
 */
async function deleteRecord(id) {
  if (!confirm('정말로 이 기록을 삭제하시겠습니까?')) return;

  if (!API_URL) {
    // 데모 모드 삭제
    state.records = state.records.filter(r => r.id !== id);
    saveDemoData();
    renderRecentRecords();
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify({ action: 'delete', id: id })
    });
    const result = await response.json();
    if (result.success) {
      showToast('삭제되었습니다.', 'success');
      loadData(); // 데이터 새로고침
    } else {
      showToast('삭제 실패: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('삭제 실패:', error);
    showToast('서버 연결 실패', 'error');
  }
}

/**
 * 관리자 모드 토글
 */
function toggleAdminMode() {
  state.isAdmin = !state.isAdmin;
  const btn = document.getElementById('btn-admin-mode');
  const mainBtn = document.querySelector('#btn-start-record .label');

  if (btn) {
    btn.classList.toggle('active', state.isAdmin);
    btn.innerHTML = state.isAdmin ? '🔓 관리자 온' : '🔒 관리자 오프';
  }

  if (mainBtn) {
    mainBtn.textContent = state.isAdmin ? '소통 내역 관리!' : '소통 기록';
  }

  // 선택 삭제 버튼 표시 여부 제어
  const batchBtn = document.getElementById('admin-batch-delete');
  if (batchBtn) {
    batchBtn.style.display = state.isAdmin ? 'block' : 'none';
  }

  showToast(state.isAdmin ? '관리자 모드가 활성화되었습니다. 내역 관리 버튼을 눌러주세요.' : '관리자 모드가 해제되었습니다.');

  // 통계 뷰에 있다면 리스트 다시 그리기
  if (state.currentView === 'stats') {
    renderRecentRecords();
  }
}

/**
 * 선택된 레코드들 삭제
 */
async function deleteSelectedRecords() {
  const checkboxes = document.querySelectorAll('.record-checkbox:checked');
  if (checkboxes.length === 0) {
    showToast('삭제할 항목을 선택해주세요.');
    return;
  }

  if (!confirm(`선택한 ${checkboxes.length}개의 기록을 정말 삭제할까요?`)) return;

  const idsToDelete = Array.from(checkboxes).map(cb => cb.value);

  showToast('삭제 중...');

  for (const id of idsToDelete) {
    // API에 순차적으로 삭제 요청 (일괄 처리 API가 현재는 없으므로)
    await deleteRecordQuietly(id);
  }

  showToast('선택한 기록들이 삭제되었습니다.', 'success');
  loadData();
}

/**
 * 토스트 알림 없이 삭제 (일괄 삭제용)
 */
async function deleteRecordQuietly(id) {
  if (!API_URL) {
    state.records = state.records.filter(r => r.id !== id);
    saveDemoData();
    return;
  }
  try {
    await fetch(API_URL, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify({ action: 'delete', id: id })
    });
  } catch (e) {
    console.error('Delete failed', id);
  }
}

// ============================================
// 데모 모드 (API 미설정 시)
// ============================================
function loadDemoData() {
  // 로컬 스토리지에서 데이터 로드
  const stored = localStorage.getItem('nabumalbutton_records');
  if (stored) {
    try {
      state.records = JSON.parse(stored);
    } catch (e) {
      state.records = [];
    }
  }

  // 데이터가 없으면 샘플 생성
  if (state.records.length === 0) {
    state.records = generateSampleData();
    saveDemoData();
  }

  updateTodayCount();
}

function saveDemoData() {
  localStorage.setItem('nabumalbutton_records', JSON.stringify(state.records));
}

/**
 * 샘플 데이터 생성 (데모용)
 */
function generateSampleData() {
  const categories = ['비난', '무시', '욕설', '짜증', '기타'];
  const speakers = ['유회장', '용쌤', '고영주', '고영은'];
  const contents = [
    '왜 항상 그런 식으로 말하는 거야?',
    '아무 말도 안 하고 무시하더라',
    '집안일 좀 해달라고 했는데 또 안 했어',
    '말투가 너무 차가웠어',
    '나한테 짜증을 냈어',
    '이유도 없이 화를 냈어',
    '대화를 하려고 하는데 계속 핸드폰만 봐',
    '내 말에 한숨만 쉬었어',
    '왜 나만 양보해야 하냐고 했어',
    '상의 없이 결정해버렸어'
  ];

  const samples = [];
  const now = new Date();

  for (let i = 0; i < 25; i++) {
    const daysAgo = Math.floor(Math.random() * 14);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(Math.floor(Math.random() * 14) + 8);
    date.setMinutes(Math.floor(Math.random() * 60));

    samples.push({
      id: 'sample-' + i,
      발생일시: formatDateTime(date),
      발생날짜: formatDate(date),
      발화자: speakers[Math.floor(Math.random() * speakers.length)],
      내용: contents[Math.floor(Math.random() * contents.length)],
      카테고리: categories[Math.floor(Math.random() * categories.length)],
      감정점수: Math.floor(Math.random() * 5) + 1
    });
  }

  // 발생일시 내림차순 정렬
  samples.sort((a, b) => b.발생일시.localeCompare(a.발생일시));
  return samples;
}

function updateTodayCount() {
  const now = new Date();
  const todayRecords = state.records.filter(r => {
    // 서버에서 온 날짜 데이터를 Date 객체로 변환
    const recordDate = new Date(r.발생일시);
    return recordDate.getFullYear() === now.getFullYear() &&
      recordDate.getMonth() === now.getMonth() &&
      recordDate.getDate() === now.getDate();
  });

  const el = document.getElementById('today-count-value');
  if (el) el.textContent = todayRecords.length;
}

// ============================================
// 통계 대시보드
// ============================================
function updateDashboard() {
  if (state.records.length === 0) return;

  updateSummaryStats();
  updateIndividualStats(); // 개인별 통계 추가
  updateDonutChart();
  updateHistogram();
  updateRecordList();
}

/**
 * 개인별 통계 업데이트
 */
function updateIndividualStats() {
  const gridEl = document.getElementById('individual-stats-grid');
  if (!gridEl) return;

  const speakers = ['유회장', '용쌤', '고영주', '고영은'];
  const speakerStats = {};

  // 초기화
  speakers.forEach(s => {
    speakerStats[s] = {
      total: 0,
      scores: [],
      categories: {}
    };
  });

  // 데이터 집계
  state.records.forEach(r => {
    if (speakerStats[r.발화자]) {
      speakerStats[r.발화자].total++;
      speakerStats[r.발화자].scores.push(Number(r.감정점수));
      speakerStats[r.발화자].categories[r.카테고리] = (speakerStats[r.발화자].categories[r.카테고리] || 0) + 1;
    }
  });

  // 렌더링
  gridEl.innerHTML = speakers.map(s => {
    const stat = speakerStats[s];
    const avgScore = stat.scores.length > 0
      ? (stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length).toFixed(1)
      : '-';

    // 가장 많이 나온 카테고리
    let topCategory = '-';
    let maxCount = 0;
    for (const cat in stat.categories) {
      if (stat.categories[cat] > maxCount) {
        maxCount = stat.categories[cat];
        topCategory = cat;
      }
    }

    const emoji = s === '유회장' ? '👩' : s === '용쌤' ? '👨' : s === '고영주' ? '👧' : '👶';

    return `
      <div class="speaker-stat-card">
        <div class="speaker-stat-name">${emoji} ${s}</div>
        <div class="speaker-stat-total">${stat.total}<span class="unit">건</span></div>
        <div class="speaker-stat-meta">
          <div><span class="label">평균 강도:</span> ${avgScore}</div>
          <div><span class="label">주요 유형:</span> ${topCategory}</div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 요약 통계 업데이트
 */
function updateSummaryStats() {
  const records = state.records;
  const total = records.length;

  // 이번 주 기록 수
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekRecords = records.filter(r => new Date(r.발생일시) >= weekStart);

  // 평균 감정 강도
  const avgScore = records.length > 0
    ? (records.reduce((sum, r) => sum + Number(r.감정점수), 0) / records.length).toFixed(1)
    : '-';

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-week').textContent = weekRecords.length;
  document.getElementById('stat-avg-score').textContent = avgScore;
}

/**
 * 도넛 차트 업데이트 (카테고리별 비율)
 */
function updateDonutChart() {
  const ctx = document.getElementById('chart-donut');
  if (!ctx) return;

  // 카테고리별 집계
  const categoryCounts = {};
  const allCategories = ['비난', '무시', '욕설', '짜증', '기타'];
  allCategories.forEach(c => categoryCounts[c] = 0);

  state.records.forEach(r => {
    if (categoryCounts.hasOwnProperty(r.카테고리)) {
      categoryCounts[r.카테고리]++;
    }
  });

  const labels = allCategories;
  const data = allCategories.map(c => categoryCounts[c]);
  const colors = allCategories.map(c => CATEGORY_COLORS[c]);

  // 기존 차트 파괴
  if (state.charts.donut) {
    state.charts.donut.destroy();
  }

  state.charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderColor: 'rgba(15, 15, 26, 0.8)',
        borderWidth: 3,
        hoverBorderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#9d9db5',
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 10,
            font: {
              family: "'Noto Sans KR', sans-serif",
              size: 12
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(30, 30, 55, 0.95)',
          titleColor: '#e8e8f0',
          bodyColor: '#9d9db5',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { family: "'Noto Sans KR', sans-serif" },
          bodyFont: { family: "'Noto Sans KR', sans-serif" },
          callbacks: {
            label: function (context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
              return ` ${context.label}: ${context.parsed}건 (${pct}%)`;
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        duration: 800,
        easing: 'easeOutQuart'
      }
    }
  });
}

/**
 * 히스토그램 업데이트 (기간별 발생 건수)
 */
function updateHistogram() {
  const ctx = document.getElementById('chart-histogram');
  if (!ctx) return;

  let labels = [];
  let data = [];

  if (state.period === 'daily') {
    // 최근 14일 일간 데이터
    const days = 14;
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      const count = state.records.filter(r => r.발생날짜 === dateStr).length;

      // 간략한 라벨 (MM/DD)
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
      data.push(count);
    }
  } else {
    // 최근 8주 주간 데이터
    const weeks = 8;
    const now = new Date();

    for (let i = weeks - 1; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - (i * 7));
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);

      const count = state.records.filter(r => {
        const d = new Date(r.발생일시);
        return d >= weekStart && d <= weekEnd;
      }).length;

      labels.push(`${weekStart.getMonth() + 1}/${weekStart.getDate()}~`);
      data.push(count);
    }
  }

  // 기존 차트 파괴
  if (state.charts.histogram) {
    state.charts.histogram.destroy();
  }

  state.charts.histogram = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '발생 건수',
        data: data,
        backgroundColor: createGradientArray(ctx, data.length),
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.7,
        categoryPercentage: 0.8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#6b6b85',
            font: {
              family: "'Noto Sans KR', sans-serif",
              size: 10
            },
            maxRotation: 45
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#6b6b85',
            font: {
              family: "'Noto Sans KR', sans-serif",
              size: 11
            },
            stepSize: 1
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(30, 30, 55, 0.95)',
          titleColor: '#e8e8f0',
          bodyColor: '#9d9db5',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { family: "'Noto Sans KR', sans-serif" },
          bodyFont: { family: "'Noto Sans KR', sans-serif" },
          callbacks: {
            label: function (context) {
              return ` ${context.parsed.y}건`;
            }
          }
        }
      },
      animation: {
        duration: 600,
        easing: 'easeOutQuart'
      }
    }
  });
}

/**
 * 히스토그램 막대에 그라데이션 색상 생성
 */
function createGradientArray(ctx, count) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const ratio = i / (count - 1 || 1);
    const r = Math.round(102 + (118 - 102) * ratio);
    const g = Math.round(126 + (75 - 126) * ratio);
    const b = Math.round(234 + (162 - 234) * ratio);
    colors.push(`rgba(${r}, ${g}, ${b}, 0.8)`);
  }
  return colors;
}

/**
 * 최근 기록 리스트 업데이트
 */
function updateRecordList() {
  const listEl = document.getElementById('records-list');
  if (!listEl) return;

  // 모든 기록 표시 (내림차순 정렬)
  const allRecords = [...state.records]
    .sort((a, b) => b.발생일시.localeCompare(a.발생일시));

  if (allRecords.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">📝</div>
        <div class="message">아직 기록이 없어요</div>
        <div class="hint">홈에서 기록을 시작해보세요</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = allRecords.map((record, idx) => {
    const color = CATEGORY_COLORS[record.카테고리] || '#69db7c';
    const emoji = CATEGORY_EMOJI[record.카테고리] || '💬';
    const scoreStars = '⚡'.repeat(Number(record.감정점수));

    // 관리자 모드일 때 체크박스 및 개별 삭제 버튼 추가
    let adminControls = '';
    if (state.isAdmin) {
      adminControls = `
        <div class="admin-item-controls">
          <input type="checkbox" class="record-checkbox" value="${record.id}">
          <button class="btn-delete" onclick="deleteRecord('${record.id}')">🗑️</button>
        </div>
      `;
    }

    // 발생일시에서 시간 부분만
    const timePart = record.발생일시 ? record.발생일시.split(' ')[1] || '' : '';
    const datePart = record.발생날짜 || '';

    return `
      <li class="record-item" style="animation-delay: ${idx * 0.05}s">
        ${adminControls}
        <div class="record-badge" style="background: ${color}">
          ${emoji}
        </div>
        <div class="record-info">
          <div class="record-meta">
            <span class="record-speaker">${record.발화자}</span>
            <span>${datePart} ${timePart}</span>
          </div>
          <div class="record-content">${escapeHtml(record.내용)}</div>
          <div class="record-score">${scoreStars} (${record.감정점수}점)</div>
        </div>
      </li>
    `;
  }).join('');
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * HTML 특수문자 이스케이프
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 토스트 알림 표시
 * @param {string} message - 메시지
 * @param {string} type - 'success' | 'error'
 */
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show' + (type ? ` ${type}` : '');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ============================================
// 앱 초기화 및 시작
// ============================================
window.onload = () => {
  console.log("🌸 부부 대화 분석 앱 - 유회장 & 용쌤 모드 🌸");
  loadData();
};
