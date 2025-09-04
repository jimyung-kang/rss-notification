const axios = require('axios');
const { config } = require('../../config/config');
const { logger, logError } = require('../../utils/logger');
const BanksaladFormatter = require('./articleFormatter');

class BanksaladMessenger {
  constructor() {
    this.formatter = BanksaladFormatter;
    this.botToken = config.telegram.botToken;
    this.chatId = config.telegram.chatId;
    this.retryConfig = config.retry;
  }

  /**
   * 아티클을 텔레그램으로 전송
   */
  async sendArticle(article) {
    const message = this.formatter.formatArticleMessage(article);
    return await this.sendDirectMessage(message);
  }

  /**
   * 텔레그램 API를 직접 호출하여 메시지 전송
   */
  async sendDirectMessage(text) {
    const url = `https://api.telegram.org/bot${this.botToken}/sendmessage`;
    
    const params = {
      chat_id: this.chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    };

    let lastError;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        logger.info('텔레그램 직접 메시지 전송 시도', {
          attempt,
          maxAttempts: this.retryConfig.maxAttempts
        });

        const response = await axios.post(url, params, {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.data.ok) {
          logger.info('텔레그램 메시지 전송 성공');
          return response.data.result;
        } else {
          throw new Error(`텔레그램 API 오류: ${response.data.description}`);
        }

      } catch (error) {
        lastError = error;
        
        if (attempt < this.retryConfig.maxAttempts) {
          const delay = this.retryConfig.delay * Math.pow(2, attempt - 1);
          logger.warn(`텔레그램 전송 실패, ${delay}ms 후 재시도 (${attempt}/${this.retryConfig.maxAttempts})`, {
            error: error.message
          });
          await this.sleep(delay);
        }
      }
    }

    // 모든 재시도 실패
    logError(lastError, { 
      context: '텔레그램 메시지 전송 최종 실패',
      attempts: this.retryConfig.maxAttempts
    });
    throw lastError;
  }

  /**
   * 대기 함수
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BanksaladMessenger;