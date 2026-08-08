import { motion } from "framer-motion";

/**
 * Hero Mountain Illustration — Full-width, seamlessly blended into hero.
 * No rectangular boundary. Feels painted into the interface.
 * Organic layered mountains. Cinematic fog. Thinner tapering road.
 */
function HeroMountainArt({ className = "" }) {
  return (
    <div
      className={`relative w-full h-full min-h-[400px] sm:min-h-[460px] flex items-end overflow-hidden select-none pointer-events-none ${className}`}
    >
      <svg
        viewBox="0 0 1600 700"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full object-cover"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" className="sk-t" />
            <stop offset="100%" className="sk-b" />
          </linearGradient>

          <radialGradient id="sunGl" cx="58%" cy="26%" r="32%">
            <stop offset="0%" className="sgc" />
            <stop offset="40%" className="sgm" />
            <stop offset="100%" className="sgo" />
          </radialGradient>

          <radialGradient id="sunOr" cx="44%" cy="36%" r="56%">
            <stop offset="0%" className="soh" />
            <stop offset="100%" className="sol" />
          </radialGradient>

          <linearGradient id="m1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" className="m1t" /><stop offset="100%" className="m1b" />
          </linearGradient>
          <linearGradient id="m2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" className="m2t" /><stop offset="100%" className="m2b" />
          </linearGradient>
          <linearGradient id="m3" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" className="m3t" /><stop offset="100%" className="m3b" />
          </linearGradient>
          <linearGradient id="m4" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" className="m4t" /><stop offset="100%" className="m4b" />
          </linearGradient>
          <linearGradient id="m5" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" className="m5t" /><stop offset="100%" className="m5b" />
          </linearGradient>

          <linearGradient id="fg1" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" className="f1b" /><stop offset="100%" className="f1t" />
          </linearGradient>
          <linearGradient id="fg2" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" className="f2b" /><stop offset="100%" className="f2t" />
          </linearGradient>

          <linearGradient id="rd" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" className="rdl" />
            <stop offset="50%" className="rdm" />
            <stop offset="100%" className="rdh" />
          </linearGradient>

          <filter id="glo" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" result="b"/>
            <feComposite in="SourceGraphic" in2="b" operator="over"/>
          </filter>
          <filter id="sgl" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="18"/>
          </filter>
          <filter id="fgl" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6"/>
          </filter>
          <filter id="trl" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2"/>
          </filter>
        </defs>

        <style>{`
          .sk-t { stop-color: #FFF8F0; stop-opacity: 0.3; }
          .sk-b { stop-color: #FFECD8; stop-opacity: 0.1; }
          [data-theme="dark"] .sk-t { stop-color: #0F1117; stop-opacity: 1; }
          [data-theme="dark"] .sk-b { stop-color: #151820; stop-opacity: 1; }

          .sgc { stop-color: #FFB870; stop-opacity: 0.45; }
          .sgm { stop-color: #FF8A3D; stop-opacity: 0.15; }
          .sgo { stop-color: #FF6B35; stop-opacity: 0; }
          [data-theme="dark"] .sgc { stop-color: #FF9040; stop-opacity: 0.28; }
          [data-theme="dark"] .sgm { stop-color: #FF6B35; stop-opacity: 0.08; }
          [data-theme="dark"] .sgo { stop-color: #FF6B35; stop-opacity: 0; }

          .soh { stop-color: #FFF6ED; stop-opacity: 1; }
          .sol { stop-color: #FFB870; stop-opacity: 1; }
          [data-theme="dark"] .soh { stop-color: #FFD9A0; stop-opacity: 1; }
          [data-theme="dark"] .sol { stop-color: #FF9040; stop-opacity: 1; }

          .m1t { stop-color: #DBA880; stop-opacity: 0.14; }
          .m1b { stop-color: var(--card-bg); stop-opacity: 0.8; }
          [data-theme="dark"] .m1t { stop-color: #2A2235; stop-opacity: 0.5; }
          [data-theme="dark"] .m1b { stop-color: #171A21; stop-opacity: 1; }

          .m2t { stop-color: #C88060; stop-opacity: 0.25; }
          .m2b { stop-color: var(--card-bg); stop-opacity: 0.86; }
          [data-theme="dark"] .m2t { stop-color: #382820; stop-opacity: 0.65; }
          [data-theme="dark"] .m2b { stop-color: #171A21; stop-opacity: 1; }

          .m3t { stop-color: #B06840; stop-opacity: 0.4; }
          .m3b { stop-color: var(--card-bg); stop-opacity: 0.94; }
          [data-theme="dark"] .m3t { stop-color: #4A3020; stop-opacity: 0.76; }
          [data-theme="dark"] .m3b { stop-color: #171A21; stop-opacity: 1; }

          .m4t { stop-color: #9A5530; stop-opacity: 0.58; }
          .m4b { stop-color: var(--card-bg); stop-opacity: 1; }
          [data-theme="dark"] .m4t { stop-color: #5A3820; stop-opacity: 0.84; }
          [data-theme="dark"] .m4b { stop-color: #171A21; stop-opacity: 1; }

          .m5t { stop-color: #7A4425; stop-opacity: 0.75; }
          .m5b { stop-color: var(--card-bg); stop-opacity: 1; }
          [data-theme="dark"] .m5t { stop-color: #6A4228; stop-opacity: 0.88; }
          [data-theme="dark"] .m5b { stop-color: #171A21; stop-opacity: 1; }

          .f1b { stop-color: var(--card-bg); stop-opacity: 0.42; }
          .f1t { stop-color: var(--card-bg); stop-opacity: 0; }
          [data-theme="dark"] .f1b { stop-color: #171A21; stop-opacity: 0.52; }
          [data-theme="dark"] .f1t { stop-color: #171A21; stop-opacity: 0; }

          .f2b { stop-color: var(--card-bg); stop-opacity: 0.3; }
          .f2t { stop-color: var(--card-bg); stop-opacity: 0; }
          [data-theme="dark"] .f2b { stop-color: #171A21; stop-opacity: 0.38; }
          [data-theme="dark"] .f2t { stop-color: #171A21; stop-opacity: 0; }

          .rdl { stop-color: #C07040; stop-opacity: 0.84; }
          .rdm { stop-color: #FF8A3D; stop-opacity: 0.9; }
          .rdh { stop-color: #FFAA64; stop-opacity: 1; }
          [data-theme="dark"] .rdl { stop-color: #A05830; stop-opacity: 0.8; }
          [data-theme="dark"] .rdm { stop-color: #FF8A3D; stop-opacity: 0.92; }
          [data-theme="dark"] .rdh { stop-color: #FFAA64; stop-opacity: 1; }

          .bds { stroke: #FF8A3D; opacity: 0.35; stroke-width: 1.2; }
          [data-theme="dark"] .bds { stroke: #FFAA64; opacity: 0.22; }

          .rds { stroke: rgba(255,253,251,0.8); }
          [data-theme="dark"] .rds { stroke: rgba(255,200,128,0.18); }

          .tr { fill: #6B8A5E; opacity: 0.55; }
          [data-theme="dark"] .tr { fill: #2A3A22; stop-opacity: 0.65; }
        `}</style>

        {/* ═══ SKY ═══ */}
        <rect width="1600" height="700" fill="url(#sky)" />

        {/* ═══ SUN — lower, behind mountain, partially visible ═══ */}
        <circle cx="920" cy="155" r="150" fill="url(#sunGl)" />
        <circle cx="920" cy="155" r="36" fill="url(#sunOr)" />

        {/* ═══════════════════════════════════════
            5 MOUNTAIN LAYERS — full-width, organic curves
            Main summit: X=750, Y=150
            Mountains spread across entire hero width
        ═══════════════════════════════════════ */}

        {/* Layer 1: Farthest — spans full width, softest */}
        <path
          d="M -50 700 C 50 700, 100 400, 200 350 C 300 300, 380 380, 480 290 C 560 220, 660 185, 750 150 C 840 185, 940 240, 1060 320 C 1160 380, 1280 300, 1400 330 C 1480 350, 1560 370, 1650 350 L 1650 740 L -50 740 Z"
          fill="url(#m1)"
        />

        {/* Layer 2 */}
        <path
          d="M -50 710 C 80 710, 160 420, 280 370 C 380 330, 440 400, 540 310 C 620 245, 700 195, 750 150 C 800 195, 880 260, 1000 340 C 1100 400, 1220 320, 1360 350 C 1460 370, 1560 390, 1650 375 L 1650 740 L -50 740 Z"
          fill="url(#m2)"
        />

        {/* Layer 3 — mid slopes */}
        <path
          d="M -50 720 C 100 720, 200 460, 320 410 C 420 370, 500 430, 580 340 C 640 275, 720 210, 750 150 C 780 210, 840 280, 960 370 C 1060 430, 1180 360, 1320 385 C 1420 400, 1540 420, 1650 405 L 1650 740 L -50 740 Z"
          fill="url(#m3)"
        />

        {/* Layer 4 — near, strong */}
        <path
          d="M -50 730 C 120 730, 240 500, 360 450 C 460 410, 540 460, 620 370 C 680 300, 730 225, 750 150 C 770 225, 810 310, 900 400 C 1000 470, 1140 400, 1300 420 C 1420 435, 1540 455, 1650 440 L 1650 740 L -50 740 Z"
          fill="url(#m4)"
        />

        {/* ═══ FOG BETWEEN LAYERS ═══ */}
        <rect x="0" y="420" width="1600" height="80" fill="url(#fg1)" opacity="0.55" />
        <rect x="0" y="490" width="1600" height="65" fill="url(#fg2)" opacity="0.4" />

        {/* ═══════════════════════════════════════
            WINDING ROAD — thinner, tapers toward summit
        ═══════════════════════════════════════ */}

        {/* Road glow */}
        <path
          d="M 650 740 C 670 680, 810 650, 800 585 C 790 520, 660 500, 670 435 C 680 370, 730 290, 745 230 C 755 195, 748 170, 750 150"
          fill="none" stroke="#FF8A3D" strokeWidth="22" strokeLinecap="round"
          opacity="0.07" filter="url(#sgl)"
        />

        {/* Road edge glow */}
        <path
          d="M 650 740 C 670 680, 810 650, 800 585 C 790 520, 660 500, 670 435 C 680 370, 730 290, 745 230 C 755 195, 748 170, 750 150"
          fill="none" stroke="#FFAA64" strokeWidth="10" strokeLinecap="round"
          opacity="0.14" filter="url(#glo)"
        />

        {/* Main road — tapers thinner toward summit */}
        <path
          d="M 650 740 C 670 680, 810 650, 800 585 C 790 520, 660 500, 670 435 C 680 370, 730 290, 745 230 C 755 195, 748 170, 750 150"
          fill="none" stroke="url(#rd)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"
        />

        {/* Road dashed center — also tapers */}
        <path
          d="M 650 740 C 670 680, 810 650, 800 585 C 790 520, 660 500, 670 435 C 680 370, 730 290, 745 230 C 755 195, 748 170, 750 150"
          fill="none" className="rds" strokeWidth="1.4" strokeDasharray="6 5" strokeLinecap="round"
        />

        {/* ═══ FOREGROUND RIDGE ═══ */}
        <path
          d="M -50 740 C 80 740, 180 540, 300 510 C 400 485, 500 520, 620 490 C 720 465, 820 500, 960 480 C 1080 460, 1220 490, 1650 480 L 1650 740 L -50 740 Z"
          fill="url(#m5)"
        />

        {/* ═══ PINE TREES — small clusters at base ═══ */}
        <g className="tr" filter="url(#trl)">
          <path d="M 180 740 L 187 718 L 194 740 Z" />
          <path d="M 183 725 L 187 708 L 191 725 Z" />
          <path d="M 230 740 L 237 712 L 244 740 Z" />
          <path d="M 233 720 L 237 700 L 241 720 Z" />
          <path d="M 280 740 L 285 725 L 290 740 Z" />
        </g>
        <g className="tr" filter="url(#trl)">
          <path d="M 1150 740 L 1157 715 L 1164 740 Z" />
          <path d="M 1153 722 L 1157 702 L 1161 722 Z" />
          <path d="M 1210 740 L 1217 708 L 1224 740 Z" />
          <path d="M 1213 718 L 1217 696 L 1221 718 Z" />
          <path d="M 1270 740 L 1275 725 L 1280 740 Z" />
          <path d="M 1330 740 L 1335 728 L 1340 740 Z" />
        </g>
        <g className="tr" filter="url(#trl)">
          <path d="M 440 740 L 445 728 L 450 740 Z" />
          <path d="M 480 740 L 485 720 L 490 740 Z" />
          <path d="M 483 728 L 485 715 L 487 728 Z" />
        </g>

        {/* ═══════════════════════════════════════
            SUMMIT FLAG — X=750, Y=150
            #FF6B35. Small. Clearly visible.
        ═══════════════════════════════════════ */}

        <circle cx="762" cy="120" r="15" fill="#FF6B35" opacity="0.15" filter="url(#fgl)" />

        <g transform="translate(750, 150)">
          <circle cx="0" cy="0" r="2.5" fill="#FF6B35" />
          <line x1="0" y1="0" x2="0" y2="-32" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" />
          <path d="M 0 -32 L 20 -25 L 0 -18 Z" fill="#FF6B35" stroke="#FF8A3D" strokeWidth="0.5" strokeLinejoin="round" />
        </g>

        {/* ═══ BIRDS — 4 tiny, near upper mountain ═══ */}
        <g className="bds" strokeLinecap="round" fill="none">
          <path d="M 580 100 Q 586 94 592 100 Q 598 94 604 100" />
          <path d="M 660 120 Q 665 115 670 120 Q 675 115 680 120" />
          <path d="M 530 138 Q 535 133 540 138 Q 545 133 550 138" opacity="0.45" />
          <path d="M 850 88 Q 855 83 860 88 Q 865 83 870 88" opacity="0.3" />
        </g>
      </svg>
    </div>
  );
}

export default HeroMountainArt;
