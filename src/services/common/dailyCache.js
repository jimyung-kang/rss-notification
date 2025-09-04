const fs = require('fs');
const path = require('path');
const { logger } = require('../../utils/logger');

/**
 * 하루 단위 캐시 시스템
 * 실행 모드별 캐시 전략:
 * - once 모드: 캐시 완전 우회 (매번 새로 실행)
 * - start:times 모드: 메모리 캐시만 사용
 * - GitHub Actions (CI): 파일 캐시 사용
 */
class DailyCache {
  constructor(domainName, options = {}) {
    this.domainName = domainName;
    this.dailyCache = new Map(); // 날짜별 전송 캐시
    
    // 캐시 모드 결정
    this.cacheMode = this.determineCacheMode(options);
    this.cacheDir = options.cacheDir ?? '.cache';
    this.cacheFile = path.join(this.cacheDir, 'rss-daily-cache.json');
    
    logger.info(`${this.domainName} 캐시 모드: ${this.cacheMode}`);
    
    // 파일 캐시 모드에서만 파일 로드
    if (this.cacheMode === 'file') {
      this.loadFromFile();
    }
  }

  /**
   * 실행 모드에 따른 캐시 전략 결정
   */
  determineCacheMode(options = {}) {
    // 명시적 옵션이 있으면 우선
    if (options.cacheMode) {
      return options.cacheMode;
    }

    // once 모드: 캐시 완전 우회
    if (options.bypassCache || process.argv.includes('--once')) {
      return 'bypass';
    }

    // CI 환경: 파일 캐시 사용
    if (process.env.CI === 'true') {
      return 'file';
    }

    // 기본값: 메모리 캐시 (start:times 모드)
    return 'memory';
  }

