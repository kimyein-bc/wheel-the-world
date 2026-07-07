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
  update,
  remove,
  get
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

const KakaoMapTest = ({
  bfMarkers = [],
  routeSteps = [],
  startMarkerPos = null,
  endMarkerPos = null,
  userLocation = null,
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
  const wheelOverlayRef = useRef(null);
const wheelAnimationRef = useRef(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const isAdminLoggedInRef = useRef(isAdminLoggedIn);

isAdminLoggedInRef.current = isAdminLoggedIn;
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
    const normalizedType = type === "stairs" ? "step" : type;

    const markerInfo = {
      step: {
        label: "단차 / 계단",
        icon: "🪜",
        color: "#EF4444",
      },
      narrow: {
        label: "좁은 길",
        icon: "↔️",
        color: "#F97316",
      },
      obstacle: {
        label: "장애물",
        icon: "🚧",
        color: "#F59E0B",
      },
      elevator: {
        label: "엘리베이터",
        icon: "🛗",
        color: "#2563EB",
      },
      slope: {
        label: "경사",
        icon: "⛰️",
        color: "#8B5CF6",
      },
      sidewalk: {
        label: "보도 상태",
        icon: "🛣️",
        color: "#10B981",
      },
    };

    return (
      markerInfo[normalizedType] || {
        label: "기타",
        icon: "📍",
        color: "#64748B",
      }
    );
  };

  const clearKakaoOverlays = () => {
    overlayRefs.current.forEach((overlay) => {
      overlay.setMap(null);
    });
    overlayRefs.current = [];
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

  const markerEl = document.createElement("div");
  markerEl.style.width = "22px";
  markerEl.style.height = "22px";
  markerEl.style.borderRadius = "50%";
  markerEl.style.background = "#2563EB";
  markerEl.style.border = "4px solid white";
  markerEl.style.boxShadow = "0 0 14px rgba(37,99,235,0.65)";
  markerEl.style.boxSizing = "border-box";

  const pulseEl = document.createElement("div");
  pulseEl.style.position = "absolute";
  pulseEl.style.left = "50%";
  pulseEl.style.top = "50%";
  pulseEl.style.width = "44px";
  pulseEl.style.height = "44px";
  pulseEl.style.borderRadius = "50%";
  pulseEl.style.background = "rgba(37,99,235,0.18)";
  pulseEl.style.transform = "translate(-50%, -50%)";
  pulseEl.style.zIndex = "-1";

  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.width = "22px";
  wrapper.style.height = "22px";
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

  const validMarkers = bfMarkers.filter(
    (m) =>
      m &&
      typeof m.lat === "number" &&
      typeof m.lng === "number" &&
      !Number.isNaN(m.lat) &&
      !Number.isNaN(m.lng)
  );

  validMarkers.forEach((m) => {
    const info = getKakaoMarkerInfo(m.type);

    const markerEl = document.createElement("div");
    markerEl.style.position = "relative";
    markerEl.style.display = "flex";
    markerEl.style.alignItems = "center";
    markerEl.style.justifyContent = "center";
    markerEl.style.width = "38px";
    markerEl.style.height = "38px";
    markerEl.style.borderRadius = "50%";
    markerEl.style.background = info.color;
    markerEl.style.color = "white";
    markerEl.style.fontSize = "20px";
    markerEl.style.fontWeight = "900";
    markerEl.style.border = "3px solid white";
    markerEl.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
    markerEl.style.cursor = "pointer";
    markerEl.style.opacity =
      m.status === "approved" || m.isOfficial === true ? "1" : "0.55";
    markerEl.innerText = info.icon;

    markerEl.onclick = () => {
  const markerApproved = m.status === "approved" || m.isOfficial === true;

  setSelectedMarker({
    ...m,
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
      kakao.maps.event.addListener(map, "dblclick", (mouseEvent) => {
  if (!isAdminLoggedInRef.current) return;

  const latLng = mouseEvent.latLng;

  setSelectedMarker(null);

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

      drawKakaoMarkers(kakao, map);
      drawKakaoRouteLine(kakao, map, routeSteps);
      drawUserLocationMarker(kakao, map);
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
  clearKakaoRoute();
  clearWheelRouteAnimation();
};
}, []);

useEffect(() => {
  if (!window.kakao || !window.kakao.maps || !kakaoMapRef.current) return;

  drawKakaoMarkers(window.kakao, kakaoMapRef.current);
}, [bfMarkers]);

useEffect(() => {
  if (!window.kakao || !window.kakao.maps || !kakaoMapRef.current) return;

  drawKakaoRouteLine(window.kakao, kakaoMapRef.current, routeSteps);
  startWheelRouteAnimation(window.kakao, kakaoMapRef.current, routeSteps);
}, [routeSteps, startMarkerPos, endMarkerPos]);

useEffect(() => {
  if (!window.kakao || !window.kakao.maps || !kakaoMapRef.current) return;

  drawUserLocationMarker(window.kakao, kakaoMapRef.current);
}, [userLocation]);

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
  <button
    onClick={async () => {
      const ok = window.confirm("이 공식 아이콘을 삭제할까요?");
      if (!ok) return;

      try {
        await remove(ref(db, `bfMarkers/${selectedMarker.id}`));

        setSelectedMarker(null);
        alert("아이콘이 삭제되었습니다.");
      } catch (error) {
        alert("아이콘 삭제 중 오류가 발생했습니다.");
      }
    }}
    style={{
      width: "100%",
      marginTop: "12px",
      border: "none",
      borderRadius: "12px",
      padding: "10px",
      background: "#FEE2E2",
      color: "#B91C1C",
      fontWeight: "900",
      cursor: "pointer",
    }}
  >
    관리자 삭제
  </button>
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
      공식 요인 등록
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
        reader.onloadend = () => setNewMarkerImage(reader.result);
        reader.readAsDataURL(file);
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
          setNewMarkerDesc("");
          setNewMarkerImage(null);
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
            await push(ref(db, "bfMarkers"), {
              lat: Number(tempMarker.lat),
              lng: Number(tempMarker.lng),
              type: newMarkerType,
              desc: newMarkerDesc,
              image: newMarkerImage || "",
              date: new Date().toLocaleDateString(),
              status: "approved",
              isOfficial: true,
              wheelLevel: Number(wheelLevel),
            });

            alert("공식 요인이 등록되었습니다.");

            setTempMarker(null);
            setNewMarkerDesc("");
            setNewMarkerImage(null);
            setNewMarkerType("step");
            setWheelLevel(1);
          } catch (error) {
            alert("공식 요인 저장 중 오류가 발생했습니다.");
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
        등록
      </button>
    </div>
  </div>
)}
    </div>
  );
};
const KakaoCreateMap = ({
  bfMarkers = [],
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
}) => {
 const mapDivRef = useRef(null);
const kakaoMapRef = useRef(null);
const overlayRefs = useRef([]);
const tempOverlayRef = useRef(null);
const isAdminLoggedInRef = useRef(isAdminLoggedIn);
const [selectedCreateMarker, setSelectedCreateMarker] = useState(null);
const clientIdRef = useRef(getWheelWorldClientId());
const currentClientId = clientIdRef.current;
const [editingMarkerId, setEditingMarkerId] = useState(null);



// 관리자 로그인 상태를 항상 최신으로 유지
isAdminLoggedInRef.current = isAdminLoggedIn;

  const getKakaoMarkerInfo = (type) => {
    const normalizedType = type === "stairs" ? "step" : type;

    const markerInfo = {
      step: {
        label: "단차 / 계단",
        icon: "🪜",
        color: "#EF4444",
      },
      narrow: {
        label: "좁은 길",
        icon: "↔️",
        color: "#F97316",
      },
      obstacle: {
        label: "장애물",
        icon: "🚧",
        color: "#F59E0B",
      },
      elevator: {
        label: "엘리베이터",
        icon: "🛗",
        color: "#2563EB",
      },
      slope: {
        label: "경사",
        icon: "⛰️",
        color: "#8B5CF6",
      },
      sidewalk: {
        label: "보도 상태",
        icon: "🛣️",
        color: "#10B981",
      },
    };

    return (
      markerInfo[normalizedType] || {
        label: "기타",
        icon: "📍",
        color: "#64748B",
      }
    );
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

   const validMarkers = bfMarkers.filter(
  (m) =>
    m &&
    typeof m.lat === "number" &&
    typeof m.lng === "number" &&
    !Number.isNaN(m.lat) &&
    !Number.isNaN(m.lng)
);

    validMarkers.forEach((m) => {
      const info = getKakaoMarkerInfo(m.type);
      const isApproved = m.status === "approved" || m.isOfficial === true;

      const markerEl = document.createElement("div");
      markerEl.style.position = "relative";
      markerEl.style.display = "flex";
      markerEl.style.alignItems = "center";
      markerEl.style.justifyContent = "center";
      markerEl.style.width = "38px";
      markerEl.style.height = "38px";
      markerEl.style.borderRadius = "50%";
      markerEl.style.background = "white";
      markerEl.style.color = "#111827";
      markerEl.style.fontSize = "20px";
      markerEl.style.fontWeight = "900";
      markerEl.style.border = isApproved
        ? `3px solid ${info.color}`
        : "3px dashed #999";
      markerEl.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
      markerEl.style.cursor = "pointer";
      markerEl.style.opacity = isApproved ? "1" : "0.65";
      markerEl.innerText = info.icon;

      markerEl.onclick = () => {
  setTempMarker(null);

  setSelectedCreateMarker({
    ...m,
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
        image: newMarkerImage || "",
        updatedAt: new Date().toLocaleString(),
        status: isAdminLoggedIn ? "approved" : "pending",
        isOfficial: isAdminLoggedIn,
        wheelLevel: isAdminLoggedIn ? Number(wheelLevel) : 0,
      });

      alert(
        isAdminLoggedIn
          ? "공식 요인이 수정되었습니다."
          : "제보가 수정되었습니다. 관리자 승인 후 지도에 반영됩니다."
      );
    } else {
      await push(ref(db, "bfMarkers"), {
        lat: Number(tempMarker.lat),
        lng: Number(tempMarker.lng),
        type: newMarkerType,
        desc: newMarkerDesc,
        image: newMarkerImage || "",
        date: new Date().toLocaleDateString(),
        createdAt: Date.now(),
        ownerId: currentClientId,
        status: isAdminLoggedIn ? "approved" : "pending",
        isOfficial: isAdminLoggedIn,
        wheelLevel: isAdminLoggedIn ? Number(wheelLevel) : 0,
      });

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

        drawKakaoCreateMarkers(kakao, map);
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
    if (!window.kakao || !window.kakao.maps || !kakaoMapRef.current) return;

    drawKakaoCreateMarkers(window.kakao, kakaoMapRef.current);
  }, [bfMarkers, tempMarker]);
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
        지도에서 위치를 더블클릭해 제보하기
      </div>
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
              reader.onloadend = () => setNewMarkerImage(reader.result);
              reader.readAsDataURL(file);
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

const [bfMarkers, setBfMarkers] = useState([]);

useEffect(() => {
  const markersRef = ref(db, "bfMarkers");

  const unsubscribe = onValue(markersRef, (snapshot) => {
    const data = snapshot.val();

    if (!data) {
      setBfMarkers([]);
      return;
    }

    const markers = Object.entries(data).map(([id, value]) => ({
      id,
      ...value
    }));

    setBfMarkers(markers);
  });

  return () => unsubscribe();
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
const [newMarkerDesc, setNewMarkerDesc] = useState("");
const [newMarkerImage, setNewMarkerImage] = useState(null);
// 5가지 안전/위험 요소 디자인 구성 설정
const bfConfig = {
  step: { label: "🪜 단차 / 계단", color: "#EF4444", icon: "🪜" },
  narrow: { label: "↔️ 좁은 도로", color: "#F59E0B", icon: "↔️" },
   obstacle: {
    label: "🚧 실시간 장애물 (공사/웅덩이)",
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
  const [currentView, setCurrentView] = useState("home");
  const [markers, setMarkers] = useState([]);
  const [selectedType, setSelectedType] = useState("step");
  const [userLocation, setUserLocation] = useState(null);
  const [isSurveying, setIsSurveying] = useState(false);
  const [surveyTracks, setSurveyTracks] = useState([]);
const [surveyTrack, setSurveyTrack] = useState([]);
  const [startCoords, setStartCoords] = useState(null);
const [endCoords, setEndCoords] = useState(null);
 

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

  try {
    const snapshot = await get(ref(db, "bfMarkers"));
    const data = snapshot.val();

    if (!data) {
      alert("백업할 아이콘 데이터가 없습니다. Firebase의 bfMarkers 경로를 확인해 주세요.");
      return;
    }

    const markers = Object.entries(data).map(([id, value]) => ({
      id,
      ...value
    }));

    const backupData = {
      backedUpAt: new Date().toISOString(),
      count: markers.length,
      bfMarkers: markers,
      rawBfMarkers: data
    };

    const json = JSON.stringify(backupData, null, 2);
    const blob = new Blob([json], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    const today = new Date().toISOString().slice(0, 10);

    a.href = url;
    a.download = `wheel-the-world-bfMarkers-backup-${today}.json`;

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`${markers.length}개의 아이콘 데이터를 백업했습니다.`);
  } catch (error) {
    console.error("백업 실패:", error);
    alert("백업 중 오류가 발생했습니다. 콘솔을 확인해 주세요.");
  }
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
const getObstacles = (mode, bfMarkers) => {
  // 일반 모드거나 마커가 없으면 회피 안 함
  if (mode === "normal" || !bfMarkers || bfMarkers.length === 0) {
    return null;
  }

  // ✅ 승인된 마커만 경로 회피에 사용
  const approvedMarkers = bfMarkers.filter(
    (m) => m.status === "approved" || m.isOfficial === true
  );

  let targetMarkers = [];

  // wheel1: 1단계, 2단계 모두 회피
  if (mode === "wheel1") {
    targetMarkers = approvedMarkers.filter(
      (m) => Number(m.wheelLevel) === 1 || Number(m.wheelLevel) === 2
    );
  }

  // wheel2: 2단계만 회피
  else if (mode === "wheel2") {
    targetMarkers = approvedMarkers.filter(
      (m) => Number(m.wheelLevel) === 2
    );
  }

  if (targetMarkers.length === 0) return null;

  const polygons = targetMarkers.map((marker) => {
    const buffer = 0.00015;

    return [[
      [marker.lng - buffer, marker.lat - buffer],
      [marker.lng + buffer, marker.lat - buffer],
      [marker.lng + buffer, marker.lat + buffer],
      [marker.lng - buffer, marker.lat + buffer],
      [marker.lng - buffer, marker.lat - buffer],
    ]];
  });


  return {
    type: "MultiPolygon",
    coordinates: polygons,
  };
};
const getRoute = async (start, end, mode = "normal", bfMarkers = []) => {
  const emptyRouteResult = {
    routeCoords: [],
    distance: 0,
    duration: 0
  };

  try {
    const avoidOptions = getObstacles(mode, bfMarkers);

    const bodyData = {
      coordinates: [
        [start.lng, start.lat],
        [end.lng, end.lat],
      ]
    };

    if (avoidOptions) {
      bodyData.options = {
        avoid_polygons: avoidOptions
      };
    }

    const url = "https://api.openrouteservice.org/v2/directions/wheelchair/geojson";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: ORS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyData),
    });

    const data = await res.json();

    if (data.error) {
      console.error("API 에러 상세:", data.error);
      return emptyRouteResult;
    }

    if (!data.features || data.features.length === 0) {
      return emptyRouteResult;
    }

    const routeCoords = data.features[0].geometry.coordinates.map(
      ([lng, lat]) => [lat, lng]
    );

    const summary = data.features[0].properties.summary;

    return {
      routeCoords,
      distance: (summary.distance / 1000).toFixed(1),
      duration: Math.round(summary.duration / 60)
    };

  } catch (err) {
    console.error("getRoute 오류:", err);
    console.error(err.stack);
    return emptyRouteResult;
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
      alert("경로 생성 실패 (매칭되는 도보/도로가 없습니다)");
      return;
    }

    // 🔥 3. 지도 이동
    if (mapRef.current && typeof mapRef.current.fitBounds === "function") {
  mapRef.current.fitBounds(route, {
    padding: [50, 50],
  });
}

    // 🔥 4. 지도 경로 저장
    setRouteSteps(route);

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

// setPoint 파라미터를 추가합니다. (예: setStartPoint 또는 setEndPoint)
const moveToMyLocation = async (setPoint, setCoords) => {
  if (!navigator.geolocation) {
    alert("이 브라우저에서는 GPS를 지원하지 않습니다.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const myLocation = [lat, lng];

      setUserLocation(myLocation);

if (setCoords) {
  const coords = {
    lat,
    lng,
  };


  setCoords(coords);
}
      setIsFollowingUser(true);

      if (mapRef.current) {
        mapRef.current.flyTo(myLocation, 17, { duration: 1.5 });
      }

      // --- 📍 수정된 부분: 주소 변환 안 하고 '내 위치'라고만 적기 ---
      if (typeof setPoint === "function") {
  setPoint("내 위치");
}
      // ----------------------------------------------------

      setTimeout(() => {
        setIsFollowingUser(false);
      }, 3000);
    },
    (error) => {
      console.error(error);
      alert("현재 위치를 가져올 수 없습니다.");
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
};
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
          onClick={downloadBfMarkersBackup}
          style={{
            padding: "8px 10px",
            border: "none",
            borderRadius: "8px",
            background: "#DCFCE7",
            color: "#166534",
            fontSize: "12px",
            fontWeight: "700",
            cursor: "pointer",
          }}
        >
          백업
        </button>
      )}

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
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: isMobile ? "18px 18px 34px" : "40px 20px",
      position: "relative",
      boxSizing: "border-box",
      width: "100%",
      minHeight: "100vh",
      overflow: "hidden",
    }}
  >
    <CuteCartoonBackground />

    <div
      style={{
        position: "relative",
        zIndex: 2,
        width: "100%",
        maxWidth: isMobile ? "370px" : "430px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        transform: isMobile ? "translateY(-34px)" : "translateY(-18px)",
      }}
    >
      <div
        style={{
          transform: isMobile ? "scale(0.72)" : "scale(0.92)",
          marginTop: isMobile ? "-88px" : "-48px",
          marginBottom: isMobile ? "-166px" : "-70px",
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
          padding: isMobile ? "10px 18px" : "12px 24px",
          marginBottom: isMobile ? "18px" : "22px",
        }}
      >
        <div
          style={{
            fontSize: isMobile ? "14px" : "16px",
            color: "#1976D2",
            fontWeight: "900",
            letterSpacing: "0.2px",
            marginBottom: "2px",
          }}
        >
          모든 길은 모두를 위해
        </div>

        <div
          style={{
            fontSize: isMobile ? "15px" : "18px",
            color: "#1F2937",
            fontWeight: "800",
            lineHeight: "1.35",
            wordBreak: "keep-all",
          }}
        >
          함께 만드는 우리 동네 무장애 생활지도
        </div>
      </div>

      <div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: isMobile ? "15px" : "18px",
    width: "100%",
  }}
>
  <button
    onClick={openSearchView}
    style={{
      width: "100%",
      border: "none",
      borderRadius: "30px",
      padding: isMobile ? "18px 18px" : "22px 22px",
      background:
        "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(219,234,254,0.96))",
      boxShadow:
        "0 10px 0 rgba(147,197,253,0.5), 0 18px 34px rgba(30,64,175,0.16)",
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
        "0 13px 0 rgba(147,197,253,0.5), 0 22px 38px rgba(30,64,175,0.2)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "translateY(0px)";
      e.currentTarget.style.boxShadow =
        "0 10px 0 rgba(147,197,253,0.5), 0 18px 34px rgba(30,64,175,0.16)";
    }}
  >
    <div
      style={{
        position: "absolute",
        top: "-35px",
        right: "-32px",
        width: "105px",
        height: "105px",
        borderRadius: "50%",
        background: "rgba(147,197,253,0.25)",
      }}
    />

    <div
      style={{
        position: "absolute",
        bottom: "-24px",
        left: "35%",
        width: "120px",
        height: "48px",
        borderRadius: "50%",
        background: "rgba(255,255,255,0.45)",
      }}
    />

    <div
      style={{
        width: isMobile ? "58px" : "64px",
        height: isMobile ? "58px" : "64px",
        borderRadius: "24px",
        background: "linear-gradient(135deg, #60A5FA, #2563EB)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: isMobile ? "29px" : "32px",
        flexShrink: 0,
        boxShadow:
          "inset 0 0 0 2px rgba(255,255,255,0.45), 0 8px 16px rgba(37,99,235,0.25)",
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
          fontSize: "10.5px",
          fontWeight: "900",
          padding: "4px 9px",
          borderRadius: "999px",
          marginBottom: "7px",
          letterSpacing: "-0.2px",
        }}
      >
        바퀴가 편한 길 찾기
      </div>

      <div
        style={{
          fontSize: isMobile ? "19px" : "21px",
          fontWeight: "950",
          color: "#1E3A8A",
          marginBottom: "5px",
          letterSpacing: "-0.5px",
        }}
      >
        안전 길찾기
      </div>

      <div
        style={{
          fontSize: isMobile ? "12.5px" : "13.5px",
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
        position: "relative",
        zIndex: 1,
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        background: "rgba(255,255,255,0.95)",
        color: "#2563EB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "20px",
        fontWeight: "900",
        boxShadow: "0 4px 10px rgba(37,99,235,0.18)",
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
      borderRadius: "30px",
      padding: isMobile ? "18px 18px" : "22px 22px",
      background:
        "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(209,250,229,0.96))",
      boxShadow:
        "0 10px 0 rgba(110,231,183,0.5), 0 18px 34px rgba(6,95,70,0.14)",
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
        "0 13px 0 rgba(110,231,183,0.5), 0 22px 38px rgba(6,95,70,0.18)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "translateY(0px)";
      e.currentTarget.style.boxShadow =
        "0 10px 0 rgba(110,231,183,0.5), 0 18px 34px rgba(6,95,70,0.14)";
    }}
  >
    <div
      style={{
        position: "absolute",
        top: "-35px",
        right: "-32px",
        width: "105px",
        height: "105px",
        borderRadius: "50%",
        background: "rgba(110,231,183,0.25)",
      }}
    />

    <div
      style={{
        position: "absolute",
        bottom: "-24px",
        left: "35%",
        width: "120px",
        height: "48px",
        borderRadius: "50%",
        background: "rgba(255,255,255,0.45)",
      }}
    />

    <div
      style={{
        width: isMobile ? "58px" : "64px",
        height: isMobile ? "58px" : "64px",
        borderRadius: "24px",
        background: "linear-gradient(135deg, #34D399, #059669)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: isMobile ? "29px" : "32px",
        flexShrink: 0,
        boxShadow:
          "inset 0 0 0 2px rgba(255,255,255,0.45), 0 8px 16px rgba(5,150,105,0.22)",
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
          fontSize: "10.5px",
          fontWeight: "900",
          padding: "4px 9px",
          borderRadius: "999px",
          marginBottom: "7px",
          letterSpacing: "-0.2px",
        }}
      >
        우리 동네 길 정보 모으기
      </div>

      <div
        style={{
          fontSize: isMobile ? "19px" : "21px",
          fontWeight: "950",
          color: "#065F46",
          marginBottom: "5px",
          letterSpacing: "-0.5px",
        }}
      >
        주민 제보
      </div>

      <div
        style={{
          fontSize: isMobile ? "12.5px" : "13.5px",
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
        position: "relative",
        zIndex: 1,
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        background: "rgba(255,255,255,0.95)",
        color: "#059669",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "20px",
        fontWeight: "900",
        boxShadow: "0 4px 10px rgba(5,150,105,0.16)",
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
          marginTop: isMobile ? "28px" : "34px",
          fontSize: "11px",
          color: "rgba(31,41,55,0.42)",
          cursor: "pointer",
          userSelect: "none",
          background: "rgba(255,255,255,0.38)",
          padding: "6px 12px",
          borderRadius: "999px",
          backdropFilter: "blur(6px)",
        }}
      >
        © 2026 Wheel the World.
      </footer>
    </div>
  </div>
)}

      {/* 2. 안전 길찾기 화면 */}
      {currentView === "search" && (
        <div style={{ 
          width: "100%", 
          maxWidth: "850px",      
          flex: 1   
                        
        }}>
          {renderHeader()}
          
          <div
  style={{
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    height: "calc(100vh - 60px)",
    width: "100%",
    marginTop: "60px"
  }}
>
                 
            {/* 왼쪽 사이드바 영역 */}
            <div style={{ 
              width: isMobile ? "100%" : "320px",
              height: isMobile ? "250px" : "100%", 
              background: "#ffffff", 
              borderRight: "1px solid #EAEAEA", 
              padding: "20px 16px", 
              overflowY: "auto", 
              display: "flex", 
              flexDirection: "column", 
              gap: "15px" 
            }}>
              
              
              <form 
                onSubmit={handleSearchRoute} 
                onClick={(e) => e.stopPropagation()} 
                style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: "3px", 
                  background: "#F8FAFC", 
                  padding: "1px", 
                  borderRadius: "16px", 
                  border: "1px solid #E2E8F0" 
                }}
              ><div onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
<div
  style={{
    display: "flex",
    gap: "4px",
    marginBottom: "15px",
    padding: "4px",
    background: "#E2E8F0",
    borderRadius: "8px"
  }}
>
  {[
    { id: "normal", label: "일반 모드" },
    { id: "wheel1", label: "바퀴 모드 1" },
    { id: "wheel2", label: "바퀴 모드 2" }
  ].map((mode) => (
    <button
      key={mode.id}
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setRouteMode(mode.id);
      }}
      style={{
        flex: 1,
        padding: "8px 0",
        border: "none",
        borderRadius: "6px",
        fontSize: "14px",
        fontWeight: routeMode === mode.id ? "600" : "400",
        background:
          routeMode === mode.id ? "white" : "transparent",
        color:
          routeMode === mode.id ? "#1E293B" : "#475569",
        cursor: "pointer",
        transition: "all 0.2s ease"
      }}
    >
      {mode.label}
    </button>
  ))}
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
      placeholder="출발지 입력 또는 선택"
      style={{
        flex: 1, // 남은 공간 모두 차지
        padding: "10px",
        borderRadius: "8px",
        border: "1px solid #CBD5E1"
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
    width: "58px",
    minWidth: "58px",
    padding: "0 8px",
    borderRadius: "8px",
    background: "#3B82F6",
    color: "white",
    border: "none",
    cursor: "pointer",
    fontWeight: "900",
    fontSize: "12px",
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
      placeholder="목적지 입력 또는 선택"
      style={{
        flex: 1,
        padding: "10px",
        borderRadius: "8px",
        border: "1px solid #CBD5E1"
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
    width: "58px",
    minWidth: "58px",
    padding: "0 8px",
    borderRadius: "8px",
    background: "#3B82F6",
    color: "white",
    border: "none",
    cursor: "pointer",
    fontWeight: "900",
    fontSize: "12px",
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
                  padding: "12px", 
                  background: "#1976D2", 
                  color: "#fff", 
                  border: "none", 
                  borderRadius: "10px", 
                  fontWeight: "700",
                  cursor: "pointer"
                }}>
                  🚀 안전 경로 탐색
                </button>
              </form>

            
            </div>

            {/* 오른쪽 지도 영역 */}
            <div style={{ 
              flex: 1, 
              position: "relative",
              height: isMobile ? "calc(100vh - 250px)" : "100%" 
            }}>
              
             {routeInfo && (
  <div
    style={{
      position: "absolute",
      top: "12px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "8px",
      width: isMobile ? "calc(100% - 24px)" : "auto",
      pointerEvents: "none",
    }}
  >
    <div
      style={{
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(8px)",
        padding: "8px 16px",
        borderRadius: "999px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
        display: "flex",
        gap: "18px",
        fontWeight: "600",
        fontSize: "14px",
        pointerEvents: "auto",
      }}
    >
      <span>📏 {routeInfo.distance}km</span>
      <span>⏱ {routeInfo.duration}분</span>
    </div>
  </div>
)}
             <div
  style={{
    width: "100%",
    height: "100%",
  }}
>
<KakaoMapTest
  bfMarkers={bfMarkers.filter(
    (m) => m.status === "approved" || m.isOfficial === true
  )}
  routeSteps={routeSteps}
  startMarkerPos={startMarkerPos}
  endMarkerPos={endMarkerPos}
  userLocation={userLocation}
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
</div>

            </div>
          </div>
        </div>
      )}

    
{/* 3. 주민 제보 화면 */}
{currentView === "create" && (
  <div
    style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      width: "100%",
      padding: isMobile ? "0" : "20px",
      boxSizing: "border-box",
    }}
  >
    {renderHeader()}

    <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row" }}>
      {/* 제보 패널 */}
      <div style={{ width: isMobile ? "100%" : "320px", padding: "20px", background: "#f9f9f9", overflowY: "auto" }}>
        
