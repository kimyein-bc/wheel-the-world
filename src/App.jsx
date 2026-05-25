import { useState, useEffect, useRef } from "react";
import { divIcon } from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  Polyline,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

// 기본 마커 아이콘 문제 해결
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const getLabel = (type) => {
  if (type === "stairs") return "계단 위험";
  if (type === "ramp") return "안전 경사로";
  if (type === "bump") return "보도 턱/파손";
  return type;
};

function getIcon(type) {
  const config = {
    stairs: { emoji: "🪜", color: "#FF6B6B" }, 
    ramp: { emoji: "♿", color: "#4BAB6E" },   
    bump: { emoji: "⚠️", color: "#FF9F43" },   
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
        { id: Date.now(), lat: e.latlng.lat, lng: e.latlng.lng, type: selectedType },
      ]);
    },
  });
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

// 사진 시안 디자인을 그대로 반영한 3층 형태의 코드형 로고 컴포넌트
const SimpleTextLogo = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", padding: "10px" }}>
    <div style={{ fontSize: "44px", fontWeight: "900", display: "flex", gap: "2px", lineHeight: "1", fontFamily: "'Arial Black', sans-serif" }}>
      <span style={{ color: "#FF5E5E" }}>W</span>
      <span style={{ color: "#FF9F43" }}>H</span>
      <span style={{ color: "#4BAB6E" }}>E</span>
      <span style={{ color: "#54a0ff" }}>E</span>
      <span style={{ color: "#9b59b6" }}>L</span>
    </div>
    <div style={{ fontSize: "12px", fontWeight: "900", color: "#2c3e50", margin: "4px 0", letterSpacing: "1px" }}>
      THE
    </div>
    <div style={{ fontSize: "44px", fontWeight: "900", display: "flex", alignItems: "center", gap: "2px", lineHeight: "1", fontFamily: "'Arial Black', sans-serif" }}>
      <span style={{ color: "#3498db" }}>W</span>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "44px", height: "44px", margin: "0 2px" }}>
        <svg width="42" height="42" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M30 20 L30 65 L70 65" fill="none" stroke="#2c3e50" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="50" cy="65" r="30" fill="none" stroke="#1976D2" strokeWidth="8" />
          <circle cx="50" cy="65" r="22" fill="none" stroke="#CBD5E1" strokeWidth="3" />
          <line x1="50" y1="35" x2="50" y2="95" stroke="#64748B" strokeWidth="4" />
          <line x1="20" y1="65" x2="80" y2="65" stroke="#64748B" strokeWidth="4" />
          <line x1="29" y1="44" x2="71" y2="86" stroke="#64748B" strokeWidth="4" />
          <line x1="29" y1="86" x2="71" y2="44" stroke="#64748B" strokeWidth="4" />
          <circle cx="50" cy="65" r="7" fill="#2c3e50" />
        </svg>
      </span>
      <span style={{ color: "#FF9F43" }}>R</span>
      <span style={{ color: "#4BAB6E" }}>L</span>
      <span style={{ color: "#9b59b6" }}>D</span>
    </div>
    <svg width="250" height="20" viewBox="0 0 240 20" xmlns="http://www.w3.org/2000/svg" style={{ marginTop: "6px" }}>
      <path d="M0 15 C40 5, 80 5, 120 12 S200 20, 240 12 L240 20 L0 20 Z" fill="#475569" />
      <path d="M0 14 C40 4, 80 4, 120 11 S200 19, 240 11" fill="none" stroke="#334155" strokeWidth="2" />
      <path d="M10 13 C30 8, 50 8, 70 11 M90 12 C110 12, 130 14, 150 15 M170 15 C195 15, 215 13, 230 12" fill="none" stroke="#FFF" strokeWidth="2" strokeDasharray="6,5" />
    </svg>
  </div>
);

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

