const BaseScheduler = require('../common/baseScheduler');
const { logger, logError } = require('../../utils/logger');

class KofeArticleScheduler extends BaseScheduler {
  constructor(articleService, messenger, cache) {
    super(articleService, messenger, {
      schedule: process.env.RSS_SCHEDULE_CRON,
      timezone: process.env.TZ || 'Asia/Seoul',
      domainName: 'Korean FE Article'
    });
    this.cache = cache;
  }


  /**
   * 실제 아티클 체크 및 전송 로직 구현
   */
  async executeArticleCheck(triggerType) {
    // 새로운 아티클 조회
    const articles = await this.articleService.getRecentArticles();

    if (articles.length === 0) {
      logger.info(`새로운 ${this.domainName}이 없습니다`);
      return { success: true, articlesFound: 0, messagesSent: 0 };
    }

    // 캐시를 이용한 중복 제거 (once 모드에서는 캐시 우회)
    const newArticles = this.cache.filterNewPosts(articles, article => article.url, this.bypassCache);

    if (newArticles.length === 0) {
      logger.info('모든 아티클이 이미 전송되었습니다');
      return { success: true, articlesFound: articles.length, messagesSent: 0 };
    }

    // 각 아티클을 텔레그램으로 전송
    let successCount = 0;
    let failCount = 0;

    for (const article of newArticles) {
      try {
        // 메시지 전송
        await this.messenger.sendArticle(article);
        
        // 캐시에 추가 (once 모드에서는 캐시에 추가하지 않음)
        this.cache.markAsSent(article.url, this.bypassCache);
        
        successCount++;
        this.stats.articlesProcessed++;
        
        logger.info(`${this.domainName} 전송 성공: ${article.title}`);
        
        // 연속 전송 시 부하 방지를 위한 딜레이
        if (newArticles.length > 1) {
          await this.sleep(1000);
        }
        
      } catch (error) {
        failCount++;
        logError(error, { 
          context: `${this.domainName} 전송 실패`,
          articleTitle: article.title 
        });
      }
    }

    return {
      success: true,
      articlesFound: articles.length,
      messagesSent: successCount,
      failed: failCount
    };
  }

}

module.exports = KofeArticleScheduler;