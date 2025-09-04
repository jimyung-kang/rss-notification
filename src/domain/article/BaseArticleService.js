const { logger, logError } = require('../../utils/logger');
const DateFilterUtils = require('../../shared/utils/DateFilterUtils');
const { DateConstants, FilterPeriod } = require('../../shared/constants/dateConstants');

/**
 * 시니어급 아티클 서비스 베이스 클래스
 * 
 * 설계 원칙:
 * 1. Single Responsibility: 아티클 조회 및 필터링 전용
 * 2. Open/Closed: 확장은 열려있고 수정은 닫혀있음
 * 3. Dependency Injection: RSS 파서 의존성 주입
 * 4. Error Boundary: 예외 처리 및 복구
 */
class BaseArticleService {
  constructor(rssParser, serviceName, options = {}) {
    this._validateConstructorParams(rssParser, serviceName);
    
    this.rssParser = rssParser;
    this.serviceName = serviceName;
    this.lastCheckedDate = null;
    
    // 설정 옵션 (기본값 포함)
    this.options = {
      defaultFilterDays: DateConstants.DEFAULT_FILTER_DAYS,
      timezone: DateConstants.DEFAULT_TIMEZONE,
      maxRetries: 3,
      retryDelay: 1000,
      enableDateFilter: true,
      logLevel: 'info',
      ...options
    };
    
    this._initializeService();
  }
  
  /**
   * 동적 날짜 필터링으로 새로운 아티클들 조회
   * @param {number|string} daysOrPeriod - 필터링 일수 또는 기간 타입 (예: 1, 'today', 'last7days')
   * @param {Object} filterOptions - 추가 필터링 옵션
   * @returns {Promise<Array>} 필터링된 아티클 배열
   */
  async getNewArticles(daysOrPeriod = this.options.defaultFilterDays, filterOptions = {}) {
    const methodName = 'getNewArticles';
    const startTime = performance.now();
    
    try {
      this._logMethodStart(methodName, { daysOrPeriod, filterOptions });
      
      // RSS 피드 파싱
      const feed = await this._fetchFeedWithRetry();
      if (!feed || !Array.isArray(feed.items)) {
        throw new Error('Invalid feed data received');
      }
      
      // 날짜 필터링 적용
      const filteredArticles = this._applyDateFilter(feed.items, daysOrPeriod);
      
      // 추가 필터링 적용
      const processedArticles = this._applyAdditionalFilters(filteredArticles, filterOptions);
      
      // 아티클 정규화
      const normalizedArticles = this._normalizeArticles(processedArticles);
      
      // 성능 메트릭 로깅
      const duration = performance.now() - startTime;
      this._logMethodResult(methodName, {
        totalArticles: feed.items.length,
        filteredCount: filteredArticles.length,
        finalCount: normalizedArticles.length,
        duration: `${duration.toFixed(2)}ms`
      });
      
      // 마지막 체크 날짜 업데이트
      if (normalizedArticles.length > 0) {
        this._updateLastCheckedDate(normalizedArticles);
      }
      
      return normalizedArticles;
      
    } catch (error) {
      this._handleError(methodName, error, { daysOrPeriod, filterOptions });
      return [];
    }
  }
  
  /**
   * 특정 기간의 최신 아티클 조회
   * @param {number|string} daysOrPeriod - 필터링 일수 또는 기간 타입
   * @param {number} limit - 최대 결과 개수
   * @returns {Promise<Array>} 최신 아티클 배열 (날짜 역순)
   */
  async getRecentArticles(daysOrPeriod = this.options.defaultFilterDays, limit = null) {
    const methodName = 'getRecentArticles';
    
    try {
      this._logMethodStart(methodName, { daysOrPeriod, limit });
      
      const articles = await this.getNewArticles(daysOrPeriod);
      
      // 날짜 기준 내림차순 정렬
      const sortedArticles = this._sortArticlesByDate(articles, 'desc');
      
      // 개수 제한 적용
      const limitedArticles = limit ? sortedArticles.slice(0, limit) : sortedArticles;
      
      this._logMethodResult(methodName, {
        totalFound: articles.length,
        returned: limitedArticles.length,
        dateRange: this._getDateRangeInfo(daysOrPeriod)
      });
      
      return limitedArticles;
      
    } catch (error) {
      this._handleError(methodName, error, { daysOrPeriod, limit });
      return [];
    }
  }
  
