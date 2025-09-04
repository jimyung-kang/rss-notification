/**
 * 날짜 유틸리티 함수들
 * 시간대 문제를 해결하고 일관된 날짜 처리를 제공
 */

// 전역 필터 날짜 설정 (기본값: 1일)
let globalFilterDays = 1;

/**
 * 전역 필터 날짜 설정
 * @param {number} days - 필터링할 날짜 수
 */
function setGlobalFilterDays(days) {
  globalFilterDays = Math.max(1, Math.min(30, days)); // 1-30일 제한
}

/**
 * 전역 필터 날짜 가져오기
 * @returns {number} 현재 설정된 필터 날짜 수
 */
function getGlobalFilterDays() {
  return globalFilterDays;
}

/**
 * 한국 시간 기준으로 오늘 0시 0분 0초를 반환
 * @returns {Date} 한국 시간 기준 오늘 0시
 */
function getKoreaTodayStart() {
  const now = new Date();
  const koreaToday = new Date();
  
  // 한국 시간으로 오늘 0시 설정
  koreaToday.setHours(0, 0, 0, 0);
  
  return koreaToday;
}

/**
 * 한국 시간 기준으로 N일 전 0시 0분 0초를 반환
 * @param {number} daysAgo - 며칠 전인지 (0=오늘, 1=어제, 2=그제...)
 * @returns {Date} 한국 시간 기준 N일 전 0시
 */
function getKoreaDaysAgoStart(daysAgo = 0) {
  const date = getKoreaTodayStart();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

/**
 * 아티클이 최근 N일 이내인지 확인
 * @param {Date|string} articleDate - 아티클 날짜
 * @param {number} days - 최근 며칠 이내인지 (기본값: 0 = 오늘만)
 * @returns {boolean} 최근 N일 이내 여부
 */
function isRecentArticle(articleDate, days = 0) {
  const article = new Date(articleDate);
  const cutoffDate = getKoreaDaysAgoStart(days);
  
  return article >= cutoffDate;
}

/**
 * 테스트용: 최근 N일 이내 아티클 필터링
 * @param {Array} articles - 아티클 배열
 * @param {number} days - 필터링할 날짜 수 (1=오늘만, 2=어제+오늘, 기본값: 전역 설정값)
 * @returns {Array} 필터링된 아티클 배열
 */
function filterRecentArticles(articles, days = null) {
  // days가 null이면 전역 설정값 사용
  const filterDays = days !== null ? days : globalFilterDays;
  // filter-days=1이면 오늘만, 2이면 어제부터 (days-1일 전부터)
  const daysAgo = filterDays > 0 ? filterDays - 1 : 0;
  const cutoffDate = getKoreaDaysAgoStart(daysAgo);
  
  return articles.filter(article => {
    const articleDate = new Date(article.pubDate || article.isoDate || article.date);
    const isValid = articleDate >= cutoffDate;
    
    // 디버그 로그
    console.log(`날짜 체크 (최근 ${filterDays}일):`, {
      title: article.title?.substring(0, 50) + '...',
      articleDate: articleDate.toISOString(),
      cutoffDate: cutoffDate.toISOString(),
      valid: isValid
    });
    
    return isValid;
  });
}

/**
 * 주어진 날짜가 오늘인지 확인 (한국 시간 기준)
 * @param {Date|string} dateInput - 확인할 날짜
 * @returns {boolean} 오늘인지 여부
 */
function isToday(dateInput) {
  if (!dateInput) return false;
  
  const date = new Date(dateInput);
  const today = new Date();
  
  // 한국 시간대 기준으로 날짜 비교
  const dateKST = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
  const todayKST = new Date(today.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
  
  return dateKST.getFullYear() === todayKST.getFullYear() &&
         dateKST.getMonth() === todayKST.getMonth() &&
         dateKST.getDate() === todayKST.getDate();
}

/**
 * 오늘 날짜의 포스트만 필터링
 * @param {Array} posts - 포스트 배열
 * @returns {Array} 오늘 날짜의 포스트만 포함된 배열
 */
function filterTodayPosts(posts) {
  return posts.filter(post => {
    // 다양한 날짜 필드 체크
    const dateFields = [
      post.date,
      post.createdAt,
      post.publishedAt,
      post.created_at,
      post.published_at,
      post.isoDate,
      post.pubDate
    ];
    
    // 하나라도 오늘 날짜면 포함
    return dateFields.some(date => isToday(date));
  });
}

module.exports = {
  getKoreaTodayStart,
  getKoreaDaysAgoStart,
  isRecentArticle,
  filterRecentArticles,
  isToday,
  filterTodayPosts,
  setGlobalFilterDays,
  getGlobalFilterDays
};