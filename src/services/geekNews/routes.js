const express = require('express');
const geekNewsService = require('./index');
const { logger, logError } = require('../../utils/logger');

class GeekNewsRoutes {
  constructor() {
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // 수동 체크 엔드포인트
    this.router.post('/manual-check', async (req, res) => {
      try {
        logger.info('GeekNews 수동 체크 요청 수신');
        
        const result = await geekNewsService.checkAndSendLatestPosts({
          todayOnly: false, // 수동 실행시에는 오늘자만이 아닌 최근 글도 포함
          limit: 5
        });

        res.json({
          success: true,
          message: 'GeekNews 수동 체크 완료',
          ...result
        });

      } catch (error) {
        logError(error, { context: 'GeekNews 수동 체크' });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 단일 포스트 전송 테스트
    this.router.post('/send-single', async (req, res) => {
      try {
        const { index = 0 } = req.body;
        
        logger.info(`GeekNews 단일 포스트 전송 (인덱스: ${index})`);
        
        const result = await geekNewsService.sendSinglePost(index);

        res.json({
          success: true,
          message: '포스트 전송 완료',
          post: result
        });

      } catch (error) {
        logError(error, { context: 'GeekNews 단일 포스트 전송' });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 현재 프론트엔드 포스트 목록 조회 (전송하지 않고 조회만)
    this.router.get('/frontend-posts', async (req, res) => {
      try {
        const { todayOnly = false, limit = 10 } = req.query;
        
        logger.info('GeekNews 프론트엔드 포스트 목록 조회');
        
        const posts = await geekNewsService.articleService.getLatestFrontendPosts({
          todayOnly: todayOnly === 'true',
          limit: parseInt(limit),
          includeDetails: false
        });

        res.json({
          success: true,
          posts,
          count: posts.length
        });

      } catch (error) {
        logError(error, { context: 'GeekNews 포스트 목록 조회' });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  }

  /**
   * Express 앱에 라우트 등록
   */
  registerRoutes(app, isDevelopment = false) {
    if (isDevelopment) {
      app.use('/geekNews', this.router);
      logger.info('GeekNews 라우트 등록 완료');
    }
  }
}

module.exports = GeekNewsRoutes;