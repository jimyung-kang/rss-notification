const TelegramBot = require('node-telegram-bot-api');
const { config } = require('../../config/config');
const { logger, logError } = require('../../utils/logger');
const articleFormatter = require('./articleFormatter');

class GeekNewsMessenger {
  constructor(isDryRun = false) {
    this.bot = null;
    this.chatId = config.telegram.chatId;
    this.isInitialized = false;
    this.formatter = articleFormatter;
    this.isDryRun = isDryRun;
  }

  /**
   * 메신저 초기화
   */
  async initialize() {
    if (this.isDryRun) {
      logger.info('[DRY RUN] GeekNews 텔레그램 메신저 초기화 시뮬레이션');
      this.isInitialized = true;
      return true;
    }
    
    try {
      logger.info('GeekNews 텔레그램 메신저 초기화 시작');

      this.bot = new TelegramBot(config.telegram.botToken, { polling: false });
      const botInfo = await this.bot.getMe();
      
      logger.info(`GeekNews 메신저 초기화 성공: @${botInfo.username}`);
      this.isInitialized = true;
      
      return true;
    } catch (error) {
      logError(error, { context: 'GeekNews 메신저 초기화' });
      throw error;
    }
  }

  /**
   * 포스트 메시지 전송
   */
  async sendPost(post) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const formattedMessage = this.formatter.formatPostMessage(post);
      
      if (this.isDryRun) {
        logger.info('[DRY RUN] GeekNews 포스트 전송 시뮬레이션', {
          title: post.title.substring(0, 50),
          messageLength: formattedMessage.length
        });
        return { message_id: 'dry-run-' + Date.now() };
      }
      
      const result = await this.bot.sendMessage(
        this.chatId,
        formattedMessage,
        {
          parse_mode: config.message.parseMode,
          disable_web_page_preview: false
        }
      );

      logger.info('GeekNews 포스트 전송 성공', {
        title: post.title.substring(0, 50),
        messageLength: formattedMessage.length
      });

      return result;
    } catch (error) {
      logError(error, { context: 'GeekNews 포스트 전송' });
      throw error;
    }
  }

  /**
   * 여러 포스트 순차 전송
   */
  async sendPosts(posts) {
    const results = [];
    
    for (const post of posts) {
      try {
        const result = await this.sendPost(post);
        results.push(result);
        
        // 연속 전송 시 딜레이
        if (posts.length > 1) {
          await this.sleep(1000);
        }
      } catch (error) {
        logError(error, { 
          context: 'GeekNews 포스트 전송 실패', 
          post: post.title 
        });
      }
    }

    return results;
  }

  /**
   * 대기 함수
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 메신저 종료
   */
  async shutdown() {
    if (this.bot && this.isInitialized) {
      logger.info('GeekNews 메신저 종료');
      this.bot = null;
      this.isInitialized = false;
    }
  }
}

// 팩토리 함수로 변경하여 isDryRun 전달 가능하게 함
function createGeekNewsMessenger(isDryRun = false) {
  return new GeekNewsMessenger(isDryRun);
}

// 기본 인스턴스 (하위 호환성)
createGeekNewsMessenger.instance = new GeekNewsMessenger();

module.exports = createGeekNewsMessenger;