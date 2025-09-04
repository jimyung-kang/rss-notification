/**
 * 유효성 검증 유틸리티
 * 
 * 설계 원칙:
 * - Pure Functions: 부작용 없는 순수 함수
 * - Fail Fast: 빠른 실패로 디버깅 용이성 확보
 * - Type Safety: 타입 검증을 통한 안정성 확보
 * - Descriptive Errors: 구체적인 에러 메시지 제공
 */

const { REGEX_PATTERNS, ERROR_CODES } = require('../constants/ServiceConstants');

/**
 * 유효성 검증 에러 클래스
 */
class ValidationError extends Error {
  constructor(message, code = ERROR_CODES.VALIDATION_ERROR, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.field = field;
  }
}

/**
 * 기본 타입 검증
 */
const TypeValidators = {
  /**
   * 문자열 검증
   */
  isString(value, fieldName = 'value') {
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName}은 문자열이어야 합니다`, ERROR_CODES.VALIDATION_ERROR, fieldName);
    }
    return true;
  },

  /**
   * 비어있지 않은 문자열 검증
   */
  isNonEmptyString(value, fieldName = 'value') {
    TypeValidators.isString(value, fieldName);
    if (value.trim().length === 0) {
      throw new ValidationError(`${fieldName}은 비어있을 수 없습니다`, ERROR_CODES.VALIDATION_ERROR, fieldName);
    }
    return true;
  },

  /**
   * 숫자 검증
   */
  isNumber(value, fieldName = 'value') {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new ValidationError(`${fieldName}은 유효한 숫자여야 합니다`, ERROR_CODES.VALIDATION_ERROR, fieldName);
    }
    return true;
  },

  /**
   * 양수 검증
   */
  isPositiveNumber(value, fieldName = 'value') {
    TypeValidators.isNumber(value, fieldName);
    if (value <= 0) {
      throw new ValidationError(`${fieldName}은 양수여야 합니다`, ERROR_CODES.VALIDATION_ERROR, fieldName);
    }
    return true;
  },

  /**
   * 정수 검증
   */
  isInteger(value, fieldName = 'value') {
    TypeValidators.isNumber(value, fieldName);
    if (!Number.isInteger(value)) {
      throw new ValidationError(`${fieldName}은 정수여야 합니다`, ERROR_CODES.VALIDATION_ERROR, fieldName);
    }
    return true;
  },

  /**
   * 불린 검증
   */
  isBoolean(value, fieldName = 'value') {
    if (typeof value !== 'boolean') {
      throw new ValidationError(`${fieldName}은 불린값이어야 합니다`, ERROR_CODES.VALIDATION_ERROR, fieldName);
    }
    return true;
  },

  /**
   * 배열 검증
   */
  isArray(value, fieldName = 'value') {
    if (!Array.isArray(value)) {
      throw new ValidationError(`${fieldName}은 배열이어야 합니다`, ERROR_CODES.VALIDATION_ERROR, fieldName);
    }
    return true;
  },

  /**
   * 비어있지 않은 배열 검증
   */
  isNonEmptyArray(value, fieldName = 'value') {
    TypeValidators.isArray(value, fieldName);
    if (value.length === 0) {
      throw new ValidationError(`${fieldName}은 비어있을 수 없습니다`, ERROR_CODES.VALIDATION_ERROR, fieldName);
    }
    return true;
  },

  /**
   * 객체 검증
   */
  isObject(value, fieldName = 'value') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ValidationError(`${fieldName}은 객체여야 합니다`, ERROR_CODES.VALIDATION_ERROR, fieldName);
    }
    return true;
  },

  /**
   * 함수 검증
   */
  isFunction(value, fieldName = 'value') {
    if (typeof value !== 'function') {
      throw new ValidationError(`${fieldName}은 함수여야 합니다`, ERROR_CODES.VALIDATION_ERROR, fieldName);
    }
    return true;
  }
};

/**
 * 비즈니스 로직 검증
 */
const BusinessValidators = {
  /**
   * 이메일 형식 검증
   */
  isValidEmail(email, fieldName = 'email') {
    TypeValidators.isNonEmptyString(email, fieldName);
    if (!REGEX_PATTERNS.EMAIL.test(email)) {
      throw new ValidationError(`${fieldName}의 형식이 올바르지 않습니다`, ERROR_CODES.VALIDATION_ERROR, fieldName);
    }
    return true;
  },

  /**
   * URL 형식 검증
   */
  isValidUrl(url, fieldName = 'url') {
    TypeValidators.isNonEmptyString(url, fieldName);
    if (!REGEX_PATTERNS.URL.test(url)) {
      throw new ValidationError(`${fieldName}의 형식이 올바르지 않습니다`, ERROR_CODES.VALIDATION_ERROR, fieldName);
    }
    return true;
  },

  /**
   * 시간 형식 검증 (HH:MM)
   */
  isValidTimeFormat(time, fieldName = 'time') {
    TypeValidators.isNonEmptyString(time, fieldName);
    if (!REGEX_PATTERNS.TIME_FORMAT.test(time)) {
      throw new ValidationError(`${fieldName}은 HH:MM 형식이어야 합니다`, ERROR_CODES.VALIDATION_ERROR, fieldName);
    }
    return true;
  },

  /**
   * 크론 표현식 검증 (간단)
   */
  isValidCronExpression(cron, fieldName = 'cronExpression') {
    TypeValidators.isNonEmptyString(cron, fieldName);
    if (!REGEX_PATTERNS.CRON_SIMPLE.test(cron)) {
      throw new ValidationError(`${fieldName}은 유효한 크론 표현식이어야 합니다`, ERROR_CODES.VALIDATION_ERROR, fieldName);
    }
    return true;
  },

  /**
   * 날짜 범위 검증
   */
  isValidDateRange(days, fieldName = 'days') {
    TypeValidators.isPositiveNumber(days, fieldName);
    TypeValidators.isInteger(days, fieldName);
    
    const { MIN_FILTER_DAYS, MAX_FILTER_DAYS } = require('../constants/ServiceConstants').DATE_TIME;
    if (days < MIN_FILTER_DAYS || days > MAX_FILTER_DAYS) {
      throw new ValidationError(
        `${fieldName}은 ${MIN_FILTER_DAYS}일 이상 ${MAX_FILTER_DAYS}일 이하여야 합니다`,
        ERROR_CODES.VALIDATION_ERROR,
        fieldName
      );
    }
    return true;
  },

  /**
   * 서비스 설정 검증
   */
  isValidServiceConfig(config, fieldName = 'config') {
    TypeValidators.isObject(config, fieldName);
    
    const required = ['serviceName', 'displayName'];
    const missing = required.filter(key => !config[key]);
    
    if (missing.length > 0) {
      throw new ValidationError(
        `${fieldName}에 필수 필드가 누락되었습니다: ${missing.join(', ')}`,
        ERROR_CODES.VALIDATION_ERROR,
        fieldName
      );
    }

    // 개별 필드 검증
    TypeValidators.isNonEmptyString(config.serviceName, 'serviceName');
    TypeValidators.isNonEmptyString(config.displayName, 'displayName');
    
    return true;
  },

  /**
   * 텔레그램 설정 검증
   */
  isValidTelegramConfig(config, fieldName = 'telegramConfig') {
    TypeValidators.isObject(config, fieldName);
    
    if (config.botToken) {
      TypeValidators.isNonEmptyString(config.botToken, 'botToken');
    }
    
    if (config.chatId) {
      // chatId는 문자열 또는 숫자일 수 있음
      if (typeof config.chatId !== 'string' && typeof config.chatId !== 'number') {
        throw new ValidationError('chatId는 문자열 또는 숫자여야 합니다', ERROR_CODES.VALIDATION_ERROR, 'chatId');
      }
    }
    
    return true;
  }
};

/**
 * 복합 검증 유틸리티
 */
const CompoundValidators = {
  /**
   * 여러 검증을 순차적으로 실행
   */
  validateAll(validators) {
    const errors = [];
    
    for (const validator of validators) {
      try {
        validator();
      } catch (error) {
        if (error instanceof ValidationError) {
          errors.push(error);
        } else {
          errors.push(new ValidationError(`예상치 못한 검증 에러: ${error.message}`));
        }
      }
    }
    
    if (errors.length > 0) {
      const message = errors.map(err => err.message).join('; ');
      throw new ValidationError(`검증 실패: ${message}`);
    }
    
    return true;
  },

  /**
   * 조건부 검증
   */
  validateIf(condition, validator) {
    if (condition) {
      return validator();
    }
    return true;
  },

  /**
   * 선택적 검증 (값이 존재할 때만)
   */
  validateOptional(value, validator) {
    if (value !== undefined && value !== null) {
      return validator(value);
    }
    return true;
  }
};

/**
 * 안전한 검증 함수 (에러를 throw하지 않고 boolean 반환)
 */
const SafeValidators = {
  /**
   * 안전한 URL 검증
   */
  isSafeUrl(url) {
    try {
      BusinessValidators.isValidUrl(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * 안전한 이메일 검증
   */
  isSafeEmail(email) {
    try {
      BusinessValidators.isValidEmail(email);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * 안전한 시간 형식 검증
   */
  isSafeTimeFormat(time) {
    try {
      BusinessValidators.isValidTimeFormat(time);
      return true;
    } catch {
      return false;
    }
  }
};

module.exports = {
  ValidationError,
  TypeValidators,
  BusinessValidators,
  CompoundValidators,
  SafeValidators
};