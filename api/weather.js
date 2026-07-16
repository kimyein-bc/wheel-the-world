// api/weather.js

function convertToKmaGrid(lat, lon) {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;

  const DEGRAD = Math.PI / 180.0;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn =
    Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
    Math.tan(Math.PI * 0.25 + slat1 * 0.5);

  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);

  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;

  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);

  let theta = lon * DEGRAD - olon;

  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;

  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);

  return { nx, ny };
}

function getKmaBaseDateTime() {
  const now = new Date();

  // 서버 시간은 UTC일 수 있으므로 한국시간으로 보정
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  // 초단기실황은 바로 안 뜰 수 있어서 45분 전이면 이전 시간 사용
  if (kst.getUTCMinutes() < 45) {
    kst.setUTCHours(kst.getUTCHours() - 1);
  }

  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const date = String(kst.getUTCDate()).padStart(2, "0");
  const hour = String(kst.getUTCHours()).padStart(2, "0");

  return {
    baseDate: `${year}${month}${date}`,
    baseTime: `${hour}00`,
  };
}

function toNumber(value) {
  const n = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function getRainTypeLabel(pty) {
  switch (Number(pty)) {
    case 0:
      return "강수 없음";
    case 1:
      return "비";
    case 2:
      return "비/눈";
    case 3:
      return "눈";
    case 5:
      return "빗방울";
    case 6:
      return "빗방울/눈날림";
    case 7:
      return "눈날림";
    default:
      return "알 수 없음";
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const rawServiceKey = process.env.KMA_SERVICE_KEY;

    if (!rawServiceKey) {
      return res.status(500).json({
        ok: false,
        message: "KMA_SERVICE_KEY 환경변수가 설정되지 않았습니다.",
      });
    }

    const serviceKey = rawServiceKey.trim();

    // 기본 좌표: 화정동 근처
    const lat = Number(req.query.lat || 37.6342);
    const lng = Number(req.query.lng || 126.8325);

    const { nx, ny } = convertToKmaGrid(lat, lng);
    const { baseDate, baseTime } = getKmaBaseDateTime();

    const params = new URLSearchParams({
      pageNo: "1",
      numOfRows: "1000",
      dataType: "JSON",
      base_date: baseDate,
      base_time: baseTime,
      nx: String(nx),
      ny: String(ny),
    });

    // 인증키가 이미 인코딩된 키면 그대로 쓰고,
    // 디코딩 키면 encodeURIComponent로 안전하게 인코딩
    const safeServiceKey = serviceKey.includes("%")
      ? serviceKey
      : encodeURIComponent(serviceKey);

    const requestUrl =
      `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst` +
      `?serviceKey=${safeServiceKey}&${params.toString()}`;

    const response = await fetch(requestUrl);
    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: "기상청 응답을 JSON으로 읽지 못했습니다. 인증키를 확인하세요.",
        raw: text.slice(0, 300),
      });
    }

    const header = data?.response?.header;
    const resultCode = header?.resultCode;
    const resultMsg = header?.resultMsg;

    if (resultCode !== "00") {
      return res.status(500).json({
        ok: false,
        message: "기상청 API 요청이 실패했습니다.",
        resultCode,
        resultMsg,
      });
    }

    const items = data?.response?.body?.items?.item || [];

    const values = {};

    items.forEach((item) => {
      values[item.category] = item.obsrValue;
    });

    const pty = toNumber(values.PTY);
    const rn1 = toNumber(values.RN1);

    const isRainy = pty !== 0 || rn1 > 0;

    return res.status(200).json({
      ok: true,
      isRainy,
      rainType: pty,
      rainTypeLabel: getRainTypeLabel(pty),
      rainAmount1h: rn1,
      nx,
      ny,
      baseDate,
      baseTime,
      source: "KMA getUltraSrtNcst",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "날씨 정보를 가져오는 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
}