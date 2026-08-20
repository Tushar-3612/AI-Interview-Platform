import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const PLATFORM_NAME = "AI-Powered Interview & Assessment Platform";
const DOC_TITLE = "Coding Problem Import Template";
const PURPOSE =
  "Prepare coding problems using this standardized template and upload the completed file through the Admin Panel. Keep the provided field structure unchanged to ensure accurate parsing, validation, and test-case import.";

const INSTRUCTIONS = [
  "Use one Problem ID for every coding problem: P001, P002, P003, etc.",
  "Keep all field labels unchanged.",
  "Enter a clear problem title and description.",
  "Enter valid constraints.",
  "Clearly define the input format.",
  "Clearly define the output format.",
  "Provide sample input and sample output.",
  "Select supported programming languages.",
  "Add at least one test case.",
  "Every test case must have an ID.",
  "Every test case must specify whether it is Visible or Hidden.",
  "Every test case must contain Input and Expected Output.",
  "Do not remove required fields.",
  "Repeat the complete coding-problem structure for additional problems.",
];

const PROBLEM_LINES = [
  "Problem ID:", "[P001]", "",
  "Problem Title:", "[Enter problem title]", "",
  "Marks:", "[10]", "",
  "Difficulty:", "[Easy / Medium / Hard]", "",
  "Description:", "[Enter detailed problem description]", "",
  "Constraints:", "[Enter constraints]", "",
  "Input Format:", "[Describe the input format]", "",
  "Output Format:", "[Describe the output format]", "",
  "Sample Input:", "[Enter sample input]", "",
  "Sample Output:", "[Enter expected output]", "",
  "Supported Languages:", "[Java, Python, C++, JavaScript, C, Go, Rust]", "",
  "Test Cases:", "",
  "Test Case ID:", "[T001]", "",
  "Visibility:", "[Visible / Hidden]", "",
  "Input:", "[Enter test case input]", "",
  "Expected Output:", "[Enter expected output]",
];

const ADD_TC_LINES = [
  "To add more test cases, duplicate the complete Test Case structure.",
  "Example:",
  "T002",
  "T003",
  "T004",
  "...",
];

const ADD_PROBLEM_LINES = [
  "To add more coding problems, duplicate the complete Coding Problem structure.",
  "Example:",
  "P002",
  "P003",
  "P004",
  "...",
];

/* ===== DOCX helpers ===== */
function loadLogo() {
  const candidates = [
    path.resolve(process.cwd(), "frontend/public/images/metadata.png"),
    path.resolve(process.cwd(), "public/images/metadata.png"),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return fs.readFileSync(p); } catch { /* ignore */ }
  }
  return null;
}

function pngSize(buf) {
  try {
    if (buf.slice(1, 4).toString() === "PNG") return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  } catch { /* ignore */ }
  return { w: 400, h: 400 };
}

