exports.handler = async (event) => {
  // Ambil kode slug dari path URL (misal: /kemejabatik1 -> kemejabatik1)
  const pathParts = event.path.split('/').filter(Boolean);
  const code = event.queryStringParameters?.code || pathParts[0];

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!code || !redisUrl || !redisToken) {
    return { statusCode: 404, body: "Link tidak ditemukan." };
  }

  // 1. Ambil data link dari Upstash Redis
  const res = await fetch(`${redisUrl}/get/link:${code}`, {
    headers: { Authorization: `Bearer ${redisToken}` }
  });
  const data = await res.json();

  if (!data.result) {
    return { statusCode: 404, body: "Link tidak ditemukan atau sudah dihapus." };
  }

  const linkData = JSON.parse(data.result);
  const today = new Date().toISOString().split('T')[0];

  // 2. Hitung Statistik Harian
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

  // 3. Render HTML Interstitial untuk Pixel lalu Redirect
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Mengarahkan ke Shopee...</title>
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
        setTimeout(function() {
          window.location.href = "${linkData.url}";
        }, 500);
      </script>
    </body>
    </html>
  `;

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: html
  };
};
