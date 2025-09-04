const axios = require('axios');
const cheerio = require('cheerio');
const { logger, logError } = require('../../utils/logger');

class GeekNewsCrawler {
  constructor() {
    this.baseUrl = 'https://news.hada.io';
    this.frontendKeywords = [
      // 프레임워크
      'react', 'vue', 'angular', 'svelte', 'nextjs', 'nuxtjs', 'gatsby',
      // 언어
      'javascript', 'typescript', 'js', 'ts', 
      // 스타일링
      'css', 'scss', 'sass', 'tailwind', 'styled-components', 'emotion',
      // 도구
      'webpack', 'vite', 'rollup', 'parcel', 'esbuild', 'swc',
      // 기술
      'html', 'dom', 'browser', 'web', 'pwa', 'spa',
      // UI/UX
      'ui', 'ux', 'design system', 'component', 'animation',
      // 한글
      '프론트엔드', '프론트', '웹개발', '웹프론트', 'ui개발', 'ux',
      // 기타
      'frontend', 'front-end', 'client-side', 'web development'
    ];
  }

  /**
   * GeekNews 메인 페이지에서 최신 포스트 목록 가져오기
   */
  async fetchLatestPosts() {
    try {
      logger.info('GeekNews 크롤링 시작');
      
      const response = await axios.get(this.baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const posts = [];

      // GeekNews의 포스트 구조 분석 (topic 링크 기반)
      const processedTopics = new Set();
      
      $('a[href*="topic?id="]').each((index, element) => {
        const $link = $(element);
        const title = $link.text().trim();
        const href = $link.attr('href');
        
        // 중복 제거 및 기본 필터링
        if (!title || title.length < 5 || 
            title.includes('더 불러오기') || 
            title.includes('댓글') ||
            processedTopics.has(href)) {
          return;
        }
        
        processedTopics.add(href);
        
        // 전체 URL 구성
        const topicUrl = href.startsWith('http') ? 
          href : 
          new URL(href, this.baseUrl).href;
        
        // 링크 근처에서 정보 추출
        const $parent = $link.parent();
        const parentText = $parent.text();
        
        // 포인트 추출
        const pointMatch = parentText.match(/(\d+)\s*포인트?/);
        const points = pointMatch ? parseInt(pointMatch[1]) : 0;
        
        // 시간 추출
        const timeMatch = parentText.match(/(\d+)(시간|분)전|어제|오늘/g);
        const time = timeMatch ? timeMatch[0] : '시간 알 수 없음';
        
        // 댓글 수 추출
        const commentMatch = parentText.match(/댓글\s*(\d+)/); 
        const commentCount = commentMatch ? parseInt(commentMatch[1]) : 0;
        
        // 태그 (제목에서 추출)
        const tags = [];

        posts.push({
          title,
          topicUrl,
          points,
          time,
          commentCount,
          tags,
          originalIndex: index
        });
      });

      logger.info(`총 ${posts.length}개의 포스트를 가져왔습니다`);
      return posts;

    } catch (error) {
      logError(error, { context: 'GeekNews 크롤링 실패' });
      throw error;
    }
  }

  /**
   * 프론트엔드 관련 포스트 필터링
   */
  filterFrontendPosts(posts) {
    const frontendPosts = posts.filter(post => {
      const searchText = `${post.title} ${post.tags.join(' ')}`.toLowerCase();
      
      // 키워드 매칭
      return this.frontendKeywords.some(keyword => 
        searchText.includes(keyword.toLowerCase())
      );
    });

    logger.info(`프론트엔드 관련 포스트: ${frontendPosts.length}개`);
    return frontendPosts;
  }

  /**
   * 오늘 날짜의 포스트만 필터링
   */
  filterTodayPosts(posts) {
    const todayKeywords = ['분전', '시간전', '방금'];
    
    const todayPosts = posts.filter(post => {
      return todayKeywords.some(keyword => post.time.includes(keyword));
    });

    logger.info(`오늘 포스트: ${todayPosts.length}개`);
    return todayPosts;
  }

  /**
   * 포스트 상세 정보 가져오기 (필요한 경우)
   */
  async fetchPostDetails(topicUrl) {
    try {
      const response = await axios.get(topicUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // 상세 설명
      const description = $('.topic_content').text().trim();
      
      // 원문 링크
      const originalUrl = $('.topic_link a').attr('href');

      return {
        description,
        originalUrl
      };

    } catch (error) {
      logError(error, { context: '포스트 상세 정보 가져오기 실패', topicUrl });
      return null;
    }
  }

  /**
   * 최신 프론트엔드 관련 포스트 가져오기
   */
  async getLatestFrontendPosts(options = {}) {
    const { 
      todayOnly = false, 
      limit = 10,
      includeDetails = false 
    } = options;

    try {
      // 1. 최신 포스트 가져오기
      const allPosts = await this.fetchLatestPosts();

      // 2. 프론트엔드 관련 필터링
      let frontendPosts = this.filterFrontendPosts(allPosts);

      // 3. 오늘 포스트만 필터링 (옵션)
      if (todayOnly) {
        frontendPosts = this.filterTodayPosts(frontendPosts);
      }

      // 4. 개수 제한
      frontendPosts = frontendPosts.slice(0, limit);

      // 5. 상세 정보 포함 (옵션)
      if (includeDetails && frontendPosts.length > 0) {
        for (const post of frontendPosts) {
          const details = await this.fetchPostDetails(post.topicUrl);
          if (details) {
            post.description = details.description;
            post.originalUrl = details.originalUrl;
          }
        }
      }

      return frontendPosts;

    } catch (error) {
      logError(error, { context: '프론트엔드 포스트 가져오기 실패' });
      throw error;
    }
  }
}

module.exports = new GeekNewsCrawler();