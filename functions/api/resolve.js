const BILI_API = "https://api.bilibili.com";

function extractBvid(input) {
  const value = String(input || "").trim();
  const match = value.match(/BV[0-9A-Za-z]{10}/i);
  if (match) return match[0];
  throw new Error("请输入有效的 B 站视频链接或 BV 号。");
}

function cleanFilename(value) {
  return String(value || "bilibili-audio")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 100) || "bilibili-audio";
}

async function biliJson(url, stage, referer) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": referer,
    "Origin": "https://www.bilibili.com",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
  };

  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok) {
    const error = new Error(`${stage}请求被 B 站拒绝（HTTP ${res.status}）。`);
    error.status = res.status;
    error.stage = stage;
    throw error;
  }

  let json;
  try {
    json = await res.json();
  } catch {
    const error = new Error(`${stage}返回的内容不是有效 JSON。`);
    error.status = 502;
    error.stage = stage;
    throw error;
  }

  if (json.code !== 0) {
    const error = new Error(`${stage}返回错误：${json.message || json.msg || `代码 ${json.code}`}。`);
    error.status = 502;
    error.stage = stage;
    throw error;
  }
  return json.data;
}

export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const bvid = extractBvid(body.url);
    const videoReferer = `https://www.bilibili.com/video/${bvid}/`;

    const view = await biliJson(
      `${BILI_API}/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
      "视频信息接口",
      videoReferer
    );

    const playUrl = new URL(`${BILI_API}/x/player/playurl`);
    playUrl.search = new URLSearchParams({
      bvid,
      cid: String(view.cid),
      qn: "0",
      fnver: "0",
      fnval: "16",
      fourk: "1",
      platform: "html5"
    }).toString();

    const play = await biliJson(playUrl.toString(), "音频播放地址接口", videoReferer);
    const audio = play?.dash?.audio?.[0];
    const audioUrl = audio?.baseUrl || audio?.base_url;

    if (!audioUrl) {
      return Response.json({
        error: "视频信息读取成功，但 B 站没有返回可用的 DASH 音频流。视频可能受登录、付费、地区或播放权限限制，本站不会尝试绕过限制。"
      }, { status: 422 });
    }

    const parsed = new URL(audioUrl);
    if (parsed.protocol !== "https:" || !/(^|\.)bilivideo\.(com|cn)$/i.test(parsed.hostname)) {
      return Response.json({ error: "B站返回了不受支持的音频地址。" }, { status: 502 });
    }

    const title = cleanFilename(view.title);
    const token = btoa(unescape(encodeURIComponent(audioUrl)));
    const downloadUrl = `/api/download?src=${encodeURIComponent(token)}&name=${encodeURIComponent(title + ".m4s")}`;

    return Response.json({
      title: view.title,
      audioId: audio.id,
      filename: title + ".m4s",
      downloadUrl
    });
  } catch (error) {
    return Response.json({
      error: error.message || "处理请求时发生错误。",
      stage: error.stage || "请求处理",
      status: error.status || 400
    }, { status: error.status || 400 });
  }
}
