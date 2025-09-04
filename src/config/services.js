const path = require('path');
const servicesConfig = require('./services.json');

/**
 * RSS 서비스 정의 및 관리 모듈 (리팩토링됨)
 * 
 * 개선사항:
 * - Factory Pattern을 통한 서비스 생성 표준화
 * - 의존성 주입을 통한 느슨한 결합
 * - 설정 중앙화 및 유효성 검증 강화
 * - 에러 핸들링 및 로깅 개선
 */
const ServiceFactory = require('../domain/service/ServiceFactory');

class ServiceManager {
  constructor() {
    this.services = this.loadServices();
    this.categories = servicesConfig.categories;
    this.types = servicesConfig.types;
  }

  /**
   * 서비스 설정 로드
   */
  loadServices() {
    return servicesConfig.services.map(service => ({
      ...service,
      // 환경변수로 URL 오버라이드 가능 (선택사항)
      feedUrl: process.env[`RSS_FEED_${service.key.toUpperCase()}`] || service.feedUrl,
      // 서비스 모듈 경로 생성
      modulePath: path.join(__dirname, '..', 'services', service.path),
      // 활성화 상태 (환경변수로 오버라이드 가능)
      enabled: process.env[`DISABLE_${service.key.toUpperCase()}`] === 'true' 
        ? false 
        : service.enabled
    }));
  }

  /**
   * 모든 활성화된 서비스 반환
   */
  getEnabledServices() {
    return this.services.filter(service => service.enabled);
  }

  /**
   * 키로 특정 서비스 찾기
   */
  getServiceByKey(key) {
    return this.services.find(service => service.key === key);
  }

  /**
   * 카테고리별 서비스 필터링
   */
  getServicesByCategory(category) {
    return this.services.filter(service => service.category === category);
  }

  /**
   * 타입별 서비스 필터링
   */
  getServicesByType(type) {
    return this.services.filter(service => service.type === type);
  }

  /**
   * 서비스 통계 정보
   */
  getStats() {
    const enabled = this.getEnabledServices();
    const byCategory = {};
    const byType = {};

    enabled.forEach(service => {
      // 카테고리별 집계
      if (!byCategory[service.category]) {
        byCategory[service.category] = 0;
      }
      byCategory[service.category]++;

      // 타입별 집계
      if (!byType[service.type]) {
        byType[service.type] = 0;
      }
      byType[service.type]++;
    });

    return {
      total: this.services.length,
      enabled: enabled.length,
      disabled: this.services.length - enabled.length,
      byCategory,
      byType
    };
  }

  /**
   * 서비스 로더 - Factory Pattern을 통한 표준화된 서비스 생성
   */
  async loadServiceModule(serviceKey, options = {}) {
    const serviceConfig = this.getServiceByKey(serviceKey);
    if (!serviceConfig) {
      throw new Error(`Service not found: ${serviceKey}`);
    }

    if (!serviceConfig.enabled) {
      throw new Error(`Service is disabled: ${serviceKey}`);
    }

    try {
      // ServiceFactory를 통해 표준화된 서비스 생성
      const serviceInstance = ServiceFactory.createService(serviceConfig, options);
      
      return {
        service: serviceInstance,
        metadata: serviceConfig
      };
    } catch (error) {
      throw new Error(`Failed to load service ${serviceKey}: ${error.message}`);
    }
  }

  /**
   * 병렬로 모든 활성 서비스 로드
   */
  async loadAllServices(options = {}) {
    const enabled = this.getEnabledServices();
    const results = await Promise.allSettled(
      enabled.map(service => this.loadServiceModule(service.key, options))
    );

    const loaded = [];
    const failed = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        loaded.push(result.value);
      } else {
        failed.push({
          service: enabled[index],
          error: result.reason
        });
      }
    });

    return { loaded, failed };
  }

  /**
   * 서비스 설정 출력 (디버깅용)
   */
  printServiceInfo() {
    const stats = this.getStats();
    
    console.log('\n=== RSS 서비스 설정 ===');
    console.log(`총 서비스: ${stats.total}개`);
    console.log(`활성: ${stats.enabled}개 | 비활성: ${stats.disabled}개`);
    
    console.log('\n카테고리별:');
    Object.entries(stats.byCategory).forEach(([category, count]) => {
      console.log(`  ${this.categories[category] || category}: ${count}개`);
    });
    
    console.log('\n타입별:');
    Object.entries(stats.byType).forEach(([type, count]) => {
      console.log(`  ${this.types[type] || type}: ${count}개`);
    });
    
    console.log('\n활성 서비스 목록:');
    this.getEnabledServices().forEach(service => {
      console.log(`  - [${service.key}] ${service.nameKo} (${service.category})`);
    });
    
    console.log('======================\n');
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const serviceManager = new ServiceManager();

module.exports = {
  serviceManager,
  getEnabledServices: () => serviceManager.getEnabledServices(),
  getServiceByKey: (key) => serviceManager.getServiceByKey(key),
  loadServiceModule: (key, options) => serviceManager.loadServiceModule(key, options),
  loadAllServices: (options) => serviceManager.loadAllServices(options),
  printServiceInfo: () => serviceManager.printServiceInfo()
};