exports.handler = async (event) => {
  const userAgent = event.headers['user-agent'] || event.headers['User-Agent'] || '';
  
  // Ekstrak kode slug dari path (dukung format /slug atau /masking/slug)
  const pathParts = event.path.split('/').filter(Boolean);
  let code = event.queryStringParameters?.code;
  if (!code) {
    code = pathParts[pathParts.length - 1]; // ambil bagian slug terakhir
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!code || !redisUrl || !redisToken) {
    return { statusCode: 404, body: "Link tidak ditemukan." };
  }

  const res = await fetch(`${redisUrl}/get/link:${code}`, {
    headers: { Authorization: `Bearer ${redisToken}` }
  });
  const data = await res.json();

  if (!data.result) {
    return { statusCode: 404, body: "Link tidak ditemukan atau sudah dihapus." };
  }

  const linkData = JSON.parse(data.result);
  const today = new Date().toISOString().split('T')[0];

  // Catat statistik di background
  fetch(`${redisUrl}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ["INCR", `clicks:total:${code}`],
      ["INCR", `clicks:daily:${code}:${today}`],
      ["SADD", `all_tags`, linkData.tag || 'Uncategorized'],
      ["INCR", `clicks:tag:${linkData.tag || 'Uncategorized'}:${today}`]
    ])
  }).catch(() => {});

  const isFbCrawler = userAgent.toLowerCase().includes('facebookexternalhit') || userAgent.toLowerCase().includes('facebot');
  const titleText = linkData.title || 'Promo Shopee Spesial';
  const imageUrl = linkData.image || '';

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${titleText}</title>
  
  <!-- Facebook Open Graph Meta Tags -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${titleText}" />
  <meta property="og:description" content="Klik untuk melihat detail promo selengkapnya." />
  ${imageUrl ? `
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:secure_url" content="${imageUrl}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  ` : ''}

  ${linkData.pixelId ? `
  <!-- Meta Pixel Code -->
  <script>
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${linkData.pixelId}');
    fbq('track', 'PageView');
    fbq('track', 'Lead');
  </script>
  ` : ''}
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f8f9fa; }
    .box { text-align: center; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #ee4d2d; border-radius: 50%; width: 30px; height: 30px; animation: spin 0.8s linear infinite; margin: 0 auto 15px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <p>Mengarahkan ke Shopee...</p>
  </div>
  <script>
    ${!isFbCrawler ? `
    setTimeout(function() {
      window.location.href = "${linkData.url}";
    }, 400);
    ` : ''}
  </script>
</body>
</html>`;

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: html
  };
};
