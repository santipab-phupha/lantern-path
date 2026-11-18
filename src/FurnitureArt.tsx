import { memo } from "react";
import type { FurnitureKind } from "./furniture";

// The same drawing is used by the plan and library. Its outer edge always fits
// the model rectangle, including when the user changes an object's proportions.
export function FurnitureFinishes() {
  return <svg width="0" height="0" className="finish-defs" aria-hidden="true"><defs>
    <linearGradient id="oak" x2=".25" y2="1" gradientUnits="objectBoundingBox">
      <stop stopColor="#d9ae7c"/><stop offset=".48" stopColor="#cfa06f"/><stop offset="1" stopColor="#b7845b"/>
    </linearGradient>
    <pattern id="grain" width="50" height="18" patternUnits="userSpaceOnUse">
      <path d="M-4 6q12-4 28 0t30-1M2 13q14-3 30 0" fill="none" stroke="#855838" strokeOpacity=".22" strokeWidth=".8"/>
    </pattern>
    <linearGradient id="linen" x2=".1" y2="1"><stop stopColor="#c3d1ba"/><stop offset="1" stopColor="#8ca58c"/></linearGradient>
    <linearGradient id="velvet" x2="0" y2="1"><stop stopColor="#e2b19a"/><stop offset="1" stopColor="#bd826c"/></linearGradient>
  </defs></svg>;
}

function Surface({ fill = "url(#oak)", radius = 3 }: { fill?: string; radius?: number }) {
  return <rect x="1" y="1" width="98" height="98" rx={radius} fill={fill} stroke="#695f4f" strokeWidth="1.8"/>;
}

function Drawing({ kind }: { kind: FurnitureKind }) {
  switch (kind) {
    case "bed":
      return <>
        <Surface fill="#996f50"/>
        <rect x="4" y="6" width="92" height="91" rx="5" fill="#f5eede" stroke="#847c6c"/>
        {[8, 52].map(x => <g key={x}><rect x={x} y="11" width="40" height="20" rx="5" fill="#ddd4c4"/>
          <rect x={x} y="9" width="39" height="19" rx="5" fill="#fffaf0" stroke="#bbb19c"/></g>)}
        <path d="M4 35Q30 31 50 35T96 35V90Q96 96 89 96H10Q4 96 4 90Z" fill="url(#linen)" stroke="#788b73"/>
        <path d="M5 36Q28 32 50 36T95 36V44Q73 46 50 43T5 44Z" fill="#dbe1cf" stroke="#95a58c"/>
        <path d="M5 80H95V91H5Z" fill="#6d876e"/><path d="M6 83H94 M6 88H94" stroke="#c0cbb4"/>
      </>;
    case "sofa":
    case "armchair": {
      const seats = kind === "sofa" ? 3 : 1;
      return <>
        <Surface fill="#a36f58" radius={10}/>
        {Array.from({ length: seats }, (_, i) => <rect key={i} x={10 + 80*i/seats} y="23" width={80/seats - 1} height="64" rx="5" fill="url(#velvet)" stroke="#a87360"/>)}
        <rect x="6" y="4" width="88" height="20" rx="7" fill="#e2b29d" stroke="#ac7a65"/>
        {[2, 89].map(x => <rect key={x} x={x} y="16" width="9" height="72" rx="4" fill="#daa68e" stroke="#a87360"/>)}
        <path d="M13 89H87" stroke="#805a48" strokeWidth="2"/>
      </>;
    }
    case "table":
      return <><Surface radius={10}/><rect x="3" y="3" width="94" height="94" rx="9" fill="url(#grain)" stroke="#e5c198"/>
        <rect x="37" y="2" width="26" height="96" fill="#ebe1c9" stroke="#b19c7c"/>
        <ellipse cx="50" cy="51" rx="10" ry="17" fill="#b6a07c"/><ellipse cx="50" cy="48" rx="9" ry="16" fill="#627e65"/>
        <path d="m46 48 4-10 4 11-4 10Z" fill="#9bab81"/>
      </>;
    case "desk":
      return <><Surface/><rect width="100" height="100" fill="url(#grain)"/>
        <rect x="32" y="13" width="37" height="43" rx="3" fill="#454f4a"/><rect x="35" y="16" width="31" height="35" fill="#96aaa2"/>
        <path d="M32 57H69L73 71H28Z" fill="#dddcd3" stroke="#706e63"/><path d="M34 62H66M36 66H64" stroke="#9b9c8e"/>
        <g transform="rotate(9 83 58)"><rect x="78" y="41" width="13" height="33" fill="#f4ead5" stroke="#8f816b"/><path d="M81 49h7m-7 6h7" stroke="#b5ab98"/></g>
      </>;
    case "wardrobe":
      return <><Surface/><rect width="100" height="100" fill="url(#grain)"/><path d="M50 2v96M5 8h90v84H5Z" fill="none" stroke="#8b664a" strokeWidth="1.6"/>
        <path d="M45 40v19m10-19v19" stroke="#514f43" strokeWidth="2.5" strokeLinecap="round"/></>;
    case "bookcase":
      return <><Surface fill="#795f4f"/>{["#c49472","#637f78","#e1cc99","#aca3ad","#b66f5b","#b4ba93","#e2c6a7","#738c91"].map((c,i)=>
        <g key={c}><rect x={5+i*11.3} y={12+(i%3)*3} width="10" height={70-(i%3)*3} rx="1.5" fill={c}/>
        <path d={`M${6+i*11.3} 32h8m-8 38h8`} stroke="#ece3cd" strokeWidth="1.8"/></g>)}
        <path d="M2 9H98M2 89H98" stroke="#d8b184" strokeWidth="5"/></>;
    case "plant":
      return <><Surface fill="#caba9b" radius={4}/><circle cx="50" cy="53" r="37" fill="#d7be9c" stroke="#9d795b" strokeWidth="3"/>
        {Array.from({length: 9}, (_,i)=><path key={i} d="M50 54Q24 32 47 4Q65 22 50 54Z" transform={`rotate(${i*40} 50 50)`}
          fill={["#5c8168","#829969","#9bae78"][i%3]} stroke="#516e53" strokeWidth="1.3"/>)}
        <circle cx="50" cy="50" r="5" fill="#bdc58c"/></>;
    case "wall": return <><Surface fill="#aaa08c" radius={0}/><path d="M1 12H99" stroke="#d9c49f" strokeWidth="5"/></>;
    case "block": return <><Surface fill="#c4c3b9"/><path d="M7 8H93V92H7Z" fill="none" stroke="#92968d" strokeDasharray="5 3"/></>;
  }
}

export const FurnitureArt = memo(function FurnitureArt({ kind, width, height }: {
  kind: FurnitureKind; width: number; height: number;
}) {
  return <svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" pointerEvents="none">
    <Drawing kind={kind}/>
  </svg>;
});
