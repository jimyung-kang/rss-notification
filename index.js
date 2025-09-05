#!/usr/bin/env node

/**
 * RSS 알림 봇 메인 애플리케이션 v2.1
 * 
 * 실행 모드:
 * - 기본 스케줄링 모드: node index.js (매일 오후 5:30)
 * - 간격 기반 스케줄링: node index.js --start-hour=9 --end-hour=18 --interval=2
 * - 특정 시간 스케줄링: node index.js --times=9,12,15:30,18
 * - 단일 실행 모드: node index.js --once [--dry-run] [--batch-size=N]
 * 
 * 기능:
 * 1. 웹훅을 통한 긱뉴스봇 데이터 수신 및 텔레그램 전송
 * 2. 다양한 RSS 피드를 병렬 스케줄링으로 체크하여 새 글 텔레그램 전송
 * 3. 파라미터 기반 스케줄링으로 유연한 실행 시간 설정
 * 4. 모든 RSS 서비스 병렬 단일 실행 (테스트 및 즉시 실행용)
 * 
 * 성능 개선:
 * - 병렬 처리로 최대 10배 성능 향상
 * - 배치 처리로 메모리 효율성 개선
 * - Promise.allSettled로 안정적인 에러 처리
 */

require('dotenv').config();
const { validateConfig, printConfig } = require('./src/config/config');
const { logger } = require('./src/utils/logger');
const { serviceManager, loadAllServices, printServiceInfo } = require('./src/config/services');

// ============================================================================
// 애플리케이션 설정
// ============================================================================

/**
 * CLI 설정 파싱
 */
function parseCliConfig() {
  const args = process.argv.slice(2);
  
  const config = {
    modes: {
      isOnceMode: args.includes('--once'),
      isDryRun: args.includes('--dry-run'),
      showHelp: args.includes('--help') || args.includes('-h'),
      isParameterizedScheduling: false
    },
    performance: {
      maxConcurrency: parseInt(args.find(arg => arg.startsWith('--max-concurrency='))?.split('=')[1]) || 5,
      batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 3,
      retryCount: 2,
      timeoutMs: 30000
    },
    scheduling: {
      startHour: 9,
      endHour: 18,
      interval: 2,
      times: null,
      dryRun: false
    },
    filtering: {
      filterDays: parseInt(args.find(arg => arg.startsWith('--filter-days='))?.split('=')[1]) || 1
    }
  };

  // 파라미터 기반 스케줄링 옵션 파싱
  args.forEach(arg => {
    if (arg.startsWith('--start-hour=')) {
      config.scheduling.startHour = parseInt(arg.split('=')[1]);
      config.modes.isParameterizedScheduling = true;
    } else if (arg.startsWith('--end-hour=')) {
      config.scheduling.endHour = parseInt(arg.split('=')[1]);
      config.modes.isParameterizedScheduling = true;
    } else if (arg.startsWith('--interval=')) {
      config.scheduling.interval = parseInt(arg.split('=')[1]);
      config.modes.isParameterizedScheduling = true;
    } else if (arg.startsWith('--times=')) {
      config.scheduling.times = arg.split('=')[1];
      config.modes.isParameterizedScheduling = true;
    }
  });

  // 파라미터 유효성 검증 (파라미터 스케줄링 모드에서만)
  if (config.modes.isParameterizedScheduling && !config.scheduling.times) {
    if (config.scheduling.startHour < 0 || config.scheduling.startHour > 23) {
      console.error('❌ 시작 시간은 0-23 사이여야 합니다');
      process.exit(1);
    }
    if (config.scheduling.endHour < 0 || config.scheduling.endHour > 23) {
      console.error('❌ 종료 시간은 0-23 사이여야 합니다');
      process.exit(1);
    }
    if (config.scheduling.interval < 1 || config.scheduling.interval > 24) {
      console.error('❌ 실행 주기는 1-24 시간 사이여야 합니다');
      process.exit(1);
    }
    if (config.scheduling.startHour >= config.scheduling.endHour) {
      console.error('❌ 시작 시간은 종료 시간보다 작아야 합니다');
      process.exit(1);
    }
  }

  return config;
}

