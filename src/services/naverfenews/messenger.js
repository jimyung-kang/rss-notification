const telegramService = require('../../infrastructure/telegram');
const { logger } = require('../../utils/logger');
const { formatMessage, getServiceNameKo } = require('../../utils/formatters');

/**
 * Naver FE News 메신저 생성 함수
 */
function createMessenger(isDryRun = false) {
  return {
    /**
     * Naver FE News 업데이트 메시지 전송
     */
    async sendUpdate(update) {
      const message = this.formatMessage(update);
      
      if (isDryRun) {
        logger.info('[DRY RUN] Naver FE News 메시지:', message);
        return true;
      }
      
      // 텔레그램 서비스 초기화 보장
      if (!telegramService.isInitialized) {
        await telegramService.initialize();
      }
      
      return telegramService.sendMessage(message);
    },

    /**
     * 메시지 포맷팅 (표준 형식 사용)
     */
    formatMessage(update) {
      // 표준 포맷터를 사용하여 다른 서비스와 통일된 형식으로 메시지 생성
      const article = {
        title: update.title,
        url: update.url
      };
      
      const serviceName = getServiceNameKo('naverfenews');
      return formatMessage(article, serviceName);
    }
  };
}

module.exports = createMessenger;