function crc32(buf) {
  if (!crc32.table) {
    const t = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    crc32.table = t;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crc32.table[(crc ^ buf[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBytes, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBytes.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralBuf, end]);
}

function xmlEscape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function docxPara(text, opts = {}) {
  const { align = "left", bold = false, italic = false, size = 20, color = null, spaceBefore = 0, spaceAfter = 80, shade = null } = opts;
  const jc = align !== "left" ? `<w:jc w:val="${align}"/>` : "";
  const rpr = [];
  if (bold) rpr.push("<w:b/>");
  if (italic) rpr.push("<w:i/>");
  if (size) rpr.push(`<w:sz w:val="${size}"/>`);
  if (color) rpr.push(`<w:color w:val="${color}"/>`);
  const rprXml = rpr.length ? `<w:rPr>${rpr.join("")}</w:rPr>` : "";
  const shd = shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : "";
  const spacing = `<w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}"/>`;
  const pPr = `<w:pPr>${jc}${shd}${spacing}</w:pPr>`;
  return `<w:p>${pPr}<w:r>${rprXml}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

function docxCodingTable(lines) {
  const rows = lines
    .map((line) => {
      if (line.trim() === "") return `<w:p/>`;
      const isLabel = /:\s*$/.test(line) || /^(Test Cases|CODING PROBLEM)\s*:?$/i.test(line);
      return docxPara(line, { bold: isLabel, size: 20, color: isLabel ? "1F2937" : "111827", spaceAfter: 40 });
    })
    .join("");

  const borders = `
    <w:top w:val="single" w:sz="6" w:space="0" w:color="D1D5DB"/>
    <w:left w:val="single" w:sz="6" w:space="0" w:color="D1D5DB"/>
    <w:bottom w:val="single" w:sz="6" w:space="0" w:color="D1D5DB"/>
    <w:right w:val="single" w:sz="6" w:space="0" w:color="D1D5DB"/>
    <w:insideH w:val="single" w:sz="6" w:space="0" w:color="D1D5DB"/>
    <w:insideV w:val="single" w:sz="6" w:space="0" w:color="D1D5DB"/>`;

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="0" w:type="auto"/>
      <w:tblBorders>${borders}</w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="140" w:type="dxa"/><w:left w:w="160" w:type="dxa"/>
        <w:bottom w:w="140" w:type="dxa"/><w:right w:w="160" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="0" w:type="auto"/>
          <w:tcBorders>${borders}</w:tcBorders>
          <w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>
        </w:tcPr>
        <w:p/>${rows}<w:p/>
      </w:tc>
    </w:tr>
  </w:tbl>`;
}

function docxLogoParagraph(logoBuf) {
  if (!logoBuf) return "";
  const { w, h } = pngSize(logoBuf);
  const emuPerIn = 914400;
  const widthEmu = Math.round(1.6 * emuPerIn);
  const heightEmu = Math.round(widthEmu * (h / w));
  const drawing = `
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="${widthEmu}" cy="${heightEmu}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="1" name="Platform Logo"/>
        <wp:cNvGraphicFramePr/>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr>
                <pic:cNvPr id="0" name="metadata.png"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="rId1"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>`;
  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r>${drawing}</w:r></w:p>`;
}

export function generateDocxTemplate() {
  const logoBuf = loadLogo();
  const bodyParts = [];
  if (logoBuf) bodyParts.push(docxLogoParagraph(logoBuf));
  bodyParts.push(docxPara(PLATFORM_NAME, { align: "center", bold: true, size: 36, color: "1F2937", spaceBefore: 60, spaceAfter: 20 }));
  bodyParts.push(docxPara(DOC_TITLE, { align: "center", bold: true, size: 28, color: "EA580C", spaceAfter: 140 }));
  bodyParts.push(docxPara(PURPOSE, { align: "center", size: 20, color: "6B7280", spaceAfter: 200 }));

  bodyParts.push(docxPara("Important Instructions", { bold: true, size: 28, color: "1F2937", spaceBefore: 80, spaceAfter: 80 }));
  INSTRUCTIONS.forEach((b) => bodyParts.push(docxPara("•   " + b, { size: 20, color: "374151", spaceAfter: 50, shade: "F3F4F6" })));

  bodyParts.push(docxPara("CODING PROBLEM", { bold: true, size: 24, color: "1F2937", spaceBefore: 200, spaceAfter: 60 }));
  bodyParts.push(docxCodingTable(PROBLEM_LINES));

  bodyParts.push(docxPara("Add More Test Cases", { bold: true, size: 24, color: "1F2937", spaceBefore: 160, spaceAfter: 60 }));
  ADD_TC_LINES.forEach((line) => bodyParts.push(docxPara(line, { size: 20, color: "374151", spaceAfter: 40, shade: "F3F4F6" })));

  bodyParts.push(docxPara("Add More Coding Problems", { bold: true, size: 24, color: "1F2937", spaceBefore: 160, spaceAfter: 60 }));
  ADD_PROBLEM_LINES.forEach((line) => bodyParts.push(docxPara(line, { size: 20, color: "374151", spaceAfter: 40, shade: "F3F4F6" })));

  bodyParts.push(docxPara(PLATFORM_NAME, { align: "center", size: 16, color: "9CA3AF", spaceBefore: 240, spaceAfter: 20 }));
  bodyParts.push(docxPara("Coding Problem Import Template", { align: "center", size: 16, color: "9CA3AF", spaceAfter: 20 }));
  bodyParts.push(docxPara("Use only the official template for reliable problem import.", { align: "center", italic: true, size: 16, color: "9CA3AF" }));

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>${bodyParts.join("")}<w:sectPr/></w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;

  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Coding Problem Import Template</dc:title>
<dc:creator>${xmlEscape(PLATFORM_NAME)}</dc:creator>
</cp:coreProperties>`;

  const files = [
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: rootRels },
    { name: "docProps/core.xml", data: core },
    { name: "word/document.xml", data: documentXml },
    { name: "word/_rels/document.xml.rels", data: docRels },
  ];
  if (logoBuf) files.push({ name: "word/media/image1.png", data: logoBuf });

  return makeZip(files);
}

/* ===== PDF helpers ===== */
const COLORS = {
  ink: "#111827", heading: "#1F2937", accent: "#EA580C", sub: "#6B7280",
  label: "#374151", footer: "#9CA3AF", rule: "#E5E7EB", border: "#D1D5DB",
};

export function generatePdfTemplate() {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 55 });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentWidth = right - left;

      const logoBuf = loadLogo();
      if (logoBuf) {
        const size = pngSize(logoBuf);
        const logoW = 120;
        const logoH = Math.round(logoW * (size.h / size.w));
        const logoX = (doc.page.width - logoW) / 2;
        doc.image(logoBuf, logoX, doc.y, { width: logoW });
        doc.y = doc.y + logoH + 12;
      }

      doc.font("Helvetica-Bold").fontSize(18).fillColor(COLORS.heading).text(PLATFORM_NAME, { align: "center" });
      doc.moveDown(0.2);
      doc.font("Helvetica-Bold").fontSize(13).fillColor(COLORS.accent).text(DOC_TITLE, { align: "center" });
      doc.moveDown(0.4);
      doc.font("Helvetica").fontSize(9).fillColor(COLORS.sub).text(PURPOSE, { align: "center", width: contentWidth });
      doc.moveDown(0.6);

      drawRule(doc, left, right);
      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.heading).text("Important Instructions", left, doc.y, { continued: false });
      doc.moveDown(0.3);
      INSTRUCTIONS.forEach((b) => {
        doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.label).text("•  " + b, left + 6, doc.y, { continued: false, width: contentWidth - 10 });
        doc.moveDown(0.18);
      });

      doc.moveDown(0.5);
      drawRule(doc, left, right);
      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.heading).text("CODING PROBLEM", left, doc.y, { continued: false });
      doc.moveDown(0.3);
      renderCodingCard(doc, PROBLEM_LINES, left, contentWidth);

      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.heading).text("Add More Test Cases", left, doc.y, { continued: false });
      doc.moveDown(0.2);
      ADD_TC_LINES.forEach((line) => { doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.label).text(line, left + 6, doc.y, { continued: false, width: contentWidth - 10 }); doc.moveDown(0.16); });

      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.heading).text("Add More Coding Problems", left, doc.y, { continued: false });
      doc.moveDown(0.2);
      ADD_PROBLEM_LINES.forEach((line) => { doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.label).text(line, left + 6, doc.y, { continued: false, width: contentWidth - 10 }); doc.moveDown(0.16); });

      drawFooter(doc);
      doc.on("pageAdded", () => drawFooter(doc));
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function drawRule(doc, left, right) {
  const y = doc.y;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.8).strokeColor(COLORS.rule).stroke();
  doc.y = y + 2;
}

