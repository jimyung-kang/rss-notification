const { logger } = require('./logger');

/**
 * 통합 포맷터 모듈
 * 제목, 메시지, 날짜 등 모든 포맷팅 로직을 통합 관리
 */

/**
 * 제목에서 소스 프리픽스 제거
 * @param {string} title - 원본 제목
 * @returns {string} 정리된 제목
 */
function cleanTitle(title) {
  if (!title) return '';
  
  // 다양한 형태의 프리픽스 제거
  // [출처] 제목, 【출처】 제목, 〔출처〕 제목 등
  const prefixPatterns = [
    /^\[.*?\]\s*/,     // [출처] 형태
    /^【.*?】\s*/,     // 【출처】 형태
    /^〔.*?〕\s*/,     // 〔출처〕 형태
    /^<.*?>\s*/,       // <출처> 형태
    /^［.*?］\s*/,     // ［출처］ 형태 (전각)
    /^\(.*?\)\s*/,     // (출처) 형태
  ];
  
  let cleanedTitle = title;
  for (const pattern of prefixPatterns) {
    cleanedTitle = cleanedTitle.replace(pattern, '');
  }
  
  return cleanedTitle.trim();
}

/**
 * HTML 특수문자 이스케이프
 * @param {string} text - 원본 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeHtml(text) {
  if (!text) return '';
  
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  return text.replace(/[&<>"']/g, char => escapeMap[char]);
}

/**
 * 날짜 포맷팅 (한국 시간)
 * @param {Date|string} date - 날짜 객체 또는 문자열
 * @returns {string} 포맷된 날짜 문자열
 */
function formatDate(date) {
  try {
    const d = new Date(date);
    return d.toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\./g, '-').replace(/\s/g, '').slice(0, -1);
  } catch (error) {
    return date;
  }
}

/**
 * 상대 시간 포맷팅 (예: 3시간 전)
 * @param {Date|string} date - 날짜 객체 또는 문자열
 * @returns {string} 상대 시간 문자열
 */
function formatRelativeTime(date) {
  const now = new Date();
  const articleDate = new Date(date);
  const diffMs = now - articleDate;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  } else if (diffHours < 24) {
    return `${diffHours}시간 전`;
  } else if (diffDays < 7) {
    return `${diffDays}일 전`;
  } else {
    return formatDate(date);
  }
}

/**
 * 텔레그램 메시지 포맷팅
 * @param {Object} article - 아티클 객체
 * @param {string} sourceNameKo - 한글 소스명 (선택사항)
 * @returns {string} 포맷된 메시지
 */
function formatMessage(article, sourceNameKo) {
  let message = '';
  
  // 1. 출처 표시 ([ 출처 ] 형식)
  const source = sourceNameKo || article.source;
  if (source) {
    message += `[ ${source} ]\n`;
  }
  
  // 2. 제목 (소스 프리픽스 제거)
  if (article.title) {
    const cleanedTitle = cleanTitle(article.title);
    message += `${escapeHtml(cleanedTitle)}\n\n`;
  }

  // 3. URL
  if (article.url) {
    message += `${article.url}`;
  }
  
  return message;
}

/**
 * 텍스트 요약 (긴 텍스트 줄이기)
 * @param {string} text - 원본 텍스트
 * @param {number} maxLength - 최대 길이 (기본 200)
 * @returns {string} 요약된 텍스트
 */
function summarizeText(text, maxLength = 200) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength) + '...';
}

/**
 * 서비스명 한글 매핑
 */
const serviceNameMap = {
  'geeknews': 'GeekNews',
  'kofeArticle': 'Korean FE Article',
  'velog': 'Velog',
  'toss': 'Toss',
  'naverd2': 'Naver D2',
  'naverfenews': 'Naver FE News',
  'toast': 'NHN Toast',
  'woowahan': '우아한형제들',
  'kakao': '카카오',
  'kakaoenterprise': '카카오엔터프라이즈',
  'lycorp': '라인',
  'banksalad': '뱅크샐러드',
  'gaerae': '개발자스럽다',
  'hyperconnect': 'Hyperconnect',
  '44bits': '44BITS'
};

/**
 * 서비스명 변환
 * @param {string} serviceName - 서비스 영문명
 * @returns {string} 한글 서비스명
 */
function getServiceNameKo(serviceName) {
  return serviceNameMap[serviceName] || serviceName;
}

module.exports = {
  cleanTitle,
  escapeHtml,
  formatDate,
  formatRelativeTime,
  formatMessage,
  summarizeText,
  getServiceNameKo
};