const { DateConstants, FilterPeriod, FilterPeriodDays } = require('../constants/dateConstants');

/**
 * 날짜 필터링을 위한 유틸리티 클래스
 * 시니어 레벨 아키텍처: 단일 책임 원칙과 확장성을 고려한 설계
 */
class DateFilterUtils {
  /**
   * 필터링 시작 날짜 계산
   * @param {number|string} daysOrPeriod - 필터링 일수 또는 기간 타입
   * @param {string} timezone - 타임존 (기본: Asia/Seoul)
   * @returns {Date} 필터링 시작 날짜
   */
  static getFilterStartDate(daysOrPeriod = DateConstants.DEFAULT_FILTER_DAYS, timezone = DateConstants.DEFAULT_TIMEZONE) {
    const days = this._resolveDays(daysOrPeriod);
    this._validateDays(days);
    
    const now = new Date();
    const startDate = new Date(now);
    
    // 지정된 일수만큼 이전으로 이동
    startDate.setDate(now.getDate() - (days - 1));
    startDate.setHours(
      DateConstants.DEFAULT_START_HOUR,
      DateConstants.DEFAULT_START_MINUTE,
      DateConstants.DEFAULT_START_SECOND,
      DateConstants.DEFAULT_START_MS
    );
    
    return startDate;
  }
  
  /**
   * 필터링 종료 날짜 계산 (현재 시간)
   * @param {string} timezone - 타임존 (기본: Asia/Seoul)
   * @returns {Date} 필터링 종료 날짜
   */
  static getFilterEndDate(timezone = DateConstants.DEFAULT_TIMEZONE) {
    return new Date();
  }
  
  /**
   * 날짜 범위 검증
   * @param {Date} startDate - 시작 날짜
   * @param {Date} endDate - 종료 날짜
   * @returns {boolean} 유효한 범위인지 여부
   */
  static isValidDateRange(startDate, endDate) {
    if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
      return false;
    }
    
    return startDate <= endDate;
  }
  
  /**
   * 아티클이 필터링 범위에 포함되는지 확인
   * @param {Object} article - 아티클 객체
   * @param {Date} startDate - 시작 날짜
   * @param {Date} endDate - 종료 날짜
   * @returns {boolean} 범위에 포함되는지 여부
   */
  static isArticleInDateRange(article, startDate, endDate) {
    if (!article) return false;
    
    const articleDate = this._extractArticleDate(article);
    if (!articleDate) return false;
    
    return articleDate >= startDate && articleDate <= endDate;
  }
  
  /**
   * 날짜 필터링을 위한 필터 함수 생성
   * @param {number|string} daysOrPeriod - 필터링 일수 또는 기간 타입
   * @param {string} timezone - 타임존
   * @returns {Function} 필터 함수
   */
  static createDateFilter(daysOrPeriod = DateConstants.DEFAULT_FILTER_DAYS, timezone = DateConstants.DEFAULT_TIMEZONE) {
    const startDate = this.getFilterStartDate(daysOrPeriod, timezone);
    const endDate = this.getFilterEndDate(timezone);
    
    if (!this.isValidDateRange(startDate, endDate)) {
      throw new Error(`Invalid date range: ${startDate} - ${endDate}`);
    }
    
    return (article) => this.isArticleInDateRange(article, startDate, endDate);
  }
  
  /**
   * 아티클 배열에 날짜 필터 적용
   * @param {Array} articles - 아티클 배열
   * @param {number|string} daysOrPeriod - 필터링 일수 또는 기간 타입
   * @param {string} timezone - 타임존
   * @returns {Array} 필터링된 아티클 배열
   */
  static filterArticlesByDate(articles, daysOrPeriod = DateConstants.DEFAULT_FILTER_DAYS, timezone = DateConstants.DEFAULT_TIMEZONE) {
    if (!Array.isArray(articles) || articles.length === 0) {
      return [];
    }
    
    const dateFilter = this.createDateFilter(daysOrPeriod, timezone);
    return articles.filter(dateFilter);
  }
  
  /**
   * CLI 파라미터를 날짜 필터링 옵션으로 파싱
   * @param {Array} args - CLI 인수 배열
   * @returns {Object} 파싱된 옵션
   */
  static parseCliDateOptions(args) {
    const options = {
      days: DateConstants.DEFAULT_FILTER_DAYS,
      period: null,
      timezone: DateConstants.DEFAULT_TIMEZONE
    };
    
    args.forEach(arg => {
      if (arg.startsWith('--days=')) {
        const days = parseInt(arg.split('=')[1]);
        if (!isNaN(days)) {
          options.days = days;
        }
      } else if (arg.startsWith('--period=')) {
        options.period = arg.split('=')[1];
      } else if (arg.startsWith('--timezone=')) {
        options.timezone = arg.split('=')[1];
      }
    });
    
    return options;
  }
  
  /**
   * 필터링 설정 정보 로깅
   * @param {number|string} daysOrPeriod - 필터링 일수 또는 기간 타입
   * @param {string} timezone - 타임존
   */
  static logFilterInfo(daysOrPeriod, timezone = DateConstants.DEFAULT_TIMEZONE) {
    const days = this._resolveDays(daysOrPeriod);
    const startDate = this.getFilterStartDate(daysOrPeriod, timezone);
    const endDate = this.getFilterEndDate(timezone);
    
    console.log(`📅 날짜 필터링 설정:`);
    console.log(`   기간: ${days}일 (${this._getPeriodName(daysOrPeriod)})`);
    console.log(`   시작: ${startDate.toLocaleString('ko-KR', { timeZone: timezone })}`);
    console.log(`   종료: ${endDate.toLocaleString('ko-KR', { timeZone: timezone })}`);
    console.log(`   타임존: ${timezone}`);
  }
  
  // Private 메서드들
  
  /**
   * 일수 또는 기간 타입을 일수로 변환
   * @private
   */
  static _resolveDays(daysOrPeriod) {
    if (typeof daysOrPeriod === 'number') {
      return daysOrPeriod;
    }
    
    if (typeof daysOrPeriod === 'string') {
      // 기간 타입인지 확인
      if (FilterPeriodDays[daysOrPeriod]) {
        return FilterPeriodDays[daysOrPeriod];
      }
      
      // 문자열 숫자인지 확인
      const parsed = parseInt(daysOrPeriod);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    
    return DateConstants.DEFAULT_FILTER_DAYS;
  }
  
  /**
   * 일수 유효성 검증
   * @private
   */
  static _validateDays(days) {
    if (days < DateConstants.MIN_FILTER_DAYS || days > DateConstants.MAX_FILTER_DAYS) {
      throw new Error(`Filter days must be between ${DateConstants.MIN_FILTER_DAYS} and ${DateConstants.MAX_FILTER_DAYS}, got: ${days}`);
    }
  }
  
  /**
   * 아티클에서 날짜 추출
   * @private
   */
  static _extractArticleDate(article) {
    const dateFields = ['pubDate', 'isoDate', 'date', 'published', 'updated'];
    
    for (const field of dateFields) {
      if (article[field]) {
        const date = new Date(article[field]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    return null;
  }
  
  /**
   * 기간 이름 반환
   * @private
   */
  static _getPeriodName(daysOrPeriod) {
    if (typeof daysOrPeriod === 'string' && FilterPeriodDays[daysOrPeriod]) {
      return daysOrPeriod;
    }
    return 'custom';
  }
}

module.exports = DateFilterUtils;