  /**
   * 수동 체크 실행 (CLI용)
   * @param {Object} cliOptions - CLI에서 전달된 옵션
   * @returns {Promise<Object>} 실행 결과 상세 정보
   */
  async runManualCheck(cliOptions = {}) {
    const methodName = 'runManualCheck';
    const startTime = performance.now();
    
    try {
      // CLI 옵션 파싱
      const { days, period, limit, dryRun = false } = cliOptions;
      const daysOrPeriod = period || days || this.options.defaultFilterDays;
      
      this._logMethodStart(methodName, { daysOrPeriod, limit, dryRun });
      
      // 날짜 필터링 정보 출력
      DateFilterUtils.logFilterInfo(daysOrPeriod, this.options.timezone);
      
      // 아티클 조회
      const articles = await this.getRecentArticles(daysOrPeriod, limit);
      
      // 실행 결과 구성
      const result = this._buildManualCheckResult(articles, {
        daysOrPeriod,
        limit,
        dryRun,
        duration: performance.now() - startTime
      });
      
      this._logManualCheckResult(result);
      
      return result;
      
    } catch (error) {
      this._handleError(methodName, error, cliOptions);
      return this._buildErrorResult(error);
    }
  }
  
  /**
   * 피드 상태 확인
   * @returns {Promise<Object>} 피드 상태 정보
   */
  async checkFeedHealth() {
    const methodName = 'checkFeedHealth';
    
    try {
      if (!this.rssParser.checkFeedHealth) {
        throw new Error('RSS parser does not support health check');
      }
      
      const healthStatus = await this.rssParser.checkFeedHealth();
      
      logger.info(`${this.serviceName} 피드 상태:`, {
        status: healthStatus.status,
        responseTime: healthStatus.responseTime
      });
      
      return healthStatus;
      
    } catch (error) {
      this._handleError(methodName, error);
      return {
        status: 'error',
        error: error.message,
        service: this.serviceName,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  // Private 메서드들
  
  /**
   * 생성자 매개변수 유효성 검증
   * @private
   */
  _validateConstructorParams(rssParser, serviceName) {
    if (!rssParser) {
      throw new Error('RSS parser is required');
    }
    
    if (!serviceName || typeof serviceName !== 'string') {
      throw new Error('Service name must be a non-empty string');
    }
    
    if (!rssParser.parseFeed || typeof rssParser.parseFeed !== 'function') {
      throw new Error('RSS parser must have parseFeed method');
    }
    
    if (!rssParser.normalizeArticle || typeof rssParser.normalizeArticle !== 'function') {
      throw new Error('RSS parser must have normalizeArticle method');
    }
  }
  
  /**
   * 서비스 초기화
   * @private
   */
  _initializeService() {
    logger.info(`${this.serviceName} 아티클 서비스 초기화 완료`, {
      defaultFilterDays: this.options.defaultFilterDays,
      timezone: this.options.timezone,
      enableDateFilter: this.options.enableDateFilter
    });
  }
  
  /**
   * 재시도 로직이 포함된 피드 조회
   * @private
   */
  async _fetchFeedWithRetry() {
    let lastError;
    
    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        const feed = await this.rssParser.parseFeed();
        return feed;
      } catch (error) {
        lastError = error;
        
        if (attempt < this.options.maxRetries) {
          logger.warn(`${this.serviceName} 피드 조회 실패 (시도 ${attempt}/${this.options.maxRetries}), 재시도 중...`, {
            error: error.message
          });
          
          await this._delay(this.options.retryDelay * attempt);
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * 날짜 필터링 적용
   * @private
   */
  _applyDateFilter(articles, daysOrPeriod) {
    if (!this.options.enableDateFilter || !Array.isArray(articles)) {
      return articles;
    }
    
    return DateFilterUtils.filterArticlesByDate(articles, daysOrPeriod, this.options.timezone);
  }
  
  /**
   * 추가 필터링 적용 (확장 포인트)
   * @private
   */
  _applyAdditionalFilters(articles, filterOptions) {
    // 하위 클래스에서 오버라이드 가능
    return articles;
  }
  
  /**
   * 아티클 배열 정규화
   * @private
   */
  _normalizeArticles(articles) {
    if (!Array.isArray(articles)) {
      return [];
    }
    
    return articles
      .map(article => {
        try {
          return this.rssParser.normalizeArticle(article);
        } catch (error) {
          logger.warn(`아티클 정규화 실패:`, {
            title: article.title,
            error: error.message
          });
          return null;
        }
      })
      .filter(article => article !== null);
  }
  
  /**
   * 날짜 기준으로 아티클 정렬
   * @private
   */
  _sortArticlesByDate(articles, order = 'desc') {
    return [...articles].sort((a, b) => {
      const dateA = DateFilterUtils._extractArticleDate(a);
      const dateB = DateFilterUtils._extractArticleDate(b);
      
      if (!dateA || !dateB) return 0;
      
      return order === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }
  
  /**
   * 마지막 체크 날짜 업데이트
   * @private
   */
  _updateLastCheckedDate(articles) {
    if (!Array.isArray(articles) || articles.length === 0) {
      return;
    }
    
    const latestDate = this._getLatestArticleDate(articles);
    if (latestDate) {
      this.lastCheckedDate = latestDate;
    }
  }
  
  /**
   * 가장 최근 아티클 날짜 조회
   * @private
   */
  _getLatestArticleDate(articles) {
    const dates = articles
      .map(article => DateFilterUtils._extractArticleDate(article))
      .filter(date => date !== null);
    
    if (dates.length === 0) return null;
    
    return new Date(Math.max(...dates));
  }
  
  /**
   * 수동 체크 결과 구성
   * @private
   */
  _buildManualCheckResult(articles, options) {
    return {
      service: this.serviceName,
      success: true,
      articlesFound: articles.length,
      messagesSent: options.dryRun ? 0 : articles.length,
      filterPeriod: options.daysOrPeriod,
      limit: options.limit,
      dryRun: options.dryRun,
      duration: options.duration,
      timestamp: new Date().toISOString(),
      articles: articles.map(article => ({
        title: article.title,
        url: article.url,
        publishedDate: article.date,
        isRelevant: article.isRelevant
      }))
    };
  }
  
  /**
   * 오류 결과 구성
   * @private
   */
  _buildErrorResult(error) {
    return {
      service: this.serviceName,
      success: false,
      articlesFound: 0,
      messagesSent: 0,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * 날짜 범위 정보 조회
   * @private
   */
  _getDateRangeInfo(daysOrPeriod) {
    const startDate = DateFilterUtils.getFilterStartDate(daysOrPeriod);
    const endDate = DateFilterUtils.getFilterEndDate();
    
    return {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      days: DateFilterUtils._resolveDays(daysOrPeriod)
    };
  }
  
  /**
   * 메서드 시작 로깅
   * @private
   */
  _logMethodStart(methodName, params) {
    if (this.options.logLevel === 'debug') {
      logger.debug(`${this.serviceName}.${methodName} 시작`, params);
    }
  }
  
  /**
   * 메서드 결과 로깅
   * @private
   */
  _logMethodResult(methodName, result) {
    logger.info(`${this.serviceName}.${methodName} 완료`, result);
  }
  
  /**
   * 수동 체크 결과 로깅
   * @private
   */
  _logManualCheckResult(result) {
    if (result.success) {
      logger.info(`✅ ${this.serviceName} 수동 체크 완료:`, {
        found: result.articlesFound,
        sent: result.messagesSent,
        period: result.filterPeriod,
        duration: `${result.duration.toFixed(2)}ms`
      });
    } else {
      logger.error(`❌ ${this.serviceName} 수동 체크 실패:`, {
        error: result.error
      });
    }
  }
  
  /**
   * 오류 처리
   * @private
   */
  _handleError(methodName, error, context = {}) {
    logError(error, {
      context: `${this.serviceName}.${methodName}`,
      service: this.serviceName,
      method: methodName,
      ...context
    });
  }
  
  /**
   * 지연 함수
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BaseArticleService;