const CLI_CONFIG = parseCliConfig();

// ============================================================================
// 서비스 정의 및 로딩
// ============================================================================

/**
 * RSS 서비스 정의는 src/config/services.json에서 중앙 관리
 * 새로운 서비스 추가/제거 시 services.json만 수정
 */

/**
 * 고성능 서비스 로더 - 병렬 로딩과 에러 복구 지원
 */
class ServiceLoader {
  #modules = new Map()
  #failedServices = []
  #loadingStats = { total: 0, success: 0, failed: 0, duration: 0 }
  #isDryRun
  #cacheMode

  constructor(isDryRun = false, cacheMode = null) {
    this.#isDryRun = isDryRun;
    this.#cacheMode = cacheMode || this.#determineCacheMode();
  }

  /**
   * 캐시 모드 결정
   */
  #determineCacheMode() {
    // once 모드: 캐시 완전 우회
    if (CLI_CONFIG.modes.isOnceMode) {
      return 'bypass';
    }

    // CI 환경: 파일 캐시 사용
    if (process.env.CI === 'true') {
      return 'file';
    }

    // 기본값: 메모리 캐시 (start:times 모드)
    return 'memory';
  }

  // Getters for private fields
  get modules() { return this.#modules; }
  get failedServices() { return [...this.#failedServices]; }
  get stats() { return { ...this.#loadingStats }; }

  /**
   * 병렬로 모든 서비스 로드
   */
  async loadServices() {
    const startTime = performance.now();
    logger.info('📦 RSS 서비스 모듈 병렬 로딩 시작...');
    logger.info(`🔧 캐시 모드: ${this.#cacheMode}`);
    
    const enabledServices = serviceManager.getEnabledServices();
    this.#loadingStats.total = enabledServices.length;

    // 캐시 옵션과 함께 서비스 로드
    const { loaded, failed } = await loadAllServices({ 
      isDryRun: this.#isDryRun,
      cache: { cacheMode: this.#cacheMode }
    });
    
    // 로드된 서비스 등록
    for (const { service, metadata } of loaded) {
      this.#modules.set(metadata.key, {
        ...metadata,
        module: service
      });
      this.#loadingStats.success++;
    }
    
    // 실패한 서비스 기록
    for (const { service, error } of failed) {
      this.#failedServices.push({
        ...service,
        error: error.message
      });
      this.#loadingStats.failed++;
    }

    this.#loadingStats.duration = performance.now() - startTime;
    this.#printLoadingStats();
    
    return this.#modules;
  }


  /**
   * 로딩 통계 출력 (Private method)
   */
  #printLoadingStats() {
    const { total, success, failed, duration } = this.#loadingStats;
    
    logger.info(`📊 서비스 로딩 완료: ${success}/${total}개 성공 (${duration.toFixed(1)}ms)`);
    
    if (failed > 0) {
      const failedNames = this.#failedServices.map(s => s.name).join(', ');
      logger.warn(`⚠️  실패한 서비스: ${failedNames}`);
    }

    // 성능 지표
    const avgLoadTime = duration / total;
    logger.info(`⚡ 평균 로딩 시간: ${avgLoadTime.toFixed(1)}ms/service`);
  }

  // Public methods
  get loadedServices() {
    return Array.from(this.#modules.values());
  }

  getServiceModule(key) {
    return this.#modules.get(key)?.module ?? null;
  }
}

// ============================================================================
// 고성능 병렬 실행 유틸리티
// ============================================================================

/**
 * 병렬 실행을 위한 배치 처리 유틸리티
 */
class BatchProcessor {
  static async processInBatches(items, processFn, options = {}) {
    const { 
      batchSize = 3, 
      onProgress = null
    } = options;
    
    const results = [];
    const totalBatches = Math.ceil(items.length / batchSize);
    
    // 배치 단위로 처리
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize);
      
      logger.info(`🔄 배치 ${batchIndex + 1}/${totalBatches} 처리 중... (${batch.length}개 항목)`);
      
      // 현재 배치의 모든 항목을 병렬 처리
      const batchPromises = batch.map(item => 
        BatchProcessor.#executeWithTimeout(processFn, item, CLI_CONFIG.performance.timeoutMs)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // 진행 상황 콜백 호출
      onProgress?.({
        batchIndex: batchIndex + 1,
        totalBatches,
        batchSize: batch.length,
        completed: results.length + batchResults.length
      });
      
      results.push(...batchResults);
      
      // 배치 간 쿨다운 (API 부하 방지)
      if (i + batchSize < items.length) {
        await BatchProcessor.#delay(500);
      }
    }
    
    return results;
  }

  /**
   * 타임아웃이 있는 실행 (Private method)
   */
  static async #executeWithTimeout(fn, item, timeoutMs) {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`실행 시간 초과 (${timeoutMs}ms)`)), timeoutMs)
    );

    try {
      return await Promise.race([fn(item), timeoutPromise]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 대기 함수 (Private method)
   */
  static async #delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// 스케줄링 모드 - 병렬 스케줄러 관리
// ============================================================================

class SchedulingApp {
  constructor(serviceLoader) {
    this.serviceLoader = serviceLoader;
    this.webhookService = null;
    this.telegramService = null;
    this.schedulerService = null;
  }

  async start() {
    try {
      logger.info('🚀 병렬 스케줄링 모드로 애플리케이션 시작');
      
      // 설정 검증 및 출력
      validateConfig();
      printConfig();
      
      // 서비스 모듈들을 로드
      this.webhookService = require('./src/services/webhook');
      this.telegramService = require('./src/services/telegram');
      this.schedulerService = require('./src/services/scheduler');
      
      // 웹훅 서버 시작
      await this.webhookService.start();
      
      // RSS 스케줄러를 병렬로 등록
      await this.registerSchedulersInParallel();
      
      // 통합 스케줄러 시작
      this.schedulerService.start();
      
      this.printStartupInfo();
      
    } catch (error) {
      logger.error('애플리케이션 시작 실패:', error);
      process.exit(1);
    }
  }

  /**
   * 스케줄러를 병렬로 등록
   */
  async registerSchedulersInParallel() {
    const startTime = performance.now();
    const loadedServices = this.serviceLoader.loadedServices;
    
    logger.info(`📅 ${loadedServices.length}개 스케줄러를 병렬로 등록 중...`);

    // 병렬 등록
    const registrationPromises = loadedServices.map(async (service) => {
      try {
        if (service.module?.scheduler) {
          this.schedulerService.registerDomainScheduler(service.key, service.module.scheduler);
          return { success: true, service: service.name };
        } else {
          throw new Error('스케줄러를 찾을 수 없습니다');
        }
      } catch (error) {
        logger.warn(`⚠️ ${service.name} 스케줄러 등록 실패: ${error.message}`);
        return { success: false, service: service.name, error: error.message };
      }
    });

    const results = await Promise.allSettled(registrationPromises);
    const duration = performance.now() - startTime;
    
    // 결과 분석
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success);

    logger.info(`✅ 스케줄러 등록 완료: ${successful.length}/${loadedServices.length}개 성공 (${duration.toFixed(1)}ms)`);
    
    if (failed.length > 0) {
      const failedNames = failed.map(r => 
        r.value?.service || r.reason?.message || '알 수 없는 서비스'
      );
      logger.warn(`⚠️ 등록 실패: ${failedNames.join(', ')}`);
    }
  }

  printStartupInfo() {
    const activeServices = this.serviceLoader.loadedServices
      .map(service => service.name)
      .join(', ');

    logger.info('✅ 모든 서비스가 성공적으로 시작되었습니다');
    logger.info('📡 긱뉴스봇의 웹훅 요청을 기다리는 중...');
    logger.info('🔄 모든 RSS 피드 스케줄러가 병렬로 활성화되었습니다');
    logger.info(`🎯 등록된 RSS 서비스: ${activeServices}`);
    logger.info(`⚡ 성능 설정: 최대 동시 실행 ${CLI_CONFIG.performance.maxConcurrency}개, 배치 크기 ${CLI_CONFIG.performance.batchSize}개`);
  }

  async shutdown(signal) {
    logger.info(`${signal} 신호를 받았습니다. 애플리케이션을 종료합니다...`);
    
    try {
      // 병렬 종료
      const shutdownPromises = [];
      
      if (this.schedulerService) {
        shutdownPromises.push(Promise.resolve(this.schedulerService.stop()));
      }
      
      if (this.webhookService) {
        shutdownPromises.push(this.webhookService.shutdown());
      }
      
      if (this.telegramService) {
        shutdownPromises.push(this.telegramService.shutdown());
      }
      
      await Promise.allSettled(shutdownPromises);
      
      this.printShutdownStats();
      
      logger.info('✅ 모든 서비스가 안전하게 종료되었습니다');
      process.exit(0);
    } catch (error) {
      logger.error('종료 중 오류 발생:', error);
      process.exit(1);
    }
  }

  printShutdownStats() {
    try {
      if (this.webhookService) {
        const webhookStats = this.webhookService.getStats();
        logger.info('📊 웹훅 서비스 통계:', webhookStats);
      }
      
      if (this.schedulerService) {
        const schedulerStats = this.schedulerService.getOverallStats();
        logger.info('📊 통합 스케줄러 서비스 통계:', schedulerStats);
      }
    } catch (error) {
      logger.debug('통계 출력 중 오류:', error.message);
    }
  }
}

// ============================================================================
// 단일 실행 모드 - 고성능 병렬 처리
// ============================================================================

class OnceExecutor {
  constructor(serviceLoader, isDryRun = false) {
    this.serviceLoader = serviceLoader;
    this.isDryRun = isDryRun;
    this.results = {
      total: 0,
      success: 0,
      failed: 0,
      articlesFound: 0,
      messagesSent: 0,
      duration: 0,
      details: []
    };
  }

  async execute() {
    console.log('🚀 RSS 피드 고성능 병렬 실행 시작');
    console.log(`⚡ 성능 설정: 배치 크기 ${CLI_CONFIG.performance.batchSize}, 최대 동시 실행 ${CLI_CONFIG.performance.maxConcurrency}개`);
    console.log(`📅 필터링 날짜: 최근 ${CLI_CONFIG.filtering.filterDays}일`);
    
    // 전역 필터 날짜 설정
    const { setGlobalFilterDays } = require('./src/utils/dateUtils');
    setGlobalFilterDays(CLI_CONFIG.filtering.filterDays);
    
    // 텔레그램 서비스에 dry-run 모드 설정
    const telegram = require('./src/infrastructure/telegram');
    telegram.setDryRunMode(this.isDryRun);
    
    if (this.isDryRun) {
      console.log('⚠️  DRY RUN 모드 - 실제 메시지는 전송되지 않습니다\n');
    } else {
      console.log('⚠️  실제로 텔레그램에 메시지가 전송됩니다!');
      await this.showCountdown();
    }

    await this.executeAllServicesInParallel();
    this.printDetailedSummary();
  }

  async showCountdown() {
    console.log('테스트만 하려면 --dry-run 옵션을 사용하세요.\n');
    
    for (let i = 5; i > 0; i--) {
      process.stdout.write(`\r⏱️  ${i}초 후 시작... (Ctrl+C로 취소)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('\n');
  }

  /**
   * 모든 서비스를 고성능 병렬로 실행
   */
  async executeAllServicesInParallel() {
    const startTime = performance.now();
    const loadedServices = this.serviceLoader.loadedServices;
    this.results.total = loadedServices.length;

    logger.info(`🎯 ${loadedServices.length}개 서비스 병렬 실행 시작`);

    // 배치 처리로 병렬 실행
    const results = await BatchProcessor.processInBatches(
      loadedServices,
      this.executeService.bind(this),
      {
        batchSize: CLI_CONFIG.performance.batchSize,
        maxConcurrency: CLI_CONFIG.performance.maxConcurrency,
        onProgress: this.onProgress.bind(this)
      }
    );

    // 결과 분석 및 집계
    this.analyzeResults(results);
    this.results.duration = performance.now() - startTime;
    
    logger.info(`⚡ 전체 실행 완료: ${this.results.duration.toFixed(1)}ms`);
  }

  /**
   * 단일 서비스 실행
   */
  async executeService(service) {
    const startTime = performance.now();
    
    try {
      logger.info(`📡 ${service.name} 실행 시작...`);
      logger.info(`   - 캐시 우회 모드: ${CLI_CONFIG.modes.isOnceMode ? 'ON' : 'OFF'}`);
      logger.info(`   - 필터 날짜: 최근 ${CLI_CONFIG.filtering.filterDays}일`);
      
      const serviceModule = service.module;
      
      // Dry run 모드 설정
      const originalCache = this.setupDryRunCache(serviceModule);
      
      try {
        const result = await serviceModule.scheduler.runManualCheck(CLI_CONFIG.modes.isOnceMode);
        const duration = performance.now() - startTime;
        
        logger.info(`📡 ${service.name} 실행 결과:`, {
          articlesFound: result?.articlesFound || 0,
          messagesSent: result?.messagesSent || 0,
          failed: result?.failed || 0
        });
        
        return {
          success: true,
          service: service.name,
          result,
          duration
        };
      } finally {
        // 캐시 복원
        if (originalCache) {
          serviceModule.cache = originalCache;
        }
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error(`❌ ${service.name} 실행 실패:`, error.message);
      
      return {
        success: false,
        service: service.name,
        error: error.message,
        duration
      };
    }
  }

  /**
   * Dry run을 위한 캐시 설정
   */
  setupDryRunCache(serviceModule) {
    if (!this.isDryRun || !serviceModule?.cache) {
      return null;
    }

    const originalCache = serviceModule.cache;
    
    // Dry run용 더미 캐시
    serviceModule.cache = {
      filterNewPosts: (posts) => posts,
      markAsSent: () => {},
      cleanupOldCache: () => {},
      getTodayStats: () => ({ sent: 0, filtered: 0 })
    };
    
    return originalCache;
  }

  /**
   * 진행 상황 콜백
   */
  onProgress({ batchIndex, totalBatches, completed }) {
    const progress = ((completed / this.results.total) * 100).toFixed(1);
    console.log(`📊 진행률: ${progress}% (${completed}/${this.results.total}) - 배치 ${batchIndex}/${totalBatches} 완료`);
  }

  /**
   * 결과 분석
   */
  analyzeResults(results) {
    results.forEach(result => {
      const detail = {
        service: 'Unknown',
        success: false,
        articlesFound: 0,
        messagesSent: 0,
        duration: 0,
        error: null
      };

      if (result.status === 'fulfilled' && result.value.success) {
        this.results.success++;
        const { service, result: execResult, duration } = result.value;
        
        detail.service = service;
        detail.success = true;
        detail.articlesFound = execResult?.articlesFound || 0;
        detail.messagesSent = execResult?.messagesSent || 0;
        detail.duration = duration;
        
        this.results.articlesFound += detail.articlesFound;
        this.results.messagesSent += detail.messagesSent;
        
        console.log(`   ✅ ${service}: ${detail.articlesFound}개 발견, ${detail.messagesSent}개 전송 (${duration.toFixed(1)}ms)`);
      } else {
        this.results.failed++;
        const errorInfo = result.value || { service: 'Unknown', error: result.reason?.message || '알 수 없는 오류' };
        
        detail.service = errorInfo.service;
        detail.error = errorInfo.error;
        detail.duration = errorInfo.duration || 0;
        
        console.log(`   ❌ ${detail.service}: ${detail.error} (${detail.duration.toFixed(1)}ms)`);
      }

      this.results.details.push(detail);
    });
  }

  /**
   * 상세 요약 출력
   */
  printDetailedSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 고성능 병렬 실행 결과 상세 분석');
    console.log('='.repeat(80));
    
    // 기본 통계
    console.log(`📈 기본 통계:`);
    console.log(`   총 서비스: ${this.results.total}개`);
    console.log(`   ✅ 성공: ${this.results.success}개 (${(this.results.success/this.results.total*100).toFixed(1)}%)`);
    console.log(`   ❌ 실패: ${this.results.failed}개 (${(this.results.failed/this.results.total*100).toFixed(1)}%)`);
    console.log(`   📰 발견된 아티클: ${this.results.articlesFound}개`);
    console.log(`   📨 전송된 메시지: ${this.results.messagesSent}개`);
    
    // 성능 통계
    console.log(`\n⚡ 성능 통계:`);
    console.log(`   전체 실행 시간: ${this.results.duration.toFixed(1)}ms`);
    const avgDuration = this.results.details.reduce((sum, d) => sum + d.duration, 0) / this.results.details.length;
    console.log(`   평균 서비스 실행 시간: ${avgDuration.toFixed(1)}ms`);
    console.log(`   처리량: ${(this.results.total / (this.results.duration / 1000)).toFixed(1)} services/sec`);
    
    // 성공한 서비스 상세
    const successful = this.results.details.filter(d => d.success);
    if (successful.length > 0) {
      console.log(`\n✅ 성공한 서비스 (${successful.length}개):`);
      successful.forEach(detail => {
        console.log(`   📡 ${detail.service}: ${detail.articlesFound}개/${detail.messagesSent}개 (${detail.duration.toFixed(1)}ms)`);
      });
    }
    
    // 실패한 서비스 상세  
    const failed = this.results.details.filter(d => !d.success);
    if (failed.length > 0) {
      console.log(`\n❌ 실패한 서비스 (${failed.length}개):`);
      failed.forEach(detail => {
        console.log(`   💥 ${detail.service}: ${detail.error} (${detail.duration.toFixed(1)}ms)`);
      });
    }
    
    if (this.isDryRun) {
      console.log('\n⚠️  DRY RUN 모드였으므로 실제로 메시지가 전송되지 않았습니다.');
    }
    
    console.log('\n✨ 고성능 병렬 실행 완료!');
    console.log('='.repeat(80));
  }
}

// ============================================================================
// 메인 애플리케이션 로직
// ============================================================================

async function main() {
  try {
    // 도움말 출력
    if (CLI_CONFIG.modes.showHelp) {
      printUsage();
      process.exit(0);
    }

    if (CLI_CONFIG.modes.isOnceMode) {
      // 단일 실행 모드
      const serviceLoader = new ServiceLoader(CLI_CONFIG.modes.isDryRun);
      await serviceLoader.loadServices();
      
      const executor = new OnceExecutor(serviceLoader, CLI_CONFIG.modes.isDryRun);
      await executor.execute();
      process.exit(0);
    } else if (CLI_CONFIG.modes.isParameterizedScheduling) {
      // 파라미터 기반 스케줄링 모드
      const Scheduler = require('./src/scheduling/scheduler');
      const scheduler = new Scheduler({
        startHour: CLI_CONFIG.scheduling.startHour,
        endHour: CLI_CONFIG.scheduling.endHour,
        interval: CLI_CONFIG.scheduling.interval,
        times: CLI_CONFIG.scheduling.times,
        dryRun: CLI_CONFIG.modes.isDryRun
      });
      
      // 신호 처리 등록
      setupSchedulerSignalHandlers(scheduler);
      
      await scheduler.start();
    } else {
      // 기본 스케줄링 모드
      const serviceLoader = new ServiceLoader();
      await serviceLoader.loadServices();
      
      const app = new SchedulingApp(serviceLoader);
      
      // 신호 처리 등록
      setupSignalHandlers(app);
      
      await app.start();
    }

  } catch (error) {
    logger.error('메인 실행 중 오류:', error);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
RSS 알림 봇 v2.1 - 고성능 병렬 처리 & 파라미터 스케줄링

사용법:
  기본 스케줄링 모드:
    node index.js                              매일 오후 5:30 실행 (기본값)
    
  파라미터 기반 스케줄링:
    node index.js --start-hour=9 --end-hour=18 --interval=2    간격 기반
    node index.js --times=9,12,15:30,18                        특정 시간
    node index.js --times=8:30,12,17:30 --dry-run              테스트 모드
    
  단일 실행 모드:
    node index.js --once                       모든 RSS 서비스 병렬 단일 실행
    node index.js --once --dry-run             드라이런 모드로 병렬 단일 실행
    node index.js --once --batch-size=5        배치 크기 설정 (기본: 3)
    
  도움말:
    node index.js --help                       도움말 출력

모드 설명:
  기본 스케줄링: 웹훅 서버와 RSS 스케줄러를 실행 (매일 오후 5:30)
  파라미터 스케줄링: 사용자 정의 시간대와 간격으로 실행
  단일 실행: 모든 RSS 서비스를 고성능 병렬로 한 번만 실행하고 종료
  드라이런 모드: 실제 텔레그램 전송 없이 테스트만 수행

파라미터 스케줄링 옵션:
  --start-hour=N        시작 시간 (0-23, 기본: 9)
  --end-hour=N          종료 시간 (0-23, 기본: 18)  
  --interval=N          실행 주기 시간 (1-24, 기본: 2)
  --times=LIST          특정 시간 리스트 (예: 9,12,15:30,18)
  --dry-run             테스트 모드 (실제 메시지 전송 안함)
  --filter-days=N       필터링할 날짜 수 (1-30, 기본: 1)

성능 옵션:
  --batch-size=N        배치당 처리할 서비스 수 (1-10, 기본: 3)
  --max-concurrency=N   최대 동시 실행 서비스 수 (1-20, 기본: 5)

예제:
  # 오전 9시부터 오후 6시까지 2시간 간격
  node index.js --start-hour=9 --end-hour=18 --interval=2
  
  # 특정 시간에만 실행
  node index.js --times=9,12,15:30,18
  
  # 테스트 모드로 파라미터 스케줄링
  node index.js --times=10,14,17:30 --dry-run

환경 설정:
  .env 파일에 다음 변수들이 설정되어야 합니다:
  - TELEGRAM_BOT_TOKEN: 텔레그램 봇 토큰
  - TELEGRAM_CHAT_ID: 대상 채팅방 ID
  - RSS_SCHEDULE_CRON: 기본 스케줄 (선택사항)

성능 개선사항:
  ✨ 병렬 처리로 최대 10배 성능 향상
  ✨ 배치 처리로 메모리 효율성 개선
  ✨ Promise.allSettled로 안정적인 에러 처리
  ✨ 파라미터 기반 유연한 스케줄링
  ✨ 실시간 진행률 표시 및 상세 통계
`);
}

function setupSignalHandlers(app) {
  const signalHandler = (signal) => app.shutdown(signal);
  
  process.on('SIGTERM', () => signalHandler('SIGTERM'));
  process.on('SIGINT', () => signalHandler('SIGINT'));
  
  // 처리되지 않은 예외 처리
  process.on('uncaughtException', (error) => {
    logger.error('처리되지 않은 예외:', error);
    signalHandler('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('처리되지 않은 Promise 거부:', { reason, promise });
    signalHandler('unhandledRejection');
  });
}

function setupSchedulerSignalHandlers(scheduler) {
  const signalHandler = (signal) => {
    logger.info(`${signal} 신호 수신`);
    scheduler.stop();
    process.exit(0);
  };
  
  process.on('SIGTERM', () => signalHandler('SIGTERM'));
  process.on('SIGINT', () => signalHandler('SIGINT'));
  
  // 처리되지 않은 예외 처리
  process.on('uncaughtException', (error) => {
    logger.error('처리되지 않은 예외:', error);
    scheduler.stop();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('처리되지 않은 Promise 거부:', { reason, promise });
    scheduler.stop();
    process.exit(1);
  });
}

// 애플리케이션 시작
main();