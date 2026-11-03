function decodeBase64Utf8(value) {
  return decodeURIComponent(escape(atob(value)));
}
function allowedHost(host) {
  return /(^|\.)bilivideo\.(com|cn)$/i.test(host);
}
export async function onRequestGet({request}) {
  const incoming = new URL(request.url);
  try {
    const encoded = incoming.searchParams.get("src");
    if (!encoded || encoded.length > 12000) return new Response("缺少或无效的下载地址。", {status:400});
    const target = new URL(decodeBase64Utf8(encoded));
    if (target.protocol !== "https:" || !allowedHost(target.hostname)) return new Response("不允许访问该文件地址。", {status:403});
    const headers = new Headers({
      "Referer":"https://www.bilibili.com/",
      "User-Agent":"Mozilla/5.0"
    });
    const range = request.headers.get("Range");
    if (range) headers.set("Range", range);
    const upstream = await fetch(target.toString(), {headers, redirect:"follow"});
    if (!upstream.ok && upstream.status !== 206) {
      return new Response("上游音频文件暂时无法访问，请重新获取音轨。", {status:upstream.status});
    }
    const name = (incoming.searchParams.get("name") || "audio.m4s").replace(/[\r\n"\\]/g,"_").slice(0,120);
    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type","application/octet-stream");
    responseHeaders.set("Content-Disposition",`attachment; filename="${name.replace(/[^\x20-\x7E]/g,"_")}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    responseHeaders.set("Cache-Control","no-store");
    for (const key of ["Content-Length","Content-Range","Accept-Ranges"]) {
      const value = upstream.headers.get(key);
      if (value) responseHeaders.set(key,value);
    }
    return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
  } catch {
    return new Response("下载链接无效或已过期，请重新获取音轨。",{status:400});
  }
}