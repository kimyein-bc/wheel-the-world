import { useState, useEffect, useRef } from "react";
import { divIcon } from "leaflet";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  Polyline,
  useMap,
} from "react-leaflet";
import {
  ref,
  set,
  push,
  onValue,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  update,
  remove,
  get,
} from "firebase/database";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import DaumPostcode from 'react-daum-postcode';
const KAKAO_JS_KEY = "5454d531ca3f6412ccc87ecd7f44eeee";

async function getCoords(place) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${place}`
  );



  const data = await res.json();

  if (!data.length) return null;

  return {
    lat: Number(data[0].lat),
    lng: Number(data[0].lon),
  };
}
  
// 기본 마커 아이콘 문제 해결
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function getLabel(type) {
  if (type === "step" || type === "stairs") return "🪜 단차 / 계단";
  if (type === "narrow") return "↔️ 좁은 도로";
  if (type === "obstacle") return "🚧 실시간 장애물";
  if (type === "elevator") return "🛗 엘리베이터";
  if (type === "slope") return "📐 경사도";
  if (type === "sidewalk") return "🧱 보도블럭 파손";
  return type;
}

function getIcon(type) {
  const config = {
    step: { emoji: "🪜", color: "#EF4444" },
    stairs: { emoji: "🪜", color: "#EF4444" },
    narrow: { emoji: "↔️", color: "#F59E0B" },
    obstacle: { emoji: "🚧", color: "#DC2626" },
    elevator: { emoji: "🛗", color: "#3B82F6" },
    slope: { emoji: "📐", color: "#10B981" },
    sidewalk: { emoji: "🧱", color: "#8B5CF6" },
  };
  const current = config[type] || { emoji: "📍", color: "#54a0ff" };
  return divIcon({
    html: `
      <div style="
        background-color: ${current.color}; width: 36px; height: 36px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center; font-size: 18px;
        border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.15); cursor: pointer;
      ">
        ${current.emoji}
      </div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
}


function MoveMapToRoute({ route }) {
  const map = useMap();

  useEffect(() => {
    if (route.length > 0) {
      map.flyToBounds(route, {
        padding: [50, 50],
        duration: 1.5,
      });
    }
  }, [route, map]);

  return null;
}
const loadKakaoMapScript = () => {
  return new Promise((resolve, reject) => {
    if (!KAKAO_JS_KEY || KAKAO_JS_KEY === "여기에_진짜_JavaScript_키") {
      reject(new Error("KAKAO_JS_KEY가 비어 있거나 예시 문구 그대로입니다."));
      return;
    }

    if (KAKAO_JS_KEY.includes("KakaoAK")) {
      reject(new Error("REST API 키를 넣은 것 같습니다. JavaScript 키를 넣어야 합니다."));
      return;
    }

    if (KAKAO_JS_KEY === "Default JS Key") {
      reject(new Error("'Default JS Key'는 키 이름입니다. 실제 JavaScript 키 값을 넣어야 합니다."));
      return;
    }

    if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(() => {
        resolve(window.kakao);
      });
      return;
    }

    const existingScript = document.getElementById("kakao-map-script");

    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement("script");
    script.id = "kakao-map-script";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&libraries=services&autoload=false`;
    script.async = true;


    script.onload = () => {

      if (!window.kakao || !window.kakao.maps) {
        reject(
          new Error(
            "스크립트는 불러왔지만 window.kakao.maps가 없습니다. JavaScript 키, 카카오맵 API 활성화, 도메인 등록을 확인하세요."
          )
        );
        return;
      }

      window.kakao.maps.load(() => {
        resolve(window.kakao);
      });
    };

    script.onerror = () => {
      reject(
        new Error(
          "카카오 지도 스크립트 자체를 불러오지 못했습니다. JavaScript 키 또는 도메인 등록 문제일 가능성이 큽니다."
        )
      );
    };

    document.head.appendChild(script);
  });
};
const getWheelWorldClientId = () => {
  const storageKey = "wheelWorldClientId";

  let clientId = localStorage.getItem(storageKey);

  if (!clientId) {
    clientId = `client_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;

    localStorage.setItem(storageKey, clientId);
  }

  return clientId;
};
const loadMarkerImageSafely = async (marker) => {
  if (!marker?.id) return "";

  try {
    const newImageSnapshot = await get(
      ref(db, `bfMarkerImages/${marker.id}/image`)
    );

    const newImage = newImageSnapshot.val();

    if (newImage) {
      return newImage;
    }
  } catch (error) {
    console.error("새 사진 위치 불러오기 실패:", error);
  }

  try {
    const oldImageSnapshot = await get(
      ref(db, `bfMarkers/${marker.id}/image`)
    );

    return oldImageSnapshot.val() || "";
  } catch (error) {
    console.error("기존 사진 위치 불러오기 실패:", error);
    return "";
  }
};
const MARKER_CACHE_KEY = "wheelWorldBfMarkersLightCacheV3";

const makeLightMarker = (id, value = {}) => ({
  id,
  lat: Number(value.lat),
  lng: Number(value.lng),
  type: value.type || "step",
  desc: value.desc || "",
  status: value.status || "pending",
  isOfficial: value.isOfficial === true,
  wheelLevel: Number(value.wheelLevel || 0),
  ownerId: value.ownerId || "",
  date: value.date || "",
  createdAt: value.createdAt || 0,
  updatedAt: value.updatedAt || "",

  // 중요:
  // 새 방식은 hasImage를 보고,
  // 기존 방식은 value.image가 있으면 사진 있음으로 처리함.
  hasImage: value.hasImage === true || !!value.image,
});

const saveMarkerImageIfNeeded = async (markerId, imageDataUrl) => {
  if (!markerId) return;

  if (imageDataUrl) {
    await set(ref(db, `bfMarkerImages/${markerId}`), {
      image: imageDataUrl,
      updatedAt: Date.now(),
    });
  } else {
    await remove(ref(db, `bfMarkerImages/${markerId}`));
  }
};



const compressImageToDataUrl = (file, maxWidth = 900, quality = 0.68) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");

        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };

      img.onerror = reject;
      img.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
const KakaoMapTest = ({
  bfMarkers = [],
  routeSteps = [],
  isRainyMode = DEFAULT_RAINY_MODE,
weatherInfo = null,
  startMarkerPos = null,
  endMarkerPos = null,
  userLocation = null,
  deviceHeading = null,
  mapRef = null,

  isAdminLoggedIn = false,
  tempMarker = null,
  setTempMarker = () => {},
  newMarkerType = "step",
  setNewMarkerType = () => {},
  newMarkerDesc = "",
  setNewMarkerDesc = () => {},
  newMarkerImage = null,
  setNewMarkerImage = () => {},
  bfConfig = {},
  wheelLevel = 1,
  setWheelLevel = () => {},
}) => {
  const mapDivRef = useRef(null);
  const kakaoMapRef = useRef(null);
  const overlayRefs = useRef([]);
  const polylineRef = useRef(null);
  const routeOverlayRefs = useRef([]);
  const userLocationOverlayRef = useRef(null);
  const officialTempOverlayRef = useRef(null);
  const wheelOverlayRef = useRef(null);
const wheelAnimationRef = useRef(null);
 const [selectedMarker, setSelectedMarker] = useState(null);
 const [editingOfficialMarkerId, setEditingOfficialMarkerId] = useState(null);
const [isKakaoMapReady, setIsKakaoMapReady] = useState(false);
const isAdminLoggedInRef = useRef(isAdminLoggedIn);
const latestBfMarkersRef = useRef(bfMarkers);

isAdminLoggedInRef.current = isAdminLoggedIn;
latestBfMarkersRef.current = bfMarkers;
  const moveKakaoMapTo = (position, zoom = 17) => {
  if (!window.kakao || !window.kakao.maps || !kakaoMapRef.current) return;

  const lat = Array.isArray(position) ? Number(position[0]) : Number(position.lat);
  const lng = Array.isArray(position) ? Number(position[1]) : Number(position.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return;

  const level =
    zoom >= 18 ? 2 :
    zoom >= 17 ? 3 :
    zoom >= 16 ? 4 :
    zoom >= 15 ? 5 :
    6;

  const kakaoPosition = new window.kakao.maps.LatLng(lat, lng);
  kakaoMapRef.current.setCenter(kakaoPosition);
  kakaoMapRef.current.setLevel(level);
};

const fitKakaoMapBounds = (positions = []) => {
  if (!window.kakao || !window.kakao.maps || !kakaoMapRef.current) return;
  if (!positions || positions.length < 2) return;

  const bounds = new window.kakao.maps.LatLngBounds();

  positions.forEach((position) => {
    const lat = Array.isArray(position) ? Number(position[0]) : Number(position.lat);
    const lng = Array.isArray(position) ? Number(position[1]) : Number(position.lng);

    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      bounds.extend(new window.kakao.maps.LatLng(lat, lng));
    }
  });

  kakaoMapRef.current.setBounds(bounds);
};

 const getKakaoMarkerInfo = (type) => {
  const fallbackConfig =
    bfConfig.step || bfConfig.sidewalk || Object.values(bfConfig)[0];

  const config = bfConfig[type] || fallbackConfig;

  const icon = config.icon || "📍";
  const rawLabel = config.label || "기타";

  return {
    label: rawLabel.replace(icon, "").trim(),
    icon,
    color: config.color || "#64748B",
  };
};

  const clearKakaoOverlays = () => {
    overlayRefs.current.forEach((overlay) => {
      overlay.setMap(null);
    });
    overlayRefs.current = [];
  };
  const clearOfficialTempOverlay = () => {
  if (officialTempOverlayRef.current) {
    officialTempOverlayRef.current.setMap(null);
    officialTempOverlayRef.current = null;
  }
};

const drawOfficialTempMarker = (kakao, map) => {
  clearOfficialTempOverlay();

  if (!tempMarker) return;

  const lat = Number(tempMarker.lat);
  const lng = Number(tempMarker.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return;

  const wrapper = document.createElement("div");

  wrapper.style.width = "46px";
  wrapper.style.height = "46px";
  wrapper.style.borderRadius = "50%";
  wrapper.style.background = "white";
  wrapper.style.border = "3px solid #2563EB";
  wrapper.style.boxShadow = "0 7px 18px rgba(15,23,42,0.3)";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.justifyContent = "center";
  wrapper.style.boxSizing = "border-box";
  wrapper.style.pointerEvents = "none";
  wrapper.style.fontSize = "27px";
  wrapper.innerText = "📍";

  const overlay = new kakao.maps.CustomOverlay({
    map,
    position: new kakao.maps.LatLng(lat, lng),
    content: wrapper,
    xAnchor: 0.5,
    yAnchor: 1,
    zIndex: 20,
  });

  officialTempOverlayRef.current = overlay;
};
const clearKakaoRoute = () => {
  if (polylineRef.current) {
    polylineRef.current.setMap(null);
    polylineRef.current = null;
  }

  routeOverlayRefs.current.forEach((overlay) => {
    overlay.setMap(null);
  });

  routeOverlayRefs.current = [];
};


const addRoutePointOverlay = (kakao, map, position, label, color) => {
  if (!position || position.length < 2) return;

  const el = document.createElement("div");
  el.style.padding = "7px 10px";
  el.style.borderRadius = "999px";
  el.style.background = color;
  el.style.color = "white";
  el.style.fontSize = "12px";
  el.style.fontWeight = "900";
  el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.22)";
  el.style.border = "2px solid white";
  el.style.whiteSpace = "nowrap";
  el.innerText = label;

  const overlay = new kakao.maps.CustomOverlay({
    map,
    position: new kakao.maps.LatLng(position[0], position[1]),
    content: el,
    yAnchor: 1.35,
  });

  routeOverlayRefs.current.push(overlay);
};

const drawKakaoRouteLine = (kakao, map, route = []) => {
  clearKakaoRoute();

  if (!route || route.length < 2) {
    return;
  }

  const path = route
    .filter(
      (point) =>
        Array.isArray(point) &&
        point.length >= 2 &&
        !Number.isNaN(Number(point[0])) &&
        !Number.isNaN(Number(point[1]))
    )
    .map(([lat, lng]) => new kakao.maps.LatLng(Number(lat), Number(lng)));

  if (path.length < 2) {
    return;
  }

  const polyline = new kakao.maps.Polyline({
    path,
    strokeWeight: 8,
    strokeColor: "#2563EB",
    strokeOpacity: 0.92,
    strokeStyle: "solid",
  });

  polyline.setMap(map);
  polylineRef.current = polyline;

  const bounds = new kakao.maps.LatLngBounds();
  path.forEach((point) => bounds.extend(point));
  map.setBounds(bounds);

  addRoutePointOverlay(kakao, map, startMarkerPos, "출발", "#2563EB");
  addRoutePointOverlay(kakao, map, endMarkerPos, "도착", "#EF4444");

};
const drawUserLocationMarker = (kakao, map) => {
  if (userLocationOverlayRef.current) {
    userLocationOverlayRef.current.setMap(null);
    userLocationOverlayRef.current = null;
  }

  if (!userLocation) return;

  const lat = Array.isArray(userLocation)
    ? Number(userLocation[0])
    : Number(userLocation.lat);

  const lng = Array.isArray(userLocation)
    ? Number(userLocation[1])
    : Number(userLocation.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return;

  const heading = Number(deviceHeading);
  const hasHeading = !Number.isNaN(heading);

  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.width = "58px";
  wrapper.style.height = "58px";
  wrapper.style.pointerEvents = "none";

  if (hasHeading) {
    const arrowEl = document.createElement("div");
    arrowEl.innerHTML = `
      <svg width="58" height="58" viewBox="0 0 58 58">
        <path
          d="M29 3 L42 34 L29 27 L16 34 Z"
          fill="#2563EB"
          stroke="white"
          stroke-width="3"
          stroke-linejoin="round"
        />
      </svg>
    `;

    arrowEl.style.position = "absolute";
    arrowEl.style.left = "0";
    arrowEl.style.top = "0";
    arrowEl.style.width = "58px";
    arrowEl.style.height = "58px";
    arrowEl.style.transform = `rotate(${heading}deg)`;
    arrowEl.style.transformOrigin = "50% 50%";
    arrowEl.style.filter = "drop-shadow(0 3px 8px rgba(37,99,235,0.35))";
    arrowEl.style.zIndex = "1";

    wrapper.appendChild(arrowEl);
  }

  const pulseEl = document.createElement("div");
  pulseEl.style.position = "absolute";
  pulseEl.style.left = "50%";
  pulseEl.style.top = "50%";
  pulseEl.style.width = "44px";
  pulseEl.style.height = "44px";
  pulseEl.style.borderRadius = "50%";
  pulseEl.style.background = "rgba(37,99,235,0.18)";
  pulseEl.style.transform = "translate(-50%, -50%)";
  pulseEl.style.zIndex = "2";

  const markerEl = document.createElement("div");
  markerEl.style.position = "absolute";
  markerEl.style.left = "50%";
  markerEl.style.top = "50%";
  markerEl.style.width = "22px";
  markerEl.style.height = "22px";
  markerEl.style.borderRadius = "50%";
  markerEl.style.background = "#2563EB";
  markerEl.style.border = "4px solid white";
  markerEl.style.boxShadow = "0 0 14px rgba(37,99,235,0.65)";
  markerEl.style.boxSizing = "border-box";
  markerEl.style.transform = "translate(-50%, -50%)";
  markerEl.style.zIndex = "3";

  wrapper.appendChild(pulseEl);
  wrapper.appendChild(markerEl);

  const overlay = new kakao.maps.CustomOverlay({
    map,
    position: new kakao.maps.LatLng(lat, lng),
    content: wrapper,
    yAnchor: 0.5,
    xAnchor: 0.5,
  });

  userLocationOverlayRef.current = overlay;
};
const clearWheelRouteAnimation = () => {
  if (wheelAnimationRef.current) {
    cancelAnimationFrame(wheelAnimationRef.current);
    wheelAnimationRef.current = null;
  }

  if (wheelOverlayRef.current) {
    wheelOverlayRef.current.setMap(null);
    wheelOverlayRef.current = null;
  }
};

const startWheelRouteAnimation = (kakao, map, route = []) => {
  clearWheelRouteAnimation();

  if (!route || route.length < 2) return;

  const points = route
    .filter(
      (point) =>
        Array.isArray(point) &&
        point.length >= 2 &&
        !Number.isNaN(Number(point[0])) &&
        !Number.isNaN(Number(point[1]))
    )
    .map(([lat, lng]) => ({
      lat: Number(lat),
      lng: Number(lng),
    }));

  if (points.length < 2) return;

  const segmentLengths = [];
  let totalLength = 0;

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];

    const length = Math.sqrt(
      Math.pow(b.lat - a.lat, 2) + Math.pow(b.lng - a.lng, 2)
    );

    segmentLengths.push(length);
    totalLength += length;
  }

  if (totalLength === 0) return;

  const wheelInner = document.createElement("div");
  wheelInner.innerText = "🛞";
  wheelInner.style.fontSize = "26px";
  wheelInner.style.lineHeight = "1";
  wheelInner.style.transformOrigin = "center center";

  const wheelWrapper = document.createElement("div");
  wheelWrapper.style.width = "42px";
  wheelWrapper.style.height = "42px";
  wheelWrapper.style.borderRadius = "50%";
  wheelWrapper.style.background = "white";
  wheelWrapper.style.display = "flex";
  wheelWrapper.style.alignItems = "center";
  wheelWrapper.style.justifyContent = "center";
  wheelWrapper.style.boxShadow = "0 6px 16px rgba(15,23,42,0.28)";
  wheelWrapper.style.border = "3px solid #2563EB";
  wheelWrapper.style.boxSizing = "border-box";
  wheelWrapper.appendChild(wheelInner);

  const overlay = new kakao.maps.CustomOverlay({
    map,
    position: new kakao.maps.LatLng(points[0].lat, points[0].lng),
    content: wheelWrapper,
    xAnchor: 0.5,
    yAnchor: 0.5,
  });

  wheelOverlayRef.current = overlay;

  const duration = Math.min(9000, Math.max(4200, points.length * 70));
  const startTime = performance.now();

  const animate = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const targetDistance = totalLength * progress;

    let walked = 0;
    let currentIndex = 0;

    for (let i = 0; i < segmentLengths.length; i += 1) {
      if (walked + segmentLengths[i] >= targetDistance) {
        currentIndex = i;
        break;
      }

      walked += segmentLengths[i];
    }

    const segmentLength = segmentLengths[currentIndex] || 1;
    const segmentProgress = Math.min(
      Math.max((targetDistance - walked) / segmentLength, 0),
      1
    );

    const start = points[currentIndex];
    const end = points[currentIndex + 1] || points[currentIndex];

    const lat = start.lat + (end.lat - start.lat) * segmentProgress;
    const lng = start.lng + (end.lng - start.lng) * segmentProgress;

    overlay.setPosition(new kakao.maps.LatLng(lat, lng));

    wheelInner.style.transform = `rotate(${progress * 1440}deg)`;

    if (progress < 1) {
      wheelAnimationRef.current = requestAnimationFrame(animate);
    } else {
      wheelAnimationRef.current = null;
    }
  };

  wheelAnimationRef.current = requestAnimationFrame(animate);
};
const drawKakaoMarkers = (kakao, map) => {
  clearKakaoOverlays();

  const markerSource = latestBfMarkersRef.current || [];

const validMarkers = markerSource
  .filter(
    (m) =>
      m &&
      m.lat !== undefined &&
      m.lng !== undefined
  )
  .map((m) => ({
    ...m,
    lat: Number(m.lat),
    lng: Number(m.lng),
  }))
    .filter(
    (m) =>
      !Number.isNaN(m.lat) &&
      !Number.isNaN(m.lng) &&
      (m.type !== "puddle" || isRainyMode)
  );
  validMarkers.forEach((m) => {
  const info = getKakaoMarkerInfo(m.type);
  const isPuddleMarker = m.type === "puddle";

  const markerBgColor = isPuddleMarker ? "#0EA5E9" : "#FFFFFF";
  const markerBorderColor =
  Number(m?.wheelLevel) === 2
    ? "#DC2626"
    : Number(m?.wheelLevel) === 1
    ? "#F59E0B"
    : "#94A3B8";
  const markerShadow = isPuddleMarker
  ? "0 4px 10px rgba(14, 165, 233, 0.30)"
  : "0 2px 7px rgba(15, 23, 42, 0.14)";

 const markerEl = document.createElement("div");

markerEl.dataset.wheelMarker = "true";
markerEl.dataset.puddleMarker = isPuddleMarker ? "true" : "false";

Object.assign(markerEl.style, {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",

   width: isPuddleMarker ? "32px" : "30px",
height: isPuddleMarker ? "32px" : "30px",
borderRadius: "50%",

background: markerBgColor,
color: isPuddleMarker ? "#FFFFFF" : "#334155",
fontSize: isPuddleMarker ? "17px" : "15px",
fontWeight: "900",

border: `2px solid ${markerBorderColor}`,
boxShadow: markerShadow,
    cursor: "pointer",
    userSelect: "none",

    opacity:
      m.status === "approved" || m.isOfficial === true ? "1" : "0.55",
  });

  markerEl.innerText = isPuddleMarker ? "💧" : info.icon;

  markerEl.onclick = async () => {
    const markerApproved = m.status === "approved" || m.isOfficial === true;
    const loadedImage = await loadMarkerImageSafely(m);

    setSelectedMarker({
      ...m,
      image: loadedImage,
      displayLabel: info.label,
      displayIcon: info.icon,
      displayColor: info.color,
      isApproved: markerApproved,
    });
  };

    const overlay = new kakao.maps.CustomOverlay({
      map,
      position: new kakao.maps.LatLng(m.lat, m.lng),
      content: markerEl,
      yAnchor: 1,
    });

    overlayRefs.current.push(overlay);
  });

};

useEffect(() => {
  let isMounted = true;

  loadKakaoMapScript()
    .then((kakao) => {
      if (!isMounted || !mapDivRef.current) return;

      const center = new kakao.maps.LatLng(37.6345, 126.832);

      const map = new kakao.maps.Map(mapDivRef.current, {
  center,
  level: 4,
  disableDoubleClickZoom: true,
});

      kakaoMapRef.current = map;
      setIsKakaoMapReady(true);
      kakao.maps.event.addListener(map, "dblclick", (mouseEvent) => {
  if (!isAdminLoggedInRef.current) return;

  const latLng = mouseEvent.latLng;

  setSelectedMarker(null);
  setEditingOfficialMarkerId(null);

  setNewMarkerType("step");
  setNewMarkerDesc("");
  setNewMarkerImage("");
  setWheelLevel(1);

  setTempMarker({
    lat: latLng.getLat(),
    lng: latLng.getLng(),
  });
});
      if (mapRef) {
  mapRef.current = {
    flyTo: (position, zoom = 17) => moveKakaoMapTo(position, zoom),
    setView: (position, zoom = 17) => moveKakaoMapTo(position, zoom),
    fitBounds: (positions = []) => fitKakaoMapBounds(positions),
  };
}

      const zoomControl = new kakao.maps.ZoomControl();
      map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);

      const mapTypeControl = new kakao.maps.MapTypeControl();
      map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);

      setTimeout(() => {
  if (!isMounted) return;

  map.relayout();
  drawKakaoRouteLine(kakao, map, routeSteps);
  drawUserLocationMarker(kakao, map);
}, 80);
    })
    .catch((error) => {
      console.error("카카오 지도 진짜 에러:", error);

      alert(
        `카카오 지도 실패: ${
          error?.message || "원인을 알 수 없습니다. F12 Console을 확인해 주세요."
        }`
      );
    });

  return () => {
  isMounted = false;
  clearKakaoOverlays();
  clearOfficialTempOverlay();
  clearKakaoRoute();
  clearWheelRouteAnimation();
};
}, []);

useEffect(() => {
  if (
    !isKakaoMapReady ||
    !window.kakao ||
    !window.kakao.maps ||
    !kakaoMapRef.current
  ) {
    return;
  }

  const drawNow = () => {
    if (!kakaoMapRef.current) return;

    kakaoMapRef.current.relayout();
    drawKakaoMarkers(window.kakao, kakaoMapRef.current);
  };

  const timer1 = setTimeout(drawNow, 80);
  const timer2 = setTimeout(drawNow, 350);
  const timer3 = setTimeout(drawNow, 800);

  return () => {
    clearTimeout(timer1);
    clearTimeout(timer2);
    clearTimeout(timer3);
  };
}, [isKakaoMapReady, bfMarkers,isRainyMode]);
useEffect(() => {
  if (
    !isKakaoMapReady ||
    !window.kakao ||
    !window.kakao.maps ||
    !kakaoMapRef.current
  ) {
    return;
  }

  drawOfficialTempMarker(window.kakao, kakaoMapRef.current);

  return () => {
    clearOfficialTempOverlay();
  };
}, [isKakaoMapReady, tempMarker]);
useEffect(() => {
  if (
    !isKakaoMapReady ||
    !window.kakao ||
    !window.kakao.maps ||
    !kakaoMapRef.current
  ) {
    return;
  }

  drawKakaoRouteLine(window.kakao, kakaoMapRef.current, routeSteps);
  startWheelRouteAnimation(window.kakao, kakaoMapRef.current, routeSteps);
}, [isKakaoMapReady, routeSteps, startMarkerPos, endMarkerPos]);

