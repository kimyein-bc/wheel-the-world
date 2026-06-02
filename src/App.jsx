import { useState, useEffect, useRef } from "react";
import { divIcon } from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  Polyline,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import DaumPostcode from 'react-daum-postcode';
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
async function getRoute(start, end) {
  const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.routes || !data.routes.length) return null;

  return data.routes[0].geometry.coordinates.map(
    (coord) => [coord[1], coord[0]]
  );
}
// 기본 마커 아이콘 문제 해결
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function getLabel(type) {
  if (type === "stairs") return "🪜 단차 / 계단";
  if (type === "narrow") return "↔️ 좁은 도로";
  if (type === "obstacle") return "🚧 실시간 장애물";
  if (type === "elevator") return "🛗 엘리베이터";
  if (type === "slope") return "📐 경사도";
  if (type === "sidewalk") return "🧱 보도블럭 파손";
  return type;
}

function getIcon(type) {
  const config = {
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

function AddMarker({ setMarkers, selectedType }) {
  useMapEvents({
    click(e) {
      setMarkers(prev => [
        ...prev,
        { id: Date.now(),
  lat: e.latlng.lat,
  lng: e.latlng.lng,
  type: selectedType,
  status: "pending", },
      ]);
    },
  });
  return null;
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
const CuteCartoonBackground = () => (
  <>
    <style>{`
      @keyframes moveRight {
        0% {
          transform: translateX(-180px);
        }
        100% {
          transform: translateX(calc(100vw + 220px));
        }
      }

      @keyframes moveLeft {
        0% {
          transform: translateX(calc(100vw + 220px));
        }
        100% {
          transform: translateX(-220px);
        }
      }

      @keyframes floaty {
        0%, 100% {
          transform: translateY(0px);
        }
        50% {
          transform: translateY(-6px);
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
      }}
    >
      {/* 하늘 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, #BEE7FF 0%, #EAF7FF 55%, #F9FDFF 100%)",
        }}
      />

      {/* 구름 */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "8%",
          width: "170px",
          height: "60px",
          background: "white",
          borderRadius: "50px",
          opacity: 0.9,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "16%",
          right: "12%",
          width: "220px",
          height: "70px",
          background: "white",
          borderRadius: "50px",
          opacity: 0.85,
        }}
      />

      {/* 언덕 */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          width: "100%",
          height: "38%",
          background: "#8EE29B",
          borderTopLeftRadius: "40% 15%",
          borderTopRightRadius: "40% 15%",
        }}
      />

      {/* 길 */}
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          width: "100%",
          height: "90px",
          background: "#F5E6C8",
          borderTop: "5px solid #E2CFA7",
        }}
      />

      {/* 점선 */}
      <div
        style={{
          position: "absolute",
          bottom: "14%",
          width: "100%",
          height: "6px",
          background:
            "repeating-linear-gradient(to right, white 0 28px, transparent 28px 50px)",
          opacity: 0.9,
        }}
      />

      {/* 휠체어 */}
      <div
        style={{
          position: "absolute",
          bottom: "13%",
          animation: "moveRight 24s linear infinite",
        }}
      >
        <svg
          width="140"
          height="140"
          viewBox="0 0 140 140"
          style={{ animation: "floaty 2s ease-in-out infinite" }}
        >
          {/* 바퀴 */}
          <circle cx="50" cy="95" r="28" fill="#2D3748" />
          <circle cx="50" cy="95" r="18" fill="#7DD3FC" />

          <circle cx="100" cy="108" r="11" fill="#2D3748" />
          <circle cx="100" cy="108" r="5" fill="#CBD5E1" />

          {/* 몸체 */}
          <path
            d="M58 45 L58 82 L92 82"
            stroke="#4B5563"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />

          {/* 사람 */}
          <circle cx="62" cy="28" r="12" fill="#FFD6B3" />

          <path
            d="M58 42 Q75 48 82 68"
            stroke="#7C3AED"
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />

          <path
            d="M78 68 L93 98"
            stroke="#374151"
            strokeWidth="8"
            strokeLinecap="round"
          />

          <path
            d="M62 54 L88 58"
            stroke="#374151"
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
          animation: "moveLeft 30s linear infinite",
        }}
      >
        <svg
          width="170"
          height="140"
          viewBox="0 0 170 140"
          style={{ animation: "floaty 2.5s ease-in-out infinite" }}
        >
          <circle cx="60" cy="105" r="14" fill="#374151" />
          <circle cx="115" cy="105" r="14" fill="#374151" />

          <path
            d="M45 48 Q95 15 125 55 L120 82 L55 82 Z"
            fill="#F9A8D4"
          />

          <path
            d="M118 82 L145 28"
            stroke="#4B5563"
            strokeWidth="7"
            strokeLinecap="round"
          />

          <circle cx="82" cy="58" r="10" fill="#FFE4C7" />

          <circle cx="77" cy="55" r="2" fill="#333" />
          <circle cx="87" cy="55" r="2" fill="#333" />

          <path
            d="M78 62 Q82 66 86 62"
            stroke="#333"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* 캐리어 */}
      <div
        style={{
          position: "absolute",
          bottom: "12%",
          animation: "moveRight 34s linear infinite",
        }}
      >
        <svg
          width="110"
          height="130"
          viewBox="0 0 110 130"
          style={{ animation: "floaty 1.8s ease-in-out infinite" }}
        >
          <rect
            x="28"
            y="30"
            width="52"
            height="70"
            rx="16"
            fill="#A78BFA"
          />

          <rect
            x="38"
            y="42"
            width="32"
            height="36"
            rx="8"
            fill="#C4B5FD"
          />

          <path
            d="M42 28 L42 10 L66 10 L66 28"
            stroke="#4B5563"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />

          <circle cx="40" cy="105" r="6" fill="#374151" />
          <circle cx="68" cy="105" r="6" fill="#374151" />
        </svg>
      </div>

      {/* 동물 카트 */}
      <div
        style={{
          position: "absolute",
          bottom: "15%",
          animation: "moveLeft 38s linear infinite",
        }}
      >
        <svg
          width="180"
          height="140"
          viewBox="0 0 180 140"
          style={{ animation: "floaty 2.2s ease-in-out infinite" }}
        >
          {/* 카트 */}
          <rect
            x="35"
            y="55"
            width="90"
            height="45"
            rx="16"
            fill="#60A5FA"
          />

          {/* 손잡이 */}
          <path
            d="M120 58 L150 20"
            stroke="#475569"
            strokeWidth="6"
            strokeLinecap="round"
          />

          {/* 바퀴 */}
          <circle cx="55" cy="108" r="12" fill="#334155" />
          <circle cx="105" cy="108" r="12" fill="#334155" />

          {/* 강아지 */}
          <circle cx="68" cy="48" r="16" fill="#F5CBA7" />
          <ellipse cx="58" cy="40" rx="7" ry="12" fill="#D98880" />
          <ellipse cx="78" cy="40" rx="7" ry="12" fill="#D98880" />

          <circle cx="63" cy="48" r="2" fill="#222" />
          <circle cx="73" cy="48" r="2" fill="#222" />

          <circle cx="68" cy="55" r="3" fill="#222" />

          {/* 고양이 */}
          <circle cx="98" cy="50" r="13" fill="#FFF7AE" />

          <polygon points="88,40 92,30 98,40" fill="#FACC15" />
          <polygon points="108,40 104,30 98,40" fill="#FACC15" />

          <circle cx="94" cy="49" r="2" fill="#222" />
          <circle cx="102" cy="49" r="2" fill="#222" />

          <path
            d="M94 56 Q98 59 102 56"
            stroke="#222"
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
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

useEffect(() => {
  const handlePopState = () => {
    // 뒤로가기를 누르면 무조건 홈 화면으로 상태 변경
    setCurrentView("home");
  };

  window.addEventListener("popstate", handlePopState);
  return () => window.removeEventListener("popstate", handlePopState);
}, []);

// 💡 App 컴포넌트 시작 직후 선언부
const [userRole, setUserRole] = useState("admin"); // 'admin' 또는 'user' (테스트용으로 기본 admin 설정)

// 무장애/위험 요소 마커들을 저장할 배열 상태 (기존 markers 배열이 있다면 합치거나 대체 가능)
// 💡 App 컴포넌트 내부 최상단 상태 정의 구역 수정

// [수정] 처음 앱이 켜질 때 localStorage에 저장된 데이터가 있다면 가져오고, 없으면 기본 샘플을 넣습니다.
const [bfMarkers, setBfMarkers] = useState(() => {
  const savedMarkers = localStorage.getItem("wheel_bf_markers");
  if (savedMarkers) {
    try {
      return JSON.parse(savedMarkers);
    } catch (e) {
      console.error("로컬스토리지 데이터 파싱 에러:", e);
    }
  }
  // 기본 데이터 구조 (기존 샘플 유지)
  return [
    {
      id: "sample-1",
      lat: 37.6355,
      lng: 126.8325,
      type: "step",
      desc: "화정역 2번 출구 앞 보도블록 단차 약 7cm 있습니다. 수동 휠체어 진입 시 주의하세요.",
      image: null,
      date: "2026. 06. 01."
    }
  ];
});
useEffect(() => {
  localStorage.setItem("wheel_bf_markers", JSON.stringify(bfMarkers));
}, [bfMarkers]);

// 등록 폼 제어를 위한 상태들
const [tempMarker, setTempMarker] = useState(null); // 지도 클릭 시 임시 마커 좌표
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

const mapRef = useRef(null);
  const [currentView, setCurrentView] = useState("home");
  const [markers, setMarkers] = useState([]);
  const [selectedType, setSelectedType] = useState("stairs");
  const [userLocation, setUserLocation] = useState(null);
const navigateTo = (view) => {
  setCurrentView(view);
  // 브라우저 주소창 기록에 현재 상태를 추가 (뒤로가기 대비)
  window.history.pushState({ view }, "", `/${view}`);
};
  // 💡 App 컴포넌트 시작 직후 (기존 선언부 자리에 덮어쓰기)
const [startPoint, setStartPoint] = useState("");
const [endPoint, setEndPoint] = useState("");
const [routeSteps, setRouteSteps] = useState([]);
const [routeGuide, setRouteGuide] = useState([]);         
const [isRouteSearched, setIsRouteSearched] = useState(false);
const [animatedRoute, setAnimatedRoute] = useState([]);
const [startMarkerPos, setStartMarkerPos] = useState(null);
const [endMarkerPos, setEndMarkerPos] = useState(null);
const animationRef = useRef(null);
const [isFollowingUser, setIsFollowingUser] = useState(false);
// ✨ 한글 선택지로도 바로 위도/경도를 매칭할 수 있도록 키값을 확장했습니다!
const locationPoints = {
  station: [37.6345, 126.832],  
  office: [37.6373, 126.8315],  
  park: [37.6332, 126.8355],    
  library: [37.6391, 126.834],  
  " 화정역": [37.6345, 126.832],
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

      // 💡 [여기 수정] 데이터를 가공할 때 리플렛이 좋아하는 깔끔한 [[위도, 경도]] 순수 배열 형태로 강제 변환합니다.
      const passedRoute = fullRoute.slice(0, segmentIndex + 1).map(pt => [pt[0], pt[1]]);
      
      // 최종 배열이 깨지지 않게 확실하게 합쳐서 저장
      setAnimatedRoute([...passedRoute, currentPos]);
    }

    animationRef.current = requestAnimationFrame(updateTrack);
  };

  animationRef.current = requestAnimationFrame(updateTrack);
};

const handleSearchRoute = async (e) => {
  e.preventDefault();

  if (!startPoint || !endPoint) {
    alert("출발지와 목적지를 선택해 주세요!");
    return;
  }

  if (startPoint === endPoint) {
    alert("출발지와 목적지가 같습니다.");
    return;
  }

  try {
    // 🔥 1. 좌표 변환
    // 검색어 뒤에 " 고양시"를 붙여서 엉뚱한 다른 지역(광주 등)이 검색되는 걸 막습니다.
const startPos = await getCoords(startPoint + " 고양시");
const endPos = await getCoords(endPoint + " 고양시");
setStartMarkerPos([startPos.lat, startPos.lng]);
setEndMarkerPos([endPos.lat, endPos.lng]);
    console.log("startPos:", startPos);
    console.log("endPos:", endPos);

    if (!startPos || !endPos) {
      alert("좌표를 찾을 수 없습니다 (주소 인식 실패)");
      return;
    }

    // 🔥 2. 경로 생성
    const route = await getRoute(startPos, endPos);

    console.log("route:", route);

    if (!route) {
      alert("경로 생성 실패");
      return;
    }

    // 🔥 3. 지도 이동
    if (mapRef.current) {
      mapRef.current.fitBounds(route, {
        padding: [60, 60],
      });
    }

    // 🔥 4. 지도 경로 저장
    setRouteSteps(route);

    // 🔥 5. 안내문
    let guide = ["📍 출발지에서 이동 시작"];

    if (startPoint === "station" && endPoint === "office") {
      guide.push("🚶 횡단보도 단차 구간 주의");
      guide.push("♿ 경사로 이용 추천");
    } else {
      guide.push("🚶 안전 경로 안내");
    }

    guide.push("🏁 도착");

    setRouteGuide(guide);
    setIsRouteSearched(true);
setRouteSteps(route);   
console.log("routeSteps 저장:", route);
console.log("첫 번째 값:", route[0]);    
    setAnimatedRoute([]);
setTimeout(() => {
  animateWheelTrack(route);
}, 1600);
  } catch (err) {
    console.error(err);
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

// 💡 새 마커 최종 등록 함수 (관리자 전용)
const handleAddBfMarker = () => {
  if (!newMarkerDesc.trim()) {
    alert("상세 설명을 입력해주세요!");
    return;
  }

  const approveMarker = (marker) => {
  const convertType = {
    stairs: "step",
    ramp: "elevator",
    bump: "obstacle",
  };

  const approvedMarker = {
    id: `approved-${marker.id}`,
    lat: marker.lat,
    lng: marker.lng,
    type: convertType[marker.type] || "obstacle",
    desc: "주민 제보 승인 데이터",
    image: null,
    date: new Date().toLocaleDateString(),
  };

  setBfMarkers((prev) => [...prev, approvedMarker]);

  setMarkers((prev) =>
    prev.filter((item) => item.id !== marker.id)
  );
};

  const newBfData = {
    id: `bf-${Date.now()}`,
    lat: tempMarker.lat,
    lng: tempMarker.lng,
    type: newMarkerType,
    desc: newMarkerDesc,
    image: newMarkerImage,
    date: new Date().toLocaleDateString(),
  };

  setBfMarkers((prev) => [...prev, newBfData]);
  
  // 폼 초기화 및 닫기
  setTempMarker(null);
  setNewMarkerDesc("");
  setNewMarkerImage(null);
  setNewMarkerType("step");
};
const moveToMyLocation = () => {
  if (!navigator.geolocation) {
    alert("이 브라우저에서는 GPS를 지원하지 않습니다.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      const myLocation = [lat, lng];

      setUserLocation(myLocation);

      // 🔥 경로 자동 이동 잠시 끄기
      setIsFollowingUser(true);

      if (mapRef.current) {
        mapRef.current.flyTo(myLocation, 17, {
          duration: 1.5,
        });
      }

      // 3초 뒤 다시 경로 이동 허용
      setTimeout(() => {
        setIsFollowingUser(false);
      }, 3000);
    },

    (error) => {
      console.error(error);
      alert("현재 위치를 가져올 수 없습니다.");
    },

    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
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

 const renderHeader = () => (
  <div style={{
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "60px", // 50px에서 약간 키워 안정감 확보
    background: "#fff",
    zIndex: 2000,
    display: "flex",
    justifyContent: "space-between", // space-around보다 정돈됨
    alignItems: "center",
    padding: "0 10px",
    boxSizing: "border-box",
    borderBottom: "1px solid #eee"
  }}>
   
  <div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",

    width: isMobile ? "95px" : "150px",
    height: "50px",

    position: "relative",
    flexShrink: 0,
  }}
>
  <button
    onClick={() => setCurrentView("home")}
    style={{
      all: "unset",

      width: "100%",
      height: "100%",

      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",

      cursor: "pointer",

      position: "relative",
      zIndex: 2,
    }}
  >
    <div
      style={{
        transform: isMobile ? "scale(0.24)" : "scale(0.40)",
        transformOrigin: "left center",

        pointerEvents: "none",

        marginLeft: isMobile ? "-14px" : "-6px",
      }}
    >
      <SimpleTextLogo />
    </div>
  </button>
</div>
   
    
    <div style={{ display: "flex", gap: "5px" }}>
      {/* 텍스트 대신 아이콘 위주로 구성하면 모바일에서 훨씬 깔끔합니다 */}
      <button onClick={() => { setCurrentView("search"); resetRoute(); }} style={{ padding: "8px", border: "none", borderRadius: "8px", background: "#F5F5F7" }}>🗺️</button>
      <button onClick={() => setCurrentView("create")} style={{ padding: "8px", border: "none", borderRadius: "8px", background: "#F5F5F7" }}>✍️</button>
    </div>
  </div>
);

return (
    <div style={{ 
      width: "100%",            // 브라우저 너비 전체를 사용
      minHeight: "100vh",       // 최소 높이를 화면 전체로 설정
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center",     // [중요] 모든 자식 요소를 가로 중앙으로 정렬
      overflowX: "hidden",      // [중요] 화면 밖으로 넘치는 콘텐츠가 있어도 가로 스크롤을 막음
      boxSizing: "border-box"   // 패딩이나 테두리가 너비를 넘치게 하지 않도록 함
    }}>
      

    {/* 1. 메인 홈 화면 */}
 {/* 1. 메인 홈 화면 */}
{currentView === "home" && (
  <div
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: isMobile ? "flex-start" : "center",
      padding: isMobile ? "10px 16px 30px" : "40px 20px",
      position: "relative",
      boxSizing: "border-box",
      width: "100%",
      overflow: "hidden",
    }}
  >
    <CuteCartoonBackground />

    {/* 메인 콘텐츠 */}
<div
  style={{
    position: "relative",
    zIndex: 2,
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    maxWidth: "380px",

    /* 추가 */
    transform: isMobile
      ? "translateY(-70px)"
      : "translateY(-30px)",
  }}
>
      
      {/* 로고 */}
<div
  style={{
    transform: isMobile ? "scale(0.64)" : "scale(0.9)",
    marginBottom: isMobile ? "-200px" : "-55px",
    marginTop: isMobile ? "-78px" : "-40px",
  }}
>
  <SimpleTextLogo />
</div>

      {/* 문구 */}
      <div
        style={{
         marginBottom: isMobile ? "10px" : "20px",
        }}
      >
        <div
          style={{
            fontSize: isMobile ? "15px" : "18px",
            color: "#1976D2",
            fontWeight: "800",
            marginBottom: "1px",
            letterSpacing: "0.3px",
          }}
        >
          "모든 길은 모두를 위해"
        </div>

        <p
          style={{
            color: "#222",
            fontSize: isMobile ? "16px" : "22px",
            margin: 0,
            fontWeight: "700",
            lineHeight: "1.35",
            letterSpacing: "-0.5px",
            wordBreak: "keep-all",
          }}
        >
          함께 만드는 우리 동네 무장애 생활지도
        </p>
      </div>

      {/* 버튼 세트 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? "12px" : "18px",
          width: "100%",
        }}
      >

        {/* 안전 길찾기 */}
        <div
          onClick={() => {
            setCurrentView("search");
            resetRoute();
          }}
          style={{
            background: "rgba(255,255,255,0.92)",
            borderRadius: "28px",
            padding: isMobile ? "20px 18px" : "26px 22px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
            border: "2px solid #EBF1F6",
            cursor: "pointer",
            transition: "0.2s",
            backdropFilter: "blur(4px)",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>🗺️</div>

          <h3
            style={{
              fontSize: isMobile ? "18px" : "20px",
              margin: "0 0 6px 0",
              fontWeight: "800",
              color: "#222",
            }}
          >
            안전 길찾기
          </h3>

          <p
            style={{
              color: "#555",
              fontSize: isMobile ? "12px" : "13px",
              margin: 0,
              lineHeight: "1.5",
            }}
          >
            바퀴가 구르기 편한 길과
            <br />
            위험 장애물을 미리 확인해요.
          </p>
        </div>

        {/* 주민 제보 */}
        <div
          onClick={() => setCurrentView("create")}
          style={{
            background: "rgba(255,255,255,0.92)",
            borderRadius: "28px",
            padding: isMobile ? "20px 18px" : "26px 22px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
            border: "2px solid #EBF1F6",
            cursor: "pointer",
            transition: "0.2s",
            backdropFilter: "blur(4px)",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>✍️</div>

          <h3
            style={{
              fontSize: isMobile ? "18px" : "20px",
              margin: "0 0 6px 0",
              fontWeight: "800",
              color: "#222",
            }}
          >
            주민 제보
          </h3>

          <p
            style={{
              color: "#555",
              fontSize: isMobile ? "12px" : "13px",
              margin: 0,
              lineHeight: "1.5",
            }}
          >
            골목길의 계단, 턱, 보도 파손을
            <br />
            직접 지도에 등록하고 제보해요.
          </p>
        </div>

        {/* 산책 코스 */}
        <div
          onClick={() => setCurrentView("walk")}
          style={{
            background: "rgba(255,255,255,0.92)",
            borderRadius: "28px",
            padding: isMobile ? "20px 18px" : "26px 22px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
            border: "2px solid #EBF1F6",
            cursor: "pointer",
            transition: "0.2s",
            backdropFilter: "blur(4px)",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>🌳</div>

          <h3
            style={{
              fontSize: isMobile ? "18px" : "20px",
              margin: "0 0 6px 0",
              fontWeight: "800",
              color: "#222",
            }}
          >
            산책 코스 추천
          </h3>

          <p
            style={{
              color: "#555",
              fontSize: isMobile ? "12px" : "13px",
              margin: 0,
              lineHeight: "1.5",
            }}
          >
            휠체어와 유모차도 편안하게
            <br />
            거닐 수 있는 동네 힐링 코스
          </p>
        </div>
      </div>
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
          
          <div style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            height: "100vh", 
            width: "100%"
          }}>
                 
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
              <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "800" }}>🔍 무장애 안전 길찾기</h3>
              
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
              >
                <div onClick={(e) => e.stopPropagation()}>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", marginBottom: "5px", display: "block" }}>🟢 출발지 선택</label>
                  <input
                    list="start-options"
                    value={startPoint}
                    onChange={(e) => setStartPoint(e.target.value)}
                    placeholder="출발지 입력 또는 선택"
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1"
                    }}
                  />
                  <datalist id="start-options">
                    <option value=" 화정역" />
                    <option value="덕양구청" />
                    <option value="화정 중앙공원" />
                    <option value="화정도서관" />
                  </datalist>
                </div>

                <div onClick={(e) => e.stopPropagation()}>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", marginBottom: "5px", display: "block" }}>🔴 목적지 선택</label>
                  <input
                    list="end-options"
                    value={endPoint}
                    onChange={(e) => setEndPoint(e.target.value)}
                    placeholder="목적지 입력 또는 선택"
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1"
                    }}
                  />
                  <datalist id="end-options">
                    <option value="화정역" />
                    <option value="덕양구청" />
                    <option value="화정 중앙공원" />
                    <option value="화정도서관" />
                  </datalist>
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

              <div style={{ flex: 1 }}>
                {isRouteSearched ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <span style={{ fontSize: isMobile ? "12px" : "14px", padding: isMobile ? "7px 10px" : "8px 16px", fontWeight: "700", color: "#475569" }}>📋 실시간 보행 가이드</span>
                    {routeSteps.map((step, idx) => (
                      <div key={idx} style={{ padding: "12px", background: idx === 0 || idx === routeSteps.length - 1 ? "#F0FDF4" : "#FFF", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: "13px", lineHeight: "1.5" }}>
                        {step}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <div style={{ background: "#F5F5F7", padding: "12px", borderRadius: "10px", fontSize: "14px", display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                      <span>📌 주변 수집 정보</span> <span style={{ color: "#1976D2", fontWeight: "700" }}>{markers.length}개</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {markers.length === 0 ? (
                        <div style={{ textAlign: "center", color: "#AAA", fontSize: "13px", marginTop: "30px" }}>제보된 마커가 없습니다.<br/>주민 제보 탭에서 등록해 보세요!</div>
                      ) : (
                        markers.map((m) => (
  <div key={m.id}>
    <span>
      {m.type === "stairs"
        ? "🪜"
        : m.type === "ramp"
        ? "♿"
        : "⚠️"}
    </span>

    <b>{getLabel(m.type)}</b>

    {userRole === "admin" && (
      <button
        onClick={() => approveMarker(m)}
      >
        승인
      </button>
    )}
  </div>
))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 오른쪽 지도 영역 */}
            <div style={{ 
              flex: 1, 
              position: "relative",
              height: isMobile ? "calc(100vh - 250px)" : "100%" 
            }}>
              <button
                onClick={moveToMyLocation}
                style={{
                  position: "absolute",
                  right: "20px",
                  bottom: "20px",
                  zIndex: 1000,
                  width: "52px",
                  height: "52px",
                  borderRadius: "14px",
                  border: "none",
                  background: "#fff",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                  fontSize: "24px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                📍
              </button>
              
              <MapContainer
  // 🌟 경로 탐색 시 자식 요소들이 확실히 새로 고쳐지도록 데이터 기반 key 적용
  key={`map-container-${routeSteps.length}`}
  center={[37.6345, 126.832]}
  zoom={16}
  style={{ width: "100%", height: "100%" }}
>
  <MapSetter mapRef={mapRef} />
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  {isRouteSearched && <MoveMapToRoute route={routeSteps} />}                
  
  {/* 📍 현재 내 위치 마커 */}
  {userLocation && (
    <Marker
      position={userLocation}
      icon={divIcon({
        html: `
          <div style="
            width:22px;
            height:22px;
            background:#2563EB;
            border:4px solid white;
            border-radius:50%;
            box-shadow:0 0 12px rgba(37,99,235,0.5);
          "></div>
        `,
        className: "",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })}
    >
      <Popup>📍 현재 내 위치</Popup>
    </Marker>
  )}

  {/* 📍 기존 일반 편의시설 마커들 */}
  {markers.map((m) => (
    <Marker key={m.id} position={[m.lat, m.lng]} icon={getIcon(m.type)}>
      <Popup><b>{getLabel(m.type)}</b></Popup>
    </Marker>
  ))}

  {/* 🔒 [권한 제어] 관리자(admin)일 때만 지도 클릭 시 제보 마커 팝업 생성 기능 활성화 */}
  {userRole === "admin" && (
    <span style={{ display: "none" }}>
      {(() => {
        const MapEvents = () => {
          useMapEvents({
            click(e) {
              const { lat, lng } = e.latlng;
              setTempMarker({ lat, lng });
            },
          });
          return null;
        };
        return <MapEvents />;
      })()}
    </span>
  )}

  {/* 🛠️ [관리자 전용] 지도 클릭 시 열리는 5대 안전 요인 등록 팝업 폼 */}
  {tempMarker && userRole === "admin" && (
    <Marker position={[tempMarker.lat, tempMarker.lng]}>
      <Popup minWidth={260}>
        <div style={{ fontFamily: "sans-serif", padding: "4px" }}>
          <h4 style={{ margin: "0 0 8px 0", color: "#1E3A8A", fontSize: "14px" }}>♿ 안전 요인 등록 (관리자)</h4>
          
          <div style={{ marginBottom: "8px" }}>
            <label style={{ fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "4px" }}>제보 유형</label>
            <select 
              value={newMarkerType} 
              onChange={(e) => setNewMarkerType(e.target.value)}
              style={{ width: "100%", padding: "4px", fontSize: "12px", border: "1px solid #CBD5E1", borderRadius: "4px" }}
            >
              {Object.entries(bfConfig).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "8px" }}>
            <label style={{ fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "4px" }}>상세 설명</label>
            <textarea 
              rows="3"
              value={newMarkerDesc}
              onChange={(e) => setNewMarkerDesc(e.target.value)}
              placeholder="단차 높이, 경사 체감, 도로 환경 등을 상세히 적어주세요."
              style={{ width: "100%", padding: "5px", fontSize: "12px", border: "1px solid #CBD5E1", borderRadius: "4px", resize: "none" }}
            />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "4px" }}>📸 현장 사진 첨부</label>
            <input type="file" accept="image/*" onChange={handleBfImageChange} style={{ fontSize: "11px", width: "100%" }} />
            {newMarkerImage && (
              <img src={newMarkerImage} alt="미리보기" style={{ width: "100%", maxHeight: "100px", objectFit: "cover", borderRadius: "4px", marginTop: "6px" }} />
            )}
          </div>

          <div style={{ display: "flex", gap: "4px" }}>
            <button onClick={handleAddBfMarker} style={{ flex: 1, background: "#2563EB", color: "white", border: "none", padding: "6px", borderRadius: "4px", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}>등록</button>
            <button onClick={() => setTempMarker(null)} style={{ background: "#EF4444", color: "white", border: "none", padding: "6px", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}>취소</button>
          </div>
        </div>
      </Popup>
    </Marker>
  )}

  {/* 👀 [공통 조회 및 관리자 삭제] 등록된 안전 요인 마커 렌더링 */}
  {bfMarkers.map((m) => {
    const config = bfConfig[m.type] || { color: "#6B7280", icon: "📍", label: "기타" };
    return (
      <Marker 
        key={m.id} 
        position={[m.lat, m.lng]}
        icon={divIcon({
          html: `
            <div style="
              display: flex; align-items: center; justify-content: center;
              width: 34px; height: 34px; background: white; border-radius: 50%;
              border: 3px solid ${config.color}; box-shadow: 0 3px 10px rgba(0,0,0,0.3);
              font-size: 18px; cursor: pointer;
            ">
              ${config.icon}
            </div>`,
          className: "", iconSize: [34, 34], iconAnchor: [17, 17]
        })}
      >
        <Popup minWidth={220}>
          <div style={{ fontFamily: "sans-serif" }}>
            <span style={{ 
              background: config.color, color: "white", 
              padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" 
            }}>
              {config.label}
            </span>
            
            <p style={{ margin: "8px 0 6px 0", fontSize: "13px", color: "#1F2937", lineHeight: "1.4" }}>
              {m.desc}
            </p>

            {m.image && (
              <img 
                src={m.image} 
                alt="현장 위험 요인" 
                style={{ width: "100%", maxHeight: "150px", objectFit: "cover", borderRadius: "6px", marginTop: "4px", marginBottom: "4px" }} 
              />
            )}
            
            <div style={{ display: "flex", justifyContent: "between", alignItems: "center", marginTop: "8px" }}>
              <span style={{ fontSize: "10px", color: "#9CA3AF" }}>제보일: {m.date}</span>
              
              {/* 🔒 [관리자 삭제 버튼] userRole이 admin일 때만 팝업 하단에 노출됩니다 */}
              {userRole === "admin" && (
                <button
                  onClick={() => {
                    if (window.confirm("이 안전 요인 아이콘을 정말 삭제하시겠습니까?")) {
                      setBfMarkers((prev) => prev.filter((item) => item.id !== m.id));
                    }
                  }}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    color: "#EF4444",
                    fontSize: "11px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    backgroundColor: "#FEF2F2"
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = "#FEE2E2"}
                  onMouseOut={(e) => e.target.style.backgroundColor = "#FEF2F2"}
                >
                  🗑️ 삭제
                </button>
              )}
            </div>
          </div>
        </Popup>
      </Marker>
    );
  })}

  {/* 🟢 실시간 애니메이션 경로선 및 자라나는 이펙트 레이어 */}
  {isRouteSearched && (
    <>
      {/* 1. 실시간으로 자라나는 초록색 경로선 */}
      {animatedRoute.length > 0 && (
        <Polyline
          positions={animatedRoute}
          color="#22C55E"
          weight={8}
          opacity={0.85}
          lineCap="round"
                />
      )}

      {/* 2. 실시간 선의 꼬리(끝점)를 따라 굴러가는 회전 바퀴 마커 */}
      {animatedRoute.length > 0 && (
        <Marker 
          position={animatedRoute[animatedRoute.length - 1]} 
          icon={divIcon({
            html: `
              <div style="
                display: flex; align-items: center; justify-content: center;
                width: 38px; height: 38px; background: white; border-radius: 50%;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3); border: 3px solid #4BAB6E;
              ">
                <svg class="spinning-wheel" width="30" height="30" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="transform-origin: center;">
                  <circle cx="50" cy="50" r="40" fill="#2C3E50" />
                  <circle cx="50" cy="50" r="30" fill="#5DADE2" stroke="#D6EAF8" stroke-width="5" />
                  <line x1="50" y1="20" x2="50" y2="80" stroke="white" stroke-width="4" />
                  <line x1="20" y1="50" x2="80" y2="50" stroke="white" stroke-width="4" />
                  <line x1="28" y1="28" x2="72" y2="72" stroke="white" stroke-width="4" />
                  <line x1="28" y1="72" x2="72" y2="28" stroke="white" stroke-width="4" />
                  <circle cx="50" cy="50" r="8" fill="#F8F9F9" stroke="#2C3E50" stroke-width="3" />
                </svg>
                <style>
                  @keyframes wheel-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  .spinning-wheel {
                    animation: wheel-spin 0.6s linear infinite;
                  }
                </style>
              </div>`,
            className: "", 
            iconSize: [38, 38], 
            iconAnchor: [19, 19]
          })} 
        />
      )}
      
      {/* 출발 마커 */}
      {startMarkerPos && (
        <Marker
          position={startMarkerPos}
          icon={divIcon({
            html: `<div style="background:#22C55E; color:white; padding:4px 8px; border-radius:8px; font-weight:bold; font-size:11px; white-space:nowrap; border:2px solid white;">🟢 출발</div>`,
            className: "",
            iconAnchor: [20, 10],
          })}
        />
      )}

      {/* 도착 마커 */}
      {endMarkerPos && (
        <Marker
          position={endMarkerPos}
          icon={divIcon({
            html: `<div style="background:#EF4444; color:white; padding:4px 8px; border-radius:8px; font-weight:bold; font-size:11px; white-space:nowrap; border:2px solid white;">🔴 도착</div>`,
            className: "",
            iconAnchor: [20, 10],
          })}
        />
      )}
    </>
  )}
</MapContainer>
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
    maxWidth: "100%",
    padding: isMobile ? "0" : "20px",
    boxSizing: "border-box",
  }}
>
    {renderHeader()}

    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
      }}
    >
      {/* 제보 패널 */}
      <div
        style={{
          width: isMobile ? "100%" : "300px",
          background: "#fff",
          borderRight: isMobile ? "none" : "1px solid #eee",
          borderBottom: isMobile ? "1px solid #eee" : "none",
          padding: "12px",
          boxSizing: "border-box",
        }}
      >
        <h3
          style={{
            margin: "0 0 12px 0",
            fontSize: "18px",
            fontWeight: "700",
          }}
        >
          ✍️ 장소 제보
        </h3>

       <div
  style={{
    display: "grid",
    gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "1fr",
    gap: "8px",
  }}
>
  <button
    onClick={() => setSelectedType("stairs")}
    style={{
      padding: "12px",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      fontWeight: "600",
      background:
        selectedType === "stairs"
          ? "#FFECEC"
          : "#F5F5F7",
      color:
        selectedType === "stairs"
          ? "#D32F2F"
          : "#333",
    }}
  >
    🪜 {isMobile ? "" : "단차 / 계단"}
  </button>

  <button
    onClick={() => setSelectedType("narrow")}
    style={{
      padding: "12px",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      fontWeight: "600",
      background:
        selectedType === "narrow"
          ? "#FFF8E1"
          : "#F5F5F7",
      color:
        selectedType === "narrow"
          ? "#F59E0B"
          : "#333",
    }}
  >
    ↔️ {isMobile ? "" : "좁은 도로"}
  </button>

  <button
    onClick={() => setSelectedType("obstacle")}
    style={{
      padding: "12px",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      fontWeight: "600",
      background:
        selectedType === "obstacle"
          ? "#FEE2E2"
          : "#F5F5F7",
      color:
        selectedType === "obstacle"
          ? "#DC2626"
          : "#333",
    }}
  >
    🚧 {isMobile ? "" : "실시간 장애물"}
  </button>

  <button
    onClick={() => setSelectedType("elevator")}
    style={{
      padding: "12px",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      fontWeight: "600",
      background:
        selectedType === "elevator"
          ? "#DBEAFE"
          : "#F5F5F7",
      color:
        selectedType === "elevator"
          ? "#2563EB"
          : "#333",
    }}
  >
    🛗 {isMobile ? "" : "엘리베이터"}
  </button>

  <button
    onClick={() => setSelectedType("slope")}
    style={{
      padding: "12px",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      fontWeight: "600",
      background:
        selectedType === "slope"
          ? "#DCFCE7"
          : "#F5F5F7",
      color:
        selectedType === "slope"
          ? "#16A34A"
          : "#333",
    }}
  >
    📐 {isMobile ? "" : "경사도"}
  </button>

  <button
    onClick={() => setSelectedType("sidewalk")}
    style={{
      padding: "12px",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      fontWeight: "600",
      background:
        selectedType === "sidewalk"
          ? "#F3E8FF"
          : "#F5F5F7",
      color:
        selectedType === "sidewalk"
          ? "#8B5CF6"
          : "#333",
    }}
  >
    🧱 {isMobile ? "" : "보도블럭 파손"}
  </button>
</div>
      </div>

     {/* 3. 주민 제보 화면 중 지도 영역 시작 */}
    <div
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 📍 내 위치 버튼 
          이제 이 버튼을 누르면 상단의 moveToMyLocation이 작동하여 주민 제보 지도도 움직입니다. */}
      <button
        onClick={moveToMyLocation}
        style={{
          position: "absolute",
          right: "20px",
          bottom: "20px",
          zIndex: 99999, // 중요: 지도 레이어 위에 고정
          pointerEvents: "auto",
          width: "52px",
          height: "52px",
          borderRadius: "14px",
          border: "none",
          background: "#fff",
          boxShadow: "0 4px 15px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          cursor: "pointer",
        }}
      >
        📍
      </button>

      <MapContainer
        center={[37.6345, 126.832]}
        zoom={16}
        style={{
          width: "100%",
          height: "100%", // 부모 .relative 박스를 가득 채우도록 고정
        }}
        // 💡 핵심 수정: ref={mapRef}를 직접 지정하여 주민 제보 화면이 켜질 때 
        // 잃어버렸던 mapRef.current 지도 객체를 확실하게 다시 잡아줍니다!
        ref={mapRef} 
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* 🔵 현재 내 위치 마커 (L.divIcon 구조로 터치 버그 방지) */}
        {userLocation && (
          <Marker
            position={userLocation}
            icon={L.divIcon({
              html: `
                <div style="
                  width:22px;
                  height:22px;
                  background:#2563EB;
                  border:4px solid white;
                  border-radius:50%;
                  box-shadow:0 0 12px rgba(37,99,235,0.5);
                "></div>
              `,
              className: "custom-user-location",
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            })}
          >
            <Popup>📍 현재 내 위치</Popup>
          </Marker>
        )}

        {/* 지도 클릭 제보 컴포넌트 */}
        <AddMarker
          setMarkers={setMarkers}
          selectedType={selectedType}
        />

        {/* 📌 사용자가 등록한 마커 */}
        {markers && markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={getIcon(m.type)}
          >
            <Popup>
              <div style={{ textAlign: "center", fontFamily: "sans-serif" }}>
                <b>{getLabel(m.type)}</b>
                <br />
                <button
                  onClick={() =>
                    setMarkers((prev) =>
                      prev.filter((item) => item.id !== m.id)
                    )
                  }
                  style={{
                    marginTop: "8px",
                    background: "#ff4d4d",
                    color: "#fff",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  삭제
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 🔄 안전길찾기에서 가져온 마커 */}
        {bfMarkers && bfMarkers.map((m) => {
          const config = bfConfig[m.type] || {
            color: "#6B7280",
            icon: "📍",
            label: "기타",
          };

          return (
            <Marker
              key={m.id}
              position={[m.lat, m.lng]}
              icon={L.divIcon({
                html: `
                  <div style="
                    width:34px;
                    height:34px;
                    background:white;
                    border-radius:50%;
                    border:3px solid ${config.color};
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    box-shadow: 0 3px 8px rgba(0,0,0,0.25);
                  ">
                    ${config.icon}
                  </div>
                `,
                className: "custom-bf-shared-marker",
                iconSize: [34, 34],
                iconAnchor: [17, 17],
              })}
            />
          );
        })}
      </MapContainer>
    </div>
  </div>
</div>
)}

      {/* 4. 산책 코스 화면 */}
      {currentView === "walk" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {renderHeader && renderHeader()}
          <div style={{ flex: 1, padding: "40px", display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto", background: "#FAFAFA" }}>
            <h2 style={{ fontSize: "26px", fontWeight: "800", marginBottom: "25px", letterSpacing: "-0.5px" }}>🌳 화정동 힐링 산책 코스</h2>
            <div style={{ width: "100%", maxWidth: "800px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ background: "white", borderRadius: "24px", padding: "24px", border: "1px solid #EAEAEA", display: "flex", gap: "20px", alignItems: "center", boxShadow: "0 4px 15px rgba(0,0,0,0.02)" }}>
                <div style={{ fontSize: "32px", background: "#E8F5E9", width: "60px", height: "60px", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>🏞️</div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: "0 0 5px 0", fontSize: "17px", fontWeight: "700" }}>화정 중앙공원 순환 코스</h4>
                  <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>단차가 없는 완만한 1.2km 코스</p>
                </div>
              </div>
              <div style={{ background: "white", borderRadius: "24px", padding: "24px", border: "1px solid #EAEAEA", display: "flex", gap: "20px", alignItems: "center", boxShadow: "0 4px 15px rgba(0,0,0,0.02)" }}>
                <div style={{ fontSize: "32px", background: "#E3F2FD", width: "60px", height: "60px", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>🎒</div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: "0 0 5px 0", fontSize: "17px", fontWeight: "700" }}>덕양구청 ➔ 도서관 산책로</h4>
                  <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>보도 정비가 잘 된 안전한 1.8km 코스</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;