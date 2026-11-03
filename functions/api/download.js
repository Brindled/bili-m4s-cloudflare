function decodeBase64Utf8(value) {
  return decodeURIComponent(escape(atob(value)));
}

function allowedUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)bilivideo\.(com|cn)$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export async function onRequestGet({ request }) {
  const incoming = new URL(request.url);

  try {
    const encoded = incoming.searchParams.get("src");
    if (!encoded || encoded.length > 12000) {
      return new Response("缺少或无效的下载地址。", { status: 400 });
    }

    let target = decodeBase64Utf8(encoded);
    if (!allowedUrl(target)) {
      return new Response("不允许访问该文件地址。", { status: 403 });
    }

    const headers = new Headers({
      "Referer": "https://www.bilibili.com/",
      "Origin": "https://www.bilibili.com",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    });
    const range = request.headers.get("Range");
    if (range) headers.set("Range", range);

    let upstream;
    // 手动跟随重定向，并对每一跳重新校验域名。
    for (let i = 0; i < 6; i++) {
      if (!allowedUrl(target)) {
        return new Response("上游重定向到了不受支持的文件地址。", { status: 403 });
      }

      upstream = await fetch(target, { headers, redirect: "manual" });
      if ([301, 302, 303, 307, 308].includes(upstream.status)) {
        const location = upstream.headers.get("Location");
        if (!location) {
          return new Response("上游返回了无效的重定向。", { status: 502 });
        }
        target = new URL(location, target).toString();
        continue;
      }
      break;
    }

    if (!upstream || [301, 302, 303, 307, 308].includes(upstream.status)) {
      return new Response("上游重定向次数过多。", { status: 502 });
    }
    if (!upstream.ok && upstream.status !== 206) {
      return new Response(`上游音频文件暂时无法访问（HTTP ${upstream.status}），请重新获取音轨。`, {
        status: upstream.status
      });
    }

    const name = (incoming.searchParams.get("name") || "audio.m4s")
      .replace(/[\r\n"\\]/g, "_")
      .slice(0, 120);

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", "application/octet-stream");
    responseHeaders.set(
      "Content-Disposition",
      `attachment; filename="${name.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`
    );
    responseHeaders.set("Cache-Control", "no-store");

    for (const key of ["Content-Length", "Content-Range", "Accept-Ranges"]) {
      const value = upstream.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }

    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return new Response("下载链接无效或已过期，请重新获取音轨。", { status: 400 });
  }
}
