#!/usr/bin/env node

/**
 * RSS 서비스 테스터
 * 
 * 사용법:
 * node src/test/test-rss.js           # 모든 활성 RSS 서비스 테스트
 * node src/test/test-rss.js kofe      # 특정 서비스만 테스트
 * node src/test/test-rss.js geeknews  # GeekNews 서비스 테스트
 */

require('dotenv').config();
const { logger } = require('../utils/logger');
const { serviceManager, getServiceByKey } = require('../config/services');

// 서비스 정의는 src/config/services.json에서 관리

/**
 * 단일 서비스 테스트
 */
async function testSingleService(serviceKey) {
  logger.info(`🔍 ${serviceKey} 서비스 테스트 시작`);
  
  // 서비스 설정 찾기
  const serviceConfig = getServiceByKey(serviceKey) || 
    serviceManager.getEnabledServices().find(s => 
      s.key.toLowerCase() === serviceKey.toLowerCase() || 
      s.name.toLowerCase().includes(serviceKey.toLowerCase())
    );

  if (!serviceConfig) {
    logger.error(`❌ 서비스를 찾을 수 없습니다: ${serviceKey}`);
    logger.info('사용 가능한 서비스:', serviceManager.getEnabledServices().map(s => s.key).join(', '));
    process.exit(1);
  }

  if (!serviceConfig.enabled) {
    logger.warn(`⚠️  ${serviceConfig.name} 서비스는 비활성화되어 있습니다`);
    return;
  }

  try {
    logger.info(`📋 서비스 정보: ${serviceConfig.name} (${serviceConfig.category})`);
    
    // 서비스 모듈 로드
    const service = require(serviceConfig.modulePath);
    
    // 피드 상태 체크
    logger.info('🔍 피드 상태 확인 중...');
    const health = await service.articleService.checkFeedHealth();
    logger.info('✅ 피드 상태:', health);
    
    // 최신 아티클 가져오기
    logger.info('📰 최신 아티클 조회 중...');
    const articles = await service.articleService.getLatestArticles(3);
    
    if (articles.length > 0) {
      logger.info(`✅ ${articles.length}개 아티클 발견:`);
      articles.forEach((article, index) => {
        console.log(`\n--- ${index + 1}. ${article.title} ---`);
        console.log(`📅 날짜: ${article.date}`);
        console.log(`🔗 URL: ${article.url}`);
        if (article.tags?.length > 0) {
          console.log(`🏷️  태그: ${article.tags.join(', ')}`);
        }
      });
    } else {
      logger.info('📭 새로운 아티클이 없습니다');
    }
    
    logger.info(`\n✅ ${serviceConfig.name} 테스트 완료\n`);
    return { success: true, service: serviceConfig.name, articlesCount: articles.length };
    
  } catch (error) {
    logger.error(`❌ ${serviceConfig.name} 테스트 실패:`, error.message);
    return { success: false, service: serviceConfig.name, error: error.message };
  }
}

/**
 * 모든 서비스 테스트
 */
async function testAllServices() {
  const enabledServices = serviceManager.getEnabledServices();
  
  logger.info('🧪 전체 RSS 서비스 테스트 시작');
  logger.info(`총 ${enabledServices.length}개 활성 서비스 테스트 예정`);
  
  // 서비스 정보 출력
  serviceManager.printServiceInfo();
  
  const results = [];
  
  for (const serviceConfig of enabledServices) {
    logger.info(`\n📌 [${results.length + 1}/${enabledServices.length}] ${serviceConfig.name} 테스트`);
    logger.info('='.repeat(50));
    
    try {
      const service = require(serviceConfig.modulePath);
      
      // 피드 상태 체크
      const health = await service.articleService.checkFeedHealth();
      
      if (health.status === 'healthy') {
        logger.info(`✅ ${serviceConfig.name}: 정상 (${health.articlesCount}개 아티클, ${health.responseTime})`);
        results.push({ 
          service: serviceConfig.name, 
          status: 'success', 
          articles: health.articlesCount,
          time: health.responseTime 
        });
      } else {
        logger.warn(`⚠️  ${serviceConfig.name}: 오류 - ${health.error}`);
        results.push({ 
          service: serviceConfig.name, 
          status: 'error', 
          error: health.error 
        });
      }
      
    } catch (error) {
      logger.error(`❌ ${serviceConfig.name}: 실패 - ${error.message}`);
      results.push({ 
        service: serviceConfig.name, 
        status: 'failed', 
        error: error.message 
      });
    }
    
    // 서비스 간 딜레이
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // 결과 요약
  logger.info('\n' + '='.repeat(60));
  logger.info('📊 테스트 결과 요약');
  logger.info('='.repeat(60));
  
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status !== 'success');
  
  logger.info(`✅ 성공: ${successful.length}/${results.length}`);
  if (failed.length > 0) {
    logger.warn(`❌ 실패: ${failed.length}개`);
    failed.forEach(r => {
      logger.error(`  - ${r.service}: ${r.error || 'Unknown error'}`);
    });
  }
  
  // 통계
  const totalArticles = successful.reduce((sum, r) => sum + (r.articles || 0), 0);
  logger.info(`📰 총 아티클 수: ${totalArticles}개`);
  
  return results;
}

/**
 * 메인 실행 함수
 */
async function main() {
  const args = process.argv.slice(2);
  
  try {
    if (args.length === 0) {
      // 전체 서비스 테스트
      await testAllServices();
    } else {
      // 특정 서비스 테스트
      const serviceKey = args[0];
      await testSingleService(serviceKey);
    }
    
    logger.info('✨ 테스트 완료!');
    process.exit(0);
    
  } catch (error) {
    logger.error('테스트 실행 중 오류:', error);
    process.exit(1);
  }
}

// 실행
main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});