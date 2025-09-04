const { logger } = require('../../utils/logger');

class KofeArticleRoutes {
  constructor(KofeArticle) {
    this.domain = KofeArticle;
  }

  /**
   * kofeArticle 관련 라우트들을 Express 앱에 등록
   */
  registerRoutes(app, isDevelopment = false) {
    if (!isDevelopment) return;

    // 수동 아티클 체크 엔드포인트
    app.post('/kofe/check', async (req, res) => {
      try {
        logger.info('Korean FE Article 수동 체크 요청');
        const result = await this.domain.runManualCheck();
        
        res.json({
          success: true,
          message: 'Korean FE Article 체크 완료',
          result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 최신 아티클 조회 엔드포인트 (기본값)
    app.get('/kofe/latest', async (req, res) => {
      try {
        const count = parseInt(req.query.count) || 5;
        const articles = await this.domain.getLatestArticles(count);
        
        res.json({
          success: true,
          count: articles.length,
          articles
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 최신 아티클 조회 엔드포인트 (개수 지정)
    app.get('/kofe/latest/:count', async (req, res) => {
      try {
        const count = parseInt(req.params.count) || 5;
        const articles = await this.domain.getLatestArticles(count);
        
        res.json({
          success: true,
          count: articles.length,
          articles
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 피드 상태 확인 엔드포인트
    app.get('/kofe/health', async (req, res) => {
      try {
        const health = await this.domain.checkFeedHealth();
        res.json(health);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 스케줄러 통계 엔드포인트
    app.get('/kofe/stats', (req, res) => {
      res.json(this.domain.getStats());
    });

    // 테스트용: 최신 아티클 1개 강제 전송
    app.post('/kofe/test-send', async (req, res) => {
      try {
        logger.info('테스트용 아티클 전송 요청');
        
        // 최신 아티클 1개 가져오기
        const articles = await this.domain.getLatestArticles(1);
        
        if (articles.length === 0) {
          res.json({ success: false, message: '아티클이 없습니다' });
          return;
        }
        
        const article = articles[0];
        
        // 메시지 포맷팅 및 전송
        const message = this.domain.formatArticleMessage(article);
        await this.domain.sendDirectMessage(message);
        
        res.json({
          success: true,
          message: '테스트 아티클 전송 완료',
          article: {
            title: article.title,
            date: article.date
          }
        });
        
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    logger.info('Korean FE Article 라우트 등록 완료');
  }
}

module.exports = KofeArticleRoutes;