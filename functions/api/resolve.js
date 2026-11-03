const BILI_API = "https://api.bilibili.com";

function extractBvid(input) {
  const value = String(input || "").trim();
  const match = value.match(/BV[0-9A-Za-z]{10}/i);
  if (match) return match[0];
  throw new Error("请输入有效的 B 站视频链接或 BV 号。");
}
function cleanFilename(value) {
  return String(value || "bilibili-audio").replace(/[\\/:*?"<>|]/g, "_").replace(/[. ]+$/g, "").slice(0, 100) || "bilibili-audio";
}
async function biliJson(url) {
  const res = await fetch(url, {headers: {"User-Agent":"Mozilla/5.0","Referer":"https://www.bilibili.com/"}});
  if (!res.ok) throw new Error(`B站接口暂时不可用（HTTP ${res.status}）。`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || json.msg || "B站未返回可用数据。");
  return json.data;
}
export async function onRequestPost({request}) {
  try {
    const body = await request.json();
    const bvid = extractBvid(body.url);
    const view = await biliJson(`${BILI_API}/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`);
    const play = await biliJson(`${BILI_API}/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(view.cid)}&qn=0&fnver=0&fnval=16&fourk=1`);
    const audio = play?.dash?.audio?.[0];
    const audioUrl = audio?.baseUrl || audio?.base_url;
    if (!audioUrl) {
      return Response.json({error:"该视频没有返回可用的 DASH 音频流。视频可能受登录、付费、地区或播放权限限制，本站不会尝试绕过限制。"}, {status:422});
    }
    const parsed = new URL(audioUrl);
    if (!["https:"].includes(parsed.protocol) || !/(^|\.)bilivideo\.(com|cn)$/i.test(parsed.hostname)) {
      return Response.json({error:"B站返回了不受支持的音频地址。"}, {status:502});
    }
    const title = cleanFilename(view.title);
    const token = btoa(unescape(encodeURIComponent(audioUrl)));
    const downloadUrl = `/api/download?src=${encodeURIComponent(token)}&name=${encodeURIComponent(title + ".m4s")}`;
    return Response.json({title:view.title, audioId:audio.id, filename:title+".m4s", downloadUrl});
  } catch (error) {
    return Response.json({error:error.message || "处理请求时发生错误。"}, {status:400});
  }
}