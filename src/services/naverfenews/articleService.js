const axios = require('axios');
const RSSParser = require('rss-parser');
const { logger, logError } = require('../../utils/logger');
const { getGlobalFilterDays, getKoreaDaysAgoStart } = require('../../utils/dateUtils');

/**
 * Naver FE News 아티클 서비스
 * GitHub 커밋 피드를 파싱하고 README 분석을 통해 발행 링크 생성
 */
class NaverFENewsArticleService {
  constructor() {
    this.parser = new RSSParser({
      customFields: {
        item: [
          'updated',
          'author',
          'content'
        ]
      }
    });
    this.feedUrl = 'https://github.com/naver/fe-news/commits/master.atom';
    this.readmeUrl = 'https://raw.githubusercontent.com/naver/fe-news/master/README.md';
  }

  /**
   * 최신 업데이트 가져오기
   */
  async getLatestUpdates(options = {}) {
    const { todayOnly = true, limit = 5 } = options;

    try {
      // GitHub 커밋 피드 파싱
      const feed = await this.parser.parseURL(this.feedUrl);
      
      if (!feed.items || feed.items.length === 0) {
        logger.info('FE News 피드에 항목이 없습니다');
        return [];
      }

      // 업데이트 필터링 및 변환
      const updates = [];
      const seenUrls = new Set(); // 중복 URL 방지
      
      for (const item of feed.items.slice(0, limit * 2)) { // 여유있게 가져오기
        const update = await this.parseCommitToUpdate(item);
        if (!update) continue;

        // 날짜 필터링 (글로벌 filter-days 설정 사용)
        const filterDays = getGlobalFilterDays();
        // filter-days=1이면 오늘만, 2이면 어제부터 (days-1일 전부터)
        const daysAgo = filterDays > 0 ? filterDays - 1 : 0;
        const cutoffDate = getKoreaDaysAgoStart(daysAgo);
        
        if (todayOnly && !this.isToday(update.date)) {
          continue;
        } else if (!todayOnly && update.date < cutoffDate) {
          // filter-days 범위 외의 업데이트는 제외
          continue;
        }

        // 동일한 URL(월간 발행)의 중복 제거
        if (seenUrls.has(update.url)) {
          logger.debug(`FE News: 중복 URL 제거 - ${update.url}`);
          continue;
        }
        seenUrls.add(update.url);

        // 테스트 모드에서는 이번달 업데이트도 포함
        if (process.argv.includes('--test') || process.argv.includes('--dry-run')) {
          if (this.isThisMonth(update.date)) {
            updates.push(update);
          }
        } else {
          updates.push(update);
        }

        if (updates.length >= limit) break;
      }

      logger.info(`FE News: ${updates.length}개 업데이트 발견`);
      return updates;

    } catch (error) {
      logError(error, { context: 'FE News 피드 파싱 오류' });
      return [];
    }
  }

  /**
   * 커밋 정보를 업데이트 객체로 변환
   */
  async parseCommitToUpdate(item) {
    try {
      // 커밋 메시지 파싱
      const title = item.title || '';
      const content = item.content || item.contentSnippet || '';
      const updated = item.updated || item.pubDate;

      // 발행 관련 커밋인지 확인
      if (!this.isPublishCommit(title, content)) {
        return null;
      }

      const date = new Date(updated);
      const month = this.formatMonth(date);

      // README에서 해당 월 링크 찾기
      const issueUrl = await this.getMonthlyIssueUrl(month);
      
      if (!issueUrl) {
        logger.debug(`FE News: ${month} 이슈 URL을 찾을 수 없습니다`);
        return null;
      }

      return {
        title: `FE News ${month}`,
        url: issueUrl,
        date: date,
        month: month,
        description: `프론트엔드 뉴스 ${month}`,
        author: item.author || 'FE News'
      };

    } catch (error) {
      logError(error, { context: 'FE News 커밋 파싱 오류' });
      return null;
    }
  }

