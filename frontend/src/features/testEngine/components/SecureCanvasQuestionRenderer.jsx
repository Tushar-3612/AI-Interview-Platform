import { useEffect, useRef, useState, useCallback } from "react";

/**
 * PrepHire SecureCanvasQuestionRenderer
 * 
 * Production Anti-Extraction Assessment Canvas Renderer:
 * - Zero selectable DOM text nodes for question statements and options.
 * - Retina / High-DPI rendering via devicePixelRatio scaling.
 * - Dynamic Theme Support (Dark Charcoal + Orange in Dark mode; Clean Light Neutral + Orange in Light mode).
 * - Multi-paragraph text formatting, bullet lists, and monospace code-block formatting.
 * - Responsive hit-testing for option selection via click, touch, and keyboard (A-D / 1-4).
 * - Subtle repeating diagonal security watermark with Candidate/Attempt identity.
 * - Complete drag, contextmenu, and copy protection.
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
  const [canvasHeight, setCanvasHeight] = useState(450);

  const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];

  // Helper to get active theme colors
  const getThemePalette = useCallback(() => {
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";

    if (isDark) {
      return {
        cardBg: "#0e131f",
        cardBorder: "rgba(255, 255, 255, 0.09)",
        textPrimary: "#f8fafc",
        textSecondary: "#94a3b8",
        textMuted: "#64748b",
        codeBg: "#080b11",
        codeBorder: "rgba(255, 255, 255, 0.08)",
        codeText: "#38bdf8",
        primaryOrange: "#FF6B35",
        primaryOrangeHover: "#FF5514",
        primaryOrangeTint: "rgba(255, 107, 53, 0.12)",
        primaryOrangeBorder: "rgba(255, 107, 53, 0.7)",
        optionBg: "#131826",
        optionBgHover: "#181f30",
        optionBorder: "rgba(255, 255, 255, 0.07)",
        optionBorderHover: "rgba(255, 255, 255, 0.20)",
        badgeBg: "#181e2e",
        badgeBorder: "rgba(255, 255, 255, 0.08)",
        watermark: "rgba(255, 255, 255, 0.025)",
        diffEasy: "#10b981",
        diffMed: "#f59e0b",
        diffHard: "#ef4444",
        divider: "rgba(255, 255, 255, 0.07)",
      };
    } else {
      return {
        cardBg: "#ffffff",
        cardBorder: "#EFE9DF",
        textPrimary: "#111827",
        textSecondary: "#6B7280",
        textMuted: "#9CA3AF",
        codeBg: "#F7F3EC",
        codeBorder: "#E5DEC9",
        codeText: "#0284c7",
        primaryOrange: "#FF6B35",
        primaryOrangeHover: "#E85A24",
        primaryOrangeTint: "rgba(255, 107, 53, 0.08)",
        primaryOrangeBorder: "#FF6B35",
        optionBg: "#FAF8F5",
        optionBgHover: "#F3EFEA",
        optionBorder: "#EFE9DF",
        optionBorderHover: "#D9D0C1",
        badgeBg: "#FAF8F5",
        badgeBorder: "#EFE9DF",
        watermark: "rgba(0, 0, 0, 0.035)",
        diffEasy: "#059669",
        diffMed: "#d97706",
        diffHard: "#dc2626",
        divider: "#EFE9DF",
      };
    }
  }, []);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !question) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colors = getThemePalette();
    const width = container.clientWidth || 720;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    // Dynamic scale font sizes for smaller screens
    const isMobile = width < 540;
    const padding = isMobile ? 18 : 28;
    const contentWidth = Math.max(200, width - padding * 2);

    const fontQuestion = isMobile
      ? "600 14px 'Plus Jakarta Sans', system-ui, sans-serif"
      : "600 16px 'Plus Jakarta Sans', system-ui, sans-serif";
    const fontOption = isMobile
      ? "500 13px 'Plus Jakarta Sans', system-ui, sans-serif"
      : "500 14px 'Plus Jakarta Sans', system-ui, sans-serif";
    const fontCode = "12.5px 'Fira Code', 'Consolas', 'Courier New', monospace";

    // Text wrapping helper
    const wrapText = (text, maxWidth, font) => {
      ctx.font = font;
      const paragraphs = String(text || "").split("\n");
      const lines = [];

      paragraphs.forEach((p) => {
        if (!p.trim()) {
          lines.push({ text: "", isCode: false });
          return;
        }

        const isCodeBlock = p.startsWith("    ") || p.startsWith("\t");
        const words = p.split(" ");
        let currentLine = words[0] || "";

        for (let i = 1; i < words.length; i++) {
          const testLine = currentLine + " " + words[i];
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth) {
            lines.push({ text: currentLine, isCode: isCodeBlock });
            currentLine = words[i];
          } else {
            currentLine = testLine;
          }
        }
        lines.push({ text: currentLine, isCode: isCodeBlock });
      });
      return lines;
    };

    const roundRect = (x, y, w, h, radius, fill, stroke) => {
      const r = Math.min(radius, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      if (fill) ctx.fill();
      if (stroke) ctx.stroke();
    };

    let currentY = padding;

    // Header space
    currentY += 44;

    // Question content lines
    const rawQuestionText = question.question || question.title || question.description || "Question text unavailable";
    const qLines = wrapText(rawQuestionText, contentWidth, fontQuestion);
    const qLineHeight = isMobile ? 22 : 26;
    currentY += qLines.length * qLineHeight + 20;

    // Options layout computation
    const rawOptions = question.options || [];
    const options = Array.isArray(rawOptions)
      ? rawOptions
      : typeof rawOptions === "object"
      ? Object.values(rawOptions)
      : [];

    const optionBoxes = [];
    const optionTextOffset = isMobile ? 64 : 76;
    const optionTextWidth = contentWidth - optionTextOffset - 16;

    options.forEach((opt, idx) => {
      const optText = typeof opt === "string" ? opt : String(opt?.text || opt?.value || opt);
      const letter = letters[idx] || String.fromCharCode(65 + idx);
      const optLines = wrapText(optText, optionTextWidth, fontOption);
      const lineH = isMobile ? 20 : 22;
      const boxHeight = Math.max(isMobile ? 50 : 56, optLines.length * lineH + (isMobile ? 20 : 24));

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

    const totalHeight = Math.max(320, currentY + padding);
    setCanvasHeight(totalHeight);

    // Set dimensions with Retina scaling
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(totalHeight * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${totalHeight}px`;

    ctx.scale(dpr, dpr);

    // 1. Draw Card Surface
    ctx.fillStyle = colors.cardBg;
    ctx.strokeStyle = colors.cardBorder;
    ctx.lineWidth = 1;
    roundRect(0, 0, width, totalHeight, 20, true, true);

    // 2. Draw Diagonal Candidate Security Watermark
    ctx.save();
    ctx.font = "bold 11px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillStyle = colors.watermark;
    ctx.textAlign = "center";
    for (let x = -width; x < width * 2; x += 280) {
      for (let y = -totalHeight; y < totalHeight * 2; y += 140) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.32);
        ctx.fillText(candidateWatermark, 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();

    // 3. Draw Header Badges & Meta
    let metaX = padding;
    const metaY = padding + 14;

    // Q Number Badge
    ctx.fillStyle = colors.primaryOrange;
    roundRect(metaX, metaY - 14, isMobile ? 38 : 44, 24, 8, true, false);
    ctx.font = "bold 12px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(`Q${questionIndex + 1}`, metaX + (isMobile ? 19 : 22), metaY + 2);
    metaX += (isMobile ? 44 : 52);

    // Type Badge
    const typeLabel = question.type || (question.subject ? question.subject : "MCQ");
    ctx.font = "600 11px 'Plus Jakarta Sans', sans-serif";
    const typeWidth = ctx.measureText(typeLabel.toUpperCase()).width + 16;
    ctx.fillStyle = colors.badgeBg;
    ctx.strokeStyle = colors.badgeBorder;
    ctx.lineWidth = 1;
    roundRect(metaX, metaY - 14, typeWidth, 24, 8, true, true);
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
    ctx.strokeStyle = `${diffColor}40`;
    ctx.lineWidth = 1;
    roundRect(metaX, metaY - 14, diffWidth, 24, 8, true, true);
    ctx.fillStyle = diffColor;
    ctx.textAlign = "center";
    ctx.fillText(diff.toUpperCase(), metaX + diffWidth / 2, metaY + 2);

    // Marks Badge (Right-aligned)
    const marksText = `+${question.marks || 1} mark${question.marks !== 1 ? "s" : ""}`;
    ctx.font = "600 12px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = colors.textSecondary;
    ctx.textAlign = "right";
    ctx.fillText(marksText, width - padding, metaY + 2);

    // Header Divider Line
    ctx.beginPath();
    ctx.moveTo(padding, padding + 34);
    ctx.lineTo(width - padding, padding + 34);
    ctx.strokeStyle = colors.divider;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4. Draw Question Text Lines
    ctx.textAlign = "left";
    let textY = padding + 60;

    qLines.forEach((lineObj) => {
      if (lineObj.isCode) {
        ctx.font = fontCode;
        ctx.fillStyle = colors.codeText;
      } else {
        ctx.font = fontQuestion;
        ctx.fillStyle = colors.textPrimary;
      }
      ctx.fillText(lineObj.text, padding, textY);
      textY += qLineHeight;
    });

    // 5. Draw Option Radio Cards
    optionsHitBoxesRef.current = optionBoxes;

    optionBoxes.forEach((box) => {
      const isSelected = answer === box.letter;
      const isHovered = hoveredLetter === box.letter;

      // Card Background
      ctx.fillStyle = isSelected
        ? colors.primaryOrangeTint
        : isHovered
        ? colors.optionBgHover
        : colors.optionBg;
      ctx.strokeStyle = isSelected
        ? colors.primaryOrangeBorder
        : isHovered
        ? colors.optionBorderHover
        : colors.optionBorder;
      ctx.lineWidth = isSelected ? 2 : 1;
      roundRect(box.x, box.y, box.width, box.height, 14, true, true);

      // Letter Badge
      const badgeSize = isMobile ? 26 : 30;
      const badgeX = box.x + (isMobile ? 10 : 14);
      const badgeY = box.y + (box.height - badgeSize) / 2;

      ctx.fillStyle = isSelected ? colors.primaryOrange : colors.badgeBg;
      ctx.strokeStyle = isSelected ? colors.primaryOrange : colors.badgeBorder;
      ctx.lineWidth = 1;
      roundRect(badgeX, badgeY, badgeSize, badgeSize, 8, true, true);

      ctx.font = "bold 13px 'Plus Jakarta Sans', sans-serif";
      ctx.fillStyle = isSelected ? "#ffffff" : colors.textSecondary;
      ctx.textAlign = "center";
      ctx.fillText(box.letter, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 4.5);

      // Radio Circle
      const radioRadius = 7.5;
      const radioCenterX = box.x + (isMobile ? 48 : 56);
      const radioCenterY = box.y + box.height / 2;

      ctx.beginPath();
      ctx.arc(radioCenterX, radioCenterY, radioRadius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? colors.primaryOrangeTint : "transparent";
      ctx.fill();
      ctx.strokeStyle = isSelected ? colors.primaryOrange : colors.textMuted;
      ctx.lineWidth = isSelected ? 2 : 1.5;
      ctx.stroke();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(radioCenterX, radioCenterY, 4, 0, Math.PI * 2);
        ctx.fillStyle = colors.primaryOrange;
        ctx.fill();
      }

      // Option Text Lines
      ctx.font = isSelected ? `600 ${isMobile ? "13px" : "14px"} 'Plus Jakarta Sans', sans-serif` : fontOption;
      ctx.fillStyle = isSelected ? colors.textPrimary : colors.textPrimary;
      ctx.textAlign = "left";

      const optTextX = box.x + optionTextOffset;
      const lineH = isMobile ? 20 : 22;
      let optTextY = box.y + (box.height - (box.textLines.length - 1) * lineH) / 2 + 4.5;

      box.textLines.forEach((l) => {
        ctx.fillText(l.text, optTextX, optTextY);
        optTextY += lineH;
      });
    });
  }, [question, questionIndex, answer, hoveredLetter, candidateWatermark, letters, getThemePalette]);

  // Redraw on resize, theme change, or question update
  useEffect(() => {
    renderCanvas();
    const handleResize = () => renderCanvas();
    window.addEventListener("resize", handleResize);

    const observer = new ResizeObserver(() => renderCanvas());
    if (containerRef.current) observer.observe(containerRef.current);

    // Watch theme attribute changes
    const mutationObserver = new MutationObserver(() => renderCanvas());
    mutationObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [renderCanvas]);

  // Pointer & Tap Action Handler
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

  // Keyboard shortcut option selection (A-D, 1-4)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is currently typing in an input / textarea
      if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA" || e.target?.isContentEditable) {
        return;
      }
      const key = e.key.toUpperCase();
      const numKey = parseInt(e.key, 10);

      let targetLetter = null;
      if (letters.slice(0, 8).includes(key)) {
        targetLetter = key;
      } else if (!isNaN(numKey) && numKey >= 1 && numKey <= 8) {
        targetLetter = letters[numKey - 1];
      }

      if (targetLetter && typeof onAnswer === "function") {
        const availableOptions = optionsHitBoxesRef.current || [];
        const exists = availableOptions.some((o) => o.letter === targetLetter);
        if (exists) {
          onAnswer(targetLetter);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onAnswer, letters]);

  return (
    <div
      ref={containerRef}
      className="w-full select-none"
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
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
