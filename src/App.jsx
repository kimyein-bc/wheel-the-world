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
function getDistance(a, b) {
  const R = 6371000;

  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) *
      Math.cos(b.lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;

  return (
    2 *
    R *
    Math.atan2(
      Math.sqrt(aa),
      Math.sqrt(1 - aa)
    )
  );
}
function getCourseDistance(route) {
  if (!route || route.length < 2) return 0;

  let total = 0;

  for (let i = 0; i < route.length - 1; i++) {
    total += getDistance(
      {
        lat: route[i][0],
        lng: route[i][1]
      },
      {
        lat: route[i + 1][0],
        lng: route[i + 1][1]
      }
    );
  }

  return total;
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
function CourseCreator({
  isCreatingCourse,
  setCoursePoints
}) {
  useMapEvents({
    click(e) {
      if (!isCreatingCourse) return;

      setCoursePoints(prev => [
        ...prev,
        [e.latlng.lat, e.latlng.lng]
      ]);
    }
  });

  return null;
}
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
const openCourse = (courseId) => {
  setSelectedCourse(courseId);

  const course = savedCourses.find(
    (c) => c.courseType === courseId
  );

  if (course?.route) {
    setAnimatedRoute([]);
    animateWheelTrack(course.route);
  }
};
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
 const [selectedCourse, setSelectedCourse] = useState(null);

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
const [isCreatingCourse, setIsCreatingCourse] = useState(false);
const [coursePoints, setCoursePoints] = useState([]);
const [savedCourses, setSavedCourses] = useState([]);
const currentCourse = savedCourses.find(
  course => course.courseType === selectedCourse
);
const courseDistance = currentCourse
  ? getCourseDistance(currentCourse.route)
  : 0;
  const estimatedMinutes =
  Math.round((courseDistance / 1000) / 4 * 60);
const saveWalkCourse = async () => {
  if (coursePoints.length < 2) {
    alert("코스를 2개 이상 찍어주세요.");
    return;
  }

  try {
    const courseId = Date.now();

    await set(ref(db, `walkCourses/${courseId}`), {
      title: "새 산책코스",

      courseType: selectedCourse, // 추가

      route: coursePoints,

      createdAt: Date.now()
    });

    alert("산책코스 저장 완료!");

    setCoursePoints([]);
    setIsCreatingCourse(false);

  } catch (error) {
    console.error(error);
  }
};
useEffect(() => {
  const coursesRef = ref(db, "walkCourses");

  const unsubscribe = onValue(coursesRef, (snapshot) => {
    const data = snapshot.val();

    if (!data) {
      setSavedCourses([]);
      return;
    }

    const courses = Object.entries(data).map(([id, value]) => ({
      id,
      ...value
    }));

    setSavedCourses(courses);
  });

  return () => unsubscribe();
}, []);
    
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

  console.log(`[디버그] ${mode} 모드 - 회피 구역 생성 개수:`, polygons.length);

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
    console.log("ORS 최종 응답:", data);

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
console.log("출발 마커:", [
  startPos.lat,
  startPos.lng
]);

console.log("도착 마커:", [
  endPos.lat,
  endPos.lng
]);
    if (!startPos || !endPos) {
      alert("장소의 좌표를 찾을 수 없습니다. 정확한 명칭인지 확인해 주세요!");
      return;
    }

    // 📍 원래 코드 포맷인 배열 형태로 마커 위치 저장 [lat, lng]
    setStartMarkerPos([startPos.lat, startPos.lng]);
    setEndMarkerPos([endPos.lat, endPos.lng]);

    // 🔥 2. 경로 생성 (getRoute 함수가 {lat, lng} 객체를 정상적으로 받도록 전달)
    const result = await getRoute(
  startPos,
  endPos,
  routeMode,
  bfMarkers
);
const route = result.routeCoords;
setRouteInfo({
  distance: result.distance,
  duration: result.duration
});
console.log(
  "wheelLevel",
  bfMarkers[0]?.wheelLevel
);
console.log("첫번째 마커", bfMarkers[0]);
console.log(
  "마지막 마커 wheelLevel",
  bfMarkers[bfMarkers.length - 1]?.wheelLevel
);
console.log("bfMarkers:", bfMarkers);
    console.log("생성된 route 선 데이터:", route);

    if (!route || route.length === 0) {
      alert("경로 생성 실패 (매칭되는 도보/도로가 없습니다)");
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

  console.log("저장되는 좌표:", coords);

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
  <div style={{
    position: "fixed", top: 0, left: 0, width: "100%", height: "60px",
    background: "#fff", zIndex: 2000, display: "flex",
    justifyContent: "space-between", alignItems: "center",
    padding: "0 10px", boxSizing: "border-box", borderBottom: "1px solid #eee"
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", width: isMobile ? "95px" : "150px", height: "50px", position: "relative", flexShrink: 0 }}>
      <button onClick={() => setCurrentView("home")} style={{ all: "unset", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "flex-start", cursor: "pointer", position: "relative", zIndex: 2 }}>
        <div style={{ transform: isMobile ? "scale(0.24)" : "scale(0.40)", transformOrigin: "left center", pointerEvents: "none", marginLeft: isMobile ? "-14px" : "-6px" }}>
          <SimpleTextLogo />
        </div>
      </button>
    </div>
    
    <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
  <button
    onClick={() => {
      setCurrentView("search");
      resetRoute();
    }}
    style={{
      padding: "8px",
      border: "none",
      borderRadius: "8px",
      background: "#F5F5F7"
    }}
  >
    🗺️
  </button>

  <button
    onClick={() => setCurrentView("create")}
    style={{
      padding: "8px",
      border: "none",
      borderRadius: "8px",
      background: "#F5F5F7"
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
        cursor: "pointer"
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
        cursor: "pointer"
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
      {/* 🚪 5번 클릭 비밀 문 */}
<footer 
  onClick={handleSecretDoorClick} 
  style={{ 
    marginTop: "40px", 
    fontSize: "11px", 
    color: "rgba(0,0,0,0.3)", 
    cursor: "pointer", 
    userSelect: "none" 
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
        padding: "10px",
        borderRadius: "8px",
        background: "#3B82F6",
        color: "white",
        border: "none",
        cursor: "pointer",
        fontWeight: "bold"
      }}
    >
      📍
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
        padding: "10px",
        borderRadius: "8px",
        background: "#3B82F6",
        color: "white",
        border: "none",
        cursor: "pointer",
        fontWeight: "bold"
      }}
    >
      📍
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

      background: "rgba(255,255,255,0.95)",

      backdropFilter: "blur(8px)",

      padding: "8px 16px",

      borderRadius: "999px",

      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",

      display: "flex",
      gap: "18px",

      fontWeight: "600",
      fontSize: "14px"
    }}
  >
    <span>📏 {routeInfo.distance}km</span>
    <span>⏱ {routeInfo.duration}분</span>
  </div>
)}
              <MapContainer
  // 🌟 경로 탐색 시 자식 요소들이 확실히 새로 고쳐지도록 데이터 기반 key 적용
  center={[37.6345, 126.832]}
  zoom={16}
  style={{ width: "100%", height: "100%" }}