  /**
   * 발행 관련 커밋인지 확인
   */
  isPublishCommit(title, content) {
    const keywords = [
      '발행', 'publish', 'release',
      'issue', '이슈',
      '.md', 'README',
      '소식', 'news',
      '2025-', '2024-' // 년도-월 패턴
    ];

    const text = `${title} ${content}`.toLowerCase();
    return keywords.some(keyword => text.includes(keyword.toLowerCase()));
  }

  /**
   * README에서 해당 월의 이슈 URL 가져오기
   */
  async getMonthlyIssueUrl(month) {
    try {
      // README.md 가져오기
      const response = await axios.get(this.readmeUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 FE News RSS Reader'
        }
      });

      const readme = response.data;

      // 발행소식 섹션 찾기
      const publishSection = this.extractPublishSection(readme);
      if (!publishSection) {
        logger.debug('FE News: README에서 발행소식 섹션을 찾을 수 없습니다');
        return null;
      }

      // 해당 월 링크 찾기
      // 패턴: [2025-01](/issues/2025-01.md) 또는 [2025-01](./issues/2025-01.md)
      const monthPattern = new RegExp(`\\[${month}\\]\\((.*?)\\)`, 'i');
      const match = publishSection.match(monthPattern);

      if (match && match[1]) {
        let issuePath = match[1];
        
        // 상대 경로 처리
        if (issuePath.startsWith('/')) {
          return `https://github.com/naver/fe-news/blob/master${issuePath}`;
        } else if (issuePath.startsWith('./')) {
          return `https://github.com/naver/fe-news/blob/master/${issuePath.substring(2)}`;
        } else if (issuePath.startsWith('issues/')) {
          return `https://github.com/naver/fe-news/blob/master/${issuePath}`;
        }
        
        // 이미 절대 URL인 경우
        if (issuePath.startsWith('http')) {
          return issuePath;
        }

        // 기본 경로 처리
        return `https://github.com/naver/fe-news/blob/master/issues/${month}.md`;
      }

      // 링크를 못 찾은 경우 기본 URL 반환
      logger.debug(`FE News: ${month} 링크를 README에서 찾을 수 없어 기본 URL 사용`);
      return `https://github.com/naver/fe-news/blob/master/issues/${month}.md`;

    } catch (error) {
      logError(error, { context: 'FE News README 파싱 오류' });
      // 에러 시 기본 URL 반환
      return `https://github.com/naver/fe-news/blob/master/issues/${month}.md`;
    }
  }

  /**
   * README에서 발행소식 섹션 추출
   */
  extractPublishSection(readme) {
    // 발행소식 섹션 찾기
    const patterns = [
      /## 발행소식[\s\S]*?(?=##|$)/i,
      /### 발행소식[\s\S]*?(?=###|##|$)/i,
      /# 발행소식[\s\S]*?(?=#|$)/i,
      /발행소식은[\s\S]*?(?=##|$)/i
    ];

    for (const pattern of patterns) {
      const match = readme.match(pattern);
      if (match) {
        return match[0];
      }
    }

    // 발행소식 섹션을 못 찾으면 전체 README에서 찾기
    return readme;
  }

  /**
   * 날짜를 년도-월 형식으로 변환
   */
  formatMonth(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * 오늘 날짜인지 확인
   */
  isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  /**
   * 이번달인지 확인 (테스트용)
   */
  isThisMonth(date) {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth();
  }

  /**
   * 테스트용: 특정 월 업데이트 가져오기
   */
  async getTestUpdate() {
    const today = new Date();
    const month = this.formatMonth(today);
    const issueUrl = await this.getMonthlyIssueUrl(month);

    return {
      title: `FE News ${month} (테스트)`,
      url: issueUrl || `https://github.com/naver/fe-news/blob/master/issues/${month}.md`,
      date: today,
      month: month,
      description: `프론트엔드 뉴스 ${month} 테스트 메시지입니다.`,
      author: 'FE News Test'
    };
  }
}

module.exports = NaverFENewsArticleService;