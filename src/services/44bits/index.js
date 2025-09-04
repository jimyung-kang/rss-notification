const Bits44ArticleService = require('./articleService');
const Bits44Scheduler = require('./scheduler');
const Bits44Messenger = require('./messenger');
const Bits44Formatter = require('./articleFormatter');
const Bits44RssParser = require('./rssParser');
const DailyCache = require('../common/dailyCache');

class Bits44 {
  constructor(options = {}) {
    // 각 컴포넌트 초기화
    this.articleService = new Bits44ArticleService();
    this.messenger = new Bits44Messenger();
    this.cache = new DailyCache('44BITS', options.cache);
    this.scheduler = new Bits44Scheduler(this.articleService, this.messenger, this.cache);
    this.formatter = Bits44Formatter;
  }

  /**
   * 도메인 시작
   */
  start() {
    // 시작 시 오래된 캐시 정리
    this.cache.cleanupOldCache();
    return this.scheduler.start();
  }

  /**
   * 도메인 중지
   */
  stop() {
    return this.scheduler.stop();
  }

  /**
   * 수동 아티클 체크
   */
  async runManualCheck() {
    return await this.scheduler.runManualCheck();
  }

  /**
   * 최신 아티클 조회
   */
  async getLatestArticles(count = 5) {
    return await this.articleService.getLatestArticles(count);
  }

  /**
   * 피드 상태 확인
   */
  async checkFeedHealth() {
    return await this.articleService.checkFeedHealth();
  }

  /**
   * 스케줄러 통계
   */
  getStats() {
    const schedulerStats = this.scheduler.getStats();
    const cacheStats = this.cache.getTodayStats();
    
    return {
      ...schedulerStats,
      cache: cacheStats
    };
  }

  /**
   * 직접 메시지 전송 (호환성 유지)
   */
  async sendDirectMessage(message) {
    return await this.messenger.sendDirectMessage(message);
  }

  /**
   * 메시지 포맷팅 (호환성 유지)
   */
  formatArticleMessage(article) {
    return this.formatter.formatArticleMessage(article);
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
module.exports = Bits44;