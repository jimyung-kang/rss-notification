/**
 * RSS 서비스 레지스트리
 * 
 * 설계 원칙:
 * - Registry Pattern: 모든 서비스를 중앙에서 등록 및 관리
 * - Service Discovery: 서비스 검색 및 조회 인터페이스 제공
 * - Lifecycle Management: 서비스 생명주기 관리
 * - Health Monitoring: 서비스 상태 모니터링 및 헬스체크
 */

const { logger } = require('../../utils/logger');
const { ValidationError, TypeValidators, BusinessValidators } = require('../utils/ValidationUtils');
const { COMMON_MESSAGES, ERROR_CODES } = require('../constants/ServiceConstants');

/**
 * RSS 서비스 중앙 레지스트리
 */
class RSSServiceRegistry {
  constructor() {
    this.services = new Map();
    this.healthChecks = new Map();
    this.startupOrder = [];
    this.shutdownOrder = [];
  }

  /**
   * 서비스 등록
   * 
   * @param {string} serviceId - 고유 서비스 식별자
   * @param {Object} serviceInstance - 서비스 인스턴스
   * @param {Object} metadata - 서비스 메타데이터
   */
  registerService(serviceId, serviceInstance, metadata = {}) {
    try {
      // 입력 검증
      TypeValidators.isNonEmptyString(serviceId, 'serviceId');
      TypeValidators.isObject(serviceInstance, 'serviceInstance');
      TypeValidators.isObject(metadata, 'metadata');

      // 서비스 인터페이스 검증
      this.validateServiceInterface(serviceInstance);

      // 이미 등록된 서비스 확인
      if (this.services.has(serviceId)) {
        logger.warn(`서비스 중복 등록 시도: ${serviceId}`, { metadata });
        return false;
      }

      // 서비스 등록
      const serviceEntry = {
        id: serviceId,
        instance: serviceInstance,
        metadata: {
          displayName: metadata.displayName || serviceId,
          category: metadata.category || 'default',
          priority: metadata.priority || 0,
          autoStart: metadata.autoStart !== false,
          healthCheckInterval: metadata.healthCheckInterval || 60000,
          ...metadata
        },
        status: 'registered',
        registeredAt: new Date(),
        lastHealthCheck: null
      };

      this.services.set(serviceId, serviceEntry);

      // 시작 순서 결정 (우선순위 기반)
      this.updateStartupOrder();

      logger.info(`서비스 등록 완료: ${serviceId}`, {
        displayName: serviceEntry.metadata.displayName,
        category: serviceEntry.metadata.category
      });

      return true;
    } catch (error) {
      logger.error(`서비스 등록 실패: ${serviceId}`, error);
      throw new ValidationError(
        `서비스 등록 실패: ${error.message}`,
        ERROR_CODES.SERVICE_INIT_FAILED,
        serviceId
      );
    }
  }

  /**
   * 서비스 인터페이스 검증
   */
  validateServiceInterface(serviceInstance) {
    const requiredMethods = ['start', 'stop'];
    const optionalMethods = ['runManualCheck', 'getStats', 'checkFeedHealth'];

    for (const method of requiredMethods) {
      if (typeof serviceInstance[method] !== 'function') {
        throw new ValidationError(
          `필수 메서드가 누락되었습니다: ${method}`,
          ERROR_CODES.VALIDATION_ERROR,
          method
        );
      }
    }
  }

  /**
   * 서비스 조회
   */
  getService(serviceId) {
    const serviceEntry = this.services.get(serviceId);
    return serviceEntry ? serviceEntry.instance : null;
  }

  /**
   * 서비스 메타데이터 조회
   */
  getServiceMetadata(serviceId) {
    const serviceEntry = this.services.get(serviceId);
    return serviceEntry ? { ...serviceEntry.metadata, status: serviceEntry.status } : null;
  }

  /**
   * 모든 등록된 서비스 조회
   */
  getAllServices() {
    return Array.from(this.services.values()).map(entry => ({
      id: entry.id,
      instance: entry.instance,
      metadata: entry.metadata,
      status: entry.status
    }));
  }

  /**
   * 카테고리별 서비스 조회
   */
  getServicesByCategory(category) {
    return this.getAllServices().filter(service => 
      service.metadata.category === category
    );
  }

  /**
   * 활성 서비스만 조회
   */
  getActiveServices() {
    return this.getAllServices().filter(service => 
      service.status === 'started'
    );
  }

