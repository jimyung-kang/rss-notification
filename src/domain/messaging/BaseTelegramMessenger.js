/**
 * 베이스 텔레그램 메신저 클래스
 * 
 * 설계 원칙:
 * - Template Method Pattern: 공통 전송 로직은 기본 구현, 특화 로직은 오버라이드
 * - Retry Strategy: 지수 백오프를 통한 안정적인 재시도
 * - Dry Run Support: 테스트 모드에서 실제 API 호출 방지
 * - Error Handling: 상세한 에러 로깅과 컨텍스트 제공
 */

const axios = require('axios');
const { config } = require('../../config/config');
const { logger, logError } = require('../../utils/logger');
const { COMMON_MESSAGES, TIMEOUTS } = require('../constants/ServiceConstants');

/**
 * 텔레그램 메신저 베이스 클래스
 */
class BaseTelegramMessenger {
  #formatter
  #isDryRun
  #botToken
  #chatId
  #retryConfig
  #isInitialized = false

  constructor(formatter, isDryRun = false) {
    this.#formatter = formatter;
    this.#isDryRun = isDryRun;
    this.#botToken = config.telegram.botToken;
    this.#chatId = config.telegram.chatId;
    this.#retryConfig = config.retry;

    if (isDryRun) {
      logger.info(COMMON_MESSAGES.DRY_RUN_MODE);
    }
  }

  // Getters for private fields
  get isDryRun() { return this.#isDryRun; }
  get isInitialized() { return this.#isInitialized; }

  /**
   * 메신저 초기화 (템플릿 메서드)
   */
  async initialize() {
    if (this.#isDryRun) {
      logger.info('[DRY RUN] 텔레그램 메신저 초기화 시뮬레이션');
      this.#isInitialized = true;
      return true;
    }

    try {
      // 실제 봇 정보 확인
      await this.#validateBotConfiguration();
      this.#isInitialized = true;
      logger.info('텔레그램 메신저 초기화 완료');
      return true;
    } catch (error) {
      logError(error, { context: '텔레그램 메신저 초기화 실패' });
      this.#isInitialized = false;
      return false;
    }
  }

  /**
   * 봇 설정 검증 (Private method)
   */
  async #validateBotConfiguration() {
    const url = `https://api.telegram.org/bot${this.#botToken}/getMe`;
    
    try {
      const response = await axios.get(url, {
        timeout: TIMEOUTS.HTTP_REQUEST
      });
      
      if (!response.data?.ok) {
        throw new Error(`Bot 설정 오류: ${response.data?.description ?? 'Unknown error'}`);
      }
      
      const { username, id } = response.data.result;
      logger.info('텔레그램 봇 설정 검증 완료', { botUsername: username, botId: id });
      
      return response.data.result;
    } catch (error) {
      throw new Error(`봇 설정 검증 실패: ${error.message}`);
    }
  }

  /**
   * 아티클을 텔레그램으로 전송 (템플릿 메서드)
   */
  async sendArticle(article) {
    if (!this.#isInitialized && !this.#isDryRun) {
      throw new Error('메신저가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
    }

    const message = this.#formatMessage(article);
    return this.sendDirectMessage(message);
  }

  /**
   * 메시지 포맷팅 (Private method)
   */
  #formatMessage(article) {
    if (this.#formatter?.formatArticleMessage) {
      return this.#formatter.formatArticleMessage(article);
    }
    
    // 기본 포맷
    return `🔔 새로운 아티클\n\n${article.title}\n${article.link}`;
  }

  /**
   * 텔레그램 API를 직접 호출하여 메시지 전송
   */
  async sendDirectMessage(text) {
    if (this.#isDryRun) {
      logger.info(COMMON_MESSAGES.DRY_RUN_SIMULATION, { message: text });
      return { message_id: Date.now(), dry_run: true };
    }

    if (!this.#isInitialized) {
      throw new Error('메신저가 초기화되지 않았습니다.');
    }

    const url = `https://api.telegram.org/bot${this.#botToken}/sendMessage`;
    
    const params = {
      chat_id: this.#chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    };

    let lastError;
    
    for (let attempt = 1; attempt <= this.#retryConfig.maxAttempts; attempt++) {
      try {
        logger.info('텔레그램 직접 메시지 전송 시도', {
          attempt,
          maxAttempts: this.#retryConfig.maxAttempts
        });

        const response = await axios.post(url, params, {
          timeout: TIMEOUTS.HTTP_REQUEST,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.data?.ok) {
          logger.info('텔레그램 메시지 전송 성공');
          return response.data.result;
        } else {
          throw new Error(`텔레그램 API 오류: ${response.data?.description ?? 'Unknown error'}`);
        }

      } catch (error) {
        lastError = error;
        
        if (attempt < this.#retryConfig.maxAttempts) {
          const delay = this.#retryConfig.delay * (2 ** (attempt - 1));
          logger.warn(`텔레그램 전송 실패, ${delay}ms 후 재시도 (${attempt}/${this.#retryConfig.maxAttempts})`, {
            error: error.message
          });
          await this.#sleep(delay);
        }
      }
    }

    // 모든 재시도 실패
    logError(lastError, { 
      context: '텔레그램 메시지 전송 최종 실패',
      attempts: this.#retryConfig.maxAttempts
    });
    throw lastError;
  }

  /**
   * Dry Run 모드 설정
   */
  setDryRunMode(isDryRun = false) {
    this.#isDryRun = isDryRun;
    if (isDryRun) {
      logger.info(COMMON_MESSAGES.DRY_RUN_MODE);
    }
  }

  /**
   * 대기 함수 (Private method)
   */
  #sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 메신저 상태 확인
   */
  isReady() {
    return this.#isInitialized || this.#isDryRun;
  }
}

module.exports = BaseTelegramMessenger;