>
  <MapSetter mapRef={mapRef} />
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  {surveyTracks.map((track) => (
  <Polyline
    key={track.id}
    positions={track.route}
    pathOptions={{
      color: "#3B82F6",
      weight: 5,
      opacity: 0.7
    }}
  />
))}
{surveyTrack.length > 1 && (
  <Polyline
    positions={surveyTrack}
    pathOptions={{
      color: "#2563EB",
      weight: 6
    }}
  />
)}
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

 {/* 🔒 [권한 제어] 지도 클릭 이벤트 처리 컴포넌트 */}
{(() => {
  const MapEvents = () => {
    useMapEvents({
      click(e) {
        // 🚨 관리자(admin)가 아니라면 마커 등록 창이 뜨지 않도록 함수를 바로 종료합니다.
        if (userRole !== "admin") return;

        const { lat, lng } = e.latlng;
        setTempMarker({ lat, lng });
      },
    });
    return null;
  };
  return <MapEvents />;
})()}

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
<select
  value={wheelLevel}
  onChange={(e) => {
    console.log("선택 변경:", e.target.value);
    setWheelLevel(Number(e.target.value));
  }}
>
  <option value={1}>🟡 1단계</option>
  <option value={2}>🔴 2단계</option>
</select>
          <div style={{ display: "flex", gap: "4px" }}>
            <button onClick={handleAddBfMarker} style={{ flex: 1, background: "#2563EB", color: "white", border: "none", padding: "6px", borderRadius: "4px", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}>등록</button>
            <button onClick={() => setTempMarker(null)} style={{ background: "#EF4444", color: "white", border: "none", padding: "6px", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}>취소</button>
           
          </div>
        </div>
      </Popup>
    </Marker>
  )}

  {/* 👀 [공통 조회 및 관리자 삭제] 등록된 안전 요인 마커 렌더링 */}
{bfMarkers
  // 안전길찾기 지도와 주민제보 지도 모두 이 조건을 사용하세요
.filter((m) => m.isOfficial === true || m.status === "approved")// ★ 조건 추가: 공식 마커이거나 승인된 마커만 표시
  .map((m) => {
    const config = getBfConfig(m.type);
    
    return (
      <Marker 
        key={m.id} // ★ key는 반드시 고유한 m.id여야 함
        position={[m.lat, m.lng]}
        icon={divIcon({
          html: `
            <div style="
              display: flex; align-items: center; justify-content: center;
              width: 34px; height: 34px; background: white; border-radius: 50%;
              border:${
  userRole === "admin" && m.wheelLevel
    ? (
        m.wheelLevel === 2
          ? "3px solid #DC2626"
          : "3px solid #F59E0B"
      )
    : `3px solid ${config.color}`
}; box-shadow: 0 3px 10px rgba(0,0,0,0.3);
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
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
              <span style={{ fontSize: "10px", color: "#9CA3AF" }}>제보일: {m.date}</span>
              
              {userRole === "admin" && (
  <button
    onClick={async () => {
      if (
        window.confirm(
          "이 안전 요인 아이콘을 정말 삭제하시겠습니까?"
        )
      ) {
        await remove(
          ref(db, `bfMarkers/${m.id}`)
        );
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
      padding: "2px 6px"
    }}
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
    padding: "10px 14px",
    border: "none",
    borderRadius: "8px",
    background: "#2563EB",
    color: "white",
    cursor: "pointer"
  }}
>
  📍
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

  console.log("2단계 승인:", m.id);

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
        

        <MapContainer center={[37.6345, 126.832]} zoom={16} style={{ width: "100%", height: "100%" }} ref={mapRef}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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

          {/* 제보 입력을 위한 클릭 이벤트 컴포넌트 */}
          {/* App.jsx 의 return 안에서 AddMarker 호출하는 부분을 이렇게 바꾸세요 */}
<AddMarker 
  setBfMarkers={setBfMarkers}
  selectedType={newMarkerType}
  setSelectedType={setNewMarkerType}
  bfConfig={bfConfig} 
  setTempMarker={setTempMarker}
  tempMarker={tempMarker}
  desc={newMarkerDesc} 
  setDesc={setNewMarkerDesc}
  image={newMarkerImage}
  setImage={setNewMarkerImage}
  isAdminLoggedIn={isAdminLoggedIn} 
   wheelLevel={wheelLevel}
  setWheelLevel={setWheelLevel}
  clientId={clientId}
/>

          {/* 📌 모든 데이터 통합 렌더링 (공식 + 주민제보) */}
          {bfMarkers.map((m) => {

            const config = bfConfig[m.type] || { color: "#6B7280", icon: "📍", label: "기타" };
            const isApproved = m.status === "approved";

            return (
              <Marker
                key={m.id}
                position={[m.lat, m.lng]}
                icon={divIcon({
                  html: `
                    <div style="
                      width:34px; height:34px; background:white; border-radius:50%;
                      border:${
  userRole === "admin" && m.wheelLevel
    ? (m.wheelLevel === 2
        ? "3px solid #DC2626"
        : "3px solid #F59E0B")
    : (isApproved
        ? `3px solid ${config.color}`
        : "3px solid #999")
};
                      display:flex; align-items:center; justify-content:center;
                      box-shadow: 0 3px 8px rgba(0,0,0,0.25); font-size:18px;
                      ${!isApproved ? "border-style: dashed;" : ""}
                    ">
                      ${config.icon}
                    </div>
                  `,
                  className: "custom-marker",
                  iconSize: [34, 34],
                  iconAnchor: [17, 17],
                })}
              >
                <Popup>
                  <div style={{ textAlign: "center" }}>
                    <b>{isApproved ? config.label : "주민 제보(대기중)"}</b>
                    <p>{m.desc}</p>
                    {m.image && <img src={m.image} style={{ width: "100px", borderRadius: "5px" }} />}
                    <br />
                    {m.status === "pending" && (userRole === "admin" || m.ownerId === clientId) && (
  <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginTop: "8px" }}>
    <button
      onClick={async () => {
        const newDesc = window.prompt("수정할 설명을 입력하세요.", m.desc || "");

        if (newDesc === null) return;

        if (!newDesc.trim()) {
          alert("설명은 비워둘 수 없습니다.");
          return;
        }

        await update(ref(db, `bfMarkers/${m.id}`), {
          desc: newDesc.trim(),
          editedAt: Date.now()
        });

        alert("제보 내용이 수정되었습니다.");
      }}
    >
      수정하기
    </button>

    <button
      onClick={async () => {
        if (window.confirm("이 제보를 삭제할까요?")) {
          await remove(ref(db, `bfMarkers/${m.id}`));
        }
      }}
    >
      삭제하기
    </button>
  </div>
)}

                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
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
console.log("현재 wheelLevel:", wheelLevel);
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
console.log("Firebase 저장 버튼 클릭");
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