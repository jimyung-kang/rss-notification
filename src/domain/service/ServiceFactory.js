/**
 * RSS 서비스 팩토리
 * 
 * Factory Pattern을 사용하여 서비스 인스턴스 생성을 캡슐화
 * 각 서비스의 복잡한 설정과 의존성 관리를 중앙화
 * 
 * 설계 원칙:
 * - Factory Pattern: 객체 생성 로직 캡슐화
 * - Dependency Injection: 필요한 의존성 주입
 * - Configuration over Convention: 설정을 통한 유연성 제공
 */

const BaseRSSService = require('./BaseRSSService');
const { logger } = require('../../utils/logger');

class ServiceFactory {
  /**
   * 서비스 인스턴스를 생성하는 팩토리 메서드
   * 
   * @param {Object} serviceConfig - 서비스 설정
   * @param {string} serviceConfig.serviceName - 서비스 이름
   * @param {string} serviceConfig.displayName - 표시용 이름
   * @param {string} serviceConfig.modulePath - 서비스 모듈 경로
   * @param {boolean} options.isDryRun - 드라이 런 모드 여부
   * @returns {BaseRSSService} 생성된 서비스 인스턴스
   */
  static createService(serviceConfig, options = {}) {
    try {
      // 서비스 모듈 동적 로드
      const serviceModule = ServiceFactory.#loadServiceModule(serviceConfig.modulePath);
      
      // 서비스 설정 구성
      const config = {
        serviceName: serviceConfig.serviceName,
        displayName: serviceConfig.displayName ?? serviceConfig.name ?? serviceConfig.serviceName,
        isDryRun: options.isDryRun ?? false,
        ...serviceModule
      };

      // 레거시 서비스 지원 (기존 서비스가 BaseRSSService를 상속하지 않는 경우)
      if (ServiceFactory.#isLegacyService(serviceModule)) {
        return ServiceFactory.#createLegacyService(serviceModule, options);
      }

      // 새로운 베이스 클래스를 사용하는 서비스
      return new BaseRSSService(config);
      
    } catch (error) {
      logger.error(`서비스 생성 실패: ${serviceConfig.serviceName}`, error);
      throw new Error(`Failed to create service ${serviceConfig.serviceName}: ${error.message}`);
    }
  }

  /**
   * 서비스 모듈 동적 로드 (Private method)
   * 
   * @param {string} modulePath - 모듈 경로
   * @returns {Object} 로드된 서비스 모듈
   */
  static #loadServiceModule(modulePath) {
    try {
      const moduleExport = require(modulePath);
      
      // GeekNews처럼 팩토리 함수인 경우 (함수이지만 .instance가 있음)
      if (typeof moduleExport === 'function' && moduleExport.instance) {
        return { createInstance: moduleExport };
      }
      
      // 직접 export된 클래스인 경우 (ES6 클래스)
      if (typeof moduleExport === 'function' && moduleExport.prototype && moduleExport.prototype.constructor === moduleExport) {
        return { legacyService: moduleExport };
      }
      
      // 직접 export된 객체나 다른 구조인 경우
      if (moduleExport.ArticleService || moduleExport.Scheduler) {
        return moduleExport;
      }
      
      // 기타 레거시 서비스 (기존 구조)
      return { legacyService: moduleExport };
      
    } catch (error) {
      throw new Error(`Failed to load service module ${modulePath}: ${error.message}`);
    }
  }

  /**
   * 레거시 서비스 여부 확인 (Private method)
   * 
   * @param {Object} serviceModule - 서비스 모듈
   * @returns {boolean} 레거시 서비스 여부
   */
  static #isLegacyService(serviceModule) {
    return Boolean(
      serviceModule.legacyService || 
      serviceModule.createInstance ||
      (!serviceModule.ArticleService && !serviceModule.Scheduler)
    );
  }

  /**
   * 레거시 서비스 생성 (Private method)
   * 기존 서비스와의 호환성을 위한 래퍼
   * 
   * @param {Object} serviceModule - 서비스 모듈
   * @param {Object} options - 옵션
   * @returns {Object} 레거시 서비스 인스턴스
   */
  static #createLegacyService(serviceModule, options = {}) {
    try {
      if (serviceModule.createInstance) {
        // 팩토리 함수 형태 (예: GeekNews)
        return serviceModule.createInstance(options.isDryRun, options);
      }
      
      if (serviceModule.legacyService) {
        // 직접 export된 클래스 인스턴스 생성 (캐시 옵션 전달)
        if (typeof serviceModule.legacyService === 'function') {
          return new serviceModule.legacyService(options);
        }
        return serviceModule.legacyService;
      }
      
      // 기타 레거시 형태 - 클래스 생성자에 옵션 전달
      if (typeof serviceModule === 'function') {
        return new serviceModule(options);
      }
      
      return serviceModule;
    } catch (error) {
      logger.warn('레거시 서비스 생성 중 오류:', error.message);
      throw error;
    }
  }

  /**
   * 벌크 서비스 생성
   * 여러 서비스를 한번에 생성
   * 
   * @param {Array} serviceConfigs - 서비스 설정 배열
   * @param {Object} options - 공통 옵션
   * @returns {Object} 생성 결과 객체
   */
  static createServices(serviceConfigs, options = {}) {
    const results = [];
    const errors = [];

    for (const serviceConfig of serviceConfigs) {
      try {
        const service = ServiceFactory.createService(serviceConfig, options);
        results.push({
          success: true,
          service,
          config: serviceConfig
        });
      } catch (error) {
        const errorInfo = {
          success: false,
          error,
          config: serviceConfig
        };
        errors.push(errorInfo);
        logger.error(`서비스 생성 실패: ${serviceConfig.serviceName}`, error);
      }
    }

    return {
      successful: results,
      failed: errors,
      totalCount: serviceConfigs.length,
      successCount: results.length,
      failureCount: errors.length
    };
  }
}

module.exports = ServiceFactory;