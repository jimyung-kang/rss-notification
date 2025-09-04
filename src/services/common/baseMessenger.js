const { formatMessage, getServiceNameKo } = require('../../utils/formatters');
const { logger, logError } = require('../../utils/logger');

/**
 * 메신저 베이스 클래스
 * 모든 서비스의 텔레그램 전송 로직
 */
class BaseMessenger {
  constructor(serviceKey, isDryRun = false) {
    this.serviceKey = serviceKey;
    this.serviceName = getServiceNameKo(serviceKey);
    this.isDryRun = isDryRun;
  }

  /**
   * 개별 아티클 전송
   */
  async sendPost(article) {
    try {
      const message = formatMessage(article, this.serviceName);
      
      if (this.isDryRun) {
        logger.info(`[DRY RUN] ${this.serviceName} 아티클 전송 시뮬레이션`, {
          title: article.title,
          url: article.url,
          messageLength: message.length
        });
        return true;
      }
      
      // infrastructure/telegram으로 경로 수정 필요
      const telegram = require('../../infrastructure/telegram');
      await telegram.sendMessage(message);
      
      logger.info(`${this.serviceName} 아티클 전송 성공`, {
        title: article.title,
        url: article.url
      });
      
      return true;
    } catch (error) {
      logError(error, { 
        context: `${this.serviceName} 아티클 전송 실패`,
        article: article.title 
      });
      throw error;
    }
  }

  /**
   * 여러 아티클 일괄 전송
   */
  async sendPosts(articles) {
    if (!articles || articles.length === 0) {
      logger.info(`전송할 ${this.serviceName} 아티클이 없습니다`);
      return { success: 0, failed: 0 };
    }

    let successCount = 0;
    let failedCount = 0;

    for (const article of articles) {
      try {
        await this.sendPost(article);
        successCount++;
        
        // 연속 전송 시 딜레이 (텔레그램 제한 방지)
        if (articles.length > 1) {
          await this.sleep(1000);
        }
      } catch (error) {
        failedCount++;
        logError(error, { 
          context: `${this.serviceName} 아티클 전송 실패`,
          title: article.title 
        });
      }
    }

    logger.info(`${this.serviceName} 아티클 전송 완료`, {
      total: articles.length,
      success: successCount,
      failed: failedCount
    });

    return { success: successCount, failed: failedCount };
  }

  /**
   * 딜레이 유틸리티
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BaseMessenger;