/**
 * Lightweight SVG chart components — zero dependencies.
 * Uses theme-aware CSS variables so they work in dark mode automatically.
 */

function buildLinePath(points, width, height, pad = 6) {
  if (points.length < 2) return "";
  const max = Math.max(...points.map((p) => p.value), 1);
  const min = Math.min(...points.map((p) => p.value), 0);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / Math.max(points.length - 1, 1);
  return points
    .map((p, i) => {
      const x = pad + i * stepX;
      const y = height - pad - ((p.value - min) / range) * (height - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(points, width, height, pad = 6) {
  if (points.length === 0) return "";
  const line = buildLinePath(points, width, height, pad);
  if (!line) return "";
  const last = points[points.length - 1];
  const stepX = (width - pad * 2) / Math.max(points.length - 1, 1);
  const lastX = pad + (points.length - 1) * stepX;
  return `${line} L${lastX.toFixed(2)},${height - pad} L${pad},${height - pad} Z`;
}

export function LineChart({ data = [], height = 180, color = "var(--primary)", showDots = true }) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center" style={{ height }}>No data yet</div>;
  }
  const width = 560;
  const pad = 6;
  const values = data.map((d) => Number(d.value) ?? 0);
  const points = values.map((value) => ({ value }));
  const line = buildLinePath(points, width, height, pad);
  const area = buildAreaPath(points, width, height, pad);
  const stepX = (width - pad * 2) / Math.max(points.length - 1, 1);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const yFor = (v) => height - pad - ((v - min) / range) * (height - pad * 2);

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height + 24}`} className="w-full" style={{ height: height + 24 }} role="img">
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad} x2={width - pad} y1={height * f} y2={height * f} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
        ))}
        <path d={area} fill="url(#lineFill)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {showDots &&
          data.map((d, i) => (
            <circle key={i} cx={pad + i * stepX} cy={yFor(Number(d.value) ?? 0)} r="3.5" fill={color} />
          ))}
        {data.map((d, i) => (
          <text key={i} x={pad + i * stepX} y={height + 16} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
            {d.label ?? ""}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function BarChart({ data = [], height = 180, color = "var(--primary)", colorValue = null }) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center" style={{ height }}>No data yet</div>;
  }
  const max = Math.max(...data.map((d) => Number(d.value) ?? 0), 1);
  const width = 560;
  const pad = 6;
  const innerH = height - 24;
  const stepX = (width - pad * 2) / data.length;
  const barW = Math.min(38, stepX * 0.55);

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height + 24}`} className="w-full" style={{ height: height + 24 }} role="img">
        {data.map((d, i) => {
          const v = Number(d.value) ?? 0;
          const h = (v / max) * innerH;
          const x = pad + i * stepX + (stepX - barW) / 2;
          const y = innerH - h;
          const fill = typeof colorValue === "function" ? colorValue(d) : color;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={Math.max(h, 2)} rx="4" fill={fill}>
                <title>{`${d.label ?? ""}: ${v}`}</title>
              </rect>
              <text x={pad + i * stepX + stepX / 2} y={height + 16} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
                {d.label ?? ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function GroupedBarChart({ data = [], series = [], height = 180 }) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center" style={{ height }}>No data yet</div>;
  }
  const allValues = data.flatMap((d) => series.map((s) => Number(d[s.key]) ?? 0));
  const max = Math.max(...allValues, 1);
  const width = 560;
  const pad = 6;
  const innerH = height - 24;
  const stepX = (width - pad * 2) / data.length;
  const groupW = Math.min(46, stepX * 0.6);
  const barW = groupW / Math.max(series.length, 1);

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height + 24}`} className="w-full" style={{ height: height + 24 }} role="img">
        {data.map((d, i) => {
          const groupX = pad + i * stepX + (stepX - groupW) / 2;
          return (
            <g key={i}>
              {series.map((s, j) => {
                const v = Number(d[s.key]) ?? 0;
                const h = (v / max) * innerH;
                const x = groupX + j * barW;
                const y = innerH - h;
                return (
                  <rect key={j} x={x} y={y} width={Math.max(barW - 2, 2)} height={Math.max(h, 2)} rx="3" fill={s.color || "var(--primary)"}>
                    <title>{`${d.label ?? ""} · ${s.label}: ${v}`}</title>
                  </rect>
                );
              })}
              <text x={pad + i * stepX + stepX / 2} y={height + 16} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
                {d.label ?? ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DonutChart({ value = 0, size = 150, stroke = 12, color = "var(--primary)", label = "", sublabel = "" }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(value, 0), 100) / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black leading-none" style={{ color: "var(--text-primary)" }}>
          {Math.round(value)}%
        </span>
        {label && <span className="text-[10px] font-semibold mt-1" style={{ color: "var(--text-secondary)" }}>{label}</span>}
        {sublabel && <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{sublabel}</span>}
      </div>
    </div>
  );
}
