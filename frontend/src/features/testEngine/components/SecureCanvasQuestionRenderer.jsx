import { useEffect, useRef, useState, useCallback } from "react";

/**
 * SecureCanvasQuestionRenderer
 * 
 * Renders Question Statement, Badges, and MCQ Options onto an HTML5 Canvas.
 * - Zero selectable DOM text nodes.
 * - High-DPI (devicePixelRatio) crisp rendering.
 * - Responsive auto-wrapping and hit-testing for option clicks/taps.
 * - Diagonal subtle security watermark (Candidate / Session / Timestamp).
 */
export default function SecureCanvasQuestionRenderer({
  question,
  questionIndex = 0,
  totalQuestions = 1,
  answer,
  onAnswer,
  candidateWatermark = "CANDIDATE SECURE SESSION",
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const optionsHitBoxesRef = useRef([]);
  const [hoveredLetter, setHoveredLetter] = useState(null);
  const [canvasHeight, setCanvasHeight] = useState(400);

  const letters = ["A", "B", "C", "D", "E", "F"];

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !question) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isDark = document.documentElement.classList.contains("dark") ||
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const width = container.clientWidth || 680;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    // Theme palette
    const colors = {
      cardBg: isDark ? "#141721" : "#ffffff",
      textPrimary: isDark ? "#f3f4f6" : "#111827",
      textSecondary: isDark ? "#9ca3af" : "#4b5563",
      textMuted: isDark ? "#6b7280" : "#9ca3af",
      primary: isDark ? "#3b82f6" : "#2563eb",
      primaryLight: isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(37, 99, 235, 0.08)",
      border: isDark ? "#272e3f" : "#e5e7eb",
      borderHover: isDark ? "#4b5563" : "#cbd5e1",
      badgeBg: isDark ? "#1e2433" : "#f3f4f6",
      watermark: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)",
      diffEasy: isDark ? "#34d399" : "#059669",
      diffMed: isDark ? "#fbbf24" : "#d97706",
      diffHard: isDark ? "#f87171" : "#dc2626",
    };

    // Helper: Wrap text
    const wrapText = (text, maxWidth, font) => {
      ctx.font = font;
      const paragraphs = String(text || "").split("\n");
      const lines = [];

      paragraphs.forEach((p) => {
        if (!p.trim()) {
          lines.push("");
          return;
        }
        const words = p.split(" ");
        let currentLine = words[0] || "";

        for (let i = 1; i < words.length; i++) {
          const testLine = currentLine + " " + words[i];
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth) {
            lines.push(currentLine);
            currentLine = words[i];
          } else {
            currentLine = testLine;
          }
        }
        lines.push(currentLine);
      });
      return lines;
    };

    // Helper: Rounded rectangle
    const roundRect = (x, y, w, h, radius, fill, stroke) => {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + w, y, x + w, y + h, radius);
      ctx.arcTo(x + w, y + h, x, y + h, radius);
      ctx.arcTo(x, y + h, x, y, radius);
      ctx.arcTo(x, y, x + w, y, radius);
      ctx.closePath();
      if (fill) ctx.fill();
      if (stroke) ctx.stroke();
    };

    // Calculate dynamic layout & total height
    const padding = 24;
    const contentWidth = width - padding * 2;
    let currentY = padding;

    // Header space: Q index, difficulty, marks
    currentY += 40;

    // Question Text lines
    const questionText = question.question || question.title || question.description || "Question text unavailable";
    const qLines = wrapText(questionText, contentWidth, "600 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
    const qLineHeight = 24;
    currentY += qLines.length * qLineHeight + 20;

    // Options layout computation
    const optionBoxes = [];
    const options = question.options || [];

    options.forEach((optText, idx) => {
      const letter = letters[idx] || String.fromCharCode(65 + idx);
      const optLines = wrapText(optText, contentWidth - 60, "400 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
      const boxHeight = Math.max(54, optLines.length * 20 + 24);
      optionBoxes.push({
        letter,
        textLines: optLines,
        x: padding,
        y: currentY,
        width: contentWidth,
        height: boxHeight,
      });
      currentY += boxHeight + 12;
    });

    const totalHeight = Math.max(300, currentY + padding);
    setCanvasHeight(totalHeight);

    // Resize canvas for sharp high-DPI
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(totalHeight * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${totalHeight}px`;

    ctx.scale(dpr, dpr);

    // 1. Draw Card Background
    roundRect(0, 0, width, totalHeight, 16, true, true);
    ctx.fillStyle = colors.cardBg;
    ctx.fill();
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 2. Draw Subtle Background Security Watermark
    ctx.save();
    ctx.font = "600 11px sans-serif";
    ctx.fillStyle = colors.watermark;
    ctx.textAlign = "center";
    for (let x = -width; x < width * 2; x += 220) {
      for (let y = -totalHeight; y < totalHeight * 2; y += 120) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.35);
        ctx.fillText(candidateWatermark, 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();

    // 3. Draw Header Meta (Q Number, Type, Difficulty, Marks)
    let metaX = padding;
    const metaY = padding + 12;

    // Q Number Badge
    ctx.fillStyle = colors.primary;
    roundRect(metaX, metaY - 14, 38, 22, 6, true, false);
    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(`Q${questionIndex + 1}`, metaX + 19, metaY + 1);
    metaX += 46;

    // Type Badge
    const typeLabel = question.type || (question.subject ? question.subject : "MCQ");
    ctx.font = "600 11px sans-serif";
    const typeWidth = ctx.measureText(typeLabel).width + 14;
    ctx.fillStyle = colors.badgeBg;
    roundRect(metaX, metaY - 14, typeWidth, 22, 6, true, true);
    ctx.strokeStyle = colors.border;
    ctx.stroke();
    ctx.fillStyle = colors.textSecondary;
    ctx.textAlign = "center";
    ctx.fillText(typeLabel, metaX + typeWidth / 2, metaY + 1);
    metaX += typeWidth + 8;

    // Difficulty Badge
    const diff = (question.difficulty || "medium").toLowerCase();
    const diffColor = diff === "easy" ? colors.diffEasy : diff === "hard" ? colors.diffHard : colors.diffMed;
    ctx.font = "600 11px sans-serif";
    const diffWidth = ctx.measureText(diff).width + 14;
    ctx.fillStyle = colors.badgeBg;
    roundRect(metaX, metaY - 14, diffWidth, 22, 6, true, true);
    ctx.strokeStyle = `${diffColor}40`;
    ctx.stroke();
    ctx.fillStyle = diffColor;
    ctx.textAlign = "center";
    ctx.fillText(diff.toUpperCase(), metaX + diffWidth / 2, metaY + 1);

    // Marks Badge (Right-aligned)
    const marksText = `+${question.marks || 1} mark${question.marks !== 1 ? "s" : ""}`;
    ctx.font = "600 11px sans-serif";
    ctx.fillStyle = colors.textSecondary;
    ctx.textAlign = "right";
    ctx.fillText(marksText, width - padding, metaY + 1);

    // Divider Line
    ctx.beginPath();
    ctx.moveTo(padding, padding + 30);
    ctx.lineTo(width - padding, padding + 30);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4. Draw Question Text
    ctx.fillStyle = colors.textPrimary;
    ctx.font = "600 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    let textY = padding + 54;
    qLines.forEach((line) => {
      ctx.fillText(line, padding, textY);
      textY += qLineHeight;
    });

    // 5. Draw Options with Hit Testing
    optionsHitBoxesRef.current = optionBoxes;

    optionBoxes.forEach((box) => {
      const isSelected = answer === box.letter;
      const isHovered = hoveredLetter === box.letter;

      // Box Background
      ctx.fillStyle = isSelected
        ? colors.primaryLight
        : isHovered
        ? colors.badgeBg
        : colors.cardBg;
      roundRect(box.x, box.y, box.width, box.height, 12, true, true);

      // Box Border
      ctx.strokeStyle = isSelected
        ? colors.primary
        : isHovered
        ? colors.borderHover
        : colors.border;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Letter Badge (A, B, C, D)
      const badgeX = box.x + 12;
      const badgeY = box.y + 12;
      const badgeSize = 28;

      ctx.fillStyle = isSelected ? colors.primary : colors.badgeBg;
      roundRect(badgeX, badgeY, badgeSize, badgeSize, 7, true, true);
      ctx.strokeStyle = isSelected ? colors.primary : colors.border;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = "bold 12px sans-serif";
      ctx.fillStyle = isSelected ? "#ffffff" : colors.textSecondary;
      ctx.textAlign = "center";
      ctx.fillText(box.letter, badgeX + badgeSize / 2, badgeY + 18);

      // Option Text
      ctx.font = isSelected
        ? "600 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        : "400 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = colors.textPrimary;
      ctx.textAlign = "left";

      const optTextX = box.x + 50;
      let optTextY = box.y + 22;
      box.textLines.forEach((line) => {
        ctx.fillText(line, optTextX, optTextY);
        optTextY += 20;
      });
    });
  }, [question, questionIndex, answer, hoveredLetter, candidateWatermark, letters]);

  // Redraw on resize, theme changes, or prop updates
  useEffect(() => {
    renderCanvas();
    const handleResize = () => renderCanvas();
    window.addEventListener("resize", handleResize);

    const observer = new ResizeObserver(() => renderCanvas());
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
    };
  }, [renderCanvas]);

  // Click & Tap Hit Testing
  const handlePointerAction = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const hit = optionsHitBoxesRef.current.find(
      (b) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    );

    if (hit && typeof onAnswer === "function") {
      onAnswer(hit.letter);
    }
  }, [onAnswer]);

  const handleClick = (e) => {
    handlePointerAction(e.clientX, e.clientY);
  };

  const handleTouchEnd = (e) => {
    if (e.changedTouches && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      handlePointerAction(touch.clientX, touch.clientY);
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = optionsHitBoxesRef.current.find(
      (b) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    );

    const newHovered = hit ? hit.letter : null;
    if (newHovered !== hoveredLetter) {
      setHoveredLetter(newHovered);
      canvas.style.cursor = hit ? "pointer" : "default";
    }
  };

  const handleMouseLeave = () => {
    setHoveredLetter(null);
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
  };

  return (
    <div ref={containerRef} className="w-full select-none" style={{ userSelect: "none", WebkitUserSelect: "none" }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onTouchEnd={handleTouchEnd}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => e.preventDefault()}
        draggable={false}
        className="w-full rounded-2xl shadow-sm block transition-all"
        style={{
          touchAction: "manipulation",
          userSelect: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none",
        }}
      />
    </div>
  );
}