function drawFooter(doc) {
  const page = doc.page;
  doc.save();
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.footer);
  doc.text(`${PLATFORM_NAME}   •   ${DOC_TITLE}`, 55, page.height - 42, { align: "center", width: page.width - 110 });
  doc.text("Use only the official template for reliable problem import.", 55, page.height - 30, { align: "center", width: page.width - 110 });
  doc.restore();
}

function renderCodingCard(doc, lines, left, contentWidth) {
  const startY = doc.y;
  lines.forEach((line) => {
    if (line.trim() === "") { doc.moveDown(0.25); return; }
    const isLabel = /:\s*$/.test(line) || /^(Test Cases|CODING PROBLEM)\s*:?$/i.test(line);
    if (isLabel) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.label).text(line, left, doc.y, { continued: false });
    } else {
      doc.font("Helvetica").fontSize(10).fillColor(COLORS.ink).text(line, left + 12, doc.y, { continued: false });
    }
    doc.moveDown(0.1);
  });
  const endY = doc.y;
  const pad = 8;
  doc.save();
  doc.roundedRect(left - pad, startY - pad, contentWidth + pad * 2, endY - startY + pad * 2, 6)
    .lineWidth(1).strokeColor(COLORS.border).stroke();
  doc.rect(left - pad, startY - pad, 3, endY - startY + pad * 2).fillColor(COLORS.accent).fill();
  doc.restore();
}

/* ===== CSV ===== */
export const TEMPLATE_CSV_TEXT = `problem_id,title,marks,difficulty,description,constraints,input_format,output_format,sample_input,sample_output,supported_languages,test_case_id,test_case_visibility,test_case_input,test_case_output
[P001],[Enter problem title],10,Medium,[Enter detailed problem description],[Enter constraints],[Describe the input format],[Describe the output format],[Enter sample input],[Enter sample output],[Java|Python|C++|JavaScript|C|Go|Rust],T001,Visible,[Enter test case input],[Enter expected output]
[P001],[Enter problem title],10,Medium,[Enter detailed problem description],[Enter constraints],[Describe the input format],[Describe the output format],[Enter sample input],[Enter sample output],[Java|Python|C++|JavaScript|C|Go|Rust],T002,Hidden,[Enter test case input],[Enter expected output]`;

export function generateCsvTemplate() {
  return TEMPLATE_CSV_TEXT;
}
