/**
 * 날짜 관련 상수 정의
 */

const DateConstants = {
  // 기본 필터링 기간 (일)
  DEFAULT_FILTER_DAYS: 1,
  
  // 최대 필터링 기간 (일)
  MAX_FILTER_DAYS: 30,
  
  // 최소 필터링 기간 (일) 
  MIN_FILTER_DAYS: 1,
  
  // 타임존
  DEFAULT_TIMEZONE: 'Asia/Seoul',
  
  // 날짜 형식
  DATE_FORMAT: 'YYYY-MM-DD',
  DATETIME_FORMAT: 'YYYY-MM-DD HH:mm:ss',
  
  // 시간 단위 (밀리초)
  MS_PER_SECOND: 1000,
  MS_PER_MINUTE: 60 * 1000,
  MS_PER_HOUR: 60 * 60 * 1000,
  MS_PER_DAY: 24 * 60 * 60 * 1000,
  
  // 기본 시간
  DEFAULT_START_HOUR: 0,
  DEFAULT_START_MINUTE: 0,
  DEFAULT_START_SECOND: 0,
  DEFAULT_START_MS: 0
};

const FilterPeriod = {
  TODAY: 'today',
  YESTERDAY: 'yesterday', 
  LAST_3_DAYS: 'last3days',
  LAST_7_DAYS: 'last7days',
  CUSTOM: 'custom'
};

const FilterPeriodDays = {
  [FilterPeriod.TODAY]: 1,
  [FilterPeriod.YESTERDAY]: 2,
  [FilterPeriod.LAST_3_DAYS]: 3,
  [FilterPeriod.LAST_7_DAYS]: 7
};

module.exports = {
  DateConstants,
  FilterPeriod,
  FilterPeriodDays
};