<h3>✍️ 새로운 안전 요인 제보</h3>

<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

  <div style={{ display: "flex", gap: "8px" }}>

  <div style={{ flex: 1, position: "relative" }}>

    <input
      type="text"
      placeholder="주소 또는 장소 검색"
      value={searchKeyword}
      onChange={(e) => handleSearchKeywordChange(e.target.value)}
      style={{
        width: "100%",
        padding: "10px",
        border: "1px solid #ddd",
        borderRadius: "8px"
      }}
    />

    {searchSuggestions.length > 0 && (
      <div
        style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          background: "white",
          border: "1px solid #ddd",
          borderRadius: "8px",
          zIndex: 2000,
          maxHeight: "200px",
          overflowY: "auto"
        }}
      >
        {searchSuggestions.map((item, idx) => (
          <div
            key={idx}
            onClick={() => {
              setSearchKeyword(item.name);

              mapRef.current.flyTo(
                [item.lat, item.lng],
                18,
                { duration: 1.5 }
              );

              setSearchSuggestions([]);
            }}
            style={{
              padding: "10px",
              cursor: "pointer",
              borderBottom: "1px solid #eee"
            }}
          >
            {item.name}
          </div>
        ))}
      </div>
    )}

  </div>

  <button
    onClick={handleSearchPlace}
    style={{
      padding: "10px 14px",
      border: "none",
      borderRadius: "8px",
      background: "#10B981",
      color: "white",
      cursor: "pointer"
    }}
  >
    🔍
  </button>

  <button
  onClick={() => moveToMyLocation()}
  style={{
    width: "58px",
    minWidth: "58px",
    padding: "0 8px",
    border: "none",
    borderRadius: "8px",
    background: "#2563EB",
    color: "white",
    cursor: "pointer",
    fontWeight: "900",
    fontSize: "12px",
    whiteSpace: "nowrap",
  }}
>
  내 위치
</button>
</div>



 <p style={{ fontSize: "12px", color: "#666" }}>
  📍 지도에서 제보할 위치를 클릭하세요.
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
      <div style={{ flex: 1, position: "relative" }}>
        

       <KakaoCreateMap
  bfMarkers={bfMarkers}
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