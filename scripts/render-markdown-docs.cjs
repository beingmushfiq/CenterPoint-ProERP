const fs = require('fs');
const path = require('path');

function markdownToHtml(md, title) {
  const lines = md.split('\n');
  let html = '';
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockContent = [];
  let inTable = false;
  let tableRows = [];

  const escapeHtml = (str) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const formatInline = (str) => {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html += `<pre class="code-block ${codeBlockLang}"><code>${escapeHtml(codeBlockContent.join('\n'))}</code></pre>\n`;
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockLang = '';
      } else {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Tables
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      // Check if separator line
      if (/^\|[\s\-:|]+\|$/.test(line.trim())) {
        continue;
      }
      const cells = line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      // End of table
      html += '<table class="doc-table">\n<thead>\n<tr>';
      if (tableRows.length > 0) {
        const header = tableRows[0];
        for (const cell of header) {
          html += `<th>${formatInline(cell)}</th>`;
        }
        html += '</tr>\n</thead>\n<tbody>\n';
        for (let r = 1; r < tableRows.length; r++) {
          html += '<tr>';
          for (const cell of tableRows[r]) {
            html += `<td>${formatInline(cell)}</td>`;
          }
          html += '</tr>\n';
        }
        html += '</tbody>\n</table>\n';
      }
      inTable = false;
      tableRows = [];
    }

    // Headings
    if (line.startsWith('# ')) {
      html += `<h1>${formatInline(line.slice(2))}</h1>\n`;
    } else if (line.startsWith('## ')) {
      html += `<h2>${formatInline(line.slice(3))}</h2>\n`;
    } else if (line.startsWith('### ')) {
      html += `<h3>${formatInline(line.slice(4))}</h3>\n`;
    } else if (line.startsWith('#### ')) {
      html += `<h4>${formatInline(line.slice(5))}</h4>\n`;
    } else if (line.startsWith('---')) {
      html += '<hr class="doc-divider">\n';
    } else if (line.startsWith('> ')) {
      html += `<blockquote>${formatInline(line.slice(2))}</blockquote>\n`;
    } else if (line.startsWith('- ')) {
      html += `<ul><li>${formatInline(line.slice(2))}</li></ul>\n`;
    } else if (/^\d+\.\s/.test(line)) {
      html += `<ol><li>${formatInline(line.replace(/^\d+\.\s/, ''))}</li></ol>\n`;
    } else if (line.trim().length > 0) {
      html += `<p>${formatInline(line)}</p>\n`;
    }
  }

  // Cleanup adjacent lists
  html = html.replace(/<\/ul>\n<ul>/g, '').replace(/<\/ol>\n<ol>/g, '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 22mm 20mm 25mm 20mm;
      @bottom-right {
        content: counter(page);
        font-family: 'JetBrains Mono', monospace;
        font-size: 9pt;
        color: #6b7280;
      }
    }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      font-size: 10.5pt;
      line-height: 1.6;
      color: #1f2937;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 22pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 2px solid #059669;
      padding-bottom: 6px;
      margin-top: 0;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
    }
    h2 {
      font-size: 14pt;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-top: 24px;
      margin-bottom: 10px;
    }
    h3 {
      font-size: 11.5pt;
      font-weight: 700;
      color: #047857;
      margin-top: 18px;
      margin-bottom: 8px;
    }
    h4 {
      font-size: 10.5pt;
      font-weight: 600;
      color: #334155;
      margin-top: 14px;
      margin-bottom: 6px;
    }
    p {
      margin-top: 0;
      margin-bottom: 10px;
      color: #334155;
    }
    strong {
      color: #0f172a;
      font-weight: 700;
    }
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9pt;
      background: #f1f5f9;
      color: #0f766e;
      padding: 2px 5px;
      border-radius: 4px;
    }
    pre.code-block {
      background: #0f172a;
      color: #e2e8f0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5pt;
      line-height: 1.45;
      padding: 12px 14px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 12px 0;
      white-space: pre;
    }
    pre.code-block code {
      background: transparent;
      color: inherit;
      padding: 0;
    }
    .doc-table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 9.5pt;
    }
    .doc-table th, .doc-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      text-align: left;
    }
    .doc-table th {
      background: #f8fafc;
      font-weight: 700;
      color: #0f172a;
    }
    .doc-table tr:nth-child(even) {
      background: #f8fafc;
    }
    blockquote {
      border-left: 4px solid #10b981;
      background: #f0fdf4;
      padding: 8px 14px;
      margin: 12px 0;
      color: #065f46;
      font-size: 10pt;
    }
    ul, ol {
      margin: 6px 0 12px 20px;
      padding: 0;
      color: #334155;
    }
    li {
      margin-bottom: 4px;
    }
    .doc-divider {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 18px 0;
    }
    a {
      color: #059669;
      text-decoration: none;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      pre.code-block { page-break-inside: avoid; }
      .doc-table { page-break-inside: avoid; }
      h2, h3 { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
}

const root = path.resolve(__dirname, '..');
const submissionDir = path.join(root, 'docs', 'submission');
if (!fs.existsSync(submissionDir)) {
  fs.mkdirSync(submissionDir, { recursive: true });
}

// 1. Technical Documentation
const techDocMd = fs.readFileSync(path.join(root, 'docs', 'FINTECHATHON_TECHNICAL_DOC.md'), 'utf8');
const techDocHtml = markdownToHtml(techDocMd, 'CenterPoint ProERP — AI Financial Copilot Technical Documentation');
fs.writeFileSync(path.join(submissionDir, 'technical_documentation.html'), techDocHtml, 'utf8');

// 2. Security Self-Assessment
const secDocMd = fs.readFileSync(path.join(root, 'docs', 'AI_SECURITY_ASSESSMENT.md'), 'utf8');
const secDocHtml = markdownToHtml(secDocMd, 'CenterPoint ProERP — AI Copilot Security & Multi-Tenant Isolation Assessment');
fs.writeFileSync(path.join(submissionDir, 'security_self_assessment.html'), secDocHtml, 'utf8');

console.log('HTML files generated in docs/submission/ ready for PDF conversion.');
