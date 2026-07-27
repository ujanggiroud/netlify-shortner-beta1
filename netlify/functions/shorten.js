exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const { code, url, tag, pixelId } = JSON.parse(event.body);
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!code || !url) {
    return { statusCode: 400, body: JSON.stringify({ error: "Code dan URL Wajib Diisi!" }) };
  }

  const payload = JSON.stringify({ url, tag: tag || 'Umum', pixelId: pixelId || '', createdAt: new Date().toISOString() });

  // Simpan ke Redis
  await fetch(`${redisUrl}/set/link:${code}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken}` },
    body: payload
  });

  // Simpan kode ke daftar list link
  await fetch(`${redisUrl}/sadd/all_links`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken}` },
    body: code
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Berhasil disimpan!", code })
  };
};