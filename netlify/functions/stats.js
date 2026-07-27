exports.handler = async () => {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const today = new Date().toISOString().split('T')[0];

  // Ambil semua daftar link
  const resLinks = await fetch(`${redisUrl}/smembers/all_links`, {
    headers: { Authorization: `Bearer ${redisToken}` }
  });
  const linksData = await resLinks.json();
  const links = linksData.result || [];

  let report = [];

  for (const code of links) {
    // Ambil detail link & total klik
    const resDetail = await fetch(`${redisUrl}/mget/link:${code}/clicks:total:${code}/clicks:daily:${code}:${today}`, {
      headers: { Authorization: `Bearer ${redisToken}` }
    });
    const details = await resDetail.json();
    
    if (details.result[0]) {
      const meta = JSON.parse(details.result[0]);
      report.push({
        code,
        url: meta.url,
        tag: meta.tag,
        pixelId: meta.pixelId,
        totalClicks: parseInt(details.result[1] || 0),
        todayClicks: parseInt(details.result[2] || 0)
      });
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report)
  };
};