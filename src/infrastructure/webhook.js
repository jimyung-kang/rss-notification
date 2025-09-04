const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { config } = require('../config/config');
const { logger, logWebhookRequest, logError, logPerformance } = require('../utils/logger');
const telegramService = require('./telegram');
const schedulerService = require('./scheduler');
const KofeArticleRoutes = require('./kofeArticle/routes');
const GeekNewsRoutes = require('./geekNews/routes');

class WebhookService {
  constructor() {
    // Express 앱 생성
    this.app = express();
    // 서버 인스턴스
    this.server = null;
    // 요청 처리 통계
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      startTime: new Date()
    };
    
    // 미들웨어 설정
    this.setupMiddleware();
    // 라우트 설정
    this.setupRoutes();
    // 도메인별 라우트 등록
    this.setupDomainRoutes();
  }

  /**
   * Express 미들웨어 설정
   */
  setupMiddleware() {
    // JSON 파싱 미들웨어
    this.app.use(bodyParser.json({ limit: '10mb' }));
    this.app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

    // 기본 헬스체크 엔드포인트
    this.app.get('/health', (req, res) => {
      const uptime = Math.floor((new Date() - this.stats.startTime) / 1000);
      res.json({
        status: 'healthy',
        uptime: `${uptime}초`,
        stats: this.stats,
        timestamp: new Date().toISOString()
      });
    });

    // 요청 로깅 미들웨어
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      // 응답 완료 시 로깅
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        if (req.path !== '/health') {
          logPerformance(`${req.method} ${req.path}`, duration);
        }
      });
      
      next();
    });

    // 에러 핸들링 미들웨어
    this.app.use((error, req, res, next) => {
      logError(error, { 
        context: 'Express 에러 핸들러',
        path: req.path,
        method: req.method 
      });
      
      res.status(500).json({
        error: '내부 서버 오류가 발생했습니다',
        message: config.app.isDevelopment ? error.message : undefined
      });
    });
  }

  /**
   * 라우트 설정
   */
  setupRoutes() {
    // 웹훅 엔드포인트
    this.app.post(config.webhook.path, async (req, res) => {
      const startTime = Date.now();
      this.stats.totalRequests++;

      try {
        // 요청 로깅
        logWebhookRequest(req);

        // 시크릿 토큰 검증 (설정된 경우)
        if (config.webhook.secret && !this.verifyWebhookSecret(req)) {
          logger.warn('웹훅 시크릿 검증 실패', { ip: req.ip });
          res.status(401).json({ error: '인증 실패' });
          this.stats.failedRequests++;
          return;
        }

        // 빈 요청 처리
        if (!req.body || Object.keys(req.body).length === 0) {
          logger.warn('빈 웹훅 요청 수신');
          res.status(400).json({ error: '요청 본문이 비어있습니다' });
          this.stats.failedRequests++;
          return;
        }

        // 긱뉴스 데이터 처리
        const result = await this.processGeekNewsData(req.body);

        // 성능 로깅
        const duration = Date.now() - startTime;
        logPerformance('웹훅 처리', duration);

        this.stats.successfulRequests++;
        
        // 응답 전송
        res.json({
          success: true,
          message: '데이터 처리 완료',
          processTime: `${duration}ms`,
          ...result
        });

      } catch (error) {
        logError(error, { context: '웹훅 처리 중 오류' });
        this.stats.failedRequests++;
        
        res.status(500).json({
          success: false,
          error: '데이터 처리 중 오류가 발생했습니다',
          message: config.app.isDevelopment ? error.message : undefined
        });
      }
    });

    // 웹훅 테스트 엔드포인트 (개발용)
    if (config.app.isDevelopment) {
      this.app.get(config.webhook.path + '/test', (req, res) => {
        res.json({
          message: '웹훅 테스트 엔드포인트',
          expectedFormat: {
            title: '기사 제목',
            url: 'https://example.com/article',
            description: '기사 설명',
            author: '작성자',
            date: '2024-01-01T00:00:00Z',
            category: '카테고리',
            tags: ['태그1', '태그2']
          }
        });
      });

      // 테스트 메시지 전송 엔드포인트
      this.app.post(config.webhook.path + '/test', async (req, res) => {
        try {
          const testData = {
            title: '테스트 긱뉴스 기사',
            url: 'https://news.hada.io/test',
            description: '이것은 웹훅 연동 테스트를 위한 메시지입니다.',
            author: 'GeekNews Bot',
            date: new Date().toISOString(),
            category: '테스트',
            tags: ['test', 'webhook']
          };

          const result = await this.processGeekNewsData(testData);
          
          res.json({
            success: true,
            message: '테스트 메시지가 전송되었습니다',
            data: testData,
            result
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error.message
          });
        }
      });

    }
  }

  /**
   * 도메인별 라우트 설정
   */
  setupDomainRoutes() {
    if (config.app.isDevelopment) {
      // Korean FE Article 라우트 등록
      const KofeArticle = require('./kofeArticle');
      const kofeRoutes = new KofeArticleRoutes(KofeArticle);
      kofeRoutes.registerRoutes(this.app, true);
      
      // GeekNews 라우트 등록
      const geekNewsRoutes = new GeekNewsRoutes();
      geekNewsRoutes.registerRoutes(this.app, true);
    }

    // 404 핸들러 (마지막에 등록)
    this.app.use((req, res) => {
      res.status(404).json({
        error: '요청한 엔드포인트를 찾을 수 없습니다',
        path: req.path
      });
    });
  }

  /**
   * 웹훅 시크릿 검증
   */
  verifyWebhookSecret(req) {
    // 헤더에서 시크릿 확인 (여러 방식 지원)
    const providedSecret = 
      req.headers['x-webhook-secret'] ||
      req.headers['x-hub-signature'] ||
      req.headers['authorization'];

    if (!providedSecret) {
      return false;
    }

    // Bearer 토큰 형식 처리
    const secret = providedSecret.replace('Bearer ', '');

    // GitHub 스타일 HMAC 서명 검증
    if (providedSecret.startsWith('sha256=')) {
      const signature = crypto
        .createHmac('sha256', config.webhook.secret)
        .update(JSON.stringify(req.body))
        .digest('hex');
      
      return providedSecret === `sha256=${signature}`;
    }

    // 단순 토큰 비교
    return secret === config.webhook.secret;
  }

  /**
   * 긱뉴스 데이터 처리 및 텔레그램 전송
   */
  async processGeekNewsData(data) {
    try {
      logger.info('긱뉴스 데이터 처리 시작', {
        hasTitle: !!data.title,
        hasUrl: !!data.url,
        dataKeys: Object.keys(data)
      });

      // 데이터 유효성 검증
      const validatedData = this.validateGeekNewsData(data);

      // 텔레그램으로 메시지 전송
      const messageResults = await telegramService.sendMessage(validatedData);

      logger.info('긱뉴스 데이터 처리 완료', {
        messageCount: messageResults.length
      });

      return {
        processed: true,
        messageCount: messageResults.length,
        title: validatedData.title
      };

    } catch (error) {
      logError(error, { context: '긱뉴스 데이터 처리' });
      throw error;
    }
  }

  /**
   * 긱뉴스 데이터 유효성 검증 및 정규화
   */
  validateGeekNewsData(data) {
    // 필수 필드 검증
    if (!data.title && !data.url && !data.description) {
      throw new Error('제목, URL, 설명 중 최소 하나는 필요합니다');
    }

    // 데이터 정규화
    const normalized = {
      title: data.title || data.subject || data.name || '제목 없음',
      url: data.url || data.link || data.href || '',
      description: data.description || data.content || data.summary || '',
      author: data.author || data.writer || data.creator || '',
      date: data.date || data.created || data.published || new Date().toISOString(),
      category: data.category || data.section || '',
      tags: Array.isArray(data.tags) ? data.tags : 
            (data.tags ? [data.tags] : []),
      geekNewsUrl: data.geekNewsUrl || data.geekNews_url || data.topicUrl || ''
    };

    // URL 유효성 검증
    if (normalized.url && !this.isValidUrl(normalized.url)) {
      logger.warn('유효하지 않은 URL', { url: normalized.url });
      normalized.url = '';
    }

    return normalized;
  }

  /**
   * URL 유효성 검증
   */
  isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * 서버 시작
   */
  async start() {
    try {
      // 텔레그램 서비스 초기화
      await telegramService.initialize();

      // 서버 시작
      return new Promise((resolve, reject) => {
        this.server = this.app.listen(config.webhook.port, () => {
          logger.info(`웹훅 서버가 포트 ${config.webhook.port}에서 시작되었습니다`);
          logger.info(`웹훅 엔드포인트: POST http://localhost:${config.webhook.port}${config.webhook.path}`);
          
          if (config.app.isDevelopment) {
            logger.info(`테스트 엔드포인트: POST http://localhost:${config.webhook.port}${config.webhook.path}/test`);
          }
          
          resolve();
        });

        this.server.on('error', (error) => {
          logError(error, { context: '서버 시작 오류' });
          reject(error);
        });
      });
    } catch (error) {
      logError(error, { context: '웹훅 서비스 시작 실패' });
      throw error;
    }
  }

  /**
   * 서버 종료
   */
  async shutdown() {
    if (this.server) {
      logger.info('웹훅 서버 종료 중...');
      
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('웹훅 서버가 종료되었습니다');
          this.server = null;
          resolve();
        });

        // 강제 종료 타임아웃 (10초)
        setTimeout(() => {
          logger.warn('서버 강제 종료');
          resolve();
        }, 10000);
      });
    }
  }

  /**
   * 통계 정보 조회
   */
  getStats() {
    return {
      ...this.stats,
      uptime: Math.floor((new Date() - this.stats.startTime) / 1000),
      successRate: this.stats.totalRequests > 0 
        ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
module.exports = new WebhookService();