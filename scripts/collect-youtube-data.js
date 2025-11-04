/**
 * YouTube 트렌딩 데이터 자동 수집 스크립트
 * GitHub Actions에서 매일 자정 실행
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// YouTube API 키 (환경변수에서 읽기)
const API_KEY = process.env.YOUTUBE_API_KEY;

if (!API_KEY) {
  console.error('❌ YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

// 카테고리 정의 (모든 주요 카테고리)
const CATEGORIES = {
  'all': { id: null, name: '전체', emoji: '🌍' },
  'film': { id: '1', name: '영화/애니', emoji: '🎥' },
  'autos': { id: '2', name: '자동차', emoji: '🚗' },
  'music': { id: '10', name: '음악', emoji: '🎵' },
  'pets': { id: '15', name: '반려동물', emoji: '🐱' },
  'sports': { id: '17', name: '스포츠', emoji: '⚽' },
  'travel': { id: '19', name: '여행', emoji: '✈️' },
  'gaming': { id: '20', name: '게임', emoji: '🎮' },
  'people': { id: '22', name: '브이로그', emoji: '📹' },
  'comedy': { id: '23', name: '코미디', emoji: '😂' },
  'entertainment': { id: '24', name: '엔터테인먼트', emoji: '🎬' },
  'news': { id: '25', name: '뉴스', emoji: '📰' },
  'howto': { id: '26', name: '하우투/스타일', emoji: '🎨' },
  'education': { id: '27', name: '교육', emoji: '📚' },
  'science': { id: '28', name: '과학/기술', emoji: '🔬' }
};

// 데이터 저장 경로
const DATA_DIR = path.join(__dirname, '..', 'data', 'youtube-trending');

/**
 * HTTPS GET 요청 (Promise)
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`JSON 파싱 실패: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * 특정 지역/카테고리의 인기 영상 수집 (페이지네이션)
 */
async function collectCategory(regionCode, categoryKey) {
  const category = CATEGORIES[categoryKey];

  console.log(`📂 [${regionCode}] ${category.emoji} ${category.name} 수집 중...`);

  const allVideos = [];
  let pageToken = null;
  const maxResults = 200;
  const perPage = 50; // YouTube API 최대값

  try {
    // 200개를 채울 때까지 페이지네이션
    while (allVideos.length < maxResults) {
      let url = `https://www.googleapis.com/youtube/v3/videos?` +
        `part=snippet,statistics` +
        `&chart=mostPopular` +
        `&regionCode=${regionCode}` +
        `&maxResults=${perPage}` +
        (category.id ? `&videoCategoryId=${category.id}` : '') +
        `&key=${API_KEY}`;

      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }

      const data = await fetchJSON(url);

      if (!data.items || data.items.length === 0) {
        break;
      }

      const videos = data.items.map(item => ({
        videoId: item.id,
        title: item.snippet.title,
        channelName: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
        viewCount: parseInt(item.statistics.viewCount || 0),
        likeCount: parseInt(item.statistics.likeCount || 0),
        commentCount: parseInt(item.statistics.commentCount || 0),
        publishedAt: item.snippet.publishedAt,
        categoryKey: categoryKey,
        categoryName: category.name
      }));

      allVideos.push(...videos);

      // 다음 페이지가 없거나 원하는 개수를 채웠으면 종료
      if (!data.nextPageToken || allVideos.length >= maxResults) {
        break;
      }

      pageToken = data.nextPageToken;

      // API 호출 제한 방지 (페이지 간 딜레이)
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const result = allVideos.slice(0, maxResults);
    console.log(`  ✅ ${result.length}개 영상 수집 완료`);
    return result;

  } catch (error) {
    console.error(`  ❌ [${regionCode}] ${category.name} 수집 실패:`, error.message);
    return allVideos; // 에러나도 지금까지 수집한 것은 반환
  }
}

/**
 * 어제 데이터 읽기 (비교용)
 */
function getYesterdayData(regionCode) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  const filePath = path.join(DATA_DIR, `${regionCode}-${dateStr}.json`);

  if (fs.existsSync(filePath)) {
    console.log(`📖 [${regionCode}] 어제 데이터 읽기: ${dateStr}`);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  console.log(`ℹ️ [${regionCode}] 어제 데이터 없음 (최초 실행)`);
  return null;
}

/**
 * 오늘 증가량 계산
 */