  /**
   * 오늘 날짜 키 생성
   */
  getTodayKey() {
    return new Date().toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\./g, '-').replace(/\s/g, '').slice(0, -1);
  }

  /**
   * 파일에서 캐시 로드 (GitHub Actions용)
   */
  loadFromFile() {
    try {
      if (!fs.existsSync(this.cacheFile)) {
        logger.info(`${this.domainName} 캐시 파일 없음: 새로 시작`);
        return;
      }
      
      const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
      const today = this.getTodayKey();
      
      // 오늘 날짜 캐시만 로드 (오래된 캐시는 무시)
      if (data[today]) {
        this.dailyCache.set(today, new Set(data[today]));
        logger.info(`${this.domainName} 캐시 파일 로드 완료: ${data[today].length}개 항목`);
      }
    } catch (error) {
      logger.warn(`${this.domainName} 캐시 파일 로드 실패:`, error.message);
    }
  }
  
  /**
   * 파일에 캐시 저장 (file 모드에서만)
   */
  saveToFile() {
    // file 모드가 아니면 저장하지 않음
    if (this.cacheMode !== 'file') {
      return;
    }
    
    try {
      // 캐시 디렉토리 생성
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      
      // Map을 JSON 직렬화 가능한 객체로 변환
      const data = {};
      for (const [date, cache] of this.dailyCache.entries()) {
        data[date] = Array.from(cache);
      }
      
      fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2));
      logger.debug(`${this.domainName} 캐시 파일 저장 완료: ${this.cacheFile}`);
    } catch (error) {
      logger.warn(`${this.domainName} 캐시 파일 저장 실패:`, error.message);
    }
  }

  /**
   * 오늘의 캐시 가져오기 (없으면 생성)
   */
  getTodayCache() {
    const today = this.getTodayKey();
    
    if (!this.dailyCache.has(today)) {
      this.dailyCache.set(today, new Set());
      logger.info(`${this.domainName} 새로운 일일 캐시 생성: ${today}`);
    }
    
    return this.dailyCache.get(today);
  }

  /**
   * 포스트가 이미 전송되었는지 확인
   * @param {string} postId - 포스트 ID
   * @param {boolean} bypassCache - 캐시 우회 여부 (호환성 유지용, deprecated)
   */
  hasSent(postId, bypassCache = false) {
    // bypass 모드: 항상 false (전송 안됨으로 처리)
    if (this.cacheMode === 'bypass' || bypassCache) {
      logger.debug(`${this.domainName} 캐시 우회 모드: ${postId} 체크 스킵`);
      return false;
    }
    
    const todayCache = this.getTodayCache();
    return todayCache.has(postId);
  }

  /**
   * 전송된 포스트를 캐시에 추가
   * @param {string} postId - 포스트 ID  
   * @param {boolean} bypassCache - 캐시 우회 여부 (호환성 유지용, deprecated)
   */
  markAsSent(postId, bypassCache = false) {
    // bypass 모드: 캐시에 추가하지 않음
    if (this.cacheMode === 'bypass' || (bypassCache && this.cacheMode !== 'file')) {
      logger.debug(`${this.domainName} 캐시 우회 모드: ${postId} 저장 스킵`);
      return;
    }
    
    const todayCache = this.getTodayCache();
    todayCache.add(postId);
    logger.debug(`${this.domainName} 캐시에 추가 (${this.cacheMode} 모드): ${postId}`);
    
    // 파일 캐시 모드에서는 즉시 저장
    if (this.cacheMode === 'file') {
      this.saveToFile();
    }
  }

  /**
   * 새로운 포스트만 필터링하고 캐시에 추가 (캐시되지 않은 포스트)
   * @param {Array} posts - 포스트 배열
   * @param {Function} getPostId - 포스트 ID 추출 함수
   * @param {boolean} bypassCache - 캐시 우회 여부 (호환성 유지용, deprecated)
   * @param {boolean} markAsProcessed - 필터링된 포스트를 자동으로 캐시에 추가할지 여부 (기본값: true)
   */
  filterNewPosts(posts, getPostId = (post) => post.url || post.topicUrl, bypassCache = false, markAsProcessed = true) {
    // bypass 모드: 모든 포스트 반환 (캐시 확인/추가 안함)
    if (this.cacheMode === 'bypass' || (bypassCache && this.cacheMode !== 'file')) {
      logger.info(`${this.domainName} 캐시 우회 모드: 모든 포스트 반환 (${posts.length}개)`);
      return posts;
    }
    
    const todayCache = this.getTodayCache();
    const newPosts = posts.filter(post => {
      const postId = getPostId(post);
      return !todayCache.has(postId);
    });
    
    // 새로운 포스트들을 캐시에 추가 (markAsProcessed가 true일 때만)
    if (markAsProcessed && newPosts.length > 0) {
      newPosts.forEach(post => {
        const postId = getPostId(post);
        todayCache.add(postId);
        logger.debug(`${this.domainName} 캐시에 추가 (${this.cacheMode} 모드): ${postId}`);
      });
      
      // 파일 캐시 모드에서는 즉시 저장
      if (this.cacheMode === 'file') {
        this.saveToFile();
      }
    }
    
    logger.info(`${this.domainName} 캐시 필터링 (${this.cacheMode} 모드): ${posts.length}개 → ${newPosts.length}개`);
    return newPosts;
  }

  /**
   * 여러 포스트를 한 번에 캐시에 추가
   */
  markMultipleAsSent(posts, getPostId = (post) => post.url || post.topicUrl) {
    const todayCache = this.getTodayCache();
    posts.forEach(post => {
      const postId = getPostId(post);
      todayCache.add(postId);
    });
    logger.info(`${this.domainName} ${posts.length}개 포스트 캐시에 추가`);
  }

  /**
   * 오늘의 캐시 통계
   */
  getTodayStats() {
    const today = this.getTodayKey();
    const todayCache = this.dailyCache.get(today);
    
    return {
      date: today,
      cachedCount: todayCache ? todayCache.size : 0,
      domainName: this.domainName,
      cacheMode: this.cacheMode
    };
  }

  /**
   * 오래된 캐시 정리 (이전 날짜 캐시 삭제)
   */
  cleanupOldCache() {
    const today = this.getTodayKey();
    let cleanedCount = 0;

    // 오늘이 아닌 모든 캐시 삭제
    for (const [date, cache] of this.dailyCache.entries()) {
      if (date !== today) {
        this.dailyCache.delete(date);
        cleanedCount++;
        logger.info(`${this.domainName} 오래된 캐시 삭제: ${date} (${cache.size}개 항목)`);
      }
    }

    if (cleanedCount === 0) {
      logger.debug(`${this.domainName} 정리할 오래된 캐시 없음`);
    }

    return cleanedCount;
  }

  /**
   * 전체 캐시 상태 조회
   */
  getCacheStatus() {
    const stats = [];
    
    for (const [date, cache] of this.dailyCache.entries()) {
      stats.push({
        date,
        count: cache.size,
        isToday: date === this.getTodayKey()
      });
    }

    return {
      domainName: this.domainName,
      totalDates: this.dailyCache.size,
      dates: stats
    };
  }
}

module.exports = DailyCache;