useEffect(() => {
  if (
    !isKakaoMapReady ||
    !window.kakao ||
    !window.kakao.maps ||
    !kakaoMapRef.current
  ) {
    return;
  }

  drawUserLocationMarker(window.kakao, kakaoMapRef.current);
}, [isKakaoMapReady, userLocation, deviceHeading]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      <div
        ref={mapDivRef}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
{isAdminLoggedIn && (
      <div
        style={{
          position: "absolute",
          left: "12px",
          top: "12px",
          zIndex: 10,
          background: "rgba(255,255,255,0.94)",
          borderRadius: "999px",
          padding: "8px 12px",
          fontSize: "12px",
          fontWeight: "900",
          color: "#334155",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        이동장애 요소 {bfMarkers.length}개 표시 중
      </div>
      )}
      {selectedMarker && (
  <div
    style={{
      position: "absolute",
      left: "50%",
      bottom: "18px",
      transform: "translateX(-50%)",
      zIndex: 30,
      width: "min(380px, calc(100% - 24px))",
      background: "rgba(255,255,255,0.98)",
      borderRadius: "22px",
      padding: "16px",
      boxShadow: "0 16px 40px rgba(15,23,42,0.24)",
      border: "1px solid rgba(255,255,255,0.9)",
      boxSizing: "border-box",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "10px",
        marginBottom: "10px",
      }}
    >
      <div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 10px",
            borderRadius: "999px",
            background: selectedMarker.isApproved
              ? `${selectedMarker.displayColor}20`
              : "#F3F4F6",
            color: selectedMarker.isApproved
              ? selectedMarker.displayColor
              : "#64748B",
            fontSize: "12px",
            fontWeight: "900",
            marginBottom: "8px",
          }}
        >
          <span>{selectedMarker.displayIcon}</span>
          <span>
            {selectedMarker.displayLabel}
          </span>
        </div>

        <div
          style={{
            fontSize: "16px",
            fontWeight: "900",
            color: "#111827",
          }}
        >
          {selectedMarker.displayLabel || "이동장애 요소"}
        </div>
      </div>

      <button
        onClick={() => setSelectedMarker(null)}
        style={{
          border: "none",
          background: "#E5E7EB",
          color: "#374151",
          borderRadius: "50%",
          width: "30px",
          height: "30px",
          fontSize: "16px",
          fontWeight: "900",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>

    {selectedMarker.image && (
      <img
        src={selectedMarker.image}
        alt="제보 사진"
        style={{
          width: "100%",
          maxHeight: "160px",
          objectFit: "cover",
          borderRadius: "14px",
          marginBottom: "10px",
          border: "1px solid #E5E7EB",
        }}
      />
    )}

    {selectedMarker.desc?.trim() && (
  <div
    style={{
      fontSize: "14px",
      lineHeight: 1.55,
      color: "#374151",
      whiteSpace: "pre-wrap",
    }}
  >
    {selectedMarker.desc}
  </div>
)}
{isAdminLoggedIn && selectedMarker.id && (
  <div
    style={{
      display: "flex",
      gap: "8px",
      marginTop: "12px",
    }}
  >
    <button
      type="button"
      onClick={async () => {
        const loadedImage = await loadMarkerImageSafely(selectedMarker);

        setEditingOfficialMarkerId(selectedMarker.id);

        setTempMarker({
          lat: Number(selectedMarker.lat),
          lng: Number(selectedMarker.lng),
        });

        setNewMarkerType(selectedMarker.type || "step");
        setNewMarkerDesc(selectedMarker.desc || "");
        setNewMarkerImage(loadedImage || "");
        setWheelLevel(Number(selectedMarker.wheelLevel || 1));

        setSelectedMarker(null);
      }}
      style={{
        flex: 1,
        border: "none",
        borderRadius: "12px",
        padding: "10px",
        background: "#DBEAFE",
        color: "#1D4ED8",
        fontWeight: "900",
        cursor: "pointer",
      }}
    >
      수정
    </button>

    <button
      type="button"
      onClick={async () => {
        const ok = window.confirm("이 공식 아이콘을 삭제할까요?");
        if (!ok) return;

        try {
          await remove(ref(db, `bfMarkers/${selectedMarker.id}`));
          await remove(ref(db, `bfMarkerImages/${selectedMarker.id}`));

          setSelectedMarker(null);
          alert("아이콘이 삭제되었습니다.");
        } catch (error) {
          console.error("공식 아이콘 삭제 실패:", error);
          alert("아이콘 삭제 중 오류가 발생했습니다.");
        }
      }}
      style={{
        flex: 1,
        border: "none",
        borderRadius: "12px",
        padding: "10px",
        background: "#FEE2E2",
        color: "#B91C1C",
        fontWeight: "900",
        cursor: "pointer",
      }}
    >
      삭제
    </button>
  </div>
)}
  </div>
)}
{isAdminLoggedIn && tempMarker && (
  <div
    style={{
      position: "absolute",
      left: "50%",
      bottom: "18px",
      transform: "translateX(-50%)",
      zIndex: 40,
      width: "min(360px, calc(100% - 24px))",
      background: "rgba(255,255,255,0.97)",
      borderRadius: "22px",
      padding: "16px",
      boxShadow: "0 14px 36px rgba(15,23,42,0.24)",
      border: "1px solid rgba(255,255,255,0.9)",
      boxSizing: "border-box",
    }}
  >
    <div
      style={{
        fontSize: "15px",
        fontWeight: "900",
        color: "#111827",
        marginBottom: "10px",
      }}
    >
      {editingOfficialMarkerId ? "공식 요인 수정" : "공식 요인 등록"}
    </div>

    <select
      value={newMarkerType}
      onChange={(e) => setNewMarkerType(e.target.value)}
      style={{
        width: "100%",
        padding: "9px",
        borderRadius: "10px",
        border: "1px solid #CBD5E1",
        marginBottom: "8px",
        fontWeight: "700",
      }}
    >
      {Object.keys(bfConfig).map((key) => (
        <option key={key} value={key}>
          {bfConfig[key].label}
        </option>
      ))}
    </select>

    <textarea
      placeholder="단차 높이, 경사, 보도 파손 등 상세 설명을 입력하세요."
      value={newMarkerDesc}
      onChange={(e) => setNewMarkerDesc(e.target.value)}
      style={{
        width: "100%",
        height: "70px",
        padding: "9px",
        borderRadius: "10px",
        border: "1px solid #CBD5E1",
        marginBottom: "8px",
        resize: "none",
        boxSizing: "border-box",
      }}
    />

    <input
      type="file"
      accept="image/*"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        compressImageToDataUrl(file)
  .then((compressedImage) => {
    setNewMarkerImage(compressedImage);
  })
  .catch((error) => {
    console.error("사진 압축 실패:", error);
    alert("사진을 불러오는 중 오류가 발생했습니다.");
  });
      }}
      style={{
        width: "100%",
        marginBottom: "8px",
        fontSize: "12px",
      }}
    />

    <select
      value={wheelLevel}
      onChange={(e) => setWheelLevel(Number(e.target.value))}
      style={{
        width: "100%",
        padding: "9px",
        borderRadius: "10px",
        border: "1px solid #CBD5E1",
        marginBottom: "10px",
        fontWeight: "700",
      }}
    >
      <option value={1}>🟡 1단계: 주의 필요</option>
      <option value={2}>🔴 2단계: 회피 권장</option>
    </select>

    <div style={{ display: "flex", gap: "8px" }}>
      <button
        onClick={() => {
  setTempMarker(null);
  setEditingOfficialMarkerId(null);
  setNewMarkerType("step");
  setNewMarkerDesc("");
  setNewMarkerImage("");
  setWheelLevel(1);
}}
        style={{
          flex: 1,
          border: "none",
          borderRadius: "12px",
          padding: "10px",
          background: "#E5E7EB",
          color: "#374151",
          fontWeight: "900",
          cursor: "pointer",
        }}
      >
        취소
      </button>

      <button
        onClick={async () => {
  try {
    const markerData = {
      lat: Number(tempMarker.lat),
      lng: Number(tempMarker.lng),
      type: newMarkerType,
      desc: newMarkerDesc,
      hasImage: !!newMarkerImage,
      status: "approved",
      isOfficial: true,
      wheelLevel: Number(wheelLevel),
    };

    if (editingOfficialMarkerId) {
      await update(
        ref(db, `bfMarkers/${editingOfficialMarkerId}`),
        {
          ...markerData,
          updatedAt: Date.now(),
        }
      );

      await saveMarkerImageIfNeeded(
        editingOfficialMarkerId,
        newMarkerImage
      );

      alert("공식 요인이 수정되었습니다.");
    } else {
      const newMarkerRef = await push(ref(db, "bfMarkers"), {
        ...markerData,
        date: new Date().toLocaleDateString(),
        createdAt: Date.now(),
      });

      await saveMarkerImageIfNeeded(
        newMarkerRef.key,
        newMarkerImage
      );

      alert("공식 요인이 등록되었습니다.");
    }

    setTempMarker(null);
    setEditingOfficialMarkerId(null);
    setNewMarkerType("step");
    setNewMarkerDesc("");
    setNewMarkerImage("");
    setWheelLevel(1);
  } catch (error) {
    console.error("공식 요인 저장 실패:", error);

    alert(
      editingOfficialMarkerId
        ? "공식 요인 수정 중 오류가 발생했습니다."
        : "공식 요인 등록 중 오류가 발생했습니다."
    );
  }
}}
        style={{
          flex: 1,
          border: "none",
          borderRadius: "12px",
          padding: "10px",
          background: "#2563EB",
          color: "white",
          fontWeight: "900",
          cursor: "pointer",
        }}
      >
        {editingOfficialMarkerId ? "수정 저장" : "등록"}
      </button>
    </div>
  </div>
)}
    </div>
  );
};
const KakaoCreateMap = ({
  bfMarkers = [],
  userLocation = null,
  deviceHeading = null,
  mapRef,
  userRole,
  isAdminLoggedIn,
  tempMarker,
  setTempMarker,
  newMarkerType,
  setNewMarkerType,
  newMarkerDesc,
  setNewMarkerDesc,
  newMarkerImage,
  setNewMarkerImage,
  bfConfig,
  wheelLevel,
  setWheelLevel,
  isRainyMode = DEFAULT_RAINY_MODE,
weatherInfo = null,
}) => {
 const mapDivRef = useRef(null);
const kakaoMapRef = useRef(null);
const overlayRefs = useRef([]);
const createUserLocationOverlayRef = useRef(null);
const tempOverlayRef = useRef(null);
const isAdminLoggedInRef = useRef(isAdminLoggedIn);
const [selectedCreateMarker, setSelectedCreateMarker] = useState(null);
const clientIdRef = useRef(getWheelWorldClientId());
const currentClientId = clientIdRef.current;
const [editingMarkerId, setEditingMarkerId] = useState(null);
const [isCreateMapReady, setIsCreateMapReady] = useState(false);
const latestCreateBfMarkersRef = useRef(bfMarkers);

// 관리자 로그인 상태와 마커 목록을 항상 최신으로 유지
isAdminLoggedInRef.current = isAdminLoggedIn;
latestCreateBfMarkersRef.current = bfMarkers;

  const getKakaoMarkerInfo = (type) => {
  const fallbackConfig =
    bfConfig.step || bfConfig.sidewalk || Object.values(bfConfig)[0];

  const config = bfConfig[type] || fallbackConfig;

  const icon = config.icon || "📍";
  const rawLabel = config.label || "기타";

  return {
    label: rawLabel.replace(icon, "").trim(),
    icon,
    color: config.color || "#64748B",
  };
};

  const clearKakaoCreateOverlays = () => {
    overlayRefs.current.forEach((overlay) => overlay.setMap(null));
    overlayRefs.current = [];

    if (tempOverlayRef.current) {
      tempOverlayRef.current.setMap(null);
      tempOverlayRef.current = null;
    }
  };

  const drawTempMarker = (kakao, map) => {
    if (tempOverlayRef.current) {
      tempOverlayRef.current.setMap(null);
      tempOverlayRef.current = null;
    }

    if (!tempMarker) return;

    const el = document.createElement("div");
    el.style.width = "42px";
    el.style.height = "42px";
    el.style.borderRadius = "50%";
    el.style.background = "#111827";
    el.style.color = "white";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.fontSize = "22px";
    el.style.border = "3px solid white";
    el.style.boxShadow = "0 5px 14px rgba(0,0,0,0.28)";
    el.innerText = "📍";

    const overlay = new kakao.maps.CustomOverlay({
      map,
      position: new kakao.maps.LatLng(tempMarker.lat, tempMarker.lng),
      content: el,
      yAnchor: 1,
    });

    tempOverlayRef.current = overlay;
  };

  const drawKakaoCreateMarkers = (kakao, map) => {
    overlayRefs.current.forEach((overlay) => overlay.setMap(null));
    overlayRefs.current = [];

   const markerSource = latestCreateBfMarkersRef.current || [];

const validMarkers = markerSource
  .filter(
    (m) =>
      m &&
      m.lat !== undefined &&
      m.lng !== undefined
  )
  .map((m) => ({
    ...m,
    lat: Number(m.lat),
    lng: Number(m.lng),
  }))
    .filter(
    (m) =>
      !Number.isNaN(m.lat) &&
      !Number.isNaN(m.lng) &&
      (m.type !== "puddle" || isRainyMode)
  );

    validMarkers.forEach((m) => {
  const info = getKakaoMarkerInfo(m.type);
  const isApproved = m.status === "approved" || m.isOfficial === true;

  const isPuddleMarker = m.type === "puddle";

  const markerBgColor = isPuddleMarker ? "#0EA5E9" : "#FFFFFF";
  const markerTextColor = isPuddleMarker ? "#FFFFFF" : "#334155";
  const markerBorderColor = !isApproved
  ? "#94A3B8"
  : Number(m?.wheelLevel) === 2
  ? "#DC2626"
  : Number(m?.wheelLevel) === 1
  ? "#F59E0B"
  : "#94A3B8";
  const markerBorderStyle = isApproved ? "solid" : "dashed";
  const markerShadow = isPuddleMarker
  ? "0 4px 10px rgba(14, 165, 233, 0.30)"
  : "0 2px 7px rgba(15, 23, 42, 0.14)";

  const markerEl = document.createElement("div");

markerEl.dataset.wheelMarker = "true";
markerEl.dataset.puddleMarker = isPuddleMarker ? "true" : "false";

Object.assign(markerEl.style, {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    width: isPuddleMarker ? "32px" : "30px",
height: isPuddleMarker ? "32px" : "30px",
borderRadius: "50%",

background: markerBgColor,
color: isPuddleMarker ? "#FFFFFF" : "#334155",
fontSize: isPuddleMarker ? "17px" : "15px",
fontWeight: "900",

border: `2px solid ${markerBorderColor}`,
boxShadow: markerShadow,
    cursor: "pointer",
    userSelect: "none",
    opacity: isApproved ? "1" : "0.65",
  });

  markerEl.innerText = isPuddleMarker ? "💧" : info.icon;

  markerEl.onclick = async () => {
    setTempMarker(null);

    const loadedImage = await loadMarkerImageSafely(m);

    setSelectedCreateMarker({
      ...m,
      image: loadedImage,
      displayLabel: info.label,
      displayIcon: info.icon,
      displayColor: info.color,
      isApproved,
    });
  };

  const overlay = new kakao.maps.CustomOverlay({
    map,
    position: new kakao.maps.LatLng(m.lat, m.lng),
    content: markerEl,
    yAnchor: 1,
  });

  overlayRefs.current.push(overlay);
});

    drawTempMarker(kakao, map);
  };
const drawKakaoCreateUserLocationMarker = (kakao, map) => {
  if (createUserLocationOverlayRef.current) {
    createUserLocationOverlayRef.current.setMap(null);
    createUserLocationOverlayRef.current = null;
  }

  if (!userLocation) return;

  const lat = Array.isArray(userLocation)
    ? Number(userLocation[0])
    : Number(userLocation.lat);

  const lng = Array.isArray(userLocation)
    ? Number(userLocation[1])
    : Number(userLocation.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return;

  const heading = Number(deviceHeading);
  const hasHeading = !Number.isNaN(heading);

  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.width = "58px";
  wrapper.style.height = "58px";
  wrapper.style.pointerEvents = "none";

  if (hasHeading) {
    const arrowEl = document.createElement("div");

    arrowEl.innerHTML = `
      <svg width="58" height="58" viewBox="0 0 58 58">
        <path
          d="M29 3 L42 34 L29 27 L16 34 Z"
          fill="#2563EB"
          stroke="white"
          stroke-width="3"
          stroke-linejoin="round"
        />
      </svg>
    `;

    arrowEl.style.position = "absolute";
    arrowEl.style.left = "0";
    arrowEl.style.top = "0";
    arrowEl.style.width = "58px";
    arrowEl.style.height = "58px";
    arrowEl.style.transform = `rotate(${heading}deg)`;
    arrowEl.style.transformOrigin = "50% 50%";
    arrowEl.style.filter = "drop-shadow(0 3px 8px rgba(37,99,235,0.35))";
    arrowEl.style.zIndex = "1";

    wrapper.appendChild(arrowEl);
  }

  const pulseEl = document.createElement("div");
  pulseEl.style.position = "absolute";
  pulseEl.style.left = "50%";
  pulseEl.style.top = "50%";
  pulseEl.style.width = "44px";
  pulseEl.style.height = "44px";
  pulseEl.style.borderRadius = "50%";
  pulseEl.style.background = "rgba(37,99,235,0.18)";
  pulseEl.style.transform = "translate(-50%, -50%)";
  pulseEl.style.zIndex = "2";

  const markerEl = document.createElement("div");
  markerEl.style.position = "absolute";
  markerEl.style.left = "50%";
  markerEl.style.top = "50%";
  markerEl.style.width = "22px";
  markerEl.style.height = "22px";
  markerEl.style.borderRadius = "50%";
  markerEl.style.background = "#2563EB";
  markerEl.style.border = "4px solid white";
  markerEl.style.boxShadow = "0 0 14px rgba(37,99,235,0.65)";
  markerEl.style.boxSizing = "border-box";
  markerEl.style.transform = "translate(-50%, -50%)";
  markerEl.style.zIndex = "3";

  wrapper.appendChild(pulseEl);
  wrapper.appendChild(markerEl);

  const overlay = new kakao.maps.CustomOverlay({
    map,
    position: new kakao.maps.LatLng(lat, lng),
    content: wrapper,
    yAnchor: 0.5,
    xAnchor: 0.5,
  });

  createUserLocationOverlayRef.current = overlay;
};
  const moveKakaoMapTo = (position, zoom = 17) => {
    if (!window.kakao || !window.kakao.maps || !kakaoMapRef.current) return;

    const lat = Array.isArray(position) ? position[0] : position.lat;
    const lng = Array.isArray(position) ? position[1] : position.lng;

    const level =
      zoom >= 18 ? 2 :
      zoom >= 17 ? 3 :
      zoom >= 16 ? 4 :
      5;

    const kakaoPosition = new window.kakao.maps.LatLng(lat, lng);
    kakaoMapRef.current.setCenter(kakaoPosition);
    kakaoMapRef.current.setLevel(level);
  };

  const saveKakaoReportMarker = async () => {
  if (!tempMarker) {
    alert("지도에서 위치를 먼저 선택해 주세요.");
    return;
  }

  if (!newMarkerDesc.trim()) {
    alert("상세 설명을 입력해 주세요.");
    return;
  }

  try {
    if (editingMarkerId) {
      await update(ref(db, `bfMarkers/${editingMarkerId}`), {
  lat: Number(tempMarker.lat),
  lng: Number(tempMarker.lng),
  type: newMarkerType,
  desc: newMarkerDesc,
  hasImage: !!newMarkerImage,
  updatedAt: new Date().toLocaleString(),
  status: isAdminLoggedIn ? "approved" : "pending",
  isOfficial: isAdminLoggedIn,
  wheelLevel: isAdminLoggedIn ? Number(wheelLevel) : 0,
});

await saveMarkerImageIfNeeded(editingMarkerId, newMarkerImage);

      alert(
        isAdminLoggedIn
          ? "공식 요인이 수정되었습니다."
          : "제보가 수정되었습니다. 관리자 승인 후 지도에 반영됩니다."
      );
    } else {
      const newMarkerRef = await push(ref(db, "bfMarkers"), {
  lat: Number(tempMarker.lat),
  lng: Number(tempMarker.lng),
  type: newMarkerType,
  desc: newMarkerDesc,
  hasImage: !!newMarkerImage,
  date: new Date().toLocaleDateString(),
  createdAt: Date.now(),
  ownerId: currentClientId,
  status: isAdminLoggedIn ? "approved" : "pending",
  isOfficial: isAdminLoggedIn,
  wheelLevel: isAdminLoggedIn ? Number(wheelLevel) : 0,
});

if (newMarkerImage) {
  await saveMarkerImageIfNeeded(newMarkerRef.key, newMarkerImage);
}

      alert(
        isAdminLoggedIn
          ? "공식 안전 요인이 등록되었습니다."
          : "제보가 접수되었습니다. 관리자 승인 후 지도에 반영됩니다."
      );
    }

    setTempMarker(null);
    setSelectedCreateMarker(null);
    setEditingMarkerId(null);
    setNewMarkerDesc("");
    setNewMarkerImage(null);
    setNewMarkerType("step");
    setWheelLevel(1);
  } catch (error) {
    alert(
      editingMarkerId
        ? "수정 중 오류가 발생했습니다."
        : "제보 저장 중 오류가 발생했습니다."
    );
  }
};

  useEffect(() => {
    let isMounted = true;

    loadKakaoMapScript()
      .then((kakao) => {
        if (!isMounted || !mapDivRef.current) return;

        const center = new kakao.maps.LatLng(37.6345, 126.832);

        const map = new kakao.maps.Map(mapDivRef.current, {
  center,
  level: 4,
  disableDoubleClickZoom: true,
});
        kakaoMapRef.current = map;
        setIsCreateMapReady(true);

        if (mapRef) {
          mapRef.current = {
            flyTo: (position, zoom = 17) => moveKakaoMapTo(position, zoom),
            setView: (position, zoom = 17) => moveKakaoMapTo(position, zoom),
          };
        }

        const zoomControl = new kakao.maps.ZoomControl();
        map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);

        const mapTypeControl = new kakao.maps.MapTypeControl();
        map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);

      kakao.maps.event.addListener(map, "dblclick", (mouseEvent) => {
  const latLng = mouseEvent.latLng;

  setSelectedCreateMarker(null);
  setEditingMarkerId(null);
  setNewMarkerDesc("");
  setNewMarkerImage(null);
  setNewMarkerType("step");
  setWheelLevel(1);

  setTempMarker({
    lat: latLng.getLat(),
    lng: latLng.getLng(),
  });
});

       setTimeout(() => {
  if (!isMounted) return;

  map.relayout();
}, 80);
      })
      .catch((error) => {
        console.error("카카오 주민 제보 지도 에러:", error);
        alert(
          `카카오 지도 실패: ${
            error?.message || "원인을 알 수 없습니다. F12 Console을 확인해 주세요."
          }`
        );
      });

   return () => {
  isMounted = false;
  clearKakaoCreateOverlays();
};
  }, []);

  useEffect(() => {
  if (
    !isCreateMapReady ||
    !window.kakao ||
    !window.kakao.maps ||
    !kakaoMapRef.current
  ) {
    return;
  }

  const drawNow = () => {
    if (!kakaoMapRef.current) return;

    kakaoMapRef.current.relayout();
    drawKakaoCreateMarkers(window.kakao, kakaoMapRef.current);
  };

  const timer1 = setTimeout(drawNow, 80);
  const timer2 = setTimeout(drawNow, 350);
  const timer3 = setTimeout(drawNow, 800);

  return () => {
    clearTimeout(timer1);
    clearTimeout(timer2);
    clearTimeout(timer3);
  };
}, [isCreateMapReady, bfMarkers, tempMarker, isRainyMode]);
useEffect(() => {
  if (
    !isCreateMapReady ||
    !window.kakao ||
    !window.kakao.maps ||
    !kakaoMapRef.current
  ) {
    return;
  }

  drawKakaoCreateUserLocationMarker(window.kakao, kakaoMapRef.current);

  return () => {
    if (createUserLocationOverlayRef.current) {
      createUserLocationOverlayRef.current.setMap(null);
      createUserLocationOverlayRef.current = null;
    }
  };
}, [isCreateMapReady, userLocation, deviceHeading]);
useEffect(() => {
  isAdminLoggedInRef.current = isAdminLoggedIn;
}, [isAdminLoggedIn]);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      <div
        ref={mapDivRef}
        style={{
          width: "100%",
          height: "100%",
        }}
      />

      
      {selectedCreateMarker && (
  <div
    style={{
      position: "absolute",
      left: "50%",
      bottom: "18px",
      transform: "translateX(-50%)",
      zIndex: 30,
      width: "min(380px, calc(100% - 24px))",
      background: "rgba(255,255,255,0.98)",
      borderRadius: "22px",
      padding: "16px",
      boxShadow: "0 16px 40px rgba(15,23,42,0.24)",
      border: "1px solid rgba(255,255,255,0.9)",
      boxSizing: "border-box",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "10px",
        marginBottom: selectedCreateMarker.image || selectedCreateMarker.desc?.trim()
          ? "10px"
          : "0",
      }}
    >
      <div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 10px",
            borderRadius: "999px",
            background: selectedCreateMarker.isApproved
              ? `${selectedCreateMarker.displayColor}20`
              : "#F3F4F6",
            color: selectedCreateMarker.isApproved
              ? selectedCreateMarker.displayColor
              : "#64748B",
            fontSize: "12px",
            fontWeight: "900",
            marginBottom: "8px",
          }}
        >
          <span>{selectedCreateMarker.displayIcon}</span>
          <span>
            {selectedCreateMarker.isApproved
              ? selectedCreateMarker.displayLabel
              : "승인 대기 제보"}
          </span>
        </div>

        <div
          style={{
            fontSize: "16px",
            fontWeight: "900",
            color: "#111827",
          }}
        >
          {selectedCreateMarker.displayLabel || "이동장애 요소"}
        </div>
      </div>

      <button
        onClick={() => setSelectedCreateMarker(null)}
        style={{
          border: "none",
          background: "#E5E7EB",
          color: "#374151",
          borderRadius: "50%",
          width: "30px",
          height: "30px",
          fontSize: "16px",
          fontWeight: "900",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>

    {selectedCreateMarker.image && (
      <img
        src={selectedCreateMarker.image}
        alt="제보 사진"
        style={{
          width: "100%",
          maxHeight: "160px",
          objectFit: "cover",
          borderRadius: "14px",
          marginBottom: "10px",
          border: "1px solid #E5E7EB",
        }}
      />
    )}

    {selectedCreateMarker.desc?.trim() && (
      <div
        style={{
          fontSize: "14px",
          lineHeight: 1.55,
          color: "#374151",
          whiteSpace: "pre-wrap",
        }}
      >
        {selectedCreateMarker.desc}
      </div>
    )}
    {selectedCreateMarker &&
  (isAdminLoggedIn || selectedCreateMarker.ownerId === currentClientId) && (
    <div
      style={{
        display: "flex",
        gap: "8px",
        marginTop: "12px",
      }}
    >
      <button
        onClick={() => {
          setEditingMarkerId(selectedCreateMarker.id);

          setTempMarker({
            lat: selectedCreateMarker.lat,
            lng: selectedCreateMarker.lng,
          });

          setNewMarkerType(selectedCreateMarker.type || "step");
          setNewMarkerDesc(selectedCreateMarker.desc || "");
          setNewMarkerImage(selectedCreateMarker.image || null);
          setWheelLevel(Number(selectedCreateMarker.wheelLevel || 1));

          setSelectedCreateMarker(null);
        }}
        style={{
          flex: 1,
          border: "none",
          borderRadius: "12px",
          padding: "10px",
          background: "#DBEAFE",
          color: "#1D4ED8",
          fontWeight: "900",
          cursor: "pointer",
        }}
      >
        수정
      </button>

      <button
        onClick={async () => {
          const ok = window.confirm("이 제보를 삭제할까요?");
          if (!ok) return;

          try {
            await remove(ref(db, `bfMarkers/${selectedCreateMarker.id}`));
            await remove(ref(db, `bfMarkerImages/${selectedCreateMarker.id}`));

            setSelectedCreateMarker(null);
            alert("삭제되었습니다.");
          } catch (error) {
            alert("삭제 중 오류가 발생했습니다.");
          }
        }}
        style={{
          flex: 1,
          border: "none",
          borderRadius: "12px",
          padding: "10px",
          background: "#FEE2E2",
          color: "#B91C1C",
          fontWeight: "900",
          cursor: "pointer",
        }}
      >
        삭제
      </button>
    </div>
  )}
  </div>
)}

      {tempMarker && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "18px",
            transform: "translateX(-50%)",
            zIndex: 20,
            width: "min(360px, calc(100% - 24px))",
            background: "rgba(255,255,255,0.97)",
            borderRadius: "22px",
            padding: "16px",
            boxShadow: "0 14px 36px rgba(15,23,42,0.24)",
            border: "1px solid rgba(255,255,255,0.9)",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: "15px",
              fontWeight: "900",
              color: "#111827",
              marginBottom: "10px",
            }}
          >
            {editingMarkerId
  ? isAdminLoggedIn
    ? "공식 요인 수정"
    : "제보 수정"
  : isAdminLoggedIn
  ? "공식 요인 등록"
  : "새로운 제보 등록"}
          </div>

          <select
            value={newMarkerType}
            onChange={(e) => setNewMarkerType(e.target.value)}
            style={{
              width: "100%",
              padding: "9px",
              borderRadius: "10px",
              border: "1px solid #CBD5E1",
              marginBottom: "8px",
              fontWeight: "700",
            }}
          >
            {Object.keys(bfConfig).map((key) => (
              <option key={key} value={key}>
                {bfConfig[key].label}
              </option>
            ))}
          </select>

          <textarea
            placeholder="단차 높이, 경사, 보도 파손 등 상세 설명을 입력하세요."
            value={newMarkerDesc}
            onChange={(e) => setNewMarkerDesc(e.target.value)}
            style={{
              width: "100%",
              height: "70px",
              padding: "9px",
              borderRadius: "10px",
              border: "1px solid #CBD5E1",
              marginBottom: "8px",
              resize: "none",
              boxSizing: "border-box",
            }}
          />

          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              const reader = new FileReader();
              compressImageToDataUrl(file)
  .then((compressedImage) => {
    setNewMarkerImage(compressedImage);
  })
  .catch((error) => {
    console.error("사진 압축 실패:", error);
    alert("사진을 불러오는 중 오류가 발생했습니다.");
  });
            }}
            style={{
              width: "100%",
              marginBottom: "8px",
              fontSize: "12px",
            }}
          />

          {isAdminLoggedIn && (
            <select
              value={wheelLevel}
              onChange={(e) => setWheelLevel(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "9px",
                borderRadius: "10px",
                border: "1px solid #CBD5E1",
                marginBottom: "10px",
                fontWeight: "700",
              }}
            >
              <option value={1}>🟡 1단계: 주의 필요</option>
              <option value={2}>🔴 2단계: 회피 권장</option>
            </select>
          )}

          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >
            <button
              onClick={() => {
  setTempMarker(null);
  setSelectedCreateMarker(null);
  setEditingMarkerId(null);
  setNewMarkerDesc("");
  setNewMarkerImage(null);
  setNewMarkerType("step");
  setWheelLevel(1);
}}
              style={{
                flex: 1,
                border: "none",
                borderRadius: "12px",
                padding: "10px",
                background: "#E5E7EB",
                color: "#374151",
                fontWeight: "900",
                cursor: "pointer",
              }}
            >
              취소
            </button>

            <button
              onClick={saveKakaoReportMarker}
              style={{
                flex: 1,
                border: "none",
                borderRadius: "12px",
                padding: "10px",
                background: "#2563EB",
                color: "white",
                fontWeight: "900",
                cursor: "pointer",
              }}
            >
              등록
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
const CuteCartoonBackground = () => (
  <>
    <style>{`
      @keyframes moveRightSoft {
        0% {
          transform: translateX(-220px);
        }
        100% {
          transform: translateX(calc(100vw + 260px));
        }
      }

      @keyframes moveLeftSoft {
        0% {
          transform: translateX(calc(100vw + 260px));
        }
        100% {
          transform: translateX(-260px);
        }
      }

      @keyframes floatSoft {
        0%, 100% {
          transform: translateY(0px);
        }
        50% {
          transform: translateY(-7px);
        }
      }

      @keyframes cloudDrift {
        0% {
          transform: translateX(0px);
        }
        50% {
          transform: translateX(12px);
        }
        100% {
          transform: translateX(0px);
        }
      }

      @keyframes shimmer {
        0%, 100% {
          opacity: 0.35;
        }
        50% {
          opacity: 0.6;
        }
      }

      @keyframes wheelSpin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    `}</style>

    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        zIndex: 0,
        pointerEvents: "none",
        background:
          "linear-gradient(to bottom, #8ED0FF 0%, #BDE7FF 28%, #E6F7FF 54%, #CDEAB6 72%, #8DCC6E 100%)",
      }}
    >
      {/* 종이 질감 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.16,
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(255,255,255,0.9) 0 1px, transparent 1.2px),
            radial-gradient(circle at 70% 60%, rgba(255,255,255,0.7) 0 1px, transparent 1.2px),
            radial-gradient(circle at 40% 80%, rgba(255,255,255,0.55) 0 1px, transparent 1.2px)
          `,
          backgroundSize: "18px 18px, 24px 24px, 28px 28px",
        }}
      />

      {/* 햇빛 */}
      <div
        style={{
          position: "absolute",
          top: "-30px",
          right: "-20px",
          width: "240px",
          height: "240px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,245,200,0.95) 0%, rgba(255,236,170,0.5) 35%, rgba(255,255,255,0) 75%)",
          filter: "blur(10px)",
        }}
      />

      {/* 구름 */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "8%",
          width: "180px",
          height: "64px",
          background: "rgba(255,255,255,0.78)",
          borderRadius: "999px",
          filter: "blur(5px)",
          animation: "cloudDrift 10s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "16%",
          left: "12%",
          width: "90px",
          height: "40px",
          background: "rgba(255,255,255,0.65)",
          borderRadius: "999px",
          filter: "blur(4px)",
          animation: "cloudDrift 11s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "14%",
          right: "10%",
          width: "220px",
          height: "72px",
          background: "rgba(255,255,255,0.76)",
          borderRadius: "999px",
          filter: "blur(5px)",
          animation: "cloudDrift 12s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "21%",
          right: "18%",
          width: "110px",
          height: "42px",
          background: "rgba(255,255,255,0.58)",
          borderRadius: "999px",
          filter: "blur(4px)",
          animation: "cloudDrift 13s ease-in-out infinite",
        }}
      />

      {/* 뒤쪽 언덕 */}
      <div
        style={{
          position: "absolute",
          bottom: "26%",
          left: "-6%",
          width: "45%",
          height: "18%",
          background:
            "radial-gradient(circle at 50% 50%, #B7DFA1 0%, #93C67E 58%, #79AF69 100%)",
          borderRadius: "50%",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "25%",
          left: "24%",
          width: "34%",
          height: "15%",
          background:
            "radial-gradient(circle at 50% 50%, #C5E5A9 0%, #9BCB82 58%, #7FB16D 100%)",
          borderRadius: "50%",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "26%",
          right: "-6%",
          width: "47%",
          height: "19%",
          background:
            "radial-gradient(circle at 50% 50%, #BEE2A4 0%, #96C97E 58%, #79AF67 100%)",
          borderRadius: "50%",
        }}
      />

      {/* 앞쪽 큰 언덕 */}
      <div
        style={{
          position: "absolute",
          bottom: "-5%",
          left: "-10%",
          width: "64%",
          height: "28%",
          background:
            "radial-gradient(circle at 50% 45%, #97D470 0%, #71B754 64%, #5B9A45 100%)",
          borderRadius: "50%",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-7%",
          right: "-12%",
          width: "68%",
          height: "30%",
          background:
            "radial-gradient(circle at 50% 45%, #9ED874 0%, #77BC58 64%, #5D9C46 100%)",
          borderRadius: "50%",
        }}
      />

      {/* 바닥 앞부분 덧칠 */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: "16%",
          background:
            "linear-gradient(to top, rgba(88,148,63,0.9), rgba(105,170,72,0.85), rgba(130,195,92,0.25))",
        }}
      />

      {/* 수채화 길 */}
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          left: "7%",
          width: "86%",
          height: "86px",
          background:
            "linear-gradient(to right, rgba(244,229,197,0.15), rgba(241,222,186,0.97), rgba(246,234,208,0.18))",
          borderRadius: "999px",
          transform: "rotate(-2deg)",
          filter: "blur(1px)",
          boxShadow: "0 0 24px rgba(255,245,220,0.28)",
        }}
      />

      {/* 길 하이라이트 */}
      <div
        style={{
          position: "absolute",
          bottom: "12.7%",
          left: "10%",
          width: "78%",
          height: "5px",
          background:
            "repeating-linear-gradient(to right, rgba(255,255,255,0.75) 0 24px, transparent 24px 46px)",
          opacity: 0.72,
        }}
      />

      {/* 잔디 붓터치 */}
      <div
        style={{
          position: "absolute",
          bottom: "13%",
          left: "4%",
          width: "14%",
          height: "8%",
          background:
            "radial-gradient(circle, rgba(120,185,78,0.9) 0%, rgba(120,185,78,0.1) 70%)",
          filter: "blur(6px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "12%",
          right: "6%",
          width: "16%",
          height: "9%",
          background:
            "radial-gradient(circle, rgba(120,185,78,0.88) 0%, rgba(120,185,78,0.08) 70%)",
          filter: "blur(6px)",
        }}
      />

      {/* 왼쪽 나무들 */}
      <svg
        width="170"
        height="260"
        viewBox="0 0 170 260"
        style={{
          position: "absolute",
          left: "-5px",
          bottom: "7%",
          opacity: 0.96,
        }}
      >
        {/* 줄기 */}
        <rect x="30" y="125" width="12" height="80" rx="6" fill="#7A5635" />
        <rect x="68" y="110" width="13" height="92" rx="6" fill="#6D4E2F" />
        <rect x="112" y="135" width="11" height="74" rx="6" fill="#7A5635" />

        {/* 수관 */}
        <circle cx="36" cy="112" r="34" fill="#72B85A" />
        <circle cx="20" cy="120" r="22" fill="#83C96A" />
        <circle cx="52" cy="122" r="20" fill="#8ACF72" />

        <circle cx="74" cy="96" r="38" fill="#6FB857" />
        <circle cx="55" cy="108" r="24" fill="#8BCD73" />
        <circle cx="95" cy="112" r="22" fill="#82C768" />

        <circle cx="118" cy="126" r="28" fill="#6EB554" />
        <circle cx="102" cy="136" r="18" fill="#88CB70" />
        <circle cx="133" cy="138" r="16" fill="#92D579" />

        {/* 풀 */}
        <ellipse cx="40" cy="210" rx="34" ry="16" fill="#5FA14B" />
        <ellipse cx="90" cy="212" rx="40" ry="17" fill="#6AAF53" />
        <ellipse cx="126" cy="214" rx="30" ry="14" fill="#5E9E48" />
      </svg>

      {/* 오른쪽 나무들 */}
      <svg
        width="180"
        height="270"
        viewBox="0 0 180 270"
        style={{
          position: "absolute",
          right: "-6px",
          bottom: "6%",
          opacity: 0.96,
        }}
      >
        {/* 줄기 */}
        <rect x="40" y="140" width="12" height="78" rx="6" fill="#755131" />
        <rect x="86" y="118" width="14" height="95" rx="6" fill="#6E4C2F" />
        <rect x="132" y="136" width="11" height="76" rx="6" fill="#7B5635" />

        {/* 수관 */}
        <circle cx="46" cy="128" r="30" fill="#74BA5B" />
        <circle cx="29" cy="136" r="18" fill="#89CD71" />
        <circle cx="61" cy="138" r="17" fill="#8FD676" />

        <circle cx="93" cy="102" r="40" fill="#6DB455" />
        <circle cx="72" cy="116" r="23" fill="#89CB72" />
        <circle cx="116" cy="118" r="22" fill="#82C767" />

        <circle cx="138" cy="126" r="30" fill="#6CB352" />
        <circle cx="123" cy="139" r="18" fill="#89CC70" />
        <circle cx="154" cy="140" r="17" fill="#93D97B" />

        {/* 풀 */}
        <ellipse cx="44" cy="222" rx="34" ry="16" fill="#5FA04A" />
        <ellipse cx="98" cy="222" rx="42" ry="17" fill="#6AAE54" />
        <ellipse cx="145" cy="222" rx="30" ry="15" fill="#5E9E48" />
      </svg>

      {/* 반짝이 */}
      <div
        style={{
          position: "absolute",
          top: "12%",
          left: "25%",
          width: "10px",
          height: "10px",
          background: "rgba(255,255,255,0.9)",
          borderRadius: "50%",
          animation: "shimmer 3s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "26%",
          right: "28%",
          width: "8px",
          height: "8px",
          background: "rgba(255,255,255,0.85)",
          borderRadius: "50%",
          animation: "shimmer 4s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "18%",
          right: "38%",
          width: "6px",
          height: "6px",
          background: "rgba(255,255,255,0.9)",
          borderRadius: "50%",
          animation: "shimmer 3.5s ease-in-out infinite",
        }}
      />

      {/* 휠체어 */}
      <div
        style={{
          position: "absolute",
          bottom: "13%",
          animation: "moveRightSoft 26s linear infinite",
        }}
      >
        <svg
          width="145"
          height="145"
          viewBox="0 0 145 145"
          style={{
            animation: "floatSoft 2.3s ease-in-out infinite",
            filter: "drop-shadow(0 8px 10px rgba(70,90,70,0.18))",
          }}
        >
          <circle
            cx="52"
            cy="98"
            r="30"
            fill="#3B4754"
            style={{ transformOrigin: "52px 98px", animation: "wheelSpin 2s linear infinite" }}
          />
          <circle cx="52" cy="98" r="20" fill="#B4E0F5" />
          <circle cx="52" cy="98" r="6" fill="#F8FDFF" />

          <circle
            cx="104"
            cy="111"
            r="12"
            fill="#3B4754"
            style={{ transformOrigin: "104px 111px", animation: "wheelSpin 1.6s linear infinite" }}
          />
          <circle cx="104" cy="111" r="5" fill="#EAF7FF" />

          <path
            d="M60 47 L60 84 L94 84"
            stroke="#687585"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />

          <circle cx="64" cy="30" r="12" fill="#FFD9BD" />

          <path
            d="M60 44 Q76 50 84 70"
            stroke="#AFA2F5"
            strokeWidth="11"
            strokeLinecap="round"
            fill="none"
          />

          <path
            d="M80 70 L96 101"
            stroke="#56606D"
            strokeWidth="8"
            strokeLinecap="round"
          />

          <path
            d="M64 57 L91 61"
            stroke="#56606D"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* 유모차 */}
      <div
        style={{
          position: "absolute",
          bottom: "14%",
          animation: "moveLeftSoft 31s linear infinite",
        }}
      >
        <svg
          width="175"
          height="145"
          viewBox="0 0 175 145"
          style={{
            animation: "floatSoft 2.6s ease-in-out infinite",
            filter: "drop-shadow(0 8px 10px rgba(70,90,70,0.15))",
          }}
        >
          <circle
            cx="60"
            cy="108"
            r="14"
            fill="#475569"
            style={{ transformOrigin: "60px 108px", animation: "wheelSpin 2s linear infinite" }}
          />
          <circle cx="60" cy="108" r="6" fill="#F8FAFC" />

          <circle
            cx="118"
            cy="108"
            r="14"
            fill="#475569"
            style={{ transformOrigin: "118px 108px", animation: "wheelSpin 2s linear infinite" }}
          />
          <circle cx="118" cy="108" r="6" fill="#F8FAFC" />

          <path
            d="M44 50 Q95 14 129 57 L123 84 L55 84 Z"
            fill="#F7B0D0"
          />

          <path
            d="M120 84 L150 28"
            stroke="#64748B"
            strokeWidth="7"
            strokeLinecap="round"
          />

          <circle cx="84" cy="60" r="11" fill="#FFE7CC" />
          <circle cx="79" cy="57" r="2" fill="#334155" />
          <circle cx="89" cy="57" r="2" fill="#334155" />

          <path
            d="M80 64 Q84 68 88 64"
            stroke="#334155"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />

          <path
            d="M50 85 L128 85"
            stroke="rgba(255,255,255,0.72)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* 캐리어 */}
      <div
        style={{
          position: "absolute",
          bottom: "12%",
          animation: "moveRightSoft 38s linear infinite",
        }}
      >
        <svg
          width="115"
          height="135"
          viewBox="0 0 115 135"
          style={{
            animation: "floatSoft 2s ease-in-out infinite",
            filter: "drop-shadow(0 8px 10px rgba(70,90,70,0.14))",
          }}
        >
          <rect
            x="30"
            y="32"
            width="54"
            height="72"
            rx="17"
            fill="#B59AF6"
          />

          <rect
            x="41"
            y="45"
            width="32"
            height="36"
            rx="8"
            fill="#DDD7FE"
          />

          <path
            d="M44 30 L44 12 L69 12 L69 30"
            stroke="#64748B"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />

          <circle
            cx="43"
            cy="109"
            r="6"
            fill="#475569"
            style={{ transformOrigin: "43px 109px", animation: "wheelSpin 1.6s linear infinite" }}
          />
          <circle
            cx="72"
            cy="109"
            r="6"
            fill="#475569"
            style={{ transformOrigin: "72px 109px", animation: "wheelSpin 1.6s linear infinite" }}
          />

          <path
            d="M47 52 L68 52"
            stroke="rgba(255,255,255,0.65)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M47 63 L68 63"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* 반려동물 카트 */}
      <div
        style={{
          position: "absolute",
          bottom: "15%",
          animation: "moveLeftSoft 42s linear infinite",
        }}
      >
        <svg
          width="185"
          height="145"
          viewBox="0 0 185 145"
          style={{
            animation: "floatSoft 2.4s ease-in-out infinite",
            filter: "drop-shadow(0 8px 10px rgba(70,90,70,0.14))",
          }}
        >
          <rect
            x="36"
            y="58"
            width="92"
            height="45"
            rx="17"
            fill="#78B7FA"
          />

          <path
            d="M123 60 L154 22"
            stroke="#64748B"
            strokeWidth="6"
            strokeLinecap="round"
          />

          <circle
            cx="57"
            cy="111"
            r="12"
            fill="#475569"
            style={{ transformOrigin: "57px 111px", animation: "wheelSpin 2s linear infinite" }}
          />
          <circle cx="57" cy="111" r="5" fill="#EFF6FF" />

          <circle
            cx="108"
            cy="111"
            r="12"
            fill="#475569"
            style={{ transformOrigin: "108px 111px", animation: "wheelSpin 2s linear infinite" }}
          />
          <circle cx="108" cy="111" r="5" fill="#EFF6FF" />

          <circle cx="70" cy="50" r="16" fill="#F5CBA7" />
          <ellipse cx="60" cy="42" rx="7" ry="12" fill="#D98880" />
          <ellipse cx="80" cy="42" rx="7" ry="12" fill="#D98880" />

          <circle cx="65" cy="50" r="2" fill="#334155" />
          <circle cx="75" cy="50" r="2" fill="#334155" />
          <circle cx="70" cy="57" r="3" fill="#334155" />

          <circle cx="101" cy="52" r="13" fill="#FFF7AE" />
          <polygon points="91,43 95,33 101,43" fill="#FACC15" />
          <polygon points="111,43 107,33 101,43" fill="#FACC15" />

          <circle cx="97" cy="51" r="2" fill="#334155" />
          <circle cx="105" cy="51" r="2" fill="#334155" />

          <path
            d="M97 58 Q101 61 105 58"
            stroke="#334155"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  </>
);