function calculateGrowth(todayVideos, yesterdayData) {
  if (!yesterdayData) {
    // 어제 데이터 없음 (최초 실행)
    return todayVideos.map(video => ({
      ...video,
      todayViews: null // 비교 불가
    }));
  }

  // 어제 데이터를 videoId로 맵핑
  const yesterdayMap = {};
  Object.values(yesterdayData.categories || {}).forEach(categoryVideos => {
    categoryVideos.forEach(video => {
      yesterdayMap[video.videoId] = video;
    });
  });

  // 오늘 증가량 계산
  return todayVideos.map(video => {
    const yesterdayVideo = yesterdayMap[video.videoId];

    if (yesterdayVideo) {
      const todayViews = video.viewCount - yesterdayVideo.viewCount;
      return {
        ...video,
        todayViews: todayViews > 0 ? todayViews : 0,
        yesterdayViews: yesterdayVideo.viewCount
      };
    } else {
      // 어제 없던 영상 (신규)
      return {
        ...video,
        todayViews: null // 비교 불가
      };
    }
  });
}

/**
 * 특정 지역의 데이터 수집
 */
async function collectRegion(regionCode) {
  console.log('');
  console.log(`🌏 [${regionCode}] 지역 데이터 수집 시작`);
  console.log('='.repeat(50));

  // 어제 데이터 읽기
  const yesterdayData = getYesterdayData(regionCode);
  console.log('');

  // 모든 카테고리 수집
  // 한국 시간(KST) 기준으로 날짜 계산
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000; // KST = UTC+9
  const kstDate = new Date(now.getTime() + kstOffset);
  const dateStr = kstDate.toISOString().split('T')[0];

  const result = {
    date: dateStr,
    timestamp: new Date().toISOString(),
    region: regionCode,
    categories: {}
  };

  for (const categoryKey of Object.keys(CATEGORIES)) {
    const videos = await collectCategory(regionCode, categoryKey);

    // 오늘 증가량 계산
    const videosWithGrowth = calculateGrowth(videos, yesterdayData);

    result.categories[categoryKey] = videosWithGrowth;

    // API 호출 제한 방지 (약간의 딜레이)
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('');
  console.log(`📊 [${regionCode}] 수집 결과:`);
  Object.entries(result.categories).forEach(([key, videos]) => {
    const category = CATEGORIES[key];
    console.log(`  ${category.emoji} ${category.name}: ${videos.length}개`);
  });

  // 총 영상 수 (중복 제거)
  const allVideoIds = new Set();
  Object.values(result.categories).forEach(videos => {
    videos.forEach(video => allVideoIds.add(video.videoId));
  });
  console.log(`  📈 총 고유 영상: ${allVideoIds.size}개`);

  return result;
}

/**
 * 메인 수집 함수
 */
async function main() {
  console.log('🚀 YouTube 트렌딩 데이터 수집 시작');
  console.log(`📅 날짜: ${new Date().toISOString()}`);
  console.log('');

  // 데이터 디렉토리 생성
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`📁 데이터 디렉토리 생성: ${DATA_DIR}`);
  }

  // 수집할 지역
  const REGIONS = ['KR', 'US', 'JP'];

  // 각 지역별 데이터 수집
  for (const regionCode of REGIONS) {
    const regionData = await collectRegion(regionCode);

    // 지역별 JSON 파일로 저장
    const dateStr = regionData.date;
    const regionFile = path.join(DATA_DIR, `${regionCode}-${dateStr}.json`);
    fs.writeFileSync(regionFile, JSON.stringify(regionData, null, 2));
    console.log('');
    console.log(`✅ [${regionCode}] 데이터 저장 완료: ${regionFile}`);

    // latest-{REGION}.json도 업데이트
    const latestFile = path.join(DATA_DIR, `${regionCode}-latest.json`);
    fs.writeFileSync(latestFile, JSON.stringify(regionData, null, 2));
    console.log(`✅ [${regionCode}] 최신 데이터 업데이트: ${latestFile}`);

    // 지역 간 딜레이 (API 할당량 보호)
    if (regionCode !== REGIONS[REGIONS.length - 1]) {
      console.log('');
      console.log('⏳ 다음 지역까지 대기 중... (3초)');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // 30일 이전 파일 삭제
  console.log('');
  console.log('🧹 30일 이전 데이터 정리 중...');
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const files = fs.readdirSync(DATA_DIR);
  let deletedCount = 0;

  files.forEach(file => {
    // latest 파일들은 제외
    if (file.includes('latest')) return;

    // {REGION}-YYYY-MM-DD.json 형식 파일만 처리
    const match = file.match(/^[A-Z]{2}-(\d{4}-\d{2}-\d{2})\.json$/);
    if (match) {
      const fileDate = new Date(match[1]);
      if (fileDate < thirtyDaysAgo) {
        const filePath = path.join(DATA_DIR, file);
        fs.unlinkSync(filePath);
        console.log(`  🗑️ 삭제: ${file}`);
        deletedCount++;
      }
    }
  });

  if (deletedCount > 0) {
    console.log(`✅ ${deletedCount}개 오래된 파일 삭제 완료`);
  } else {
    console.log('✅ 삭제할 오래된 파일 없음');
  }

  console.log('');
  console.log('🎉 수집 완료!');
}

// 실행
main().catch(error => {
  console.error('❌ 수집 실패:', error);
  process.exit(1);
});