  /**
   * 모든 서비스 시작
   */
  async startAllServices() {
    const results = {
      successful: [],
      failed: []
    };

    logger.info(COMMON_MESSAGES.SERVICE_START);

    for (const serviceId of this.startupOrder) {
      try {
        const success = await this.startService(serviceId);
        if (success) {
          results.successful.push(serviceId);
        } else {
          results.failed.push({ serviceId, error: '시작 실패' });
        }
      } catch (error) {
        results.failed.push({ serviceId, error: error.message });
        logger.error(`서비스 시작 실패: ${serviceId}`, error);
      }
    }

    logger.info(`서비스 일괄 시작 완료`, {
      성공: results.successful.length,
      실패: results.failed.length
    });

    return results;
  }

  /**
   * 개별 서비스 시작
   */
  async startService(serviceId) {
    const serviceEntry = this.services.get(serviceId);
    if (!serviceEntry) {
      throw new Error(`서비스를 찾을 수 없습니다: ${serviceId}`);
    }

    if (serviceEntry.status === 'started') {
      logger.info(`서비스가 이미 시작되었습니다: ${serviceId}`);
      return true;
    }

    try {
      serviceEntry.status = 'starting';
      const result = await serviceEntry.instance.start();
      serviceEntry.status = 'started';
      serviceEntry.startedAt = new Date();

      logger.info(`서비스 시작 완료: ${serviceId}`);
      return result;
    } catch (error) {
      serviceEntry.status = 'error';
      serviceEntry.lastError = error;
      logger.error(`서비스 시작 실패: ${serviceId}`, error);
      throw error;
    }
  }

  /**
   * 모든 서비스 중지
   */
  async stopAllServices() {
    const results = {
      successful: [],
      failed: []
    };

    logger.info(COMMON_MESSAGES.SERVICE_STOP);

    // 역순으로 중지
    for (const serviceId of [...this.shutdownOrder].reverse()) {
      try {
        const success = await this.stopService(serviceId);
        if (success) {
          results.successful.push(serviceId);
        } else {
          results.failed.push({ serviceId, error: '중지 실패' });
        }
      } catch (error) {
        results.failed.push({ serviceId, error: error.message });
        logger.error(`서비스 중지 실패: ${serviceId}`, error);
      }
    }

    return results;
  }

  /**
   * 개별 서비스 중지
   */
  async stopService(serviceId) {
    const serviceEntry = this.services.get(serviceId);
    if (!serviceEntry) {
      throw new Error(`서비스를 찾을 수 없습니다: ${serviceId}`);
    }

    if (serviceEntry.status === 'stopped') {
      logger.info(`서비스가 이미 중지되었습니다: ${serviceId}`);
      return true;
    }

    try {
      serviceEntry.status = 'stopping';
      const result = await serviceEntry.instance.stop();
      serviceEntry.status = 'stopped';
      serviceEntry.stoppedAt = new Date();

      logger.info(`서비스 중지 완료: ${serviceId}`);
      return result;
    } catch (error) {
      serviceEntry.status = 'error';
      serviceEntry.lastError = error;
      logger.error(`서비스 중지 실패: ${serviceId}`, error);
      throw error;
    }
  }

  /**
   * 시작 순서 업데이트
   */
  updateStartupOrder() {
    this.startupOrder = Array.from(this.services.values())
      .filter(entry => entry.metadata.autoStart)
      .sort((a, b) => b.metadata.priority - a.metadata.priority)
      .map(entry => entry.id);

    this.shutdownOrder = [...this.startupOrder];
  }

  /**
   * 레지스트리 상태 조회
   */
  getRegistryStats() {
    const services = this.getAllServices();
    const statusCount = services.reduce((acc, service) => {
      acc[service.status] = (acc[service.status] || 0) + 1;
      return acc;
    }, {});

    return {
      총_서비스: services.length,
      상태별_통계: statusCount,
      시작_순서: this.startupOrder,
      중지_순서: this.shutdownOrder
    };
  }

  /**
   * 서비스 등록 해제
   */
  unregisterService(serviceId) {
    if (!this.services.has(serviceId)) {
      return false;
    }

    this.services.delete(serviceId);
    this.updateStartupOrder();
    
    logger.info(`서비스 등록 해제 완료: ${serviceId}`);
    return true;
  }
}

// 싱글톤 인스턴스
const serviceRegistry = new RSSServiceRegistry();

module.exports = {
  RSSServiceRegistry,
  serviceRegistry
};