function RainOverlay() {
  const drops = Array.from({ length: 46 }, (_, index) => ({
    id: index,
    left: `${(index * 29) % 100}%`,
    delay: `${(index * 0.13) % 2.2}s`,
    duration: `${0.85 + (index % 6) * 0.11}s`,
    height: `${20 + (index % 5) * 7}px`,
    opacity: 0.3 + (index % 5) * 0.08,
  }));

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        overflow: "hidden",

        // 전체적으로 하늘을 살짝 우중충하게 덮음
        background:
          "linear-gradient(180deg, rgba(71, 85, 105, 0.28), rgba(148, 163, 184, 0.12) 45%, rgba(255, 255, 255, 0.04))",
        backdropFilter: "saturate(0.85)",
      }}
    >
      <style>
        {`
          @keyframes wheelRainFall {
            0% {
              transform: translateY(-70px) translateX(0);
            }
            100% {
              transform: translateY(110vh) translateX(-24px);
            }
          }

          @keyframes wheelCloudFloat {
            0% {
              transform: translateX(-8px);
            }
            50% {
              transform: translateX(10px);
            }
            100% {
              transform: translateX(-8px);
            }
          }
        `}
      </style>

      {/* 해와 맑은 하늘을 살짝 가리는 구름층 */}
      <div
        style={{
          position: "absolute",
          top: "5%",
          left: "7%",
          width: "190px",
          height: "70px",
          borderRadius: "999px",
          background: "rgba(148, 163, 184, 0.55)",
          filter: "blur(1px)",
          animation: "wheelCloudFloat 7s ease-in-out infinite",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "2%",
          right: "8%",
          width: "230px",
          height: "82px",
          borderRadius: "999px",
          background: "rgba(100, 116, 139, 0.48)",
          filter: "blur(1.2px)",
          animation: "wheelCloudFloat 8s ease-in-out infinite",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "14%",
          left: "38%",
          width: "260px",
          height: "90px",
          borderRadius: "999px",
          background: "rgba(203, 213, 225, 0.38)",
          filter: "blur(1.5px)",
          animation: "wheelCloudFloat 9s ease-in-out infinite",
        }}
      />

      {/* 화면 전체를 한 번 더 흐리게 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15, 23, 42, 0.08)",
        }}
      />

      {/* 빗줄기 */}
      {drops.map((drop) => (
        <div
          key={drop.id}
          style={{
            position: "absolute",
            top: "-80px",
            left: drop.left,
            width: "2px",
            height: drop.height,
            borderRadius: "999px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(56,189,248,0.75))",
            opacity: drop.opacity,
            animation: `wheelRainFall ${drop.duration} linear infinite`,
            animationDelay: drop.delay,
          }}
        />
      ))}
    </div>
  );
}
const SimpleTextLogo = () => {
  // 현재 경로가 '/' (홈)인지 확인
  const isHomePage = window.location.pathname === "/";

  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "flex-start", 
      width: "100%", 
      padding: "10px 0" 
    }}>
      <img 
        src="/휠오프 로고.png" 
        alt="Wheel The World Logo" 
        style={{ 
          // 홈이면 500px, 그 외 모든 탭은 250px 적용
          width: isHomePage ? "500px" : "250px", 
          height: "auto", 
          objectFit: "contain",
          // 로고가 가리지 않도록 클릭 이벤트 제어 (필요 시)
          pointerEvents: isHomePage ? "auto" : "none" 
        }} 
      />
    </div>
  );
};
const buttonStyle = {
  width: "100%",
  background: "rgba(255, 255, 255, 0.92)",
  padding: "20px",
  borderRadius: "24px",
  boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
  border: "2px solid #EBF1F6",
  cursor: "pointer",
  transition: "all 0.2s ease-in-out",
  textAlign: "center",
  backdropFilter: "blur(4px)"
};
// ================================
// 1분 의견 설문 설정
// ================================
const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdsufxeu500lZlAhLGS2gVuL7vWayaIf2cf2YGCLPmLuX52Xg/viewform";

