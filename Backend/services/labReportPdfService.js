const fs = require("fs");
const path = require("path");

const uploadsDir = path.join(__dirname, "../uploads");

const sanitize = (value) =>
  String(value ?? "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const pdfText = (value) =>
  sanitize(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const wrapText = (text, maxChars = 82) => {
  const words = sanitize(text).split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
};

// PDF color constants (r g b)
const TEAL       = "0.09 0.44 0.53";
const TEAL_DARK  = "0.06 0.32 0.40";
const TEAL_LIGHT = "0.92 0.97 0.99";
const WHITE      = "1 1 1";
const INK        = "0.10 0.15 0.22";
const MID        = "0.38 0.45 0.54";
const DIM        = "0.58 0.63 0.70";
const BORDER     = "0.74 0.81 0.89";
const ROW_ALT    = "0.97 0.98 0.99";
const ROW_NORM   = "0.92 0.99 0.93";
const ROW_HIGH   = "1.00 0.96 0.86";
const ROW_CRIT   = "1.00 0.91 0.91";
const GRN_BADGE  = "0.08 0.65 0.30";
const AMB_BADGE  = "0.82 0.48 0.06";
const RED_BADGE  = "0.80 0.10 0.10";
const GRY_BADGE  = "0.48 0.55 0.62";

// Table column x-positions (page width 612, margins 40)
const COL = { name: 46, result: 226, unit: 306, range: 366, status: 492 };
const DIV = { c2: 222, c3: 302, c4: 362, c5: 488 };

const buildContentStream = (order) => {
  const patient = order.patientId || {};
  const doctor  = order.doctorId  || {};

  const hospitalName = sanitize(
    doctor.hospital || process.env.HOSPITAL_NAME || "ChatAid Clinic"
  );
  const reportDate = new Date(order.completedAt || Date.now()).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const reportId = `RPT-${String(order._id || Date.now()).slice(-8).toUpperCase()}`;

  // ─────────────────────────────────────────────────────────────────────────
  // Content blocks: each has a fixed height and a render(chunks, topY) fn.
  // topY = PDF y-coord of the BLOCK'S TOP EDGE (high y = near page top).
  // ─────────────────────────────────────────────────────────────────────────
  const blocks = [];
  const block = (height, render) => blocks.push({ height, render });

  const divider = () => block(14, (ch, ty) => {
    ch.push(`q ${BORDER} RG 0.5 w 40 ${ty - 7} m 572 ${ty - 7} l S Q`);
  });

  // ── Patient + Doctor info cards ──────────────────────────────────────────
  block(82, (ch, ty) => {
    const H = 72;
    const HDR = 16;
    const y = ty - H;

    // Patient card
    ch.push(`q ${TEAL_LIGHT} rg 40 ${y} 248 ${H} re f Q`);
    ch.push(`q ${BORDER} RG 0.5 w 40 ${y} 248 ${H} re S Q`);
    ch.push(`q ${TEAL} rg 40 ${y + H - HDR} 248 ${HDR} re f Q`);
    ch.push(`q ${WHITE} rg BT /F2 7.5 Tf 50 ${y + H - 10} Td (PATIENT INFORMATION) Tj ET Q`);
    ch.push(`q ${INK} rg BT /F2 9.5 Tf 50 ${y + H - 28} Td (${pdfText(patient.name || "Not provided")}) Tj ET Q`);
    ch.push(`q ${INK} rg BT /F1 8.5 Tf 50 ${y + H - 41} Td (Age: ${pdfText(String(patient.age || "N/A"))}   Gender: ${pdfText(patient.gender || "N/A")}) Tj ET Q`);
    ch.push(`q ${MID} rg BT /F1 8 Tf 50 ${y + H - 53} Td (${pdfText(patient.email || patient.phone || "Contact not provided")}) Tj ET Q`);

    // Doctor card
    ch.push(`q ${TEAL_LIGHT} rg 316 ${y} 248 ${H} re f Q`);
    ch.push(`q ${BORDER} RG 0.5 w 316 ${y} 248 ${H} re S Q`);
    ch.push(`q ${TEAL} rg 316 ${y + H - HDR} 248 ${HDR} re f Q`);
    ch.push(`q ${WHITE} rg BT /F2 7.5 Tf 326 ${y + H - 10} Td (REFERRING PHYSICIAN) Tj ET Q`);
    ch.push(`q ${INK} rg BT /F2 9.5 Tf 326 ${y + H - 28} Td (Dr. ${pdfText(doctor.name || "Doctor")}) Tj ET Q`);
    ch.push(`q ${INK} rg BT /F1 8.5 Tf 326 ${y + H - 41} Td (${pdfText(order.department || doctor.specialisation || doctor.specialization || "General Medicine")}) Tj ET Q`);
    const oDate = new Date(order.createdAt || Date.now()).toLocaleDateString("en-IN");
    ch.push(`q ${MID} rg BT /F1 8 Tf 326 ${y + H - 53} Td (Ordered: ${pdfText(oDate)}) Tj ET Q`);
  });

  block(6, () => {}); // spacer
  divider();

  // ── Tests ordered ────────────────────────────────────────────────────────
  block(18, (ch, ty) => {
    ch.push(`q ${TEAL} rg BT /F2 8 Tf 40 ${ty - 12} Td (TESTS ORDERED) Tj ET Q`);
  });

  const testLines = wrapText((order.tests || []).join("   |   "), 88);
  block(testLines.length * 12 + 8, (ch, ty) => {
    ch.push(`q ${INK} rg`);
    let ly = ty - 11;
    testLines.forEach((line) => {
      ch.push(`BT /F1 9 Tf 40 ${ly} Td (${pdfText(line)}) Tj ET`);
      ly -= 12;
    });
    ch.push("Q");
  });

  divider();

  // ── Results table ─────────────────────────────────────────────────────────
  block(18, (ch, ty) => {
    ch.push(`q ${TEAL} rg BT /F2 8 Tf 40 ${ty - 12} Td (TEST RESULTS) Tj ET Q`);
  });

  // Column header row
  const HDR_H = 20;
  block(HDR_H + 2, (ch, ty) => {
    const ry = ty - HDR_H;
    ch.push(`q ${TEAL} rg 40 ${ry} 532 ${HDR_H} re f Q`);
    const ty2 = ry + 6;
    ch.push(`q ${WHITE} rg`);
    ch.push(`BT /F2 7.5 Tf ${COL.name}   ${ty2} Td (TEST NAME) Tj ET`);
    ch.push(`BT /F2 7.5 Tf ${COL.result} ${ty2} Td (RESULT) Tj ET`);
    ch.push(`BT /F2 7.5 Tf ${COL.unit}   ${ty2} Td (UNIT) Tj ET`);
    ch.push(`BT /F2 7.5 Tf ${COL.range}  ${ty2} Td (NORMAL RANGE) Tj ET`);
    ch.push(`BT /F2 7.5 Tf ${COL.status} ${ty2} Td (STATUS) Tj ET`);
    ch.push("Q");
  });

  // Data rows
  if (!order.results?.length) {
    block(28, (ch, ty) => {
      ch.push(`q ${MID} rg BT /F1 9 Tf ${COL.name} ${ty - 17} Td (No structured result values were entered.) Tj ET Q`);
    });
  } else {
    order.results.forEach((result, idx) => {
      const flag = result.flag || "";
      const noteLines = result.values && result.value
        ? wrapText(`Note: ${result.values}`, 86)
        : [];
      const ROW_H = 24;
      const totalH = ROW_H + (noteLines.length ? noteLines.length * 11 + 4 : 0);

      block(totalH, (ch, ty) => {
        const ry = ty - ROW_H;

        // Background
        let bg = idx % 2 === 0 ? WHITE : ROW_ALT;
        if      (flag === "critical")              bg = ROW_CRIT;
        else if (flag === "high" || flag === "low") bg = ROW_HIGH;
        else if (flag === "normal")                bg = ROW_NORM;

        ch.push(`q ${bg} rg 40 ${ry} 532 ${ROW_H} re f Q`);
        ch.push(`q ${BORDER} RG 0.3 w 40 ${ry} m 572 ${ry} l S Q`);

        // Vertical column dividers
        ch.push(`q ${BORDER} RG 0.2 w`);
        [DIV.c2, DIV.c3, DIV.c4, DIV.c5].forEach((dx) => {
          ch.push(`${dx} ${ry} m ${dx} ${ry + ROW_H} l S`);
        });
        ch.push("Q");

        // Test name (max 2 lines)
        const nameLines = wrapText(sanitize(result.testName || ""), 22);
        ch.push(`q ${INK} rg BT /F1 8.5 Tf ${COL.name} ${ry + ROW_H - 9} Td (${pdfText(nameLines[0])}) Tj ET Q`);
        if (nameLines[1]) {
          ch.push(`q ${DIM} rg BT /F1 7 Tf ${COL.name} ${ry + ROW_H - 18} Td (${pdfText(nameLines[1])}) Tj ET Q`);
        }

        // Result value (bold, prominent)
        ch.push(`q ${INK} rg BT /F2 11 Tf ${COL.result} ${ry + ROW_H - 10} Td (${pdfText(String(result.value || result.values || "N/A"))}) Tj ET Q`);

        // Unit
        ch.push(`q ${MID} rg BT /F1 8.5 Tf ${COL.unit} ${ry + ROW_H - 9} Td (${pdfText(result.unit || "")}) Tj ET Q`);

        // Normal range
        ch.push(`q ${MID} rg BT /F1 8.5 Tf ${COL.range} ${ry + ROW_H - 9} Td (${pdfText(result.normalRange || "N/A")}) Tj ET Q`);

        // Status badge
        if (flag) {
          let bc = GRY_BADGE;
          if      (flag === "critical") bc = RED_BADGE;
          else if (flag === "high")     bc = AMB_BADGE;
          else if (flag === "low")      bc = AMB_BADGE;
          else if (flag === "normal")   bc = GRN_BADGE;

          const bw = flag.length * 5.8 + 12;
          const bx = COL.status;
          const bh = 13;
          const by = ry + (ROW_H - bh) / 2;
          ch.push(`q ${bc} rg ${bx} ${by} ${bw} ${bh} re f Q`);
          ch.push(`q ${WHITE} rg BT /F2 7 Tf ${bx + 4} ${by + 3} Td (${pdfText(flag.toUpperCase())}) Tj ET Q`);
        }

        // Inline notes below the row
        if (noteLines.length) {
          ch.push(`q ${DIM} rg`);
          let ny = ry - 2;
          noteLines.forEach((nl) => {
            ch.push(`BT /F1 7.5 Tf 50 ${ny} Td (${pdfText(nl)}) Tj ET`);
            ny -= 11;
          });
          ch.push("Q");
        }
      });
    });
  }

  // ── Doctor notes ──────────────────────────────────────────────────────────
  if (order.notes) {
    const noteLines = wrapText(order.notes, 88);
    const boxH = noteLines.length * 13 + 18;
    divider();
    block(18, (ch, ty) => {
      ch.push(`q ${TEAL} rg BT /F2 8 Tf 40 ${ty - 12} Td (DOCTOR'S NOTES) Tj ET Q`);
    });
    block(boxH, (ch, ty) => {
      const by = ty - boxH;
      ch.push(`q ${TEAL_LIGHT} rg 40 ${by} 532 ${boxH} re f Q`);
      ch.push(`q ${BORDER} RG 0.5 w 40 ${by} 532 ${boxH} re S Q`);
      ch.push(`q ${INK} rg`);
      let ly = ty - 14;
      noteLines.forEach((nl) => {
        ch.push(`BT /F1 9 Tf 48 ${ly} Td (${pdfText(nl)}) Tj ET`);
        ly -= 13;
      });
      ch.push("Q");
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Paginate blocks into pages
  // ─────────────────────────────────────────────────────────────────────────
  const CONTENT_TOP    = 728;
  const CONTENT_BOTTOM = 60;
  const PAGE_CAPACITY  = CONTENT_TOP - CONTENT_BOTTOM; // 668px per page

  const pages = [];
  let curPage = [];
  let cap = PAGE_CAPACITY;

  for (const b of blocks) {
    if (b.height > cap && curPage.length > 0) {
      pages.push(curPage);
      curPage = [];
      cap = PAGE_CAPACITY;
    }
    curPage.push(b);
    cap -= b.height;
  }
  if (curPage.length) pages.push(curPage);
  if (!pages.length) pages.push([]);

  const totalPages = pages.length;

  // ─────────────────────────────────────────────────────────────────────────
  // Render each page to a PDF content stream string
  // ─────────────────────────────────────────────────────────────────────────
  return pages.map((pageBlocks, pageIndex) => {
    const ch = [];

    // ── Header bar ────────────────────────────────────────────────────────
    ch.push(`q ${TEAL} rg 0 738 612 54 re f Q`);
    ch.push(`q ${TEAL_DARK} rg 0 736 612 2 re f Q`);
    // Icon square
    ch.push(`q 0.06 0.35 0.43 rg 44 746 38 38 re f Q`);
    ch.push(`q ${WHITE} rg BT /F2 22 Tf 57 758 Td (H) Tj ET Q`);
    // Clinic name + subtitle
    ch.push(`q ${WHITE} rg BT /F2 15 Tf 92 765 Td (${pdfText(hospitalName)}) Tj ET Q`);
    ch.push(`q 0.82 0.94 0.97 rg BT /F1 8.5 Tf 92 751 Td (Laboratory Result Report) Tj ET Q`);
    // Right side – report ID and date
    ch.push(`q ${WHITE} rg BT /F2 8 Tf 442 767 Td (${pdfText(reportId)}) Tj ET Q`);
    ch.push(`q 0.82 0.94 0.97 rg BT /F1 7.5 Tf 442 755 Td (${pdfText(reportDate)}) Tj ET Q`);

    // ── Footer ────────────────────────────────────────────────────────────
    ch.push(`q ${BORDER} RG 0.5 w 40 54 m 572 54 l S Q`);
    ch.push(`q ${DIM} rg BT /F1 7.5 Tf 40 42 Td (CONFIDENTIAL  |  For Medical Use Only  |  Generated by ChatAid Clinic Lab System) Tj ET Q`);
    ch.push(`q ${DIM} rg BT /F1 7.5 Tf 516 42 Td (Page ${pageIndex + 1} of ${totalPages}) Tj ET Q`);

    // ── Content blocks ────────────────────────────────────────────────────
    let ty = CONTENT_TOP;
    for (const b of pageBlocks) {
      b.render(ch, ty);
      ty -= b.height;
    }

    return ch.join("\n");
  });
};

const createPdfBuffer = (streams) => {
  const objects = [];
  const addObject = (body) => { objects.push(body); return objects.length; };

  const catalogId  = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId    = addObject("");
  const fontId     = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds    = [];

  streams.forEach((stream) => {
    const contentId = addObject(
      `<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}\nendstream`
    );
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792]` +
      ` /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >>` +
      ` /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  });

  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "binary");
};

const generateLabReportPdf = async (order) => {
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  const streams = buildContentStream(order);
  const buffer  = createPdfBuffer(streams);
  const filename = `lab-report-${order._id}-${Date.now()}.pdf`;
  const filePath = path.join(uploadsDir, filename);
  await fs.promises.writeFile(filePath, buffer);
  return { filename, filePath };
};

const generateLabReportPdfBuffer = (order) => {
  const streams = buildContentStream(order);
  return createPdfBuffer(streams);
};

module.exports = { generateLabReportPdf, generateLabReportPdfBuffer };
