import { useEffect, useRef, useState, useCallback } from "react";

/**
 * SecureCanvasQuestionRenderer
 * 
 * PrepHire High-DPI Canvas Assessment Renderer
 * - Zero selectable DOM text nodes for questions and options.
 * - Crisp Retina/4K rendering via devicePixelRatio.
 * - PrepHire brand styling: Obsidian black surface, Brand Orange accents (#FF6B35), clear option radio pills.
 * - Responsive line-wrapping and hit-testing for option selection.
 * - Diagonal subtle security watermark.
 */
export default function SecureCanvasQuestionRenderer({
  question,
  questionIndex = 0,
  totalQuestions = 1,
  answer,
  onAnswer,
  candidateWatermark = "PREPHIRE SECURE ASSESSMENT",
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const optionsHitBoxesRef = useRef([]);
  const [hoveredLetter, setHoveredLetter] = useState(null);
  const [canvasHeight, setCanvasHeight] = useState(420);

  const letters = ["A", "B", "C", "D", "E", "F"];

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !question) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isDark = true; // PrepHire Assessment is locked to high-contrast dark theme

    const width = container.clientWidth || 720;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    // PrepHire Design Palette
    const colors = {
      cardBg: "#0e131f",
      cardBorder: "rgba(255, 255, 255, 0.08)",
      textPrimary: "#f8fafc",
      textSecondary: "#94a3b8",
      textMuted: "#64748b",
      primaryOrange: "#FF6B35",
      primaryOrangeHover: "#FF5514",
      primaryOrangeTint: "rgba(255, 107, 53, 0.12)",
      primaryOrangeBorder: "rgba(255, 107, 53, 0.6)",
      optionBg: "#131826",
      optionBgHover: "#181f30",
      optionBorder: "rgba(255, 255, 255, 0.07)",
      optionBorderHover: "rgba(255, 255, 255, 0.18)",
      badgeBg: "#181e2e",
      badgeBorder: "rgba(255, 255, 255, 0.08)",
      watermark: "rgba(255, 255, 255, 0.028)",
      diffEasy: "#10b981",
      diffMed: "#f59e0b",
      diffHard: "#ef4444",
      divider: "rgba(255, 255, 255, 0.06)",
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
    const padding = 28;
    const contentWidth = width - padding * 2;
    let currentY = padding;

    // Header space: Q index, badges, marks
    currentY += 44;

    // Question Text lines
    const questionText = question.question || question.title || question.description || "Question text unavailable";
    const qLines = wrapText(questionText, contentWidth, "600 16px 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif");
    const qLineHeight = 26;
    currentY += qLines.length * qLineHeight + 24;

    // Options layout computation
    const optionBoxes = [];
    const options = question.options || [];

    options.forEach((optText, idx) => {
      const letter = letters[idx] || String.fromCharCode(65 + idx);
      // Option text available width (accounting for letter badge and radio indicator)
      const optLines = wrapText(optText, contentWidth - 96, "500 14px 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif");
      const boxHeight = Math.max(56, optLines.length * 22 + 24);
      optionBoxes.push({
        letter,
        textLines: optLines,
        x: padding,
        y: currentY,
        width: contentWidth,
        height: boxHeight,
      });
      currentY += boxHeight + 14;
    });

    const totalHeight = Math.max(340, currentY + padding);
    setCanvasHeight(totalHeight);

    // Resize canvas for sharp high-DPI
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(totalHeight * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${totalHeight}px`;

    ctx.scale(dpr, dpr);

    // 1. Draw Card Background
    roundRect(0, 0, width, totalHeight, 20, true, true);
    ctx.fillStyle = colors.cardBg;
    ctx.fill();
    ctx.strokeStyle = colors.cardBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 2. Draw Subtle Security Watermark Across Canvas
    ctx.save();
    ctx.font = "600 11px sans-serif";
    ctx.fillStyle = colors.watermark;
    ctx.textAlign = "center";
    for (let x = -width; x < width * 2; x += 260) {
      for (let y = -totalHeight; y < totalHeight * 2; y += 140) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.32);
        ctx.fillText(candidateWatermark, 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();

    // 3. Draw Header Meta (Q Number, Type, Difficulty, Marks)
    let metaX = padding;
    const metaY = padding + 14;

    // Q Number Badge (PrepHire Orange)
    ctx.fillStyle = colors.primaryOrange;
    roundRect(metaX, metaY - 14, 42, 24, 8, true, false);
    ctx.font = "bold 12px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(`Q${questionIndex + 1}`, metaX + 21, metaY + 2);
    metaX += 50;

    // Type Badge
    const typeLabel = question.type || (question.subject ? question.subject : "MCQ");
    ctx.font = "600 11px 'Plus Jakarta Sans', sans-serif";
    const typeWidth = ctx.measureText(typeLabel.toUpperCase()).width + 16;
    ctx.fillStyle = colors.badgeBg;
    roundRect(metaX, metaY - 14, typeWidth, 24, 8, true, true);
    ctx.strokeStyle = colors.badgeBorder;
    ctx.stroke();
    ctx.fillStyle = colors.textSecondary;
    ctx.textAlign = "center";
    ctx.fillText(typeLabel.toUpperCase(), metaX + typeWidth / 2, metaY + 2);
    metaX += typeWidth + 8;

    // Difficulty Badge
    const diff = (question.difficulty || "medium").toLowerCase();
    const diffColor = diff === "easy" ? colors.diffEasy : diff === "hard" ? colors.diffHard : colors.diffMed;
    ctx.font = "bold 11px 'Plus Jakarta Sans', sans-serif";
    const diffWidth = ctx.measureText(diff.toUpperCase()).width + 16;
    ctx.fillStyle = `${diffColor}14`;
    roundRect(metaX, metaY - 14, diffWidth, 24, 8, true, true);
    ctx.strokeStyle = `${diffColor}35`;
    ctx.stroke();
    ctx.fillStyle = diffColor;
    ctx.textAlign = "center";
    ctx.fillText(diff.toUpperCase(), metaX + diffWidth / 2, metaY + 2);

    // Marks Badge (Right-aligned)
    const marksText = `+${question.marks || 1} mark${question.marks !== 1 ? "s" : ""}`;
    ctx.font = "600 12px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = colors.textSecondary;
    ctx.textAlign = "right";
    ctx.fillText(marksText, width - padding, metaY + 2);

    // Divider Line
    ctx.beginPath();
    ctx.moveTo(padding, padding + 34);
    ctx.lineTo(width - padding, padding + 34);
    ctx.strokeStyle = colors.divider;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4. Draw Question Text
    ctx.fillStyle = colors.textPrimary;
    ctx.font = "600 16px 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "left";
    let textY = padding + 62;
    qLines.forEach((line) => {
      ctx.fillText(line, padding, textY);
      textY += qLineHeight;
    });

    // 5. Draw Options with PrepHire Radio Cards
    optionsHitBoxesRef.current = optionBoxes;

    optionBoxes.forEach((box) => {
      const isSelected = answer === box.letter;
      const isHovered = hoveredLetter === box.letter;

      // Option Card Box
      ctx.fillStyle = isSelected
        ? colors.primaryOrangeTint
        : isHovered
        ? colors.optionBgHover
        : colors.optionBg;
      roundRect(box.x, box.y, box.width, box.height, 14, true, true);

      ctx.strokeStyle = isSelected
        ? colors.primaryOrangeBorder
        : isHovered
        ? colors.optionBorderHover
        : colors.optionBorder;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Letter Badge (A, B, C, D)
      const badgeX = box.x + 14;
      const badgeY = box.y + 13;
      const badgeSize = 30;

      ctx.fillStyle = isSelected ? colors.primaryOrange : colors.badgeBg;
      roundRect(badgeX, badgeY, badgeSize, badgeSize, 8, true, true);
      ctx.strokeStyle = isSelected ? colors.primaryOrange : colors.badgeBorder;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = "bold 13px 'Plus Jakarta Sans', sans-serif";
      ctx.fillStyle = isSelected ? "#ffffff" : colors.textSecondary;
      ctx.textAlign = "center";
      ctx.fillText(box.letter, badgeX + badgeSize / 2, badgeY + 20);

      // Option Radio Circle (Right before text or on left)
      const radioCenterX = box.x + 58;
      const radioCenterY = box.y + box.height / 2;
      const radioRadius = 8;

      ctx.beginPath();
      ctx.arc(radioCenterX, radioCenterY, radioRadius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? colors.primaryOrangeTint : "transparent";
      ctx.fill();
      ctx.strokeStyle = isSelected ? colors.primaryOrange : colors.textMuted;
      ctx.lineWidth = isSelected ? 2 : 1.5;
      ctx.stroke();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(radioCenterX, radioCenterY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = colors.primaryOrange;
        ctx.fill();
      }

      // Option Text
      ctx.font = isSelected
        ? "600 14px 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
        : "400 14px 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = isSelected ? "#ffffff" : colors.textPrimary;
      ctx.textAlign = "left";

      const optTextX = box.x + 76;
      let optTextY = box.y + (box.height - (box.textLines.length - 1) * 22) / 2 + 5;
      box.textLines.forEach((line) => {
        ctx.fillText(line, optTextX, optTextY);
        optTextY += 22;
      });
    });
  }, [question, questionIndex, answer, hoveredLetter, candidateWatermark, letters]);

  // Redraw on resize or prop changes
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
        className="w-full rounded-2xl shadow-lg block transition-all"
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