const SURVEY_COUNT = 0; // 현재 확인한 설문 제출 인원
const SURVEY_LIMIT = 10;

const openOpinionSurvey = () => {
  if (!GOOGLE_FORM_URL.startsWith("http")) {
    alert("구글폼 주소가 아직 등록되지 않았습니다.");
    return;
  }

  window.open(
    GOOGLE_FORM_URL,
    "_blank",
    "noopener,noreferrer"
  );
};

const SurveyInviteCard = ({ compact = false }) => {
  const rewardAvailable = SURVEY_COUNT < SURVEY_LIMIT;

  const progressPercent = Math.min(
    100,
    (SURVEY_COUNT / SURVEY_LIMIT) * 100
  );

  return (
    <div
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: compact ? "16px" : "18px",
        borderRadius: compact ? "18px" : "24px",
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(255,247,237,0.98))",
        border: "1px solid #FED7AA",
        boxShadow: compact
          ? "0 8px 22px rgba(154,52,18,0.08)"
          : "0 12px 28px rgba(154,52,18,0.12)",
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <span style={{ fontSize: "24px" }}>
          {rewardAvailable ? "☕" : "💬"}
        </span>

        <div
          style={{
            color: "#7C2D12",
            fontSize: compact ? "17px" : "19px",
            fontWeight: "950",
            letterSpacing: "-0.4px",
          }}
        >
          {compact
            ? "조금 더 들려주세요"
            : "1분 의견 설문"}
        </div>
      </div>

      <div
        style={{
          color: "#475569",
          fontSize: "13px",
          lineHeight: 1.55,
          wordBreak: "keep-all",
        }}
      >
        휠더월드를 이용하며 느낀 점과
        <br />
        개선되었으면 하는 부분을 들려주세요.
      </div>

      <div
        style={{
          marginTop: "9px",
          color: "#64748B",
          fontSize: "12px",
          fontWeight: "700",
        }}
      >
        ⏱ 약 1분 소요
      </div>

      {rewardAvailable && (
        <>
          <div
            style={{
              marginTop: "11px",
              padding: "10px 11px",
              borderRadius: "13px",
              background: "#FFF7ED",
              color: "#9A3412",
              fontSize: "12.5px",
              lineHeight: 1.45,
              fontWeight: "800",
              wordBreak: "keep-all",
            }}
          >
            🎁 설문 제출 완료자 선착순 {SURVEY_LIMIT}명에게
            커피 쿠폰을 드려요.
          </div>

          <div
            style={{
              marginTop: "10px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "#64748B",
              fontSize: "11.5px",
              fontWeight: "800",
            }}
          >
            <span>현재 참여</span>
            <span>
              {SURVEY_COUNT} / {SURVEY_LIMIT}
            </span>
          </div>

          <div
            style={{
              width: "100%",
              height: "7px",
              marginTop: "6px",
              borderRadius: "999px",
              background: "#FFEDD5",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                borderRadius: "999px",
                background:
                  "linear-gradient(90deg, #FB923C, #F97316)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </>
      )}

      <button
        type="button"
        onClick={openOpinionSurvey}
        style={{
          width: "100%",
          marginTop: "14px",
          padding: "12px",
          border: "none",
          borderRadius: "14px",
          background:
            "linear-gradient(135deg, #F97316, #EA580C)",
          color: "white",
          fontSize: "14px",
          fontWeight: "900",
          cursor: "pointer",
          boxShadow: "0 7px 14px rgba(234,88,12,0.2)",
        }}
      >
        {rewardAvailable
          ? "1분 설문 참여하기 〉"
          : "의견 남기기 〉"}
      </button>

      {rewardAvailable && (
        <div
          style={{
            marginTop: "7px",
            color: "#94A3B8",
            fontSize: "10.5px",
            lineHeight: 1.4,
            textAlign: "center",
          }}
        >
          구글폼 응답 제출 순서에 따라 제공됩니다.
        </div>
      )}
    </div>
  );
};

// ================================
// 비 오는 날 모드
// true  = 물고임 아이콘 표시
// false = 물고임 아이콘 숨김
// ================================
const DEFAULT_RAINY_MODE = false;
const applyWheelMarkerZoomStyle = (map) => {
  if (!map || typeof map.getLevel !== "function") return;

  const level = Number(map.getLevel());
  const markerEls = document.querySelectorAll("[data-wheel-marker='true']");

  markerEls.forEach((markerEl) => {
    const isPuddleMarker = markerEl.dataset.puddleMarker === "true";

    if (level >= 7) {
      markerEl.style.display = "none";
      return;
    }

    markerEl.style.display = "flex";

    if (level >= 6) {
      markerEl.style.width = isPuddleMarker ? "24px" : "22px";
      markerEl.style.height = isPuddleMarker ? "24px" : "22px";
      markerEl.style.fontSize = isPuddleMarker ? "13px" : "12px";
      markerEl.style.borderWidth = "1.5px";
      markerEl.style.boxShadow = isPuddleMarker
        ? "0 2px 6px rgba(14, 165, 233, 0.22)"
        : "0 1px 4px rgba(15, 23, 42, 0.12)";
      return;
    }

    if (level >= 5) {
      markerEl.style.width = isPuddleMarker ? "28px" : "26px";
      markerEl.style.height = isPuddleMarker ? "28px" : "26px";
      markerEl.style.fontSize = isPuddleMarker ? "15px" : "13px";
      markerEl.style.borderWidth = "1.8px";
      markerEl.style.boxShadow = isPuddleMarker
        ? "0 3px 8px rgba(14, 165, 233, 0.26)"
        : "0 2px 6px rgba(15, 23, 42, 0.14)";
      return;
    }

    markerEl.style.width = isPuddleMarker ? "32px" : "30px";
    markerEl.style.height = isPuddleMarker ? "32px" : "30px";
    markerEl.style.fontSize = isPuddleMarker ? "17px" : "15px";
    markerEl.style.borderWidth = "2px";
    markerEl.style.boxShadow = isPuddleMarker
      ? "0 4px 10px rgba(14, 165, 233, 0.30)"
      : "0 2px 7px rgba(15, 23, 42, 0.14)";
  });
};
function App() {
  const KAKAO_REST_API_KEY = "1425cc58ea2a07e5aea6e01a9b0dac74";
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

useEffect(() => {
  const handlePopState = () => {
    // 뒤로가기를 누르면 무조건 홈 화면으로 상태 변경
    setCurrentView("home");
  };

  window.addEventListener("popstate", handlePopState);
  return () => window.removeEventListener("popstate", handlePopState);
}, []);

const [clientId] = useState(() => {
  let savedId = localStorage.getItem("wheelClientId");

  if (!savedId) {
    savedId = crypto.randomUUID();
    localStorage.setItem("wheelClientId", savedId);
  }

  return savedId;
});
// 💡 App 컴포넌트 시작 직후 선언부
const [userRole, setUserRole] = useState("user"); // 'admin' 또는 'user' (테스트용으로 기본 admin 설정)

// 무장애/위험 요소 마커들을 저장할 배열 상태 (기존 markers 배열이 있다면 합치거나 대체 가능)
// 💡 App 컴포넌트 내부 최상단 상태 정의 구역 수정
const [bfMarkers, setBfMarkers] = useState(() => {
  try {
    const cached = localStorage.getItem(MARKER_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    return [];
  }
});

const [isBfMarkersLoaded, setIsBfMarkersLoaded] = useState(() => {
  try {
    return !!localStorage.getItem(MARKER_CACHE_KEY);
  } catch (error) {
    return false;
  }
});

useEffect(() => {
  try {
    // 예전에 무거운 사진까지 저장했던 캐시 제거
    localStorage.removeItem("wheelWorldBfMarkersCache");
  } catch (error) {
    console.error("기존 무거운 캐시 삭제 실패:", error);
  }
}, []);

useEffect(() => {
  const markersRef = ref(db, "bfMarkers");

  const saveCache = (markers) => {
    try {
      localStorage.setItem(MARKER_CACHE_KEY, JSON.stringify(markers));
    } catch (error) {
      console.error("가벼운 아이콘 캐시 저장 실패:", error);
    }
  };

  const upsertMarker = (snapshot) => {
    const value = snapshot.val();
    const marker = makeLightMarker(snapshot.key, value);

    if (Number.isNaN(marker.lat) || Number.isNaN(marker.lng)) {
      return;
    }

    setBfMarkers((prev) => {
      const next = [
        ...prev.filter((item) => item.id !== marker.id),
        marker,
      ].sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));

      saveCache(next);
      return next;
    });

    setIsBfMarkersLoaded(true);
  };

  const removeMarkerFromState = (snapshot) => {
    const removedId = snapshot.key;

    setBfMarkers((prev) => {
      const next = prev.filter((item) => item.id !== removedId);
      saveCache(next);
      return next;
    });

    setIsBfMarkersLoaded(true);
  };

  const unsubscribeAdded = onChildAdded(markersRef, upsertMarker, (error) => {
    console.error("아이콘 추가 감지 실패:", error);
    setIsBfMarkersLoaded(true);
  });

  const unsubscribeChanged = onChildChanged(markersRef, upsertMarker, (error) => {
    console.error("아이콘 수정 감지 실패:", error);
    setIsBfMarkersLoaded(true);
  });

  const unsubscribeRemoved = onChildRemoved(
    markersRef,
    removeMarkerFromState,
    (error) => {
      console.error("아이콘 삭제 감지 실패:", error);
      setIsBfMarkersLoaded(true);
    }
  );

  const emptyTimer = setTimeout(() => {
    setIsBfMarkersLoaded(true);
  }, 1200);

  return () => {
    clearTimeout(emptyTimer);
    unsubscribeAdded();
    unsubscribeChanged();
    unsubscribeRemoved();
  };
}, []);

// App.js 내에 배치
const addOfficialMarker = async (newMarker) => {
  const markerToAdd = {
    ...newMarker,
    isOfficial: true,
    status: "approved",
    date: new Date().toLocaleDateString()
  };

  await push(
    ref(db, "bfMarkers"),
    markerToAdd
  );

  setTempMarker(null);
  setNewMarkerDesc("");
  setNewMarkerImage(null);
  setNewMarkerType("step");
};

// 주민제보와 안전길찾기에서 모두 사용할 통합 검색 함수
const handleMapSearch = async (e, currentSearchValue) => {
  e.preventDefault();
  
  const target = currentSearchValue.trim();
  if (!target) return;

  // 1. 고정 장소 리스트(locationPoints)에 있으면 즉시 이동
  if (locationPoints[target]) {
    if (mapRef.current) {
      mapRef.current.flyTo(locationPoints[target], 17, { animate: true, duration: 1.2 });
    }
    return;
  }

  // 2. 새로운 장소는 카카오 API로 정밀 검색
  try {
    const searchQuery = target.includes("고양") || target.includes("화정") 
      ? target 
      : `경기도 고양시 덕양구 화정동 ${target}`;

    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchQuery)}`,
      {
        headers: {
          // 🌟 발급받으신 실제 카카오 REST API 키를 넣어주세요!
          Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`
        }
      }
    );
    const data = await response.json();

    if (data.documents && data.documents.length > 0 && mapRef.current) {
      const lat = parseFloat(data.documents[0].y);
      const lng = parseFloat(data.documents[0].x);

      // 오픈스트리트맵 지도를 카카오가 찾은 정확한 좌표로 이동!
      mapRef.current.flyTo([lat, lng], 17, {
        animate: true,
        duration: 1.2
      });

      // 💡 [선택사항] 만약 안전길찾기 탭에서 목적지 좌표 상태(예: setDestination)가 있다면 
      // 여기에 연동해서 검색한 위치에 목적지 핀을 꽂아줄 수도 있습니다.
      // if (currentView === "search" && setDestination) {
      //   setDestination([lat, lng]);
      // }

    } else {
      alert(`'${target}'에 대한 정확한 위치를 찾을 수 없습니다.`);
    }
  } catch (error) {
    console.error("카카오 로컬 API 검색 에러:", error);
    alert("검색 중 오류가 발생했습니다.");
  }
};