useEffect(() => {
  const handleResize = () => {
    setIsMobile(window.innerWidth <= 768);
  };

  window.addEventListener("resize", handleResize);

  return () => window.removeEventListener("resize", handleResize);
}, []);
  const [currentView, setCurrentView] = useState("home");
  const [markers, setMarkers] = useState([]);
  const [selectedType, setSelectedType] = useState("stairs");

  const [startPoint, setStartPoint] = useState("");
  const [endPoint, setEndPoint] = useState("");
  const [routeSteps, setRouteSteps] = useState([]);             
  const [isRouteSearched, setIsRouteSearched] = useState(false);

  const [animatedRoute, setAnimatedRoute] = useState([]);
  const animationRef = useRef(null);

  const locationPoints = {
    station: [37.6345, 126.832],  
    office: [37.6373, 126.8315],  
    park: [37.6332, 126.8355],    
    library: [37.6391, 126.834],  
  };

  const animateWheelTrack = (fullRoute) => {
    let currentStep = 0;
    const totalSteps = 120; 
    
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const updateTrack = () => {
      currentStep++;
      const progress = currentStep / totalSteps;

      if (progress >= 1) {
        setAnimatedRoute(fullRoute);
        return;
      }

      const totalSegments = fullRoute.length - 1;
      const currentProgressFull = progress * totalSegments;
      const segmentIndex = Math.floor(currentProgressFull);
      const segmentProgress = currentProgressFull - segmentIndex;

      const currentSegmentStart = fullRoute[segmentIndex];
      const currentSegmentEnd = fullRoute[segmentIndex + 1];

      const currentLat = currentSegmentStart[0] + (currentSegmentEnd[0] - currentSegmentStart[0]) * segmentProgress;
      const currentLng = currentSegmentStart[1] + (currentSegmentEnd[1] - currentSegmentStart[1]) * segmentProgress;

      const nextRoute = fullRoute.slice(0, segmentIndex + 1);
      nextRoute.push([currentLat, currentLng]);
      
      setAnimatedRoute(nextRoute);
      animationRef.current = requestAnimationFrame(updateTrack);
    };

    animationRef.current = requestAnimationFrame(updateTrack);
  };

  const handleSearchRoute = (e) => {
    e.preventDefault();
    if (!startPoint || !endPoint) {
      alert("출발지와 목적지를 모두 선택해 주세요!");
      return;
    }
    if (startPoint === endPoint) {
      alert("출발지와 목적지가 같습니다. 다시 설정해 주세요.");
      return;
    }

    const startPos = locationPoints[startPoint];
    const endPos = locationPoints[endPoint];

    const midPos1 = [startPos[0] + (endPos[0] - startPos[0]) * 0.4, startPos[1]];
    const midPos2 = [startPos[0] + (endPos[0] - startPos[0]) * 0.7, endPos[1]];
    const fullRoute = [startPos, midPos1, midPos2, endPos];

    animateWheelTrack(fullRoute);

    let steps = ["📍 출발지에서 이동을 시작합니다."];
    if (startPoint === "station" && endPoint === "office") {
      steps.push("🚶 횡단보도 단차 낮춤 구간을 이용해 우측 보도로 진입하세요.");
      steps.push("🚧 50m 앞 보도블록 파손 구간이 있으니 서행하세요.");
      steps.push("♿ 덕양구청 후문 경사로를 이용하면 진입이 훨씬 수월합니다.");
    } else if (startPoint === "station" && endPoint === "park") {
      steps.push("🚶 화정역 3번 출구 방면 엘리베이터를 이용하여 지상으로 이동하세요.");
      steps.push("🍀 중앙공원 진입 광장은 턱이 없는 평탄한 진입로입니다.");
    } else if (startPoint === "office" && endPoint === "library") {
      steps.push("🚶 구청 앞 정비된 보도를 따라 도서관 방면으로 직진합니다.");
      steps.push("🪜 도서관 정문 계단 옆에 마련된 '안전 완만 경사로'를 이용하세요.");
    } else {
      steps.push("🚶 제보된 계단 위험 지역을 우회하는 안전 루트로 안내합니다.");
      steps.push("🍀 턱 낮춤 정비가 완료된 쾌적한 인도 중심 경로입니다.");
    }
    steps.push("🏁 안전하게 목적지에 도착했습니다!");

    setRouteSteps(steps);
    setIsRouteSearched(true);
  };

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
      height: "65px", background: "#ffffff", borderBottom: "1px solid #EAEAEA",
      display: "flex", alignItems: "center", padding: "0 20px", justifyContent: "space-between",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)", zIndex: 1001, position: "relative",
      boxSizing: "border-box"
    }}>
      <div onClick={() => setCurrentView("home")} style={{ cursor: "pointer", display: "flex", alignItems: "center", height: "100%" }}>
        <div style={{ transform: "scale(0.48)", transformOrigin: "left center", margin: "-12px 0" }}>
          <SimpleTextLogo />
        </div>
      </div>
      <div style={{ display: "flex", gap: "12px" }}>
        <button onClick={() => { setCurrentView("search"); resetRoute(); }} style={{ padding: "8px 16px", border: "none", borderRadius: "12px", background: currentView === "search" ? "#E3F2FD" : "#F5F5F7", color: currentView === "search" ? "#1976D2" : "#555", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>🗺️ 안전 길찾기</button>
        <button onClick={() => setCurrentView("create")} style={{ padding: "8px 16px", border: "none", borderRadius: "12px", background: currentView === "create" ? "#E3F2FD" : "#F5F5F7", color: currentView === "create" ? "#1976D2" : "#555", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>✍️ 주민 제보</button>
        <button onClick={() => setCurrentView("walk")} style={{ padding: "8px 16px", border: "none", borderRadius: "12px", background: currentView === "walk" ? "#E3F2FD" : "#F5F5F7", color: currentView === "search" ? "#555" : currentView === "walk" ? "#1976D2" : "#555", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>🌳 산책 코스</button>
      </div>
      <div style={{ width: "35px" }}></div>
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
      {currentView === "home" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", position: "relative", boxSizing: "border-box", width: "100%" }}>
          <CuteCartoonBackground />
          <div style={{ position: "relative", zIndex: 2, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: "850px" }}>
            <SimpleTextLogo />
            <div style={{ fontSize: "18px", color: "#1976D2", fontWeight: "800", marginBottom: "2px", letterSpacing: "0.5px", marginTop: "10px" }}>
              "모든 길은 모두를 위해"
            </div>
            <p style={{ color: "#222", fontSize: "22px", margin: 0, fontWeight: "700", letterSpacing: "-0.5px", wordBreak: "keep-all", lineHeight: "1.4", marginBottom: "40px" }}>
              함께 만드는 우리 동네 무장애 생활지도
            </p>
            <div style={{ 
  display: "flex", 
  gap: "20px", 
  width: "100%", 
  maxWidth: "340px",      // 버튼 전체의 최대 너비
  flexDirection: "column", 
  alignItems: "center", 
  justifyContent: "flex-start", // [중요] 왼쪽 정렬을 위해 center에서 flex-start로 변경
  margin: "0 auto",             // 전체 박스는 중앙 유지
  paddingLeft: "20px"           // [중요] 왼쪽으로 살짝 더 밀고 싶다면 추가
}}>
              <div 
                onClick={() => { setCurrentView("search"); resetRoute(); }} 
                style={{ width: isMobile ? "100%" : "260px",
maxWidth: isMobile ? "340px" : "260px", background: "rgba(255, 255, 255, 0.92)", padding: "28px 20px", borderRadius: "28px", boxShadow: "0 10px 30px rgba(0,0,0,0.06)", border: "2px solid #EBF1F6", cursor: "pointer", transition: "all 0.25s ease-in-out", textAlign: "center", backdropFilter: "blur(4px)" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform="translateY(-6px)"; e.currentTarget.style.borderColor="#4BAB6E"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.borderColor="#EBF1F6"; }}
              >
                <div style={{ fontSize: "38px", marginBottom: "12px" }}>🗺️</div>
                <h3 style={{ fontSize: "19px", margin: "0 0 8px 0", fontWeight: "800", color: "#222" }}>안전 길찾기</h3>
                <p style={{ color: "#555", fontSize: "13.5px", margin: 0, lineHeight: "1.6", wordBreak: "keep-all" }}>바퀴가 구르기 편한 길과<br />위험 장애물을 미리 확인해요.</p>
              </div>
              <div 
                onClick={() => setCurrentView("create")} 
                style={{ width: isMobile ? "100%" : "260px",
maxWidth: isMobile ? "340px" : "260px", background: "rgba(255, 255, 255, 0.92)", padding: "28px 20px", borderRadius: "28px", boxShadow: "0 10px 30px rgba(0,0,0,0.06)", border: "2px solid #EBF1F6", cursor: "pointer", transition: "all 0.25s ease-in-out", textAlign: "center", backdropFilter: "blur(4px)" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform="translateY(-6px)"; e.currentTarget.style.borderColor="#4BAB6E"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.borderColor="#EBF1F6"; }}
              >
                <div style={{ fontSize: "38px", marginBottom: "12px" }}>✍️</div>
                <h3 style={{ fontSize: "19px", margin: "0 0 8px 0", fontWeight: "800", color: "#222" }}>주민 제보</h3>
                <p style={{ color: "#555", fontSize: "13.5px", margin: 0, lineHeight: "1.6", wordBreak: "keep-all" }}>골목길의 계단, 턱, 보도 파손을<br />직접 지도에 등록하고 제보해요.</p>
              </div>
              <div 
                onClick={() => setCurrentView("walk")} 
                style={{width: isMobile ? "100%" : "260px",
maxWidth: isMobile ? "340px" : "260px", background: "rgba(255, 255, 255, 0.92)", padding: "28px 20px", borderRadius: "28px", boxShadow: "0 10px 30px rgba(0,0,0,0.06)", border: "2px solid #EBF1F6", cursor: "pointer", transition: "all 0.25s ease-in-out", textAlign: "center", backdropFilter: "blur(4px)" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform="translateY(-6px)"; e.currentTarget.style.borderColor="#4BAB6E"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.borderColor="#EBF1F6"; }}
              >
                <div style={{ fontSize: "38px", marginBottom: "12px" }}>🌳</div>
                <h3 style={{ fontSize: "19px", margin: "0 0 8px 0", fontWeight: "800", color: "#222" }}>산책 코스 추천</h3>
                <p style={{ color: "#555", fontSize: "13.5px", margin: 0, lineHeight: "1.6", wordBreak: "keep-all" }}>휠체어와 유모차도 편안하게<br />거닐 수 있는 동네 힐링 코스</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. 안전 길찾기 화면 */}
      {currentView === "search" && (
      <div style={{ 
          width: "100%", 
          maxWidth: "850px",      // 화면 제한
          flex: 1                 // 남은 공간을 다 차지하게 함
        }}>
          {renderHeader()}
          <div
  style={{
    flex: 1,
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
  }}
>
            <div style={{ width: isMobile ? "100%" : "320px",
height: isMobile ? "320px" : "100%", background: "#ffffff", borderRight: "1px solid #EAEAEA", padding: "20px 16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "15px" }}>
              <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "800" }}>🔍 무장애 안전 길찾기</h3>
              
              <form onSubmit={handleSearchRoute} style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#F8FAFC", padding: "14px", borderRadius: "16px", border: "1px solid #E2E8F0" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", display: "block", marginBottom: "4px" }}>🟢 출발지 선택</label>
                  <select value={startPoint} onChange={(e) => setStartPoint(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", background: "#fff" }}>
                    <option value="">출발지를 골라주세요</option>
                    <option value="station">📍 화정역</option>
                    <option value="office">📍 덕양구청</option>
                    <option value="park">📍 화정중앙공원</option>
                    <option value="library">📍 화정도서관</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", display: "block", marginBottom: "4px" }}>🔴 목적지 선택</label>
                  <select value={endPoint} onChange={(e) => setEndPoint(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", background: "#fff" }}>
                    <option value="">목적지를 골라주세요</option>
                    <option value="station">📍 화정역</option>
                    <option value="office">📍 덕양구청</option>
                    <option value="park">📍 화정중앙공원</option>
                    <option value="library">📍 화정도서관</option>
                  </select>
                </div>
                <button type="submit" style={{ width: "100%", padding: "10px", background: "#1976D2", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer", marginTop: "5px" }}>🚀 안전 경로 탐색</button>
                {isRouteSearched && (
                  <button type="button" onClick={resetRoute} style={{ width: "100%", padding: "8px", background: "#EFF6FF", color: "#1976D2", border: "1px solid #BFDBFE", borderRadius: "10px", fontWeight: "600", cursor: "pointer" }}>🔄 경로 지우기</button>
                )}
              </form>

              <div style={{ flex: 1 }}>
                {isRouteSearched ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <span style={{ fontSize: isMobile ? "12px" : "14px",
padding: isMobile ? "7px 10px" : "8px 16px", fontWeight: "700", color: "#475569" }}>📋 실시간 보행 가이드</span>
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
                          <div key={m.id} style={{ padding: "10px", borderRadius: "12px", border: "1px solid #EEF0F3", background: "#fff", display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
                            <span>{m.type === "stairs" ? "🪜" : m.type === "ramp" ? "♿" : "⚠️"}</span> <b>{getLabel(m.type)}</b>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ flex: 1, position: "relative" }}>
              <MapContainer center={[37.6345, 126.832]} zoom={16} style={{ width: "100%", height: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                
                {markers.map((m) => (
                  <Marker key={m.id} position={[m.lat, m.lng]} icon={getIcon(m.type)}>
                    <Popup><b>{getLabel(m.type)}</b></Popup>
                  </Marker>
                ))}

                {isRouteSearched && (
                  <>
                    <Polyline 
                      positions={animatedRoute} 
                      color="#22C55E" 
                      weight={8} 
                      opacity={0.85} 
                      dashArray="6, 12" 
                      lineCap="round"
                    />

                    {/* 실시간으로 늘어나는 선의 끝점(헤드)에 매끄럽게 회전하는 바퀴 모양 아이콘 배치 */}
                    {animatedRoute.length > 0 && (
                      <Marker position={animatedRoute[animatedRoute.length - 1]} icon={divIcon({
                        html: `
                          <div style="
                            display: flex; align-items: center; justify-content: center;
                            width: 38px; height: 38px; background: white; border-radius: 50%;
                            box-shadow: 0 4px 15px rgba(0,0,0,0.3); border: 3px solid #4BAB6E;
                          ">
                           <svg
  class="spinning-wheel"
  width="30"
  height="30"
  viewBox="0 0 100 100"
  xmlns="http://www.w3.org/2000/svg"
  style="transform-origin: center;"
>
  {/* 바깥 타이어 */}
  <circle
    cx="50"
    cy="50"
    r="40"
    fill="#2C3E50"
  />

  {/* 안쪽 테두리 */}
  <circle
    cx="50"
    cy="50"
    r="30"
    fill="#5DADE2"
    stroke="#D6EAF8"
    stroke-width="5"
  />

  {/* 바퀴 살 */}
  <line x1="50" y1="20" x2="50" y2="80" stroke="white" stroke-width="4" />
  <line x1="20" y1="50" x2="80" y2="50" stroke="white" stroke-width="4" />
  <line x1="28" y1="28" x2="72" y2="72" stroke="white" stroke-width="4" />
  <line x1="28" y1="72" x2="72" y2="28" stroke="white" stroke-width="4" />

  {/* 가운데 */}
  <circle
    cx="50"
    cy="50"
    r="8"
    fill="#F8F9F9"
    stroke="#2C3E50"
    stroke-width="3"
  />
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
                        className: "", iconSize: [38, 38], iconAnchor: [19, 19]
                      })} />
                    )}
                    
                    <Marker position={locationPoints[startPoint]} icon={divIcon({
                      html: `<div style="background:#22C55E; color:white; padding:4px 8px; border-radius:8px; font-weight:bold; font-size:11px; white-space:nowrap; border:2px solid white;">🟢 출발</div>`,
                      className: "", iconAnchor: [20, 10]
                    })} />
                    
                    <Marker position={locationPoints[endPoint]} icon={divIcon({
                      html: `<div style="background:#EF4444; color:white; padding:4px 8px; border-radius:8px; font-weight:bold; font-size:11px; white-space:nowrap; border:2px solid white;">🔴 도착</div>`,
                      className: "", iconAnchor: [20, 10]
                    })} />
                  </>
                )}
              </MapContainer>
            </div>
          </div>
        </div>
      )}

      {/* 3. 주민 제보 화면 */}
      {currentView === "create" && (
       <div style={{ 
    flex: 1, 
    display: "flex", 
    flexDirection: "column", 
    width: "100%",          // 중요: 부모 너비를 100%로 꽉 채움
    maxWidth: "850px",      // 중요: 너무 넓어지지 않게 최대 너비 제한
    padding: "20px",        // 양옆 여백 확보
    boxSizing: "border-box" // 패딩 때문에 잘리는 것 방지
  }}>
          {renderHeader()}
          <div style={{ flex: 1, display: "flex" }}>
            <div style={{ width: "320px", background: "#ffffff", borderRight: "1px solid #EAEAEA", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>✍️ 새로운 장소 제보</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button onClick={() => setSelectedType("stairs")} style={{ padding: "12px", borderRadius: "12px", border: "none", background: selectedType === "stairs" ? "#FFECEC" : "#F5F5F7", color: selectedType === "stairs" ? "#D32F2F" : "#333", fontWeight: "600", cursor: "pointer", textAlign: "left" }}>🪜 계단 위험</button>
                <button onClick={() => setSelectedType("ramp")} style={{ padding: "12px", borderRadius: "12px", border: "none", background: selectedType === "ramp" ? "#E8F5E9" : "#F5F5F7", color: selectedType === "ramp" ? "#2E7D32" : "#333", fontWeight: "600", cursor: "pointer", textAlign: "left" }}>♿ 안전 경사로</button>
                <button onClick={() => setSelectedType("bump")} style={{ padding: "12px", borderRadius: "12px", border: "none", background: selectedType === "bump" ? "#FFF3E0" : "#F5F5F7", color: selectedType === "bump" ? "#E65100" : "#333", fontWeight: "600", cursor: "pointer", textAlign: "left" }}>⚠️ 보도 턱/파손</button>
              </div>
              <div style={{ background: "#E3F2FD", padding: "12px", borderRadius: "10px", fontSize: "13px", color: "#0D47A1", lineHeight: "1.4" }}>💡 장애물 종류를 고르고 지도를 클릭해 실시간으로 등록해 보세요.</div>
            </div>
           <div
  style={{
    flex: 1,
    position: "relative",
    height: isMobile ? "calc(100vh - 380px)" : "100%",
  }}
>
              <MapContainer center={[37.6345, 126.832]} zoom={16} style={{ width: "100%", height: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <AddMarker setMarkers={setMarkers} selectedType={selectedType} />
                {markers.map((m) => (
                  <Marker key={m.id} position={[m.lat, m.lng]} icon={getIcon(m.type)}>
                    <Popup closeButton={false}>
                      <div style={{ textAlign: "center", padding: "4px" }}>
                        <b style={{ display: "block", marginBottom: "8px" }}>{getLabel(m.type)}</b>
                        <button onClick={(e) => { e.stopPropagation(); setMarkers(prev => prev.filter(item => item.id !== m.id)); }} style={{ background: "#FF4D4D", color: "white", border: "none", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}>삭제</button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>
      )}

      {/* 4. 산책 코스 화면 */}
      {currentView === "walk" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {renderHeader()}
          <div style={{ flex: 1, padding: "40px", display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto", background: "#FAFAFA" }}>
            <h2 style={{ fontSize: "26px", fontWeight: "800", marginBottom: "25px", letterSpacing: "-0.5px" }}>🌳 화정동 힐링 산책 코스</h2>
            <div style={{ width: "100%", maxWidth: "800px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ background: "white", borderRadius: "24px", padding: "24px", border: "1px solid #EAEAEA", display: "flex", gap: "20px", alignItems: "center", boxShadow: "0 4px 15px rgba(0,0,0,0.02)" }}>
                <div style={{ fontSize: "32px", background: "#E8F5E9", width: "60px", height: "60px", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>🏞️</div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: "0 0 5px 0", fontSize: "17px", fontWeight: "700" }}>화정중앙공원 순환 코스</h4>
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