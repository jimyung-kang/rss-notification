const TelegramBot = require('node-telegram-bot-api');
const { config } = require('../config/config');
const { logger, logTelegramMessage, logError } = require('../utils/logger');

class TelegramService {
  constructor() {
    // 텔레그램 봇 인스턴스 (아직 초기화하지 않음)
    this.bot = null;
    // 채팅방 ID
    this.chatId = config.telegram.chatId;
    // 봇 초기화 상태
    this.isInitialized = false;
    // dry-run 모드 상태
    this.isDryRun = false;
  }

  /**
   * Dry-run 모드 설정
   */
  setDryRunMode(isDryRun = false) {
    this.isDryRun = isDryRun;
    if (isDryRun) {
      logger.info('[DRY RUN] 텔레그램 서비스가 DRY RUN 모드로 설정되었습니다');
    }
  }

  /**
   * 텔레그램 봇 초기화
   * 웹훅 모드가 아닌 일반 모드로 초기화 (메시지 전송만 사용)
   */
  async initialize() {
    if (this.isDryRun) {
      logger.info('[DRY RUN] 텔레그램 봇 초기화 시뮬레이션');
      this.isInitialized = true;
      return true;
    }

    try {
      logger.info('텔레그램 봇 초기화 시작');

      // 봇 인스턴스 생성 (polling 비활성화 - 메시지 전송만 사용)
      this.bot = new TelegramBot(config.telegram.botToken, { polling: false });

      // 봇 정보 확인
      const botInfo = await this.bot.getMe();
      logger.info(`텔레그램 봇 초기화 성공: @${botInfo.username}`);

      // 채팅방 정보 확인
      await this.verifyChatAccess();

      this.isInitialized = true;
      return true;
    } catch (error) {
      logError(error, { context: '텔레그램 봇 초기화' });
      throw new Error(`텔레그램 봇 초기화 실패: ${error.message}`);
    }
  }

  /**
   * 채팅방 접근 권한 확인
   */
  async verifyChatAccess() {
    try {
      // 채팅방 정보 가져오기만 하고 테스트 메시지는 보내지 않음
      const chat = await this.bot.getChat(this.chatId);
      logger.info(`채팅방 확인 완료: ${chat.title || chat.username || 'Private Chat'}`);
      
      // 채팅방 접근이 가능한지 getChat이 성공하면 확인된 것으로 간주
      // 실제 메시지 전송은 하지 않음 (사용자에게 불필요한 알림 방지)
      logger.info('텔레그램 연결 확인 완료 (채팅방 접근 가능)');
      
      return true;
    } catch (error) {
      logError(error, { context: '채팅방 접근 확인' });
      throw new Error(`채팅방 접근 실패: ${error.message}`);
    }
  }

  /**
   * 텔레그램으로 메시지 전송
   * @param {string|object} content - 전송할 메시지 내용
   * @param {object} options - 추가 옵션
   */
  async sendMessage(content, options = {}) {
    if (!this.isInitialized) {
      throw new Error('텔레그램 봇이 초기화되지 않았습니다');
    }

    // 메시지 포맷팅
    const formattedMessage = this.formatMessage(content);

    if (this.isDryRun) {
      logTelegramMessage('[DRY RUN] 메시지 전송 시뮬레이션', { 
        messageLength: formattedMessage.length,
        preview: formattedMessage.substring(0, 100) + '...'
      });
      return [{ message_id: 'dry-run-' + Date.now() }];
    }

    try {
      // 메시지가 너무 길면 잘라서 전송
      const messages = this.splitMessage(formattedMessage);

      const results = [];
      for (const message of messages) {
        const result = await this.sendWithRetry(message, options);
        results.push(result);
      }

      logTelegramMessage('메시지 전송 성공', { 
        messageCount: messages.length,
        totalLength: formattedMessage.length 
      });

      return results;
    } catch (error) {
      logError(error, { context: '텔레그램 메시지 전송' });
      throw error;
    }
  }

  /**
   * 재시도 로직과 함께 메시지 전송
   */
  async sendWithRetry(message, options = {}) {
    const maxRetries = config.retry.maxAttempts;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.bot.sendMessage(
          this.chatId,
          message,
          {
            parse_mode: config.message.parseMode,
            disable_web_page_preview: true,
            ...options
          }
        );

        return result;
      } catch (error) {
        lastError = error;
        logger.warn(`메시지 전송 실패 (시도 ${attempt}/${maxRetries})`, {
          error: error.message
        });

        if (attempt < maxRetries) {
          // 지수 백오프로 재시도 대기
          const delay = config.retry.delay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`메시지 전송 실패 (${maxRetries}회 시도): ${lastError.message}`);
  }

  /**
   * 메시지 포맷팅 (문자열은 그대로 반환)
   */
  formatMessage(content) {
    // content가 문자열인 경우 그대로 반환
    if (typeof content === 'string') {
      return content;
    }

    // 객체인 경우 경고 로그 후 JSON 형태로 반환
    logger.warn('formatMessage: 객체 형태 content는 사전 포맷팅 필요', { content });
    return JSON.stringify(content, null, 2);
  }


  /**
   * 긴 메시지를 텔레그램 제한에 맞춰 분할
   */
  splitMessage(message) {
    const maxLength = config.message.maxLength;
    
    if (message.length <= maxLength) {
      return [message];
    }

    const messages = [];
    let currentMessage = '';

    const lines = message.split('\n');
    
    for (const line of lines) {
      if (currentMessage.length + line.length + 1 > maxLength) {
        if (currentMessage) {
          messages.push(currentMessage.trim());
          currentMessage = '';
        }
        
        // 한 줄이 maxLength보다 긴 경우
        if (line.length > maxLength) {
          const chunks = this.chunkString(line, maxLength - 10);
          messages.push(...chunks);
        } else {
          currentMessage = line;
        }
      } else {
        currentMessage += (currentMessage ? '\n' : '') + line;
      }
    }

    if (currentMessage) {
      messages.push(currentMessage.trim());
    }

    return messages;
  }

  /**
   * 문자열을 지정된 길이로 분할
   */
  chunkString(str, size) {
    const chunks = [];
    for (let i = 0; i < str.length; i += size) {
      chunks.push(str.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 대기 함수
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 봇 종료
   */
  async shutdown() {
    if (this.bot) {
      logger.info('텔레그램 봇 종료');
      await this.bot.stopPolling();
      this.bot = null;
      this.isInitialized = false;
    }
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
module.exports = new TelegramService();