// 등록 폼 제어를 위한 상태들
const [tempMarker, setTempMarker] = useState(null); // 지도 클릭 시 임시 마커 좌표
const handleSearchKeywordChange = async (value) => {
  setSearchKeyword(value);

  if (!value.trim()) {
    setSearchSuggestions([]);
    return;
  }

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(value)}&size=5`,
      {
        headers: {
          Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`
        }
      }
    );

    const data = await res.json();

    setSearchSuggestions(
      data.documents?.map(item => ({
        name: item.place_name,
        lat: Number(item.y),
        lng: Number(item.x)
      })) || []
    );
  } catch (err) {
    console.error(err);
  }
};
const handleSearchPlace = async () => {

  if (!searchKeyword.trim()) return;

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchKeyword)}`
  );

  const data = await response.json();

  if (!data.length) {
    alert("검색 결과가 없습니다.");
    return;
  }

  const lat = Number(data[0].lat);
  const lng = Number(data[0].lon);

  mapRef.current.flyTo([lat, lng], 18, {
    duration: 1.5
  });
};
const [searchKeyword, setSearchKeyword] = useState("");
const [searchSuggestions, setSearchSuggestions] = useState([]);
const [newMarkerType, setNewMarkerType] = useState("step");
const [hiddenMarkerTypes, setHiddenMarkerTypes] = useState([]);
const [isMarkerFilterOpen, setIsMarkerFilterOpen] = useState(false);
const isMarkerTypeVisible = (marker) => {
  if (!marker?.type) return true;
  return !hiddenMarkerTypes.includes(marker.type);
};

const toggleMarkerTypeVisibility = (type) => {
  setHiddenMarkerTypes((prev) =>
    prev.includes(type)
      ? prev.filter((item) => item !== type)
      : [...prev, type]
  );
};

const showAllMarkerTypes = () => {
  setHiddenMarkerTypes([]);
};
const [newMarkerDesc, setNewMarkerDesc] = useState("");
const [newMarkerImage, setNewMarkerImage] = useState(null);
// 5가지 안전/위험 요소 디자인 구성 설정
const bfConfig = {
  step: { label: "🪜 단차 / 계단", color: "#EF4444", icon: "🪜" },
  narrow: { label: "↔️ 좁은 도로", color: "#F59E0B", icon: "↔️" },
   obstacle: {
    label: "🚧 일시적 장애물 (공사/주차 차량 등)",
    color: "#DC2626",
    icon: "🚧",
},
   elevator: {
    label: "🛗 엘리베이터 위치",
    color: "#3B82F6",
    icon: "🛗",
  },

  slope: { label: "📐 경사도 / 오르막", color: "#10B981", icon: "📐" },
    sidewalk: {
    label: "🧱 보도블럭 파손",
    color: "#8B5CF6",
    icon: "🧱",
  },
  puddle: {
  label: "💧 웅덩이",
  color: "#0EA5E9",
  icon: "💧",
},
};
// ================================
// 마커 아이콘/색상/이름 통일 기준
// bfConfig를 기준으로 지도 표시, 설명창, 제보 선택 아이콘을 모두 통일
// ================================
const getUnifiedMarkerInfo = (type) => {
  const fallbackConfig =
    bfConfig.step || bfConfig.sidewalk || Object.values(bfConfig)[0];

  const config = bfConfig[type] || fallbackConfig;

  const icon = config.icon || "📍";
  const rawLabel = config.label || "기타";

  return {
    label: rawLabel.replace(icon, "").trim(),
    icon,
    color: config.color || "#64748B",
  };
};
const getBfConfig = (type) => {
  const normalizedType = type === "stairs" ? "step" : type;

  return (
    bfConfig[normalizedType] || {
      label: "기타",
      color: "#6B7280",
      icon: "📍"
    }
  );
};
const mapRef = useRef(null);
const surveyWatchRef = useRef(null);
const liveLocationWatchRef = useRef(null);
  const [currentView, setCurrentView] = useState("home");
  const [markers, setMarkers] = useState([]);
  const [selectedType, setSelectedType] = useState("step");
  const [userLocation, setUserLocation] = useState(null);
  const [isNavigationActive, setIsNavigationActive] = useState(false);
const [isNavigationFinished, setIsNavigationFinished] = useState(false);
const [distanceToDestination, setDistanceToDestination] = useState(null);
const [navigationMessage, setNavigationMessage] = useState("");
const [showNavigationFeedback, setShowNavigationFeedback] = useState(false);
const [navigationFeedbackRating, setNavigationFeedbackRating] = useState(0);
const [navigationFeedbackComment, setNavigationFeedbackComment] = useState("");
const [isSavingNavigationFeedback, setIsSavingNavigationFeedback] = useState(false);
const [
  navigationFeedbackSaved,
  setNavigationFeedbackSaved
] = useState(false);
const closeNavigationFeedbackModal = () => {
  setShowNavigationFeedback(false);
  setNavigationFeedbackSaved(false);
  setNavigationFeedbackRating(0);
  setNavigationFeedbackComment("");
};
  const [deviceHeading, setDeviceHeading] = useState(null);
  const compassHandlerRef = useRef(null);
  const isCompassTrackingRef = useRef(false);
  const [isSurveying, setIsSurveying] = useState(false);
  const [surveyTracks, setSurveyTracks] = useState([]);
const [surveyTrack, setSurveyTrack] = useState([]);
  const [startCoords, setStartCoords] = useState(null);
const [endCoords, setEndCoords] = useState(null);
 
const [isRainyMode, setIsRainyMode] = useState(DEFAULT_RAINY_MODE);
const [weatherInfo, setWeatherInfo] = useState(null);
useEffect(() => {
  let isCancelled = false;

  const loadWeatherInfo = async () => {
    try {
      const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

if (isLocalhost) {
  console.log(
    "🌦 로컬 개발 환경: 날씨 API 호출 생략. 배포 사이트에서는 자동 연동됩니다."
  );

  setIsRainyMode(DEFAULT_RAINY_MODE);
  setWeatherInfo(null);
  return;
}

const response = await fetch("/api/weather");
      const data = await response.json();

      if (isCancelled) return;

      if (data.ok) {
        setIsRainyMode(Boolean(data.isRainy));
        setWeatherInfo(data);

        console.log("🌦 기상청 날씨 정보:", data);
      } else {
        console.warn("기상청 날씨 정보 불러오기 실패:", data);
        setIsRainyMode(DEFAULT_RAINY_MODE);
      }
    } catch (error) {
      if (isCancelled) return;

      console.warn("기상청 날씨 정보 요청 오류:", error);
      setIsRainyMode(DEFAULT_RAINY_MODE);
    }
  };

  loadWeatherInfo();

  return () => {
    isCancelled = true;
  };
}, []);
  // 💡 5번 클릭 감지를 위한 상태 및 타이머 설정
const [clickCount, setClickCount] = useState(0);
const clickTimeoutRef = useRef(null);

const handleSecretDoorClick = () => {
  // 이전 타이머가 있다면 초기화
  if (clickTimeoutRef.current) {
    clearTimeout(clickTimeoutRef.current);
  }

  const nextCount = clickCount + 1;
  setClickCount(nextCount);

  if (nextCount === 5) {
    // 5번 연속 클릭 성공 시 관리자 모드 진입 및 횟수 리셋
    setCurrentView("admin");
    setClickCount(0);
  } else {
    // 1초(1000ms) 동안 다음 클릭이 없으면 누적 횟수 초기화
    clickTimeoutRef.current = setTimeout(() => {
      setClickCount(0);
    }, 1000);
  }
};
// 💡 관리자 로그인 입력값을 저장하는 상태 변수
const [adminEmailInput, setAdminEmailInput] = useState("");
const [adminPasswordInput, setAdminPasswordInput] = useState("");
// 💡 관리자 로그인 처리 함수
const ADMIN_EMAIL = "wheel0ff@naver.com";

const handleLogin = async (e) => {
  e.preventDefault();

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      adminEmailInput,
      adminPasswordInput
    );

    if (userCredential.user.email !== ADMIN_EMAIL) {
      await signOut(auth);
      alert("관리자 계정이 아닙니다.");
      return;
    }

    alert("관리자 인증에 성공했습니다!");

    setIsAdminLoggedIn(true);
    setUserRole("admin");
    setCurrentView("home");

    setAdminEmailInput("");
    setAdminPasswordInput("");
  } catch (error) {
    console.error("관리자 로그인 실패:", error);
    alert("이메일 또는 비밀번호가 일치하지 않습니다.");
  }
};
const handleLogout = async () => {
  try {
    await signOut(auth);

    setIsAdminLoggedIn(false);
    setUserRole("user");
    setCurrentView("home");

    alert("관리자 로그아웃 되었습니다.");
  } catch (error) {
    console.error("로그아웃 실패:", error);
    alert("로그아웃 중 오류가 발생했습니다.");
  }
};
const downloadBfMarkersBackup = async () => {
  if (!isAdminLoggedIn) {
    alert("관리자만 백업할 수 있습니다.");
    return;
  }

  const downloadJsonFile = (data, filename) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], {
      type: "application/json;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  try {
    const snapshot = await get(ref(db, "bfMarkers"));
    const data = snapshot.val();

    if (!data) {
      alert("백업할 아이콘 데이터가 없습니다.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const entries = Object.entries(data);

    const markerListWithoutImages = [];
    const imageChunks = [];

    let currentImageChunk = {};
    let currentChunkSize = 0;
    const MAX_CHUNK_SIZE = 900000; // 약 0.9MB 단위로 사진 백업 분할

    entries.forEach(([id, value]) => {
      const { image, ...markerWithoutImage } = value || {};

      markerListWithoutImages.push({
        id,
        ...markerWithoutImage,
        hasImage: !!image || value?.hasImage === true,
      });

      if (image) {
        const imageData = {
          image,
          backedUpFrom: `bfMarkers/${id}/image`,
        };

        const imageSize = image.length;

        if (
          currentChunkSize > 0 &&
          currentChunkSize + imageSize > MAX_CHUNK_SIZE
        ) {
          imageChunks.push(currentImageChunk);
          currentImageChunk = {};
          currentChunkSize = 0;
        }

        currentImageChunk[id] = imageData;
        currentChunkSize += imageSize;
      }
    });

    if (Object.keys(currentImageChunk).length > 0) {
      imageChunks.push(currentImageChunk);
    }

    const markerBackup = {
      backedUpAt: new Date().toISOString(),
      count: markerListWithoutImages.length,
      note:
        "이 파일은 지도용 아이콘 정보 백업입니다. 사진은 별도 image chunk 파일에 나뉘어 저장됩니다.",
      bfMarkers: markerListWithoutImages,
    };

    downloadJsonFile(
      markerBackup,
      `wheel-the-world-bfMarkers-light-backup-${today}.json`
    );

    imageChunks.forEach((chunk, index) => {
      const imageBackup = {
        backedUpAt: new Date().toISOString(),
        chunkIndex: index + 1,
        totalChunks: imageChunks.length,
        note:
          "이 파일은 아이콘 사진 백업입니다. key는 bfMarkers의 아이콘 id와 같습니다.",
        bfMarkerImages: chunk,
      };

      downloadJsonFile(
        imageBackup,
        `wheel-the-world-bfMarker-images-backup-${today}-part-${
          index + 1
        }-of-${imageChunks.length}.json`
      );
    });

    alert(
      `${markerListWithoutImages.length}개의 아이콘 정보를 백업했습니다.\n사진 백업 파일은 ${imageChunks.length}개로 나누어 저장됩니다.\n브라우저가 여러 파일 다운로드 허용을 물으면 허용해 주세요.`
    );
  } catch (error) {
    console.error("백업 실패:", error);
    alert("백업 중 오류가 발생했습니다. 콘솔을 확인해 주세요.");
  }
};
const migrateExistingMarkerImages = async () => {
  if (!isAdminLoggedIn) {
    alert("관리자만 사진 정리를 할 수 있습니다.");
    return;
  }

  const ok = window.confirm(
    "기존 아이콘 사진을 새 저장 위치로 옮깁니다.\n\n" +
      "반드시 Firebase 콘솔에서 JSON 백업을 먼저 했을 때만 진행하세요.\n\n" +
      "진행할까요?"
  );

  if (!ok) return;

  const markersRef = ref(db, "bfMarkers");

  let scannedCount = 0;
  let migratedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let finished = false;
  let idleTimer = null;
  let unsubscribe = null;

  const finish = () => {
    if (finished) return;
    finished = true;

    if (unsubscribe) {
      unsubscribe();
    }

    alert(
      "사진 정리가 끝났습니다.\n\n" +
        `확인한 아이콘: ${scannedCount}개\n` +
        `옮긴 사진: ${migratedCount}개\n` +
        `이미 정리됨/사진 없음: ${skippedCount}개\n` +
        `실패: ${failedCount}개`
    );
  };

  unsubscribe = onChildAdded(
    markersRef,
    async (snapshot) => {
      if (idleTimer) {
        clearTimeout(idleTimer);
      }

      scannedCount += 1;

      const id = snapshot.key;
      const value = snapshot.val() || {};

      try {
        if (!value.image) {
          skippedCount += 1;
        } else {
          const existingNewImageSnapshot = await get(
            ref(db, `bfMarkerImages/${id}/image`)
          );

          if (!existingNewImageSnapshot.exists()) {
            await set(ref(db, `bfMarkerImages/${id}`), {
              image: value.image,
              updatedAt: Date.now(),
              migratedFrom: `bfMarkers/${id}/image`,
            });
          }

          await update(ref(db, `bfMarkers/${id}`), {
            image: null,
            hasImage: true,
            imageMigratedAt: Date.now(),
          });

          migratedCount += 1;
        }
      } catch (error) {
        console.error("사진 정리 실패:", id, error);
        failedCount += 1;
      }

      idleTimer = setTimeout(finish, 2500);
    },
    (error) => {
      console.error("사진 정리 중 오류:", error);
      failedCount += 1;
      finish();
    }
  );

  idleTimer = setTimeout(finish, 2500);
};
// 💡 관리자 로그인 성공 여부를 저장하는 상태 (기본값은 false)
const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user && user.email === ADMIN_EMAIL) {
      setIsAdminLoggedIn(true);
      setUserRole("admin");
    } else {
      setIsAdminLoggedIn(false);
      setUserRole("user");
    }
  });

  return () => unsubscribe();
}, []);
const navigateTo = (view) => {
  setCurrentView(view);
  // 브라우저 주소창 기록에 현재 상태를 추가 (뒤로가기 대비)
  window.history.pushState({ view }, "", `/${view}`);
};
  // 💡 App 컴포넌트 시작 직후 (기존 선언부 자리에 덮어쓰기)
const [startPoint, setStartPoint] = useState("");
const [endPoint, setEndPoint] = useState("");
const [startSuggestions, setStartSuggestions] = useState([]); // 출발지 자동완성 추천 목록
const [endSuggestions, setEndSuggestions] = useState([]);     // 목적지 자동완성 추천 목록

// 입력어에 따라 카카오 추천 장소를 가져오는 함수
const fetchAutoComplete = async (keyword, setSuggestions) => {
  const trimmed = keyword.trim();
  if (!trimmed || trimmed.length < 2) { // 2글자 이상 입력했을 때부터 검색 시작
    setSuggestions([]);
    return;
  }

  try {
    // 화정동 주변 위주로 장소를 찾기 위해 행정구역명을 조합합니다.
    const query = trimmed.includes("고양") || trimmed.includes("화정") ? trimmed : `고양 화정 ${trimmed}`;
    
    const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`, {
      headers: { 
        // 🔑 발급받으신 실제 카카오 REST API 키를 넣어주세요!
        Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`
      }
    });
    const data = await res.json();

    if (data.documents) {
      // 카카오가 찾아준 실제 정확한 장소명(place_name)들만 추출해서 상태에 저장
      const names = data.documents.map(doc => doc.place_name);
      setSuggestions(names);
    }
  } catch (err) {
    console.error("자동완성 데이터 로드 실패:", err);
  }
};
const [routeSteps, setRouteSteps] = useState([]);
const [routeInfo, setRouteInfo] = useState(null);
const [routeMode, setRouteMode] = useState("normal");
const [wheelLevel, setWheelLevel] = useState(1);
const [routeGuide, setRouteGuide] = useState([]);         
const [isRouteSearched, setIsRouteSearched] = useState(false);
const [animatedRoute, setAnimatedRoute] = useState([]);
const [startMarkerPos, setStartMarkerPos] = useState(null);
const [endMarkerPos, setEndMarkerPos] = useState(null);
const animationRef = useRef(null);
const [isFollowingUser, setIsFollowingUser] = useState(false);
const [isAdmin, setIsAdmin] = useState(false);


    
// ✨ 한글 선택지로도 바로 위도/경도를 매칭할 수 있도록 키값을 확장했습니다!
const locationPoints = {
  station: [37.6345, 126.832],  
  office: [37.6373, 126.8315],  
  park: [37.6332, 126.8355],    
  library: [37.6391, 126.834],  
  "화정역": [37.6345, 126.832],
  "덕양구청": [37.6373, 126.8315],
  "화정 중앙공원": [37.6332, 126.8355],
  "화정도서관": [37.6391, 126.834],
};

const animateWheelTrack = (fullRoute) => {
  if (!fullRoute || fullRoute.length === 0) return;
  
  let currentStep = 0;
  const totalSteps = 120; 
  
  if (animationRef.current) cancelAnimationFrame(animationRef.current);

  const updateTrack = () => {
    currentStep++;
    const progress = currentStep / totalSteps;

    if (progress >= 1) {
      setAnimatedRoute(fullRoute);
      cancelAnimationFrame(animationRef.current);
      return;
    }

    const totalSegments = fullRoute.length - 1;
    const currentProgressFull = progress * totalSegments;
    const segmentIndex = Math.floor(currentProgressFull);
    const segmentProgress = currentProgressFull - segmentIndex;
    


    const currentSegmentStart = fullRoute[segmentIndex];
    const currentSegmentEnd = fullRoute[segmentIndex + 1];

    if (currentSegmentStart && currentSegmentEnd) {
      const lat = currentSegmentStart[0] + (currentSegmentEnd[0] - currentSegmentStart[0]) * segmentProgress;
      const lng = currentSegmentStart[1] + (currentSegmentEnd[1] - currentSegmentStart[1]) * segmentProgress;
      const currentPos = [lat, lng];

      // 리플렛이 좋아하는 [[위도, 경도]] 순수 배열 형태로 변환하여 병합
      const passedRoute = fullRoute.slice(0, segmentIndex + 1).map(pt => [pt[0], pt[1]]);
      setAnimatedRoute([...passedRoute, currentPos]);
    }

    animationRef.current = requestAnimationFrame(updateTrack);
  };

  animationRef.current = requestAnimationFrame(updateTrack);
};

const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjZiMjY1Y2E5NjZjODQxZmE5MjJjNDEzM2IyYWNhN2U2IiwiaCI6Im11cm11cjY0In0=";
const getObstacles = (mode, bfMarkers, start, end) => {
  // 일반길은 장애물 회피를 아예 넣지 않음
  if (mode === "normal" || !Array.isArray(bfMarkers) || bfMarkers.length === 0) {
    return null;
  }

  const modeSettings = {
    // 바퀴길: 2단계 위험만 회피
    wheel2: {
      label: "바퀴길",
      levels: [2],
      maxAvoidCount: 8,
      buffer: 0.00008,
    },

    // 바퀴+길: 2단계 우선 회피 + 1단계도 일부 회피
    wheel1: {
      label: "바퀴+길",
      levels: [2, 1],
      maxAvoidCount: 12,
      buffer: 0.00008,
    },
  };

  const setting = modeSettings[mode];

  if (!setting) {
    return null;
  }

  const startLat = Number(start?.lat);
  const startLng = Number(start?.lng);
  const endLat = Number(end?.lat);
  const endLng = Number(end?.lng);

  const hasRouteBounds =
    !Number.isNaN(startLat) &&
    !Number.isNaN(startLng) &&
    !Number.isNaN(endLat) &&
    !Number.isNaN(endLng);

  // 출발지~목적지 주변만 후보로 사용
  // 너무 먼 장애물까지 ORS에 보내면 요청이 무거워짐
  const margin = 0.005;

  const minLat = hasRouteBounds
    ? Math.min(startLat, endLat) - margin
    : -Infinity;

  const maxLat = hasRouteBounds
    ? Math.max(startLat, endLat) + margin
    : Infinity;

  const minLng = hasRouteBounds
    ? Math.min(startLng, endLng) - margin
    : -Infinity;

  const maxLng = hasRouteBounds
    ? Math.max(startLng, endLng) + margin
    : Infinity;

  const toXY = (lat, lng) => {
    const baseLat = hasRouteBounds
      ? ((startLat + endLat) / 2) * (Math.PI / 180)
      : Number(lat) * (Math.PI / 180);

    return {
      x: Number(lng) * Math.cos(baseLat) * 111320,
      y: Number(lat) * 110540,
    };
  };

  const getDistanceToRouteLine = (marker) => {
    if (!hasRouteBounds) return 0;

    const point = toXY(marker.lat, marker.lng);
    const a = toXY(startLat, startLng);
    const b = toXY(endLat, endLng);

    const dx = b.x - a.x;
    const dy = b.y - a.y;

    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      return Math.sqrt(
        Math.pow(point.x - a.x, 2) + Math.pow(point.y - a.y, 2)
      );
    }

    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq
      )
    );

    const projected = {
      x: a.x + dx * t,
      y: a.y + dy * t,
    };

    return Math.sqrt(
      Math.pow(point.x - projected.x, 2) +
        Math.pow(point.y - projected.y, 2)
    );
  };

  const approvedMarkers = bfMarkers
    .filter((m) => {
      const lat = Number(m?.lat);
      const lng = Number(m?.lng);
      const level = Number(m?.wheelLevel || 0);

      return (
        m &&
        (m.status === "approved" || m.isOfficial === true) &&
        m.type !== "puddle" &&
        setting.levels.includes(level) &&
        !Number.isNaN(lat) &&
        !Number.isNaN(lng) &&
        lat >= minLat &&
        lat <= maxLat &&
        lng >= minLng &&
        lng <= maxLng
      );
    })
    .map((m) => ({
      ...m,
      lat: Number(m.lat),
      lng: Number(m.lng),
      wheelLevel: Number(m.wheelLevel || 0),
    }));

  if (approvedMarkers.length === 0) {
    console.log("🧱 회피 마커 없음:", {
      mode,
      label: setting.label,
    });

    return null;
  }

  // 거의 같은 위치의 마커 중복 제거
  // 같은 구역에 여러 번 찍힌 마커가 ORS 요청을 불필요하게 무겁게 만드는 것 방지
  const groupedByLocation = new Map();

  approvedMarkers.forEach((marker) => {
    const key = `${marker.lat.toFixed(4)}_${marker.lng.toFixed(4)}`;
    const previous = groupedByLocation.get(key);

    // 같은 위치면 더 위험한 단계가 높은 마커를 남김
    if (!previous || marker.wheelLevel > previous.wheelLevel) {
      groupedByLocation.set(key, marker);
    }
  });

  const dedupedMarkers = Array.from(groupedByLocation.values());

  const sortedMarkers = dedupedMarkers
    .map((marker) => ({
      ...marker,
      distanceToRouteLine: getDistanceToRouteLine(marker),
    }))
    .sort((a, b) => {
      // 2단계 위험을 먼저 보냄
      if (b.wheelLevel !== a.wheelLevel) {
        return b.wheelLevel - a.wheelLevel;
      }

      // 그다음 실제 경로 직선에 가까운 장애물을 먼저 보냄
      return a.distanceToRouteLine - b.distanceToRouteLine;
    });

  const selectedMarkers = sortedMarkers.slice(0, setting.maxAvoidCount);

  console.log("🧱 회피 마커 정리:", {
    mode,
    label: setting.label,
    approvedCount: approvedMarkers.length,
    dedupedCount: dedupedMarkers.length,
    sentCount: selectedMarkers.length,
    level2Sent: selectedMarkers.filter((m) => Number(m.wheelLevel) === 2).length,
    level1Sent: selectedMarkers.filter((m) => Number(m.wheelLevel) === 1).length,
  });

  if (selectedMarkers.length === 0) {
    return null;
  }

  const polygons = selectedMarkers.map((marker) => {
    const buffer = setting.buffer;

    return [
      [
        [marker.lng - buffer, marker.lat - buffer],
        [marker.lng + buffer, marker.lat - buffer],
        [marker.lng + buffer, marker.lat + buffer],
        [marker.lng - buffer, marker.lat + buffer],
        [marker.lng - buffer, marker.lat - buffer],
      ],
    ];
  });

  return {
    type: "MultiPolygon",
    coordinates: polygons,
  };
};
const getRoute = async (start, end, mode = "normal", bfMarkers = []) => {
  const emptyRouteResult = (reason = "UNKNOWN") => ({
    routeCoords: [],
    distance: 0,
    duration: 0,
    reason,
  });

  try {
    const avoidOptions = getObstacles(mode, bfMarkers, start, end);

    const bodyData = {
      coordinates: [
        [start.lng, start.lat],
        [end.lng, end.lat],
      ],
    };

    if (avoidOptions) {
      bodyData.options = {
        avoid_polygons: avoidOptions,
      };
    }

    console.log("🚗 ORS 요청 모드:", mode);
    console.log("🚗 ORS 요청 bodyData:", JSON.stringify(bodyData, null, 2));

    const url =
      "https://api.openrouteservice.org/v2/directions/wheelchair/geojson";

    const fetchRouteOnce = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      try {
        return await fetch(url, {
          method: "POST",
          headers: {
            Authorization: ORS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bodyData),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    };

    let res = await fetchRouteOnce();

    if (res.status === 502 || res.status === 503 || res.status === 504) {
      console.warn(
        "ORS 서버 오류. 1초 후 한 번 더 시도합니다:",
        res.status
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));
      res = await fetchRouteOnce();
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");

      console.error("ORS 응답 실패:", {
        status: res.status,
        errorText,
      });

      if (res.status === 401 || res.status === 403) {
        return emptyRouteResult("AUTH_ERROR");
      }

      if (res.status === 429) {
        return emptyRouteResult("RATE_LIMIT");
      }

      if (res.status === 502 || res.status === 503 || res.status === 504) {
        return emptyRouteResult("SERVER_ERROR");
      }

      return emptyRouteResult("ROUTE_ERROR");
    }

    const data = await res.json();

    if (data.error) {
      console.error("API 에러 상세:", data.error);

      if (data.error.code === 2009) {
        return emptyRouteResult("NO_ROUTE");
      }

      return emptyRouteResult("ROUTE_ERROR");
    }

    if (!data.features || data.features.length === 0) {
      return emptyRouteResult("NO_ROUTE");
    }

    const routeCoords = data.features[0].geometry.coordinates.map(
      ([lng, lat]) => [lat, lng]
    );

    const summary = data.features[0].properties.summary;

    return {
      routeCoords,
      distance: (summary.distance / 1000).toFixed(1),
      duration: Math.round(summary.duration / 60),
      reason: "OK",
    };
  } catch (err) {
    console.error("getRoute 오류:", err);

    if (err.name === "AbortError") {
      return emptyRouteResult("TIMEOUT");
    }

    return emptyRouteResult("NETWORK_ERROR");
  }
};
const handleSearchRoute = async (e) => {
  e.preventDefault();

  // 인풋 양쪽 공백 제거
  const start = startPoint ? startPoint.trim() : "";
  const end = endPoint ? endPoint.trim() : "";

  if (!start || !end) {
    alert("출발지와 목적지를 모두 입력하거나 선택해 주세요!");
    return;
  }

  if (start === end) {
    alert("출발지와 목적지가 같습니다.");
    return;
  }

  try {
    // 🔑 카카오 로컬 API 검색용 헬퍼 함수
    const searchKakaoCoords = async (placeName) => {
      // 이미 기존 고정 리스트(locationPoints)에 완벽히 일치하는 단어면 즉시 {lat, lng} 객체로 반환
      if (locationPoints[placeName]) {
        const coords = locationPoints[placeName];
        return { lat: coords[0], lng: coords[1] };
      }

      // 목록에 없는 새로운 단어(세이브존 등)면 카카오 API 호출
      const query = placeName.includes("고양") || placeName.includes("화정") 
        ? placeName 
        : `경기도 고양시 덕양구 화정동 ${placeName}`;
      
      const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`, {
        headers: { 
          // 🌟 여기에 실제 카카오 REST API 키를 넣어주세요!
          Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`
        }
      });
      const data = await res.json();
      
      if (data.documents && data.documents.length > 0) {
        return {
          lat: parseFloat(data.documents[0].y), // 위도
          lng: parseFloat(data.documents[0].x)  // 경도
        };
      }
      return null;
    };

    // 🔍 출발지와 목적지 좌표를 카카오/고정목록 하이브리드로 가져오기
    // 내 위치일 때는 저장된 좌표를 쓰고, 아니면 검색함
let startPos;


if (start === "내 위치") {
  if (!userLocation || userLocation.length < 2) {
    alert("현재 위치를 먼저 가져와 주세요!");
    return;
  }

  startPos = {
    lat: userLocation[0],
    lng: userLocation[1]
  };
} else {
  startPos = await searchKakaoCoords(start);
}

let endPos;

if (end === "내 위치") {
  if (!userLocation || userLocation.length < 2) {
    alert("현재 위치를 먼저 가져와 주세요!");
    return;
  }

  endPos = {
    lat: userLocation[0],
    lng: userLocation[1]
  };
} else {
  endPos = await searchKakaoCoords(end);
}

// 만약 '내 위치'를 눌렀는데 startCoords가 null이면 오류 방지
if (start === "내 위치" && !startCoords) {
  alert("현재 위치를 먼저 가져와 주세요!");
  return;
}


    if (!startPos || !endPos) {
      alert("장소의 좌표를 찾을 수 없습니다. 정확한 명칭인지 확인해 주세요!");
      return;
    }

    // 📍 원래 코드 포맷인 배열 형태로 마커 위치 저장 [lat, lng]
    setStartMarkerPos([startPos.lat, startPos.lng]);
    setEndMarkerPos([endPos.lat, endPos.lng]);

    // 🔥 2. 경로 생성 (getRoute 함수가 {lat, lng} 객체를 정상적으로 받도록 전달)
    const approvedRouteMarkers = bfMarkers.filter(
  (m) => m.status === "approved" || m.isOfficial === true
);

const result = await getRoute(
  startPos,
  endPos,
  routeMode,
  approvedRouteMarkers
);
const route = result.routeCoords;
setRouteInfo({
  distance: result.distance,
  duration: result.duration
});


    if (!route || route.length === 0) {
  if (result.reason === "TIMEOUT") {
    alert("경로 서버 응답이 너무 오래 걸립니다. 잠시 후 다시 시도해 주세요.");
  } else if (result.reason === "SERVER_ERROR") {
    alert("경로 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.");
  } else if (result.reason === "NETWORK_ERROR") {
    alert("경로 서버 요청에 실패했습니다. 인터넷 연결 또는 ORS 서버 상태를 확인해 주세요.");
  } else if (result.reason === "AUTH_ERROR") {
    alert("경로 API 키 인증에 문제가 있습니다. ORS API 키를 확인해 주세요.");
  } else if (result.reason === "RATE_LIMIT") {
    alert("경로 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
  } else if (result.reason === "NO_ROUTE") {
    alert("해당 출발지와 목적지 사이에서 경로를 찾지 못했습니다. 위치를 조금 조정해 주세요.");
  } else {
    alert("경로 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
  }

  return;
}

    // 🔥 3. 지도 이동
    if (mapRef.current && typeof mapRef.current.fitBounds === "function") {
  mapRef.current.fitBounds(route, {
    padding: [50, 50],
  });
}

    // 🔥 4. 지도 경로 저장
    resetVoiceGuide();
setRouteSteps(route);

stopLiveLocationTracking();
setIsNavigationActive(false);
setIsNavigationFinished(false);
setNavigationMessage("");
setDistanceToDestination(null);

    // 🔥 5. 안내문 처리
    let guide = ["📍 출발지에서 이동 시작"];
    // 고정 예시 조합일 때만 특수 안내문 띄우기
    if (start === "화정역" && end === "덕양구청") {
      guide.push("🚶 횡단보도 단차 구간 주의");
      guide.push("♿ 경사로 이용 추천");
    } else {
      guide.push("🚶 안전 보행 경로 안내");
    }
    guide.push("🏁 도착");

    setRouteGuide(guide);
    setIsRouteSearched(true);
    
    // 휠체어 바퀴 자국 애니메이션 실행
    setAnimatedRoute([]);
    setTimeout(() => {
      animateWheelTrack(route);
    }, 1600);

  } catch (err) {
    console.error("최종 경로 탐색 에러:", err);
    alert("삐빅! 경로 생성 중 오류 발생!");
  }
};

// 💡 이미지 첨부 시 호출되는 Base64 인코더
const handleBfImageChange = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewMarkerImage(reader.result); // 이미지 문자열 상태 저장
    };
    reader.readAsDataURL(file);
  }
};

// 관리자 승인 페이지 예시 코드

const pendingMarkers = bfMarkers.filter(m => m.status === 'pending');



// 승인 함수

const approveMarker = async (id) => {
  await update(ref(db, `bfMarkers/${id}`), {
    status: "approved"
  });
};

// 💡 새 마커 최종 등록 함수 (관리자 전용)
const handleAddBfMarker = async () => {
  if (!isAdminLoggedIn) {
    alert("권한이 없습니다. 관리자 로그인 후 이용해주세요.");
    return;
  }

  

  const newBfData = {
    lat: tempMarker.lat,
    lng: tempMarker.lng,
    type: newMarkerType,
    desc: newMarkerDesc,
    image: newMarkerImage,
    date: new Date().toLocaleDateString(),
    wheelLevel,
    status: "approved",
    isOfficial: true,
  };

  await push(ref(db, "bfMarkers"), newBfData);

  setTempMarker(null);
  setNewMarkerDesc("");
  setNewMarkerImage(null);
  setNewMarkerType("step");
};
const startCompassTracking = async () => {
  if (!window.DeviceOrientationEvent) {
    return;
  }

  if (isCompassTrackingRef.current) {
    return;
  }

  if (!compassHandlerRef.current) {
    compassHandlerRef.current = (event) => {
      let heading = null;

      // iPhone Safari 계열
      if (typeof event.webkitCompassHeading === "number") {
        heading = event.webkitCompassHeading;
      }

      // Android Chrome 계열
      else if (typeof event.alpha === "number") {
        heading = 360 - event.alpha;
      }

      if (heading === null) return;

      const normalizedHeading = ((heading % 360) + 360) % 360;
      setDeviceHeading(normalizedHeading);
    };
  }

  try {
    // iPhone은 사용자가 버튼을 누른 직후 권한 요청을 해야 함
    if (
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      const permission = await DeviceOrientationEvent.requestPermission();

      if (permission !== "granted") {
        return;
      }
    }

    window.addEventListener(
      "deviceorientationabsolute",
      compassHandlerRef.current,
      true
    );

    window.addEventListener(
      "deviceorientation",
      compassHandlerRef.current,
      true
    );

    isCompassTrackingRef.current = true;
  } catch (error) {
    console.error("방향 센서 권한 오류:", error);
  }
};
const toLatLngObject = (position) => {
  if (!position) return null;

  const lat = Array.isArray(position)
    ? Number(position[0])
    : Number(position.lat);

  const lng = Array.isArray(position)
    ? Number(position[1])
    : Number(position.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  return { lat, lng };
};

const getDistanceMeters = (a, b) => {
  const pointA = toLatLngObject(a);
  const pointB = toLatLngObject(b);

  if (!pointA || !pointB) return Infinity;

  const R = 6371000;
  const lat1 = (pointA.lat * Math.PI) / 180;
  const lat2 = (pointB.lat * Math.PI) / 180;
  const dLat = ((pointB.lat - pointA.lat) * Math.PI) / 180;
  const dLng = ((pointB.lng - pointA.lng) * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const findNearestPointOnRoute = (rawPosition, route = []) => {
  const raw = toLatLngObject(rawPosition);

  if (!raw || !route || route.length < 2) {
    return null;
  }

  let bestPoint = null;
  let bestDistance = Infinity;

  for (let i = 0; i < route.length - 1; i += 1) {
    const start = toLatLngObject(route[i]);
    const end = toLatLngObject(route[i + 1]);

    if (!start || !end) continue;

    const lat0 = (raw.lat * Math.PI) / 180;

    const project = (p) => ({
      x: p.lng * Math.cos(lat0) * 111320,
      y: p.lat * 110540,
    });

    const rawP = project(raw);
    const startP = project(start);
    const endP = project(end);

    const dx = endP.x - startP.x;
    const dy = endP.y - startP.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) continue;

    const t = Math.max(
      0,
      Math.min(
        1,
        ((rawP.x - startP.x) * dx + (rawP.y - startP.y) * dy) / lengthSq
      )
    );

    const nearest = {
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
    };

    const distance = getDistanceMeters(raw, nearest);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestPoint = nearest;
    }
  }

  if (!bestPoint) return null;

  return {
    ...bestPoint,
    distance: bestDistance,
  };
};
const stopLiveLocationTracking = () => {
  if (liveLocationWatchRef.current !== null) {
    navigator.geolocation.clearWatch(liveLocationWatchRef.current);
    liveLocationWatchRef.current = null;
  }
};

const stopNavigation = () => {
  stopLiveLocationTracking();

  setIsNavigationActive(false);
  setIsNavigationFinished(false);
  setNavigationMessage("");
  setDistanceToDestination(null);
};
const finishNavigationAndOpenFeedback = () => {
  voiceSpeak("안내를 종료합니다.", { force: true });
  stopNavigation();

  setNavigationFeedbackRating(0);
  setNavigationFeedbackComment("");
  setNavigationFeedbackSaved(false);
  setShowNavigationFeedback(true);
};

const saveNavigationFeedback = async () => {
  if (!navigationFeedbackRating) {
    alert("별점을 선택해 주세요.");
    return;
  }

  try {
    setIsSavingNavigationFeedback(true);

    await push(ref(db, "routeFeedbacks"), {
      rating: Number(navigationFeedbackRating),
      comment: navigationFeedbackComment.trim(),
      createdAt: Date.now(),
      createdAtText: new Date().toLocaleString(),
      clientId: getWheelWorldClientId(),

      routeSummary: {
        distance: routeInfo?.distance || null,
        duration: routeInfo?.duration || null,
        obstacleCount: routeInfo?.obstacleCount ?? null,
      },

      startMarkerPos: startMarkerPos
        ? {
            lat: Array.isArray(startMarkerPos)
              ? Number(startMarkerPos[0])
              : Number(startMarkerPos.lat),
            lng: Array.isArray(startMarkerPos)
              ? Number(startMarkerPos[1])
              : Number(startMarkerPos.lng),
          }
        : null,

      endMarkerPos: endMarkerPos
        ? {
            lat: Array.isArray(endMarkerPos)
              ? Number(endMarkerPos[0])
              : Number(endMarkerPos.lat),
            lng: Array.isArray(endMarkerPos)
              ? Number(endMarkerPos[1])
              : Number(endMarkerPos.lng),
          }
        : null,
    });

    
    setNavigationFeedbackSaved(true);
    setNavigationFeedbackRating(0);
    setNavigationFeedbackComment("");
  } catch (error) {
    console.error("경로 후기 저장 실패:", error);
    alert("의견 저장 중 오류가 발생했습니다.");
  } finally {
    setIsSavingNavigationFeedback(false);
  }
};
const startLiveLocationTracking = async ({
  navigationMode = false,
  route = [],
  destination = null,
  centerMap = true,
  followMap = false,
  onFirstLocation = null,
} = {}) => {
  await startCompassTracking();

  if (!navigator.geolocation) {
    alert("이 브라우저에서는 GPS를 지원하지 않습니다.");
    return;
  }

  stopLiveLocationTracking();

  let hasFirstLocation = false;
  let hasCenteredMapOnce = false;

  if (navigationMode) {
    setIsNavigationActive(true);
    setIsNavigationFinished(false);
    setNavigationMessage("안내를 시작합니다.");
  }

  const handlePosition = (position) => {
    const rawLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };

    if (!hasFirstLocation) {
      hasFirstLocation = true;

      if (typeof onFirstLocation === "function") {
        onFirstLocation(rawLocation);
      }
    }

    let displayLocation = rawLocation;

    if (navigationMode && route && route.length >= 2) {
      const nearest = findNearestPointOnRoute(rawLocation, route);

      // GPS가 경로에서 너무 멀리 튀면 실제 위치를 보여주고,
      // 경로 근처면 파란 점을 경로선 위에 붙여서 보여줌.
      if (nearest && nearest.distance <= 35) {
        displayLocation = {
          lat: nearest.lat,
          lng: nearest.lng,
        };
      }
    }

    setUserLocation([displayLocation.lat, displayLocation.lng]);
    if (navigationMode && route && route.length > 1) {
  announceVoiceNavigation({
    currentPosition: displayLocation,
    route,
    destination,
    markers: bfMarkers,
  });
}
    

// 안내 중이면서 followMap이 켜진 경우에만
// 지도 화면이 계속 사용자를 따라가게 함
setIsFollowingUser(navigationMode && followMap);

const shouldMoveMap =
  centerMap && (followMap || !hasCenteredMapOnce);

if (shouldMoveMap && mapRef.current) {
  const nextCenter = [displayLocation.lat, displayLocation.lng];

  if (typeof mapRef.current.setView === "function") {
    mapRef.current.setView(nextCenter, 17);
  } else if (typeof mapRef.current.flyTo === "function") {
    mapRef.current.flyTo(nextCenter, 17);
  } else if (
    typeof mapRef.current.panTo === "function" &&
    window.kakao?.maps
  ) {
    mapRef.current.panTo(
      new window.kakao.maps.LatLng(
        displayLocation.lat,
        displayLocation.lng
      )
    );
  } else if (
    typeof mapRef.current.setCenter === "function" &&
    window.kakao?.maps
  ) {
    mapRef.current.setCenter(
      new window.kakao.maps.LatLng(
        displayLocation.lat,
        displayLocation.lng
      )
    );
  }

  hasCenteredMapOnce = true;
}

    if (navigationMode && destination) {
      const distance = getDistanceMeters(rawLocation, destination);
      const roundedDistance = Math.round(distance);

      setDistanceToDestination(roundedDistance);

      if (distance <= 20) {
        stopLiveLocationTracking();

        setIsNavigationActive(false);
        setIsNavigationFinished(true);
        setNavigationMessage("도착했습니다.");
        setDistanceToDestination(0);

        alert("목적지 근처에 도착했습니다.");
      } else {
        setNavigationMessage(`안내 중 · 도착까지 약 ${roundedDistance}m`);
      }
    }
  };

  const handleError = (error) => {
  console.error("실시간 위치 추적 오류:", error);
  alert("현재 위치를 계속 추적할 수 없습니다. 위치 권한을 확인해 주세요.");
  stopLiveLocationTracking();
  resetVoiceGuide();
  setIsNavigationActive(false);
};

  liveLocationWatchRef.current = navigator.geolocation.watchPosition(
    handlePosition,
    handleError,
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000,
    }
  );
};
// setPoint 파라미터를 추가합니다. (예: setStartPoint 또는 setEndPoint)
const moveToMyLocation = async (setPoint, setCoords) => {
  await startLiveLocationTracking({
  navigationMode: false,
  centerMap: true,
  followMap: false,
  onFirstLocation: (rawLocation) => {
      const myLocation = [rawLocation.lat, rawLocation.lng];

      setUserLocation(myLocation);

      if (setCoords) {
        setCoords({
          lat: rawLocation.lat,
          lng: rawLocation.lng,
        });
      }

      if (typeof setPoint === "function") {
        setPoint("내 위치");
      }
    },
  });
};
useEffect(() => {
  return () => {
    stopLiveLocationTracking();
  };
}, []);

useEffect(() => {
  if (currentView !== "search" && currentView !== "create") {
    return;
  }

  let intervalId = null;
  let timeoutId1 = null;
  let timeoutId2 = null;

  const applyMarkerStyleByZoom = () => {
    const map = mapRef.current;

    if (!map || typeof map.getLevel !== "function") {
      return;
    }

    applyWheelMarkerZoomStyle(map);
  };

  applyMarkerStyleByZoom();

  timeoutId1 = setTimeout(applyMarkerStyleByZoom, 300);
  timeoutId2 = setTimeout(applyMarkerStyleByZoom, 900);

  intervalId = setInterval(applyMarkerStyleByZoom, 400);

  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }

    if (timeoutId1) {
      clearTimeout(timeoutId1);
    }

    if (timeoutId2) {
      clearTimeout(timeoutId2);
    }
  };
}, [currentView, bfMarkers.length]);

function MapSetter({ mapRef }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map]);
  return null;
}

const resetRoute = () => {
  if (animationRef.current) cancelAnimationFrame(animationRef.current);
  setStartPoint("");
  setEndPoint("");
  setAnimatedRoute([]);
  setRouteSteps([]);
  setIsRouteSearched(false);
};

useEffect(() => {
  return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
}, []);
useEffect(() => {
  if (!isSurveying) {
    if (surveyWatchRef.current !== null) {
      navigator.geolocation.clearWatch(surveyWatchRef.current);
      surveyWatchRef.current = null;
    }
    return;
  }

  surveyWatchRef.current = navigator.geolocation.watchPosition(
    (position) => {
      const point = [
        position.coords.latitude,
        position.coords.longitude,
      ];

      setSurveyTrack((prev) => [...prev, point]);
    },
    (err) => {
      console.error("GPS 오류:", err);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    }
  );

  return () => {
    if (surveyWatchRef.current !== null) {
      navigator.geolocation.clearWatch(surveyWatchRef.current);
    }
  };
}, [isSurveying]);
const goHomeClean = () => {
  if (animationRef.current) {
    cancelAnimationFrame(animationRef.current);
  }

  setTempMarker(null);
  setSearchSuggestions([]);
  setStartSuggestions([]);
  setEndSuggestions([]);
  resetRoute();
  setCurrentView("home");
};

const handleBackHome = () => {
  if (currentView !== "home") {
    window.history.back();
  } else {
    goHomeClean();
  }
};

const openSearchView = () => {
  resetRoute();
  setCurrentView("search");
  window.history.pushState({ view: "search" }, "", "#search");
};

const openCreateView = () => {
  setCurrentView("create");
  window.history.pushState({ view: "create" }, "", "#create");
};
useEffect(() => {
  window.history.replaceState({ view: "home" }, "", "#home");

  const handlePhoneBackButton = (event) => {
    const view = event.state?.view || "home";

    if (view === "home") {
      goHomeClean();
      return;
    }

    setCurrentView(view);
  };

  window.addEventListener("popstate", handlePhoneBackButton);

  return () => {
    window.removeEventListener("popstate", handlePhoneBackButton);
  };
}, []);
const saveSurveyTrack = async () => {
  if (surveyTrack.length < 2) {
    alert("저장할 조사 경로가 없습니다.");
    return;
  }

  try {
    await push(ref(db, "surveyTracks"), {
      route: surveyTrack,
      createdAt: Date.now()
    });

    alert("조사 경로 저장 완료!");

    setIsSurveying(false);
    setSurveyTrack([]);

  } catch (err) {
    console.error(err);
    alert("저장 실패");
  }
};
useEffect(() => {
  const surveyRef = ref(db, "surveyTracks");

  const unsubscribe = onValue(surveyRef, (snapshot) => {
    const data = snapshot.val();

    if (!data) {
      setSurveyTracks([]);
      return;
    }

    const tracks = Object.entries(data).map(([id, value]) => ({
      id,
      ...value
    }));

    setSurveyTracks(tracks);
  });

  return () => unsubscribe();
}, []);
const migrateExistingMarkerImagesNow = async () => {
  if (!isAdminLoggedIn) {
    alert("관리자 로그인 후 실행해야 합니다.");
    return;
  }

  const ok = window.confirm(
    "기존 아이콘 사진을 새 저장 위치로 옮깁니다.\n\n" +
      "Firebase 콘솔에서 JSON 백업을 먼저 했다면 확인을 눌러 주세요.\n\n" +
      "복사 성공이 확인된 사진만 기존 위치에서 삭제합니다."
  );

  if (!ok) return;

  const markersRef = ref(db, "bfMarkers");

  let scannedCount = 0;
  let migratedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  let finished = false;
  let idleTimer = null;
  let unsubscribe = null;

  const finish = () => {
    if (finished) return;
    finished = true;

    if (idleTimer) {
      clearTimeout(idleTimer);
    }

    if (unsubscribe) {
      unsubscribe();
    }

    console.log("사진 이동 완료", {
      scannedCount,
      migratedCount,
      skippedCount,
      failedCount,
    });

    alert(
      "사진 이동이 끝났습니다.\n\n" +
        `확인한 아이콘: ${scannedCount}개\n` +
        `옮긴 사진: ${migratedCount}개\n` +
        `건너뜀: ${skippedCount}개\n` +
        `실패: ${failedCount}개`
    );
  };

  const resetFinishTimer = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
    }

    idleTimer = setTimeout(finish, 6000);
  };

  unsubscribe = onChildAdded(
    markersRef,
    async (snapshot) => {
      resetFinishTimer();

      const id = snapshot.key;
      const value = snapshot.val() || {};

      scannedCount += 1;

      try {
        if (!value.image) {
          skippedCount += 1;
          return;
        }

        const oldImage = value.image;

        const alreadyMovedSnapshot = await get(
          ref(db, `bfMarkerImages/${id}/image`)
        );

        if (!alreadyMovedSnapshot.exists()) {
          await set(ref(db, `bfMarkerImages/${id}`), {
            image: oldImage,
            updatedAt: Date.now(),
            migratedFrom: `bfMarkers/${id}/image`,
          });
        }

        const verifySnapshot = await get(
          ref(db, `bfMarkerImages/${id}/image`)
        );

        if (!verifySnapshot.exists()) {
          throw new Error("복사 확인 실패");
        }

        await update(ref(db, `bfMarkers/${id}`), {
          image: null,
          hasImage: true,
          imageMigratedAt: Date.now(),
        });

        migratedCount += 1;
        console.log(`사진 이동 성공: ${id}`);
      } catch (error) {
        failedCount += 1;
        console.error(`사진 이동 실패: ${id}`, error);
      } finally {
        resetFinishTimer();
      }
    },
    (error) => {
      failedCount += 1;
      console.error("사진 이동 전체 오류:", error);
      finish();
    }
  );

  resetFinishTimer();
};
useEffect(() => {
  window.migrateWheelWorldImages = migrateExistingMarkerImagesNow;

  return () => {
    delete window.migrateWheelWorldImages;
  };
}, [isAdminLoggedIn]);
const voiceGuideRef = useRef({
  lastText: "",
  lastSpokenAt: 0,
  spokenTurnKeys: new Set(),
  spokenHazardIds: new Set(),
  arrived: false,
});

const voiceToRoutePoint = (point) => {
  if (!point) return null;

  if (Array.isArray(point)) {
    const lat = Number(point[0]);
    const lng = Number(point[1]);

    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    return { lat, lng };
  }

  const lat = Number(point.lat);
  const lng = Number(point.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  return { lat, lng };
};

const voiceDistanceMeters = (a, b) => {
  const pointA = voiceToRoutePoint(a);
  const pointB = voiceToRoutePoint(b);

  if (!pointA || !pointB) return Infinity;

  const earthRadius = 6371000;

  const lat1 = (pointA.lat * Math.PI) / 180;
  const lat2 = (pointB.lat * Math.PI) / 180;
  const deltaLat = ((pointB.lat - pointA.lat) * Math.PI) / 180;
  const deltaLng = ((pointB.lng - pointA.lng) * Math.PI) / 180;

  const value =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const voiceBearingDegrees = (from, to) => {
  const a = voiceToRoutePoint(from);
  const b = voiceToRoutePoint(to);

  if (!a || !b) return 0;

  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

const voiceAngleDifference = (fromAngle, toAngle) => {
  return ((toAngle - fromAngle + 540) % 360) - 180;
};

const voiceClosestRouteIndex = (currentPosition, route = []) => {
  if (!currentPosition || !route || route.length === 0) {
    return {
      index: -1,
      distance: Infinity,
    };
  }

  let closestIndex = -1;
  let closestDistance = Infinity;

  route.forEach((point, index) => {
    const distance = voiceDistanceMeters(currentPosition, point);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return {
    index: closestIndex,
    distance: closestDistance,
  };
};

const voiceFindUpcomingTurn = (currentPosition, route = []) => {
  if (!currentPosition || !route || route.length < 8) return null;

  const { index: closestIndex } = voiceClosestRouteIndex(
    currentPosition,
    route
  );

  if (closestIndex < 0) return null;

  const startIndex = Math.max(closestIndex + 2, 3);
  const endIndex = Math.min(route.length - 4, closestIndex + 45);

  for (let i = startIndex; i <= endIndex; i += 1) {
    const before = route[i - 3];
    const center = route[i];
    const after = route[i + 3];

    if (!before || !center || !after) continue;

    const beforeBearing = voiceBearingDegrees(before, center);
    const afterBearing = voiceBearingDegrees(center, after);
    const angleDiff = voiceAngleDifference(beforeBearing, afterBearing);
    const absAngle = Math.abs(angleDiff);

    if (absAngle < 35) continue;

    const distanceToTurn = voiceDistanceMeters(currentPosition, center);

    if (distanceToTurn > 120) continue;

    return {
      index: i,
      distance: distanceToTurn,
      direction: angleDiff > 0 ? "오른쪽" : "왼쪽",
      angle: absAngle,
    };
  }

  return null;
};

const voiceMarkerLabel = (marker) => {
  const config = bfConfig?.[marker?.type];

  if (!config) return "장애물";

  const icon = config.icon || "";
  const label = String(config.label || "장애물")
    .split(icon)
    .join("")
    .trim();

  return label || "장애물";
};

const voiceFindNearbyHazard = (currentPosition, markers = []) => {
  if (!currentPosition || !Array.isArray(markers)) return null;

  const approvedMarkers = markers.filter(
    (marker) =>
      marker.status === "approved" ||
      marker.isOfficial === true
  );

  const candidates = approvedMarkers
    .map((marker) => {
      const distance = voiceDistanceMeters(currentPosition, marker);
      const level = Number(marker.wheelLevel || 0);

      return {
        marker,
        distance,
        level,
      };
    })
    .filter(({ distance, level }) => {
      if (level === 2) return distance <= 40;
      if (level === 1) return distance <= 25;
      return false;
    })
    .sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return a.distance - b.distance;
    });

  return candidates[0] || null;
};

const voiceSpeak = (text, options = {}) => {
  const { force = false } = options;

  if (!text) return;

  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    console.warn("이 브라우저는 음성 안내를 지원하지 않습니다.");
    return;
  }

  const now = Date.now();
  const lastText = voiceGuideRef.current.lastText;
  const lastSpokenAt = voiceGuideRef.current.lastSpokenAt;

  if (!force && lastText === text && now - lastSpokenAt < 12000) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = 0.92;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);

  voiceGuideRef.current.lastText = text;
  voiceGuideRef.current.lastSpokenAt = now;
};

const resetVoiceGuide = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  voiceGuideRef.current = {
    lastText: "",
    lastSpokenAt: 0,
    spokenTurnKeys: new Set(),
    spokenHazardIds: new Set(),
    arrived: false,
  };
};

const announceVoiceNavigation = ({
  currentPosition,
  route = [],
  destination = null,
  markers = [],
}) => {
  if (!currentPosition || !route || route.length < 2) return;

  const destinationPoint = destination || route[route.length - 1];

  const distanceToDestination = voiceDistanceMeters(
    currentPosition,
    destinationPoint
  );

  if (
    distanceToDestination <= 20 &&
    voiceGuideRef.current.arrived === false
  ) {
    voiceGuideRef.current.arrived = true;

    voiceSpeak("목적지에 도착했습니다. 안내를 종료해 주세요.", {
      force: true,
    });

    return;
  }

  const nearbyHazard = voiceFindNearbyHazard(currentPosition, markers);

  if (nearbyHazard) {
    const markerId =
      nearbyHazard.marker.id ||
      `${nearbyHazard.marker.lat}_${nearbyHazard.marker.lng}`;

    const hazardKey = `${markerId}_${nearbyHazard.level}`;

    if (!voiceGuideRef.current.spokenHazardIds.has(hazardKey)) {
      voiceGuideRef.current.spokenHazardIds.add(hazardKey);

      const label = voiceMarkerLabel(nearbyHazard.marker);

      const roundedDistance = Math.max(
        5,
        Math.round(nearbyHazard.distance / 5) * 5
      );

      if (nearbyHazard.level === 2) {
        voiceSpeak(
          `전방 ${roundedDistance}미터 안에 2단계 위험 구간이 있습니다. ${label}에 주의하세요.`,
          { force: true }
        );
      } else {
        voiceSpeak(
          `근처 ${roundedDistance}미터 안에 1단계 주의 구간이 있습니다. ${label}에 주의하세요.`
        );
      }

      return;
    }
  }

  const upcomingTurn = voiceFindUpcomingTurn(currentPosition, route);

  if (!upcomingTurn) return;

  const threshold =
    upcomingTurn.distance <= 30
      ? "near"
      : upcomingTurn.distance <= 80
      ? "far"
      : null;

  if (!threshold) return;

  const turnKey = `${upcomingTurn.index}_${threshold}`;

  if (voiceGuideRef.current.spokenTurnKeys.has(turnKey)) {
    return;
  }

  voiceGuideRef.current.spokenTurnKeys.add(turnKey);

  const roundedDistance = Math.max(
    10,
    Math.round(upcomingTurn.distance / 10) * 10
  );

  if (threshold === "near") {
    voiceSpeak(`잠시 후 ${upcomingTurn.direction}으로 이동하세요.`, {
      force: true,
    });
  } else {
    voiceSpeak(
      `약 ${roundedDistance}미터 후 ${upcomingTurn.direction}으로 이동하세요.`
    );
  }
};
const renderMarkerTypeFilter = () => {
  const typeEntries = Object.entries(bfConfig || {});

  if (typeEntries.length === 0) return null;

  const totalCount = typeEntries.length;
  const visibleCount = totalCount - hiddenMarkerTypes.length;
  const isAllVisible = hiddenMarkerTypes.length === 0;

  const getFilterButtonStyle = (isVisible) => ({
    width: "100%",
    minHeight: "38px",
    padding: "8px 10px",
    borderRadius: "12px",
    border: isVisible ? "1.5px solid #93C5FD" : "1.5px solid #E2E8F0",
    background: isVisible ? "#EFF6FF" : "#F8FAFC",
    color: isVisible ? "#1D4ED8" : "#64748B",
    fontSize: "12px",
    fontWeight: "900",
    fontFamily: "inherit",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    lineHeight: 1.25,
    wordBreak: "keep-all",
    opacity: isVisible ? 1 : 0.7,
    boxShadow: isVisible
      ? "0 4px 10px rgba(37, 99, 235, 0.10)"
      : "none",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: "12px",
        left: "12px",
        zIndex: 60,
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        onClick={() => setIsMarkerFilterOpen((prev) => !prev)}
        style={{
          position: "absolute",
          left: "8px",
          zIndex: 10,

          height: "34px",
          padding: "0 12px",

          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",

          border: "1px solid #CBD5E1",
          borderRadius: "999px",
          background: "#FFFFFF",
          color: "#334155",

          fontSize: "11px",
          fontWeight: "900",
          fontFamily: "inherit",
          whiteSpace: "nowrap",

          boxShadow: "0 4px 10px rgba(15, 23, 42, 0.12)",
          cursor: "pointer",
          transform: "translateY(-8px)",
        }}
      >
        <span>표시</span>
        <span
          style={{
            background: "#EFF6FF",
            color: "#2563EB",
            borderRadius: "999px",
            padding: "2px 7px",
            fontSize: "11px",
            fontWeight: "900",
          }}
        >
          {visibleCount}/{totalCount}
        </span>
      </button>

      {isMarkerFilterOpen && (
        <div
          style={{
            marginTop: "8px",
            width: "min(300px, calc(100vw - 24px))",
            background: "rgba(255,255,255,0.97)",
            borderRadius: "18px",
            padding: "12px",
            boxShadow: "0 14px 34px rgba(15,23,42,0.22)",
            border: "1px solid rgba(226,232,240,0.9)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "10px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "900",
                  color: "#0F172A",
                }}
              >
                표시할 아이콘
              </div>

              <div
                style={{
                  fontSize: "11px",
                  color: "#64748B",
                  marginTop: "2px",
                }}
              >
                보고 싶은 장애물만 선택하세요
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsMarkerFilterOpen(false)}
              style={{
                border: "none",
                background: "#F1F5F9",
                color: "#475569",
                borderRadius: "999px",
                width: "28px",
                height: "28px",
                fontSize: "16px",
                fontWeight: "900",
                cursor: "pointer",
                lineHeight: "28px",
              }}
            >
              ×
            </button>
          </div>

          <div
  style={{
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "7px",
    maxHeight: "none",
    overflowY: "visible",
    paddingRight: 0,
  }}
>
            {typeEntries.map(([type, info]) => {
              const isVisible = !hiddenMarkerTypes.includes(type);

              const iconText = info.icon || "";
              const labelText = String(info.label || type)
                .split(iconText)
                .join("")
                .trim();

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleMarkerTypeVisibility(type)}
                  style={getFilterButtonStyle(isVisible)}
                >
                  <span>{iconText}</span>
                  <span>{labelText}</span>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "11px",
            }}
          >
            <button
              type="button"
              onClick={showAllMarkerTypes}
              disabled={isAllVisible}
              style={{
                flex: 1,
                minHeight: "36px",
                border: "1px solid #BFDBFE",
                borderRadius: "12px",
                padding: "9px 10px",
                background: isAllVisible ? "#F1F5F9" : "#EFF6FF",
                color: isAllVisible ? "#94A3B8" : "#2563EB",
                fontSize: "12px",
                fontWeight: "900",
                fontFamily: "inherit",
                cursor: isAllVisible ? "default" : "pointer",
              }}
            >
              전체 보기
            </button>

            <button
              type="button"
              onClick={() =>
                setHiddenMarkerTypes(typeEntries.map(([type]) => type))
              }
              style={{
                flex: 1,
                minHeight: "36px",
                border: "1px solid #FECACA",
                borderRadius: "12px",
                padding: "9px 10px",
                background: "#FEF2F2",
                color: "#DC2626",
                fontSize: "12px",
                fontWeight: "900",
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              모두 숨김
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
const renderHeader = () => (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "60px",
      background: "rgba(255,255,255,0.96)",
      zIndex: 2000,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0 10px",
      boxSizing: "border-box",
      borderBottom: "1px solid #E5E7EB",
      backdropFilter: "blur(10px)",
    }}
  >
   {/* 왼쪽: 로고 */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    height: "50px",
    flexShrink: 0,
  }}
>
  <button
    onClick={() => {
      goHomeClean();
      window.history.replaceState({ view: "home" }, "", "#home");
    }}
    style={{
      all: "unset",
      width: isMobile ? "74px" : "105px",
      height: "48px",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      cursor: "pointer",
      position: "relative",
    }}
  >
    <div
      style={{
        transform: isMobile ? "scale(0.2)" : "scale(0.28)",
        transformOrigin: "left center",
        pointerEvents: "none",
        marginLeft: isMobile ? "-18px" : "-10px",
      }}
    >
      <SimpleTextLogo />
    </div>
  </button>
</div>
    {/* 오른쪽: 메뉴 버튼 */}
    <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
      <button
        onClick={openSearchView}
        style={{
          padding: "8px",
          border: "none",
          borderRadius: "8px",
          background: "#F5F5F7",
          cursor: "pointer",
        }}
      >
        🗺️
      </button>

      <button
        onClick={openCreateView}
        style={{
          padding: "8px",
          border: "none",
          borderRadius: "8px",
          background: "#F5F5F7",
          cursor: "pointer",
        }}
      >
        ✍️
      </button>

     

      {isAdminLoggedIn && (
        <button
          onClick={handleLogout}
          style={{
            padding: "8px 10px",
            border: "none",
            borderRadius: "8px",
            background: "#FEE2E2",
            color: "#DC2626",
            fontSize: "12px",
            fontWeight: "700",
            cursor: "pointer",
          }}
        >
          로그아웃
        </button>
      )}
    </div>
  </div>
);

return (
  <div style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", overflowX: "hidden", boxSizing: "border-box" }}>
    
    {/* 🔒 [신규] 관리자 디버그 로그인 뷰 처리 */}
    {currentView === "admin" && (
      <div className="login-box" style={{ padding: "30px 20px", maxWidth: "400px", width: "90%", margin: "100px auto", border: "1px solid #E2E8F0", borderRadius: "24px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)", background: "#fff", textAlign: "center" }}>
        <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "8px" }}>🔐 관리자 모드 로그인</h2>
        <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "24px" }}>등록 시스템 설정을 변경할 수 있습니다.</p>
        <form onSubmit={handleLogin}>
          <input 
            type="email" 
            placeholder="이메일 주소 (admin@wheel.com)" 
            value={adminEmailInput} 
            onChange={(e) => setAdminEmailInput(e.target.value)} 
            style={{ display: "block", width: "100%", marginBottom: "12px", padding: "12px", borderRadius: "12px", border: "1px solid #CBD5E1", boxSizing: "border-box" }}
          />
          <input 
            type="password" 
            placeholder="비밀번호" 
            value={adminPasswordInput} 
            onChange={(e) => setAdminPasswordInput(e.target.value)} 
            style={{ display: "block", width: "100%", marginBottom: "20px", padding: "12px", borderRadius: "12px", border: "1px solid #CBD5E1", boxSizing: "border-box" }}
          />
          <button type="submit" style={{ width: "100%", padding: "14px", background: "#1976D2", color: "white", border: "none", borderRadius: "12px", fontWeight: "700", cursor: "pointer", fontSize: "15px" }}>로그인 완료</button>
        </form>
        <button onClick={() => setCurrentView("home")} style={{ marginTop: "16px", background: "none", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: "14px", textDecoration: "underline" }}>뒤로가기</button>
      </div>
    )}
      

 {/* 1. 메인 홈 화면 */}
{currentView === "home" && (
  <div
    style={{
      position: "relative",
      width: "100%",
      height: "100vh",
      minHeight: "100vh",
      maxHeight: "100vh",
      overflow: "hidden",
      boxSizing: "border-box",
    }}
  >
    {isMobile ? (
      <CuteCartoonBackground />
    ) : (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <CuteCartoonBackground />
      </div>
    )}

    {isRainyMode && <RainOverlay />}

    {isRainyMode && (
      <div
        style={{
          position: "absolute",
          top: isMobile ? "18px" : "24px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 5,
          width: "calc(100% - 36px)",
          maxWidth: isMobile ? "330px" : "420px",
          padding: isMobile ? "7px 11px" : "8px 14px",
          borderRadius: "999px",
          background: "rgba(224, 242, 254, 0.92)",
          border: "1px solid rgba(125, 211, 252, 0.95)",
          color: "#075985",
          fontSize: isMobile ? "11px" : "12px",
          fontWeight: "900",
          textAlign: "center",
          boxShadow: "0 8px 18px rgba(14, 116, 144, 0.14)",
          boxSizing: "border-box",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        🌧 비 오는 날 모드 · 물고임 구간 표시 중
      </div>
    )}

    {isMobile ? (
      <div
  style={{
    position: "relative",
    zIndex: 2,
    width: "100%",
    height: "100%",
    maxWidth: "370px",
    margin: "0 auto",
    padding: "18px 18px 78px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    transform: "translateY(-54px)",
  }}
>
        <div
          style={{
            transform: "scale(0.64)",
            marginTop: "-96px",
            marginBottom: "-178px",
            filter: "drop-shadow(0 8px 14px rgba(30, 80, 120, 0.12))",
          }}
        >
          <SimpleTextLogo />
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.68)",
            border: "1.5px solid rgba(255,255,255,0.85)",
            boxShadow: "0 12px 28px rgba(72, 117, 92, 0.12)",
            backdropFilter: "blur(10px)",
            borderRadius: "999px",
            padding: "8px 16px",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              color: "#1976D2",
              fontWeight: "900",
              marginBottom: "2px",
            }}
          >
            모든 길은 모두를 위해
          </div>

          <div
            style={{
              fontSize: "14px",
              color: "#1F2937",
              fontWeight: "800",
              lineHeight: "1.35",
              wordBreak: "keep-all",
            }}
          >
            함께 만드는 우리 동네 바퀴지도
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "9px",
            width: "100%",
          }}
        >
          <button
            type="button"
            onClick={openOpinionSurvey}
            style={{
              width: "100%",
              padding: "8px 11px",
              borderRadius: "14px",
              border: "1px solid #FED7AA",
              background: "rgba(255, 247, 237, 0.96)",
              boxShadow: "0 6px 15px rgba(154, 52, 18, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              cursor: "pointer",
              textAlign: "left",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: "9px",
              }}
            >
              <span style={{ flexShrink: 0, fontSize: "19px" }}>
                {SURVEY_COUNT < SURVEY_LIMIT ? "☕" : "💬"}
              </span>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: "#9A3412",
                    fontSize: "12.5px",
                    fontWeight: "900",
                    lineHeight: 1.3,
                    whiteSpace: "nowrap",
                  }}
                >
                  {SURVEY_COUNT < SURVEY_LIMIT
                    ? "1분 설문 · 커피 쿠폰"
                    : "1분 의견 설문"}
                </div>

                <div
                  style={{
                    marginTop: "2px",
                    color: "#78716C",
                    fontSize: "10px",
                    fontWeight: "700",
                    lineHeight: 1.3,
                  }}
                >
                  휠더월드에 의견을 들려주세요
                </div>
              </div>
            </div>

            <div
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: "7px",
              }}
            >
              {SURVEY_COUNT < SURVEY_LIMIT && (
                <span
                  style={{
                    padding: "5px 8px",
                    borderRadius: "999px",
                    background: "white",
                    color: "#EA580C",
                    fontSize: "9.5px",
                    fontWeight: "900",
                    whiteSpace: "nowrap",
                  }}
                >
                  현재 참여 {SURVEY_COUNT}/{SURVEY_LIMIT}
                </span>
              )}

              <span
                style={{
                  color: "#C2410C",
                  fontSize: "18px",
                  fontWeight: "900",
                }}
              >
                ›
              </span>
            </div>
          </button>

          <button
            onClick={openSearchView}
            style={{
              width: "100%",
              border: "none",
              borderRadius: "24px",
              padding: "12px 14px",
              gap: "12px",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(219,234,254,0.96))",
              boxShadow:
                "0 10px 0 rgba(147,197,253,0.5), 0 18px 34px rgba(30,64,175,0.16)",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "46px",
                height: "46px",
                borderRadius: "18px",
                fontSize: "23px",
                background: "linear-gradient(135deg, #60A5FA, #2563EB)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow:
                  "inset 0 0 0 2px rgba(255,255,255,0.45), 0 8px 16px rgba(37,99,235,0.25)",
              }}
            >
              🗺️
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "inline-block",
                  background: "rgba(219,234,254,0.95)",
                  color: "#1D4ED8",
                  fontSize: "10.5px",
                  fontWeight: "900",
                  padding: "4px 9px",
                  borderRadius: "999px",
                  marginBottom: "7px",
                }}
              >
                바퀴가 편한 길 찾기
              </div>

              <div
                style={{
                  fontSize: "19px",
                  fontWeight: "950",
                  color: "#1E3A8A",
                  marginBottom: "5px",
                }}
              >
                안전 길찾기
              </div>

              <div
                style={{
                  fontSize: "11.5px",
                  color: "#475569",
                  lineHeight: "1.45",
                  fontWeight: "650",
                  wordBreak: "keep-all",
                }}
              >
                단차, 경사, 장애물을 확인하고
                <br />
                더 편한 경로를 찾아요.
              </div>
            </div>

            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.95)",
                color: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                fontWeight: "900",
                flexShrink: 0,
              }}
            >
              ›
            </div>
          </button>

          <button
            onClick={openCreateView}
            style={{
              width: "100%",
              border: "none",
              borderRadius: "24px",
              padding: "12px 14px",
              gap: "12px",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(209,250,229,0.96))",
              boxShadow:
                "0 10px 0 rgba(110,231,183,0.5), 0 18px 34px rgba(6,95,70,0.14)",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "46px",
                height: "46px",
                borderRadius: "18px",
                fontSize: "23px",
                background: "linear-gradient(135deg, #34D399, #059669)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow:
                  "inset 0 0 0 2px rgba(255,255,255,0.45), 0 8px 16px rgba(5,150,105,0.22)",
              }}
            >
              ✍️
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "inline-block",
                  background: "rgba(209,250,229,0.95)",
                  color: "#047857",
                  fontSize: "10.5px",
                  fontWeight: "900",
                  padding: "4px 9px",
                  borderRadius: "999px",
                  marginBottom: "7px",
                }}
              >
                우리 동네 길 정보 모으기
              </div>

              <div
                style={{
                  fontSize: "17px",
                  fontWeight: "950",
                  color: "#065F46",
                  marginBottom: "5px",
                }}
              >
                주민 제보
              </div>

              <div
                style={{
                  fontSize: "11.5px",
                  color: "#475569",
                  lineHeight: "1.45",
                  fontWeight: "650",
                  wordBreak: "keep-all",
                }}
              >
                턱, 계단, 보도 파손을
                <br />
                지도에 직접 남겨요.
              </div>
            </div>

            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.95)",
                color: "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                fontWeight: "900",
                flexShrink: 0,
              }}
            >
              ›
            </div>
          </button>
        </div>

        <footer
          onClick={handleSecretDoorClick}
          style={{
            position: "absolute",
            bottom: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "10px",
            color: "rgba(31,41,55,0.38)",
            cursor: "pointer",
            userSelect: "none",
            background: "rgba(255,255,255,0.38)",
            padding: "5px 10px",
            borderRadius: "999px",
            backdropFilter: "blur(6px)",
          }}
        >
          © 2026 Wheel the World.
        </footer>
      </div>
    ) : (
      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "min(1120px, calc(100% - 80px))",
          height: "100%",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          alignItems: "center",
          gap: "54px",
          boxSizing: "border-box",
          padding: "38px 0 34px",
        }}
      >
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            minWidth: 0,
          }}
        >
          <div
            style={{
              transform: "scale(0.72)",
              transformOrigin: "left center",
              marginLeft: "-32px",
              marginTop: "-96px",
              marginBottom: "-112px",
              filter: "drop-shadow(0 12px 22px rgba(30, 80, 120, 0.14))",
            }}
          >
            <SimpleTextLogo />
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(255,255,255,0.9)",
              boxShadow: "0 10px 24px rgba(72, 117, 92, 0.10)",
              color: "#1976D2",
              fontSize: "14px",
              fontWeight: "900",
              backdropFilter: "blur(10px)",
              marginBottom: "18px",
            }}
          >
            모든 길은 모두를 위해
          </div>

          <h1
            style={{
              margin: 0,
              color: "#173B69",
              fontSize: "42px",
              lineHeight: 1.18,
              letterSpacing: "-1.6px",
              fontWeight: "950",
              textAlign: "left",
              textShadow: "0 2px 0 rgba(255,255,255,0.35)",
            }}
          >
            함께 만드는
            <br />
            우리 동네 바퀴지도
          </h1>

          <p
            style={{
              margin: "18px 0 0",
              color: "#334155",
              fontSize: "17px",
              lineHeight: 1.7,
              fontWeight: "700",
              wordBreak: "keep-all",
              maxWidth: "540px",
            }}
          >
            우리 동네의 단차, 경사, 보도 위 불편 요소를 함께 모아
            바퀴로 이동하는 누구나 더 편한 길을 찾을 수 있도록 돕습니다.
          </p>
        </section>

        <section
          style={{
            justifySelf: "end",
            width: "440px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            padding: "24px",
            borderRadius: "34px",
            background: "rgba(255,255,255,0.48)",
            border: "1px solid rgba(255,255,255,0.78)",
            boxShadow:
              "0 24px 60px rgba(30, 64, 175, 0.12), inset 0 0 0 1px rgba(255,255,255,0.32)",
            backdropFilter: "blur(14px)",
          }}
        >
          <button
            type="button"
            onClick={openOpinionSurvey}
            style={{
              width: "100%",
              padding: "11px 13px",
              borderRadius: "18px",
              boxSizing: "border-box",
              border: "1px solid #FED7AA",
              background: "rgba(255, 247, 237, 0.96)",
              boxShadow: "0 8px 20px rgba(154, 52, 18, 0.10)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div
              style={{
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  fontSize: "22px",
                }}
              >
                {SURVEY_COUNT < SURVEY_LIMIT ? "☕" : "💬"}
              </span>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: "#9A3412",
                    fontSize: "14px",
                    fontWeight: "900",
                    lineHeight: 1.3,
                    whiteSpace: "nowrap",
                  }}
                >
                  {SURVEY_COUNT < SURVEY_LIMIT
                    ? "1분 설문 · 커피 쿠폰"
                    : "1분 의견 설문"}
                </div>

                <div
                  style={{
                    marginTop: "2px",
                    color: "#78716C",
                    fontSize: "11px",
                    fontWeight: "700",
                    lineHeight: 1.3,
                  }}
                >
                  휠더월드에 의견을 들려주세요
                </div>
              </div>
            </div>

            <div
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {SURVEY_COUNT < SURVEY_LIMIT && (
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: "999px",
                    background: "white",
                    color: "#EA580C",
                    fontSize: "10px",
                    fontWeight: "900",
                    whiteSpace: "nowrap",
                  }}
                >
                  현재 참여 {SURVEY_COUNT}/{SURVEY_LIMIT}
                </span>
              )}

              <span
                style={{
                  color: "#C2410C",
                  fontSize: "20px",
                  fontWeight: "900",
                }}
              >
                ›
              </span>
            </div>
          </button>

          <div
            style={{
              color: "#0F172A",
              fontSize: "24px",
              fontWeight: "950",
              letterSpacing: "-0.8px",
              textAlign: "left",
              margin: "2px 0 2px",
            }}
          >
            필요한 기능을 선택해 주세요
          </div>

          <button
            onClick={openSearchView}
            style={{
              width: "100%",
              border: "none",
              borderRadius: "28px",
              padding: "22px 22px",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(219,234,254,0.98))",
              boxShadow:
                "0 10px 0 rgba(147,197,253,0.52), 0 22px 38px rgba(30,64,175,0.16)",
              cursor: "pointer",
              transition: "all 0.18s ease",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: "16px",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow =
                "0 13px 0 rgba(147,197,253,0.52), 0 26px 42px rgba(30,64,175,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0px)";
              e.currentTarget.style.boxShadow =
                "0 10px 0 rgba(147,197,253,0.52), 0 22px 38px rgba(30,64,175,0.16)";
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-35px",
                right: "-32px",
                width: "118px",
                height: "118px",
                borderRadius: "50%",
                background: "rgba(147,197,253,0.25)",
              }}
            />

            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "24px",
                background: "linear-gradient(135deg, #60A5FA, #2563EB)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "31px",
                flexShrink: 0,
                boxShadow:
                  "inset 0 0 0 2px rgba(255,255,255,0.45), 0 10px 18px rgba(37,99,235,0.25)",
                position: "relative",
                zIndex: 1,
              }}
            >
              🗺️
            </div>

            <div style={{ position: "relative", zIndex: 1, flex: 1 }}>
              <div
                style={{
                  display: "inline-block",
                  background: "rgba(219,234,254,0.95)",
                  color: "#1D4ED8",
                  fontSize: "11px",
                  fontWeight: "900",
                  padding: "5px 10px",
                  borderRadius: "999px",
                  marginBottom: "8px",
                }}
              >
                바퀴가 편한 길 찾기
              </div>

              <div
                style={{
                  fontSize: "25px",
                  fontWeight: "950",
                  color: "#1E3A8A",
                  marginBottom: "6px",
                  letterSpacing: "-0.7px",
                }}
              >
                안전 길찾기
              </div>

              <div
                style={{
                  fontSize: "13px",
                  color: "#475569",
                  lineHeight: "1.5",
                  fontWeight: "700",
                  wordBreak: "keep-all",
                }}
              >
                단차, 경사, 장애물을 확인하고
                <br />
                더 편한 경로를 찾아요.
              </div>
            </div>

            <div
              style={{
                position: "relative",
                zIndex: 1,
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.95)",
                color: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontWeight: "900",
                flexShrink: 0,
                boxShadow: "0 4px 10px rgba(37,99,235,0.18)",
              }}
            >
              ›
            </div>
          </button>

          <button
            onClick={openCreateView}
            style={{
              width: "100%",
              border: "none",
              borderRadius: "28px",
              padding: "22px 22px",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(209,250,229,0.98))",
              boxShadow:
                "0 10px 0 rgba(110,231,183,0.52), 0 22px 38px rgba(6,95,70,0.14)",
              cursor: "pointer",
              transition: "all 0.18s ease",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: "16px",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow =
                "0 13px 0 rgba(110,231,183,0.52), 0 26px 42px rgba(6,95,70,0.18)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0px)";
              e.currentTarget.style.boxShadow =
                "0 10px 0 rgba(110,231,183,0.52), 0 22px 38px rgba(6,95,70,0.14)";
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-35px",
                right: "-32px",
                width: "118px",
                height: "118px",
                borderRadius: "50%",
                background: "rgba(110,231,183,0.25)",
              }}
            />

            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "24px",
                background: "linear-gradient(135deg, #34D399, #059669)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "31px",
                flexShrink: 0,
                boxShadow:
                  "inset 0 0 0 2px rgba(255,255,255,0.45), 0 10px 18px rgba(5,150,105,0.22)",
                position: "relative",
                zIndex: 1,
              }}
            >
              ✍️
            </div>

            <div style={{ position: "relative", zIndex: 1, flex: 1 }}>
              <div
                style={{
                  display: "inline-block",
                  background: "rgba(209,250,229,0.95)",
                  color: "#047857",
                  fontSize: "11px",
                  fontWeight: "900",
                  padding: "5px 10px",
                  borderRadius: "999px",
                  marginBottom: "8px",
                }}
              >
                우리 동네 길 정보 모으기
              </div>

              <div
                style={{
                  fontSize: "25px",
                  fontWeight: "950",
                  color: "#065F46",
                  marginBottom: "6px",
                  letterSpacing: "-0.7px",
                }}
              >
                주민 제보
              </div>

              <div
                style={{
                  fontSize: "13px",
                  color: "#475569",
                  lineHeight: "1.5",
                  fontWeight: "700",
                  wordBreak: "keep-all",
                }}
              >
                턱, 계단, 보도 파손을
                <br />
                지도에 직접 남겨요.
              </div>
            </div>

            <div
              style={{
                position: "relative",
                zIndex: 1,
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.95)",
                color: "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontWeight: "900",
                flexShrink: 0,
                boxShadow: "0 4px 10px rgba(5,150,105,0.16)",
              }}
            >
              ›
            </div>
          </button>
        </section>

        <footer
          onClick={handleSecretDoorClick}
          style={{
            position: "absolute",
            left: "50%",
            bottom: "16px",
            transform: "translateX(-50%)",
            fontSize: "11px",
            color: "rgba(31,41,55,0.42)",
            cursor: "pointer",
            userSelect: "none",
            background: "rgba(255,255,255,0.42)",
            padding: "6px 12px",
            borderRadius: "999px",
            backdropFilter: "blur(6px)",
          }}
        >
          © 2026 Wheel the World.
        </footer>
      </div>
    )}
  </div>
)}

      {/* 2. 안전 길찾기 화면 */}
      {currentView === "search" && (
  <div
    style={{
      position: isMobile ? "relative" : "fixed",
      top: isMobile ? "auto" : 0,
      left: isMobile ? "auto" : 0,
      right: isMobile ? "auto" : 0,
      bottom: isMobile ? "auto" : 0,

      width: isMobile ? "100%" : "100vw",
      maxWidth: isMobile ? "850px" : "none",
      height: isMobile ? "auto" : "100vh",

      flex: 1,
      margin: 0,
      padding: 0,
      boxSizing: "border-box",
      overflow: isMobile ? "visible" : "hidden",
      background: isMobile ? "transparent" : "#F8FAFC",
      zIndex: isMobile ? "auto" : 50,
    }}
  >
          {renderHeader()}
          
          <div
  style={{
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    height: "calc(100vh - 60px)",
    width: "100%",
    marginTop: "60px",
    overflow: isMobile ? "visible" : "hidden",
    background: isMobile ? "transparent" : "#F8FAFC",
  }}
>
                 
            {/* 왼쪽 사이드바 영역 */}
            <div
  style={{
    width: isMobile ? "100%" : "390px",
    height: isMobile ? "auto" : "100%",
    flexShrink: isMobile ? 1 : 0,
    background: "#ffffff",
    borderRight: isMobile
      ? "1px solid #EAEAEA"
      : "1px solid #E2E8F0",
    padding: isMobile ? "7px 14px 5px" : "28px 24px",
    overflowY: isMobile ? "visible" : "auto",
    display: "flex",
    flexDirection: "column",
    gap: isMobile ? "8px" : "12px",
    boxSizing: "border-box",
    boxShadow: isMobile
      ? "none"
      : "8px 0 24px rgba(15, 23, 42, 0.04)",
  }}
>
              {!isMobile && (
                <h3
                  style={{
                    margin: "0 0 10px",
                    color: "#5B5570",
                    fontSize: "24px",
                    fontWeight: "900",
                    letterSpacing: "-0.6px",
                    textAlign: "center",
                  }}
                >
                  🗺️ 안전 길찾기
                </h3>
              )}
              
              
              {isRouteSearched && routeInfo ? (
  <div
    style={{
      width: "100%",
      padding: "10px 11px",
      boxSizing: "border-box",
      borderRadius: "14px",
      background: "#FFFFFF",
      border: "1px solid #E2E8F0",
      boxShadow: "0 4px 12px rgba(15,23,42,0.07)",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            overflow: "hidden",
            color: "#1E293B",
            fontSize: "12.5px",
            fontWeight: "900",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {startPoint || "출발지"} → {endPoint || "목적지"}
        </div>

        <div
          style={{
            marginTop: "3px",
            color: "#64748B",
            fontSize: "10.5px",
            fontWeight: "700",
            whiteSpace: "nowrap",
          }}
        >
          {routeMode === "normal"
            ? "일반길"
            : routeMode === "wheel2"
            ? "바퀴길"
            : "바퀴+길"}

          {(() => {
  const isGuiding =
    (isNavigationActive || isNavigationFinished) &&
    typeof distanceToDestination === "number";

  const totalDistanceM =
    Number(routeInfo?.distance || 0) * 1000;

  const totalDurationMin =
    Number(routeInfo?.duration || 0);

  const remainingDistanceM = isGuiding
    ? Math.max(0, distanceToDestination)
    : null;

  const displayedDistanceKm = isGuiding
    ? (remainingDistanceM / 1000).toFixed(1)
    : routeInfo?.distance;

  const displayedDurationMin =
    isGuiding &&
    totalDistanceM > 0 &&
    totalDurationMin > 0
      ? remainingDistanceM <= 20
        ? 0
        : Math.max(
            1,
            Math.round(
              (remainingDistanceM / totalDistanceM) *
                totalDurationMin
            )
          )
      : routeInfo?.duration;

  return (
    <>
      {displayedDistanceKm != null && (
        <span> · {displayedDistanceKm}km</span>
      )}

      {displayedDurationMin != null && (
        <span> · {displayedDurationMin}분</span>
      )}
    </>
  );
})()}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsRouteSearched(false)}
        style={{
          flexShrink: 0,
          height: "32px",
          padding: "0 10px",
          border: "1px solid #BFDBFE",
          borderRadius: "9px",
          background: "#EFF6FF",
          color: "#2563EB",
          fontSize: "10.5px",
          fontWeight: "900",
          fontFamily: "inherit",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        다시 검색
      </button>
    </div>
  </div>
) : (
              <form 
                onSubmit={handleSearchRoute} 
                onClick={(e) => e.stopPropagation()} 
                style={{
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  width: "100%",
  padding: 0,
  margin: 0,
  background: "#FFFFFF",
  border: "none",
  borderRadius: 0,
  boxSizing: "border-box",
}}
              ><div onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
<div
  style={{
    marginBottom: "8px",
  }}
>
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "7px",
    }}
  >
    <div
      style={{
        flexShrink: 0,
        color: "#334155",
        fontSize: "12px",
        fontWeight: "900",
        whiteSpace: "nowrap",
      }}
    >
      길 선택
    </div>

    <div
  role="radiogroup"
  aria-label="길 유형 선택"
  style={{
    flex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    padding: "3px",
    borderRadius: "11px",
    background: "#F1F5F9",
  }}
>
      {[
        { id: "normal", label: "일반길" },
        { id: "wheel2", label: "바퀴길" },
        { id: "wheel1", label: "바퀴+길" },
      ].map((mode) => {
        const isSelected = routeMode === mode.id;

        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setRouteMode(mode.id);
            }}
            style={{
              minWidth: 0,
              padding: "7px 2px",
             borderRadius: "8px",
border: "none",
background: isSelected ? "#2563EB" : "transparent",
              color: isSelected ? "#FFFFFF" : "#475569",
              fontSize: "11.5px",
              fontWeight: "900",
              cursor: "pointer",
              boxShadow: isSelected
                ? "0 2px 6px rgba(37,99,235,0.18)"
                : "none",
            }}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  </div>

  <div
    aria-live="polite"
    style={{
      marginTop: "4px",
      marginLeft: "48px",
      color: "#64748B",
      fontSize: "10.5px",
      lineHeight: 1.3,
      wordBreak: "keep-all",
    }}
  >
    {routeMode === "normal" &&
      "장애물 정보를 반영하지 않는 기본 경로예요."}

    {routeMode === "wheel2" &&
      "가벼운 장애물이 있어 함께 이동하기 좋아요."}

    {routeMode === "wheel1" &&
      "등록된 장애물을 최대한 피해 더 편하게 이동해요."}
  </div>
</div>
  {/* 📍 입력창과 버튼을 나란히 배치 */}
  <div style={{ display: "flex", gap: "5px" }}>
    <input
      value={startPoint}
      onChange={(e) => {
  setStartPoint(e.target.value);

  setStartCoords(null);

  fetchAutoComplete(
    e.target.value,
    setStartSuggestions
  );
}}
      placeholder="출발지를 입력하세요"
      style={{
  flex: 1,
  minWidth: 0,
  height: "38px",
  padding: "0 11px",
  boxSizing: "border-box",
  borderRadius: "10px",
  border: "1px solid #DCE3EC",
  background: "#FFFFFF",
  color: "#1E293B",
  fontSize: "12.5px",
  fontFamily: "inherit",
  outline: "none",
}}
    />
   <button
  type="button"
  onClick={(e) => {
    e.stopPropagation();

    moveToMyLocation(
      setStartPoint,
      setStartCoords
    );
  }}
  style={{
  flexShrink: 0,
  width: "64px",
  height: "38px",
  padding: "0 7px",
  borderRadius: "10px",
  border: "1px solid #BFDBFE",
  background: "#EFF6FF",
  color: "#2563EB",
  fontSize: "11.5px",
  fontWeight: "850",
  fontFamily: "inherit",
  cursor: "pointer",
  whiteSpace: "nowrap",
}}
>
  내 위치
</button>
  </div>
                  
  {/* 출발지 자동완성 리스트 */}
  {startSuggestions.length > 0 && (
    <ul style={{
      position: "absolute", zIndex: 1000, background: "#fff", width: "100%", // width를 100%로 수정하여 정렬
      border: "1px solid #E2E8F0", borderRadius: "8px", marginTop: "4px",
      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", padding: "5px 0", listStyle: "none"
    }}>
      {startSuggestions.map((name, idx) => (
        <li 
          key={idx}
          onClick={() => {
  setStartPoint(name);

  setStartCoords(null);

  setStartSuggestions([]);
}}
          style={{ padding: "8px 12px", fontSize: "13px", cursor: "pointer", borderBottom: "1px solid #F1F5F9" }}
          onMouseEnter={(e) => e.target.style.background = "#F1F5F9"}
          onMouseLeave={(e) => e.target.style.background = "transparent"}
        >
          🔍 {name}
        </li>
      ))}
    </ul>
  )}
</div>

               <div onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
  
  
  <div style={{ display: "flex", gap: "5px" }}>
    <input
      value={endPoint}
      onChange={(e) => {
  setEndPoint(e.target.value);

  setEndCoords(null);

  fetchAutoComplete(
    e.target.value,
    setEndSuggestions
  );
}}
      placeholder="목적지를 입력하세요"
      style={{
  flex: 1,
  minWidth: 0,
  height: "38px",
  padding: "0 11px",
  boxSizing: "border-box",
  borderRadius: "10px",
  border: "1px solid #DCE3EC",
  background: "#FFFFFF",
  color: "#1E293B",
  fontSize: "12.5px",
  fontFamily: "inherit",
  outline: "none",
}}
    />
    <button
  type="button"
  onClick={() =>
    moveToMyLocation(
      setEndPoint,
      setEndCoords
    )
  }
  style={{
  flexShrink: 0,
  width: "64px",
  height: "38px",
  padding: "0 7px",
  borderRadius: "10px",
  border: "1px solid #BFDBFE",
  background: "#EFF6FF",
  color: "#2563EB",
  fontSize: "11.5px",
  fontWeight: "850",
  fontFamily: "inherit",
  cursor: "pointer",
  whiteSpace: "nowrap",
}}
>
  내 위치
</button>
  </div>
                
                  {/* 목적지 인풋 바로 아래에 삽입 */}
{endSuggestions.length > 0 && (
  <ul style={{
    position: "absolute", zIndex: 1000, background: "#fff", width: "90%",
    border: "1px solid #E2E8F0", borderRadius: "8px", marginTop: "4px",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", padding: "5px 0", listStyle: "none"
  }}>
    {endSuggestions.map((name, idx) => (
      <li 
        key={idx}
        onClick={() => {
          setEndPoint(name); 
          setEndCoords(null);      // 클릭한 정확한 이름으로 인풋창 입력값 변경
          setEndSuggestions([]);   // 추천 창 닫기
        }}
        style={{ padding: "8px 12px", fontSize: "13px", cursor: "pointer", borderBottom: "1px solid #F1F5F9" }}
        onMouseEnter={(e) => e.target.style.background = "#F1F5F9"}
        onMouseLeave={(e) => e.target.style.background = "transparent"}
      >
        🔍 {name}
      </li>
    ))}
  </ul>
)}
                </div>

                <button type="submit" style={{
  width: "100%",
  height: "40px",
  marginTop: "1px",
  padding: "0 14px",
  boxSizing: "border-box",
  border: "none",
  borderRadius: "11px",
  background: "#2563EB",
  color: "#FFFFFF",
  fontSize: "13.5px",
  fontWeight: "900",
  fontFamily: "inherit",
  letterSpacing: "-0.2px",
  cursor: "pointer",
  boxShadow: "0 5px 12px rgba(37,99,235,0.2)",
}}>
                  🚀 안전 경로 탐색
                </button>
              </form>
              )}

            
            </div>

            {/* 오른쪽 지도 영역 */}
            <div
  style={{
    flex: 1,
    minHeight: 0,
    minWidth: isMobile ? "auto" : 0,
    position: "relative",
    height: isMobile ? "auto" : "100%",
    overflow: isMobile ? "visible" : "hidden",
  }}
>
              
            {routeInfo && (
  <div
    style={{
      position: "absolute",
      top: "4px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 30,
      pointerEvents: "none",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "8px",
    }}
  >
   
    {routeSteps.length > 0 && !isNavigationActive && !isNavigationFinished && (
  <button
    type="button"
    onClick={() => {
      if (!endMarkerPos) {
        alert("목적지를 먼저 설정해 주세요.");
        return;
      }
resetVoiceGuide();

voiceSpeak("음성 안내를 시작합니다. 추천 경로를 따라 이동해 주세요.", {
  force: true,
});
      startLiveLocationTracking({
  navigationMode: true,
  route: routeSteps,
  destination: Array.isArray(endMarkerPos)
    ? endMarkerPos
    : [endMarkerPos.lat, endMarkerPos.lng],
  centerMap: true,
  followMap: true,
});
    }}
    style={{
  height: "34px",
  padding: "0 14px",

  border: "1px solid #1D6FEA",
  borderRadius: "3px",
  background: "#2F80ED",
  color: "#FFFFFF",

  fontSize: "11.5px",
  fontWeight: "900",
  fontFamily: "inherit",
  whiteSpace: "nowrap",

  boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
  cursor: "pointer",
  pointerEvents: "auto",
}}
  >
    안내 시작
  </button>
)}

    {(isNavigationActive || isNavigationFinished) && (
      <button
        type="button"
        onClick={finishNavigationAndOpenFeedback}
        style={{
  height: "34px",
  padding: "0 14px",

  border: "1px solid #DC2626",
  borderRadius: "3px",
  background: "#EF4444",
  color: "#FFFFFF",

  fontSize: "11.5px",
  fontWeight: "900",
  fontFamily: "inherit",
  whiteSpace: "nowrap",

  boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
  cursor: "pointer",
  pointerEvents: "auto",
}}
      >
        안내 종료
      </button>
    )}
  </div>
)}
{showNavigationFeedback && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "rgba(15,23,42,0.5)",
      backdropFilter: "blur(5px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "18px",
      boxSizing: "border-box",
    }}
  >
    <div
      style={{
        position: "relative",
        width: "min(390px, 100%)",
        maxHeight: "calc(100vh - 36px)",
        overflowY: "auto",
        boxSizing: "border-box",
        padding: "22px",
        borderRadius: "26px",
        background: "white",
        boxShadow: "0 24px 60px rgba(15,23,42,0.25)",
      }}
    >
      <button
        type="button"
        onClick={closeNavigationFeedbackModal}
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          width: "32px",
          height: "32px",
          border: "none",
          borderRadius: "50%",
          background: "#F1F5F9",
          color: "#475569",
          fontSize: "19px",
          fontWeight: "900",
          cursor: "pointer",
        }}
      >
        ×
      </button>

      {!navigationFeedbackSaved ? (
        <>
          <div
            style={{
              marginTop: "4px",
              color: "#0F172A",
              fontSize: "21px",
              fontWeight: "950",
              textAlign: "center",
              letterSpacing: "-0.5px",
            }}
          >
            휠더월드, 어떠셨나요? 💙
          </div>

          <div
            style={{
              marginTop: "6px",
              color: "#64748B",
              fontSize: "13px",
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            이용한 경로에 별점을 남겨주세요.
          </div>

          {SURVEY_COUNT < SURVEY_LIMIT && (
            <div
              style={{
                marginTop: "15px",
                padding: "12px",
                borderRadius: "15px",
                background:
                  "linear-gradient(135deg, #FFF7ED, #FFFBEB)",
                border: "1px solid #FED7AA",
                color: "#9A3412",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "900",
                }}
              >
                ☕ 1분 설문 제출자 선착순 10명
              </div>

              <div
                style={{
                  marginTop: "3px",
                  fontSize: "12px",
                  lineHeight: 1.45,
                }}
              >
                커피 쿠폰을 드려요!
              </div>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "11px",
                  fontWeight: "800",
                }}
              >
                현재 참여 {SURVEY_COUNT} / {SURVEY_LIMIT}
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "6px",
              marginTop: "19px",
            }}
          >
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                onClick={() =>
                  setNavigationFeedbackRating(score)
                }
                aria-label={`${score}점`}
                style={{
                  padding: "2px",
                  border: "none",
                  background: "transparent",
                  color:
                    score <= navigationFeedbackRating
                      ? "#FBBF24"
                      : "#CBD5E1",
                  fontSize: "38px",
                  lineHeight: 1,
                  cursor: "pointer",
                  transition: "transform 0.15s ease",
                }}
              >
                ★
              </button>
            ))}
          </div>

          <div
            style={{
              minHeight: "20px",
              marginTop: "7px",
              color: "#64748B",
              fontSize: "12px",
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {navigationFeedbackRating > 0
              ? `${navigationFeedbackRating}점을 선택했어요`
              : "별점을 선택해 주세요"}
          </div>

          <textarea
            value={navigationFeedbackComment}
            onChange={(e) =>
              setNavigationFeedbackComment(e.target.value)
            }
            placeholder="이용하며 느낀 점이 있다면 남겨주세요. (선택)"
            style={{
              width: "100%",
              height: "82px",
              marginTop: "13px",
              padding: "11px",
              boxSizing: "border-box",
              border: "1px solid #CBD5E1",
              borderRadius: "14px",
              resize: "none",
              color: "#334155",
              fontSize: "13px",
              fontFamily: "inherit",
              outline: "none",
            }}
          />

          <button
            type="button"
            disabled={
              navigationFeedbackRating === 0 ||
              isSavingNavigationFeedback
            }
            onClick={saveNavigationFeedback}
            style={{
              width: "100%",
              marginTop: "13px",
              padding: "13px",
              border: "none",
              borderRadius: "14px",
              background:
                navigationFeedbackRating === 0
                  ? "#CBD5E1"
                  : "linear-gradient(135deg, #3B82F6, #2563EB)",
              color: "white",
              fontSize: "14px",
              fontWeight: "900",
              cursor:
                navigationFeedbackRating === 0
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {isSavingNavigationFeedback
              ? "저장 중..."
              : "별점 남기고 계속하기"}
          </button>

          <button
            type="button"
            onClick={openOpinionSurvey}
            style={{
              width: "100%",
              marginTop: "10px",
              padding: "7px",
              border: "none",
              background: "transparent",
              color: "#64748B",
              fontSize: "12px",
              fontWeight: "800",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            설문부터 참여할게요 〉
          </button>

          {SURVEY_COUNT < SURVEY_LIMIT && (
            <div
              style={{
                marginTop: "4px",
                color: "#94A3B8",
                fontSize: "10.5px",
                lineHeight: 1.45,
                textAlign: "center",
                wordBreak: "keep-all",
              }}
            >
              커피 쿠폰은 별점 참여와 별도로,
              <br />
              1분 설문 제출 완료자를 대상으로 제공됩니다.
            </div>
          )}
        </>
      ) : (
        <>
          <div
            style={{
              marginTop: "6px",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "34px" }}>💙</div>

            <div
              style={{
                marginTop: "7px",
                color: "#0F172A",
                fontSize: "20px",
                fontWeight: "950",
              }}
            >
              별점을 남겨주셔서 감사해요!
            </div>

            <div
              style={{
                marginTop: "5px",
                color: "#64748B",
                fontSize: "12.5px",
                lineHeight: 1.5,
              }}
            >
              여러분의 평가가 휠더월드를
              <br />
              더 나은 서비스로 만드는 데 도움이 됩니다.
            </div>
          </div>

          <SurveyInviteCard compact />

          <button
            type="button"
            onClick={closeNavigationFeedbackModal}
            style={{
              width: "100%",
              marginTop: "11px",
              padding: "9px",
              border: "none",
              background: "transparent",
              color: "#64748B",
              fontSize: "12px",
              fontWeight: "800",
              cursor: "pointer",
            }}
          >
            다음에 할게요
          </button>
        </>
      )}
    </div>
  </div>
)}
             <div
  style={{
    width: "100%",
    height: "100%",
  }}
>
{!isBfMarkersLoaded ? (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#F8FAFC",
      color: "#475569",
      fontSize: "14px",
      fontWeight: "900",
    }}
  >
    지도 아이콘 불러오는 중...
  </div>
) : (
  <>
    {renderMarkerTypeFilter()}

    <KakaoMapTest
  bfMarkers={bfMarkers
    .filter((m) => m.status === "approved" || m.isOfficial === true)
    .filter(isMarkerTypeVisible)}
      routeSteps={routeSteps}
      isRainyMode={isRainyMode}
weatherInfo={weatherInfo}
      startMarkerPos={startMarkerPos}
      endMarkerPos={endMarkerPos}
      userLocation={userLocation}
      deviceHeading={deviceHeading}
      mapRef={mapRef}
      isAdminLoggedIn={isAdminLoggedIn}
      tempMarker={tempMarker}
      setTempMarker={setTempMarker}
      newMarkerType={newMarkerType}
      setNewMarkerType={setNewMarkerType}
      newMarkerDesc={newMarkerDesc}
      setNewMarkerDesc={setNewMarkerDesc}
      newMarkerImage={newMarkerImage}
      setNewMarkerImage={setNewMarkerImage}
      bfConfig={bfConfig}
      wheelLevel={wheelLevel}
      setWheelLevel={setWheelLevel}
    />
  </>
)}
</div>

            </div>
          </div>
        </div>
      )}

    
{/* 3. 주민 제보 화면 */}
{currentView === "create" && (
  <div
    style={{
      position: isMobile ? "relative" : "fixed",
      top: isMobile ? "auto" : 0,
      left: isMobile ? "auto" : 0,
      right: isMobile ? "auto" : 0,
      bottom: isMobile ? "auto" : 0,

      height: isMobile ? "100vh" : "100vh",
      display: "flex",
      flexDirection: "column",
      width: isMobile ? "100%" : "100vw",
      maxWidth: "none",

      padding: isMobile ? "0" : 0,
      margin: 0,
      boxSizing: "border-box",
      overflow: isMobile ? "visible" : "hidden",
      background: isMobile ? "transparent" : "#F8FAFC",
      zIndex: isMobile ? "auto" : 50,
    }}
  >
    <div
  style={{
    position: "relative",
    zIndex: 10000,
  }}
>
  {renderHeader()}
</div>

    <div
  style={{
    flex: 1,
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    marginTop: "60px",
    minHeight: 0,
    width: "100%",
    height: isMobile ? "auto" : "calc(100vh - 60px)",
    overflow: isMobile ? "visible" : "hidden",
    background: isMobile ? "transparent" : "#F8FAFC",
  }}
>
      {/* 제보 패널 */}
      <div
  style={{
    width: isMobile ? "100%" : "390px",
    height: isMobile ? "auto" : "100%",
    flexShrink: isMobile ? 1 : 0,
    padding: isMobile ? "10px 16px 12px" : "28px 24px",
    background: isMobile ? "#f9f9f9" : "#FFFFFF",
    borderRight: isMobile ? "none" : "1px solid #E2E8F0",
    overflowY: isMobile ? "visible" : "auto",
    position: "relative",
    zIndex: 3000,
    boxSizing: "border-box",
    boxShadow: isMobile
      ? "none"
      : "8px 0 24px rgba(15, 23, 42, 0.04)",
  }}
>
        
{!isMobile && (
  <h3>✍️ 주민 제보</h3>
)}

<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

 <div
  style={{
    display: "flex",
    gap: "8px",
    position: "relative",
    zIndex: 9999,
    overflow: "visible",
  }}
>

  <div style={{ flex: 1, position: "relative" }}>

    <input
      type="text"
      placeholder="주소 또는 장소 검색"
      value={searchKeyword}
      onChange={(e) => handleSearchKeywordChange(e.target.value)}
      style={{
  width: "100%",
  height: "38px",
  padding: "0 11px",
  boxSizing: "border-box",
  border: "1px solid #DCE3EC",
  borderRadius: "10px",
  background: "#FFFFFF",
  color: "#1E293B",
  fontSize: "12.5px",
  fontFamily: "inherit",
  outline: "none",
}}
    />

   

  </div>

  <button
    onClick={handleSearchPlace}
    style={{
  flexShrink: 0,
  width: "40px",
  height: "38px",
  padding: 0,
  border: "none",
  borderRadius: "10px",
  background: "#2563EB",
  color: "#FFFFFF",
  fontSize: "15px",
  fontWeight: "900",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 4px 10px rgba(37,99,235,0.18)",
}}
  >
    🔍
  </button>

  <button
  onClick={() => moveToMyLocation()}
  style={{
  flexShrink: 0,
  height: "38px",
  padding: "0 11px",
  borderRadius: "10px",
  border: "1px solid #BFDBFE",
  background: "#EFF6FF",
  color: "#2563EB",
  fontSize: "11.5px",
  fontWeight: "850",
  fontFamily: "inherit",
  cursor: "pointer",
  whiteSpace: "nowrap",
  boxShadow: "0 2px 6px rgba(37,99,235,0.08)",
}}
>
  내 위치
</button>
{searchSuggestions.length > 0 && (
  <ul
    style={{
      position: "absolute",
      top: "42px",
      left: 0,
      right: 0,
      zIndex: 9999,

      margin: "4px 0 0",
      padding: "5px 0",
      listStyle: "none",

      background: "#FFFFFF",
      border: "1px solid #E2E8F0",
      borderRadius: "8px",
      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",

      maxHeight: "none",
      overflow: "visible",
    }}
  >
    {searchSuggestions.map((item, idx) => {
      const name =
        typeof item === "string" ? item : item.name;

      return (
        <li
          key={idx}
          onClick={() => {
            setSearchKeyword(name);
            setSearchSuggestions([]);
          }}
          style={{
            padding: "10px 12px",
            fontSize: "13px",
            color: "#334155",
            cursor: "pointer",
            borderBottom:
              idx === searchSuggestions.length - 1
                ? "none"
                : "1px solid #F1F5F9",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#F1F5F9";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          🔍 {name}
        </li>
      );
    })}
  </ul>
)}
</div>



 <p style={{ fontSize: "12px", color: "#666" }}>
  📍 지도에서 제보할 위치를 더블 클릭해 주세요.
</p>

</div>

        {/* 관리자 승인 대기 목록 */}
{userRole === "admin" && (
  <div style={{ marginTop: "20px" }}>
    <h4>🚨 승인 대기 목록</h4>
    
    {/* 목록을 감싸는 div에 고정 높이와 스크롤 설정 */}
    <div style={{ 
      maxHeight: "200px", 
      overflowY: "auto", 
      border: "1px solid #ddd", 
      padding: "5px", 
      background: "#f9f9f9",
      borderRadius: "8px"
    }}>
      {bfMarkers.filter(m => m.status === 'pending').map(m => (
        <div key={m.id} style={{ 
          border: "1px solid #ddd", 
          padding: "8px", 
          marginBottom: "5px", 
          background: "white", 
          borderRadius: "4px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span style={{ fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {m.desc || "내용 없음"}
          </span>
          <button
  onClick={async () => {
  await update(ref(db, `bfMarkers/${m.id}`), {
    status: "approved",
    wheelLevel: 1
  });
}}
>
  🟡 1단계 승인
</button>

<button
 onClick={async () => {


  await update(ref(db, `bfMarkers/${m.id}`), {
    status: "approved",
    wheelLevel: 2
  });

}}
>
  🔴 2단계 승인
</button>
        </div>
      ))}
    </div>
  </div>
)}
      </div>

      {/* 지도 영역 */}
      <div
  style={{
    flex: 1,
    position: "relative",
    minWidth: isMobile ? "auto" : 0,
    minHeight: isMobile ? "auto" : 0,
    height: isMobile ? "auto" : "100%",
    overflow: isMobile ? "visible" : "hidden",
  }}
>
        

       {!isBfMarkersLoaded ? (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#F8FAFC",
      color: "#475569",
      fontSize: "14px",
      fontWeight: "900",
    }}
  >
    지도 아이콘 불러오는 중...
  </div>
) : (
  <>
    {renderMarkerTypeFilter()}

    <KakaoCreateMap
      bfMarkers={bfMarkers.filter(isMarkerTypeVisible)}
      userLocation={userLocation}
      deviceHeading={deviceHeading}
      isRainyMode={isRainyMode}
weatherInfo={weatherInfo}
      mapRef={mapRef}
      userRole={userRole}
      isAdminLoggedIn={isAdminLoggedIn}
      tempMarker={tempMarker}
      setTempMarker={setTempMarker}
      newMarkerType={newMarkerType}
      setNewMarkerType={setNewMarkerType}
      newMarkerDesc={newMarkerDesc}
      setNewMarkerDesc={setNewMarkerDesc}
      newMarkerImage={newMarkerImage}
      setNewMarkerImage={setNewMarkerImage}
      bfConfig={bfConfig}
      wheelLevel={wheelLevel}
      setWheelLevel={setWheelLevel}
    />
  </>
)}
      </div>
    </div>
  </div>
)}

      
    </div>
  );
}

function AddMarker({
  setBfMarkers,
  selectedType,
   setSelectedType,
  bfConfig,
  setTempMarker,
  tempMarker,
  desc,
  setDesc,
  image,
  setImage,
  isAdminLoggedIn,
  wheelLevel,
  setWheelLevel,
  clientId,
})
 {
  useMapEvents({
  click(e) {

    setTempMarker({
      lat: e.latlng.lat,
      lng: e.latlng.lng
    });

  }
});
  if (!tempMarker) return null;

  return (
    <Marker position={[tempMarker.lat, tempMarker.lng]}>
      <Popup onClose={() => setTempMarker(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "180px" }}>
          {/* 여기서도 props로 받은 isAdminLoggedIn을 사용하세요 */}
          <h4>{isAdminLoggedIn ? "공식 요인 등록" : "새로운 제보 등록"}</h4>
          <select
  value={selectedType}
  onChange={(e) => setSelectedType(e.target.value)}
  style={{
    padding: "6px",
    borderRadius: "6px",
    border: "1px solid #ccc"
  }}
>
  {Object.keys(bfConfig).map((key) => (
    <option key={key} value={key}>
      {bfConfig[key].label}
    </option>
  ))}
</select>
          <textarea 
            placeholder="상세 설명을 입력하세요..." 
            value={desc}
            onChange={(e) => setDesc(e.target.value)} 
            style={{ height: "60px" }}
          />
          <input type="file" accept="image/*" onChange={(e) => {
            const reader = new FileReader();
            reader.onloadend = () => setImage(reader.result);
            reader.readAsDataURL(e.target.files[0]);
          }} />
          
          <button onClick={async () => {
  if (!desc) {
    alert("설명을 입력해주세요!");
    return;
  }

  await push(ref(db, "bfMarkers"), {
  lat: tempMarker.lat,
  lng: tempMarker.lng,
  type: selectedType,
  desc,
  image,
  date: new Date().toLocaleDateString(),
  status: isAdminLoggedIn ? "approved" : "pending",
  isOfficial: isAdminLoggedIn,
  wheelLevel: isAdminLoggedIn ? wheelLevel : null,
  ownerId: clientId
});

  setTempMarker(null);
  setDesc("");
  setImage(null);

  alert(
    isAdminLoggedIn
      ? "공식 아이콘이 등록되었습니다."
      : "제보 완료! 관리자 승인을 기다려주세요."
  );

}}>
            {isAdminLoggedIn ? "등록하기" : "제보하기"}
          </button>
        </div>
      </Popup>
    </Marker>
  );
}

export default App;