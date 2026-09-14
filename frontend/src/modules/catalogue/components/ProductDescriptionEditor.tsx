import { useState, useRef, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import {
  Eye,
  Columns2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table as TableIcon,
  Tag,
  Palette,
  Highlighter,
  Sparkles,
  Quote,
  Minus,
  FileText,
  FileCode,
  Maximize2,
  Minimize2,
  Plus,
  Shirt,
  Cpu,
  Armchair,
  FlaskConical,
  Package,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface ProductDescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

const PRESET_COLORS = [
  { label: 'Slate Dark', value: '#0f172a' },
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Rose', value: '#e11d48' },
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Cyan', value: '#0891b2' },
];

const PRESET_HIGHLIGHTS = [
  { label: 'None', value: 'transparent' },
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Emerald', value: '#bbf7d0' },
  { label: 'Sky Blue', value: '#bae6fd' },
  { label: 'Rose', value: '#fecdd3' },
  { label: 'Purple', value: '#f3e8ff' },
  { label: 'Amber', value: '#fed7aa' },
];

const INDUSTRY_BADGE_PRESETS = [
  {
    category: 'Quality & Compliance',
    badges: [
      { text: 'ISO 9001 Certified', icon: '🏆', bg: '#eff6ff', color: '#1d4ed8' },
      { text: 'CE Certified', icon: '🇪🇺', bg: '#f0fdf4', color: '#15803d' },
      { text: 'RoHS Compliant', icon: '🌿', bg: '#ecfdf5', color: '#047857' },
      { text: 'QC Passed (Grade A)', icon: '🛡️', bg: '#faf5ff', color: '#6b21a8' },
    ],
  },
  {
    category: 'Garments & Apparel',
    badges: [
      { text: '100% Combed Cotton', icon: '🧵', bg: '#f8fafc', color: '#334155' },
      { text: 'Oeko-Tex 100', icon: '✨', bg: '#ecfdf5', color: '#065f46' },
      { text: 'Pre-Shrunk Fabric', icon: '👔', bg: '#eff6ff', color: '#1e40af' },
      { text: 'Water Repellent', icon: '💧', bg: '#f0f9ff', color: '#0369a1' },
    ],
  },
  {
    category: 'Food, Bakery & Pharma',
    badges: [
      { text: '100% Organic', icon: '🌱', bg: '#f0fdf4', color: '#166534' },
      { text: 'Halal Certified', icon: '✨', bg: '#eef2ff', color: '#4338ca' },
      { text: 'Gluten Free', icon: '🌾', bg: '#fffbeb', color: '#b45309' },
      { text: 'Non-GMO Verified', icon: '🍃', bg: '#ecfdf5', color: '#047857' },
    ],
  },
  {
    category: 'Electronics & Hardware',
    badges: [
      { text: 'Energy Star Rated', icon: '⚡', bg: '#fefce8', color: '#854d0e' },
      { text: 'Surge Protected', icon: '🔌', bg: '#f0f9ff', color: '#075985' },
      { text: 'IP67 Waterproof', icon: '🛡️', bg: '#eff6ff', color: '#1e40af' },
      { text: 'FCC Approved', icon: '📡', bg: '#faf5ff', color: '#6b21a8' },
    ],
  },
  {
    category: 'Furniture & Woodwork',
    badges: [
      { text: 'Solid Teak Wood', icon: '🪑', bg: '#fef3c7', color: '#92400e' },
      { text: 'FSC Certified Timber', icon: '🌲', bg: '#f0fdf4', color: '#15803d' },
      { text: 'Scratch Resistant', icon: '✨', bg: '#f8fafc', color: '#334155' },
      { text: 'Heavy Duty Frame', icon: '🔨', bg: '#f1f5f9', color: '#1e293b' },
    ],
  },
  {
    category: 'Commercial & Status',
    badges: [
      { text: 'Best Seller', icon: '🔥', bg: '#fff1f2', color: '#be123c' },
      { text: 'Export Quality', icon: '🚢', bg: '#f0fdfa', color: '#0f766e' },
      { text: 'Limited Edition', icon: '⭐', bg: '#faf5ff', color: '#7e22ce' },
      { text: '2-Year Warranty', icon: '🛡️', bg: '#f0fdf4', color: '#166534' },
    ],
  },
];

export function ProductDescriptionEditor({
  value,
  onChange,
  placeholder = 'Write product description, technical specifications, or custom HTML/CSS...',
  rows = 6,
}: ProductDescriptionEditorProps) {
  const [mode, setMode] = useState<'visual' | 'code' | 'preview' | 'split'>('visual');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Popover State
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showBadgeMenu, setShowBadgeMenu] = useState(false);

  // Color state
  const [customTextColor, setCustomTextColor] = useState('#4f46e5');
  const [customHighlightColor, setCustomHighlightColor] = useState('#fef08a');

  // Custom Badge Creator state
  const [badgeText, setBadgeText] = useState('New Feature');
  const [badgeIcon, setBadgeIcon] = useState('✨');
  const [badgeBg, setBadgeBg] = useState('#eef2ff');
  const [badgeColor, setBadgeColor] = useState('#4338ca');
  const [badgeBorderRadius, setBadgeBorderRadius] = useState('9999px');
  const [badgeTab, setBadgeTab] = useState<'custom' | 'presets'>('custom');

  const containerRef = useRef<HTMLDivElement>(null);
  const visualEditorRef = useRef<HTMLDivElement>(null);
  const codeEditorRef = useRef<HTMLTextAreaElement>(null);
  const isUpdatingFromInternalRef = useRef(false);

  // Close open popovers when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
        setShowHighlightPicker(false);
        setShowTemplateMenu(false);
        setShowBadgeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const sanitizeHtml = useCallback((html: string) => {
    return DOMPurify.sanitize(html, {
      ADD_TAGS: [
        'style', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'b', 'i', 'u', 's', 'strong',
        'em', 'ul', 'ol', 'li', 'br', 'hr', 'blockquote', 'code', 'pre', 'mark'
      ],
      ADD_ATTR: [
        'style', 'class', 'id', 'target', 'border', 'cellpadding', 'cellspacing',
        'width', 'height', 'align', 'valign'
      ],
    });
  }, []);

  // Sync value into visual editable div when value changes externally
  useEffect(() => {
    if (visualEditorRef.current && !isUpdatingFromInternalRef.current) {
      if (visualEditorRef.current.innerHTML !== value) {
        visualEditorRef.current.innerHTML = value || '';
      }
    }
    isUpdatingFromInternalRef.current = false;
  }, [value, mode]);

  // Execute formatting command in Visual Mode
  const executeCommand = (command: string, arg: string | undefined = undefined) => {
    visualEditorRef.current?.focus();
    document.execCommand(command, false, arg);
    if (visualEditorRef.current) {
      const updated = visualEditorRef.current.innerHTML;
      isUpdatingFromInternalRef.current = true;
      onChange(updated);
    }
  };

  // Insert HTML directly at selection or at end
  const insertHtmlSnippet = (snippetHtml: string) => {
    if (mode === 'visual' || mode === 'split') {
      visualEditorRef.current?.focus();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const el = document.createElement('div');
        el.innerHTML = snippetHtml;
        const frag = document.createDocumentFragment();
        let node;
        let lastNode;
        while ((node = el.firstChild)) {
          lastNode = frag.appendChild(node);
        }
        range.insertNode(frag);
        if (lastNode) {
          range.setStartAfter(lastNode);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } else if (visualEditorRef.current) {
        visualEditorRef.current.innerHTML += snippetHtml;
      }
      if (visualEditorRef.current) {
        const updated = visualEditorRef.current.innerHTML;
        isUpdatingFromInternalRef.current = true;
        onChange(updated);
      }
    } else {
      onChange(value ? `${value}\n${snippetHtml}` : snippetHtml);
    }
  };

  const handleVisualInput = () => {
    if (visualEditorRef.current) {
      const html = visualEditorRef.current.innerHTML;
      isUpdatingFromInternalRef.current = true;
      onChange(html);
    }
  };

  const insertCustomBadge = () => {
    const badgeHtml = `<span style="display: inline-flex; align-items: center; gap: 4px; background: ${badgeBg}; color: ${badgeColor}; padding: 3px 10px; border-radius: ${badgeBorderRadius}; font-weight: 600; font-size: 11px; margin: 2px 4px 2px 0;"><span>${badgeIcon}</span> <span>${badgeText}</span></span>`;
    insertHtmlSnippet(badgeHtml);
    setShowBadgeMenu(false);
  };

  // Multi-Industry Universal Templates
  const getTemplateHtml = (type: string): string => {
    switch (type) {
      case 'general_tech':
        return `
<div style="font-family: inherit; line-height: 1.6;">
  <h3 style="color: #1e293b; margin: 0 0 8px 0; font-size: 15px; font-weight: 700;">Technical Product Specification</h3>
  <p style="margin: 0 0 12px 0; color: #475569;">Engineered for high-reliability commercial and industrial applications. Built to international quality standards with precision tolerances.</p>
  
  <table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; border: 1px solid #e2e8f0;">
    <thead>
      <tr style="background: #f8fafc; text-align: left;">
        <th style="padding: 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #334155;">Technical Property</th>
        <th style="padding: 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #334155;">Rated Specification</th>
        <th style="padding: 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #334155;">Tolerance / Standard</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Operating Rating</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 600;">Standard Grade A</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; color: #64748b;">Nominal</td>
      </tr>
      <tr style="background: #fcfcfd;">
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Material Composition</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 600;">High Density Poly/Metal</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; color: #64748b;">RoHS & ISO Compliant</td>
      </tr>
      <tr>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Environmental Limits</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 600;">-10°C to +60°C</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; color: #64748b;">Humidity &lt; 85%</td>
      </tr>
    </tbody>
  </table>
</div>`;

      case 'garments':
        return `
<div style="font-family: inherit; line-height: 1.6;">
  <h3 style="color: #4338ca; margin: 0 0 6px 0; font-size: 15px; font-weight: 700;">Garments & Apparel Tech Spec</h3>
  <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">
    <span style="background: #f1f5f9; color: #334155; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">🧵 100% Combed Cotton</span>
    <span style="background: #ecfdf5; color: #047857; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">✨ 220 GSM Bio-Washed</span>
    <span style="background: #eff6ff; color: #1d4ed8; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">🛡️ Reactive Dye (Colorfast)</span>
  </div>

  <h4 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 12px 0 6px 0;">Measurement Size Chart (Inches)</h4>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; border: 1px solid #cbd5e1;">
    <thead>
      <tr style="background: #f8fafc; text-align: center;">
        <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: left;">Size</th>
        <th style="padding: 6px; border: 1px solid #cbd5e1;">Chest</th>
        <th style="padding: 6px; border: 1px solid #cbd5e1;">Length</th>
        <th style="padding: 6px; border: 1px solid #cbd5e1;">Sleeve</th>
      </tr>
    </thead>
    <tbody style="text-align: center;">
      <tr><td style="padding: 5px; border: 1px solid #cbd5e1; text-align: left; font-weight: 600;">S (Small)</td><td>38"</td><td>27"</td><td>8.0"</td></tr>
      <tr style="background: #fcfcfd;"><td style="padding: 5px; border: 1px solid #cbd5e1; text-align: left; font-weight: 600;">M (Medium)</td><td>40"</td><td>28"</td><td>8.5"</td></tr>
      <tr><td style="padding: 5px; border: 1px solid #cbd5e1; text-align: left; font-weight: 600;">L (Large)</td><td>42"</td><td>29"</td><td>9.0"</td></tr>
      <tr style="background: #fcfcfd;"><td style="padding: 5px; border: 1px solid #cbd5e1; text-align: left; font-weight: 600;">XL (Extra Large)</td><td>44"</td><td>30"</td><td>9.5"</td></tr>
    </tbody>
  </table>

  <div style="background: #f8fafc; border-left: 3px solid #6366f1; padding: 8px 12px; font-size: 11px; color: #475569;">
    <strong>Care SOP:</strong> Machine wash cold with similar colors. Do not bleach. Tumble dry low. Warm iron if necessary.
  </div>
</div>`;

      case 'electronics':
        return `
<div style="font-family: inherit; line-height: 1.6;">
  <h3 style="color: #0369a1; margin: 0 0 6px 0; font-size: 15px; font-weight: 700;">Electronics & Hardware Engineering Sheet</h3>
  <table style="width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; border: 1px solid #cbd5e1;">
    <tbody>
      <tr>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: 600; width: 35%;">Input Voltage Range</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">AC 100V - 240V ~ 50/60Hz</td>
      </tr>
      <tr>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: 600;">Power Consumption</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">Standby: &lt; 0.5W | Max Load: 65W</td>
      </tr>
      <tr>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: 600;">Connectivity & Interfaces</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">USB-C PD 3.0, RS-485, Wi-Fi 6 (802.11ax)</td>
      </tr>
      <tr>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: 600;">Certifications</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">CE, FCC Part 15 Class B, RoHS 2.0</td>
      </tr>
    </tbody>
  </table>
</div>`;

      case 'food_recipe':
        return `
<div style="font-family: inherit; line-height: 1.6;">
  <h3 style="color: #b45309; margin: 0 0 6px 0; font-size: 15px; font-weight: 700;">Food Processing & Recipe Formulation</h3>
  <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px;">
    <span style="background: #f0fdf4; color: #166534; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">🌱 100% Organic</span>
    <span style="background: #fffbeb; color: #b45309; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">✨ Halal Certified</span>
  </div>

  <div style="border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.08); padding: 10px 14px; border-radius: 6px; margin: 10px 0; font-size: 11.5px;">
    <strong style="color: #dc2626;">⚠️ Allergen Declaration:</strong> Contains Wheat (Gluten), Milk Solids, Eggs. Processed in a facility handling Tree Nuts.
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; border: 1px solid #e2e8f0;">
    <thead>
      <tr style="background: #fefce8; text-align: left;">
        <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Nutritional Value</th>
        <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Per 100g Serving</th>
        <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">% Daily Value</th>
      </tr>
    </thead>
    <tbody>
      <tr><td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Energy (Calories)</td><td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 600;">264 kcal</td><td>13%</td></tr>
      <tr style="background: #fafafa;"><td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Protein</td><td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 600;">9.2 g</td><td>18%</td></tr>
      <tr><td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Total Carbohydrates</td><td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 600;">49.1 g</td><td>16%</td></tr>
    </tbody>
  </table>
</div>`;

      case 'furniture':
        return `
<div style="font-family: inherit; line-height: 1.6;">
  <h3 style="color: #92400e; margin: 0 0 6px 0; font-size: 15px; font-weight: 700;">Furniture Craftsmanship & Dimensions</h3>
  <table style="width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; border: 1px solid #e2e8f0;">
    <tbody>
      <tr><td style="padding: 6px 8px; border: 1px solid #e2e8f0; background: #fffbeb; font-weight: 600; width: 35%;">Dimensions (L × W × H)</td><td style="padding: 6px 8px; border: 1px solid #e2e8f0;">1800 mm × 900 mm × 760 mm</td></tr>
      <tr><td style="padding: 6px 8px; border: 1px solid #e2e8f0; background: #fffbeb; font-weight: 600;">Primary Material</td><td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Seasoned Grade-A Solid Teak Wood</td></tr>
      <tr><td style="padding: 6px 8px; border: 1px solid #e2e8f0; background: #fffbeb; font-weight: 600;">Joinery & Construction</td><td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Mortise and Tenon with Corner Bracing</td></tr>
      <tr><td style="padding: 6px 8px; border: 1px solid #e2e8f0; background: #fffbeb; font-weight: 600;">Surface Finish</td><td style="padding: 6px 8px; border: 1px solid #e2e8f0;">Natural Matte Polyurethane (Water-Resistant)</td></tr>
    </tbody>
  </table>
</div>`;

      case 'msds':
        return `
<div style="font-family: inherit; line-height: 1.6;">
  <h3 style="color: #b91c1c; margin: 0 0 6px 0; font-size: 15px; font-weight: 700;">Material Safety & Handling Protocol (MSDS)</h3>
  <div style="border: 1px solid #fecaca; background: #fff1f2; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px;">
    <strong style="color: #991b1b; display: block; margin-bottom: 4px;">🛡️ Safe Storage & Operational Handling:</strong>
    <p style="margin: 0; color: #7f1d1d; font-size: 11.5px;">Store in a tightly sealed container in a cool, well-ventilated dry area away from direct sunlight, heat, and incompatible oxidizers. Wear protective gloves and eye protection.</p>
  </div>
</div>`;

      case 'warranty':
        return `
<div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; background: #f8fafc; font-size: 12px; line-height: 1.6;">
  <h4 style="margin: 0 0 6px 0; color: #0f172a; font-size: 13.5px; font-weight: 700;">Enterprise Warranty & Assurance Policy</h4>
  <p style="margin: 0 0 8px 0; color: #475569;">Covered by a comprehensive <strong>24-Month Limited Manufacturer Warranty</strong> against all manufacturing defects in materials and craftsmanship.</p>
  <ul style="margin: 0; padding-left: 18px; color: #64748b; font-size: 11.5px;">
    <li>Includes free repair or replacement of verified defective components.</li>
    <li>Dedicated technical support hotline with 24-hour turnaround.</li>
  </ul>
</div>`;

      case 'table_spec':
      default:
        return `
<table style="width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; border: 1px solid #cbd5e1;">
  <thead>
    <tr style="background: #f8fafc; text-align: left;">
      <th style="padding: 6px 8px; border: 1px solid #cbd5e1; color: #334155; font-weight: 700;">Attribute / Parameter</th>
      <th style="padding: 6px 8px; border: 1px solid #cbd5e1; color: #334155; font-weight: 700;">Specification Value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600;">Model Number</td>
      <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">MOD-2026-X1</td>
    </tr>
    <tr style="background: #fcfcfd;">
      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600;">Country of Origin</td>
      <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">Made in Bangladesh</td>
    </tr>
  </tbody>
</table>`;
    }
  };

  const applyTemplate = (type: string) => {
    setShowTemplateMenu(false);
    const html = getTemplateHtml(type);
    insertHtmlSnippet(html);
  };

  return (
    <div
      ref={containerRef}
      className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs transition-all flex flex-col ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl bg-white dark:bg-slate-900 border-2 border-primary' : ''
      }`}
    >
      {/* ── Top Responsive Header Toolbar ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-t-2xl">
        {/* Left Formatting Controls */}
        <div className="flex flex-wrap items-center gap-1">
          {/* Visual Editing Tools */}
          {(mode === 'visual' || mode === 'split') && (
            <>
              {/* Text Styles Group */}
              <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => executeCommand('bold')}
                  className="inline-flex items-center justify-center size-7 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Bold (Ctrl+B)"
                >
                  <Bold className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand('italic')}
                  className="inline-flex items-center justify-center size-7 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Italic (Ctrl+I)"
                >
                  <Italic className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand('underline')}
                  className="inline-flex items-center justify-center size-7 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Underline (Ctrl+U)"
                >
                  <Underline className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand('strikeThrough')}
                  className="inline-flex items-center justify-center size-7 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Strikethrough"
                >
                  <Strikethrough className="size-3.5" />
                </button>
              </div>

              {/* Headings */}
              <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => executeCommand('formatBlock', '<h2>')}
                  className="inline-flex items-center justify-center size-7 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer font-bold text-xs"
                  title="Heading 1 (H2)"
                >
                  <Heading1 className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand('formatBlock', '<h3>')}
                  className="inline-flex items-center justify-center size-7 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer font-bold text-xs"
                  title="Heading 2 (H3)"
                >
                  <Heading2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand('formatBlock', '<h4>')}
                  className="inline-flex items-center justify-center size-7 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer font-bold text-xs"
                  title="Heading 3 (H4)"
                >
                  <Heading3 className="size-3.5" />
                </button>
              </div>

              {/* Alignment */}
              <div className="hidden sm:flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => executeCommand('justifyLeft')}
                  className="inline-flex items-center justify-center size-7 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Align Left"
                >
                  <AlignLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand('justifyCenter')}
                  className="inline-flex items-center justify-center size-7 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Align Center"
                >
                  <AlignCenter className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand('justifyRight')}
                  className="inline-flex items-center justify-center size-7 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Align Right"
                >
                  <AlignRight className="size-3.5" />
                </button>
              </div>

              {/* Lists & Callouts */}
              <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => executeCommand('insertUnorderedList')}
                  className="inline-flex items-center justify-center size-7 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Bullet List"
                >
                  <List className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand('insertOrderedList')}
                  className="inline-flex items-center justify-center size-7 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Numbered List"
                >
                  <ListOrdered className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand('formatBlock', '<blockquote>')}
                  className="inline-flex items-center justify-center size-7 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Quote / Callout"
                >
                  <Quote className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand('insertHorizontalRule')}
                  className="inline-flex items-center justify-center size-7 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Horizontal Divider"
                >
                  <Minus className="size-3.5" />
                </button>
              </div>

              {/* 🎨 Dynamic Color & Highlight Picker */}
              <div className="flex items-center gap-1">
                {/* Text Color Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowColorPicker(!showColorPicker);
                      setShowHighlightPicker(false);
                      setShowBadgeMenu(false);
                      setShowTemplateMenu(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs"
                    title="Choose Text Color (Palette & Custom Picker)"
                  >
                    <Palette className="size-3.5 text-indigo-500" />
                    <span>Color</span>
                    <span
                      className="size-2 rounded-full border border-black/20"
                      style={{ backgroundColor: customTextColor }}
                    />
                  </button>

                  {showColorPicker && (
                    <div className="absolute left-0 top-full mt-1.5 z-50 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-3 w-64 max-w-[calc(100vw-2rem)]">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">
                          Preset Colors
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => {
                                executeCommand('foreColor', c.value);
                                setCustomTextColor(c.value);
                                setShowColorPicker(false);
                              }}
                              className="size-7 rounded-lg border border-slate-300 dark:border-slate-700 hover:scale-110 transition-transform cursor-pointer shadow-xs"
                              style={{ backgroundColor: c.value }}
                              title={c.label}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                          Custom Hex & Color Picker
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={customTextColor}
                            onChange={(e) => setCustomTextColor(e.target.value)}
                            className="size-8 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-transparent"
                          />
                          <input
                            type="text"
                            value={customTextColor}
                            onChange={(e) => setCustomTextColor(e.target.value)}
                            placeholder="#4f46e5"
                            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-mono uppercase text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              executeCommand('foreColor', customTextColor);
                              setShowColorPicker(false);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 shadow-xs cursor-pointer"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Highlight Color Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowHighlightPicker(!showHighlightPicker);
                      setShowColorPicker(false);
                      setShowBadgeMenu(false);
                      setShowTemplateMenu(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs"
                    title="Highlight Background (Palette & Custom Picker)"
                  >
                    <Highlighter className="size-3.5 text-amber-500" />
                    <span>Highlight</span>
                    <span
                      className="size-2 rounded-full border border-black/20"
                      style={{ backgroundColor: customHighlightColor }}
                    />
                  </button>

                  {showHighlightPicker && (
                    <div className="absolute left-0 top-full mt-1.5 z-50 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-3 w-64 max-w-[calc(100vw-2rem)]">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">
                          Preset Highlights
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {PRESET_HIGHLIGHTS.map((h) => (
                            <button
                              key={h.value}
                              type="button"
                              onClick={() => {
                                executeCommand('hiliteColor', h.value);
                                setCustomHighlightColor(h.value);
                                setShowHighlightPicker(false);
                              }}
                              className="size-7 rounded-lg border border-slate-300 dark:border-slate-700 hover:scale-110 transition-transform cursor-pointer shadow-xs flex items-center justify-center text-[10px] font-bold text-slate-800"
                              style={{ backgroundColor: h.value }}
                              title={h.label}
                            >
                              {h.value === 'transparent' ? '✕' : ''}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                          Custom Background Picker
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={customHighlightColor}
                            onChange={(e) => setCustomHighlightColor(e.target.value)}
                            className="size-8 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-transparent"
                          />
                          <input
                            type="text"
                            value={customHighlightColor}
                            onChange={(e) => setCustomHighlightColor(e.target.value)}
                            placeholder="#fef08a"
                            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-mono uppercase text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              executeCommand('hiliteColor', customHighlightColor);
                              setShowHighlightPicker(false);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 shadow-xs cursor-pointer"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Table Inserter */}
          <button
            type="button"
            onClick={() => applyTemplate('table_spec')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs"
            title="Insert Parameter Specification Table"
          >
            <TableIcon className="size-3.5 text-indigo-500" />
            <span>Table</span>
          </button>

          {/* 🏷️ Dynamic Custom Badge Creator & Multi-Industry Presets */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowBadgeMenu(!showBadgeMenu);
                setShowTemplateMenu(false);
                setShowColorPicker(false);
                setShowHighlightPicker(false);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs"
              title="Create Custom Badges or Select Multi-Industry Presets"
            >
              <Tag className="size-3.5 text-emerald-500" />
              <span>Badge ▼</span>
            </button>

            {showBadgeMenu && (
              <div className="absolute left-0 top-full mt-1.5 z-50 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-3 w-80 max-w-[calc(100vw-2rem)]">
                {/* Tab Switcher */}
                <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                  <button
                    type="button"
                    onClick={() => setBadgeTab('custom')}
                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      badgeTab === 'custom'
                        ? 'bg-white dark:bg-slate-700 text-primary shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Custom Builder
                  </button>
                  <button
                    type="button"
                    onClick={() => setBadgeTab('presets')}
                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      badgeTab === 'presets'
                        ? 'bg-white dark:bg-slate-700 text-primary shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Industry Presets
                  </button>
                </div>

                {badgeTab === 'custom' ? (
                  <div className="space-y-3">
                    {/* Live Preview */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Live Preview</span>
                      <span
                        style={{
                          backgroundColor: badgeBg,
                          color: badgeColor,
                          borderRadius: badgeBorderRadius,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 10px',
                          fontWeight: 600,
                          fontSize: '11px',
                        }}
                      >
                        <span>{badgeIcon}</span>
                        <span>{badgeText || 'Badge Text'}</span>
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Icon</label>
                          <input
                            type="text"
                            value={badgeIcon}
                            onChange={(e) => setBadgeIcon(e.target.value)}
                            className="w-full text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1 text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Label Text</label>
                          <input
                            type="text"
                            value={badgeText}
                            onChange={(e) => setBadgeText(e.target.value)}
                            placeholder="e.g. 100% Organic, QC Passed"
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Background</label>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <input
                              type="color"
                              value={badgeBg}
                              onChange={(e) => setBadgeBg(e.target.value)}
                              className="size-7 rounded border border-slate-300 cursor-pointer p-0.5 bg-transparent"
                            />
                            <input
                              type="text"
                              value={badgeBg}
                              onChange={(e) => setBadgeBg(e.target.value)}
                              className="w-full text-xs font-mono uppercase rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-1"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Text Color</label>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <input
                              type="color"
                              value={badgeColor}
                              onChange={(e) => setBadgeColor(e.target.value)}
                              className="size-7 rounded border border-slate-300 cursor-pointer p-0.5 bg-transparent"
                            />
                            <input
                              type="text"
                              value={badgeColor}
                              onChange={(e) => setBadgeColor(e.target.value)}
                              className="w-full text-xs font-mono uppercase rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-1"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Shape</label>
                        <div className="grid grid-cols-3 gap-1 mt-0.5">
                          <button
                            type="button"
                            onClick={() => setBadgeBorderRadius('9999px')}
                            className={`py-1 text-[11px] rounded-lg border font-semibold cursor-pointer ${
                              badgeBorderRadius === '9999px' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            Pill
                          </button>
                          <button
                            type="button"
                            onClick={() => setBadgeBorderRadius('6px')}
                            className={`py-1 text-[11px] rounded-lg border font-semibold cursor-pointer ${
                              badgeBorderRadius === '6px' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            Rounded
                          </button>
                          <button
                            type="button"
                            onClick={() => setBadgeBorderRadius('2px')}
                            className={`py-1 text-[11px] rounded-lg border font-semibold cursor-pointer ${
                              badgeBorderRadius === '2px' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            Square
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={insertCustomBadge}
                      className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      Insert Custom Badge
                    </button>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
                    {INDUSTRY_BADGE_PRESETS.map((cat) => (
                      <div key={cat.category} className="space-y-1.5">
                        <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                          {cat.category}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {cat.badges.map((b) => (
                            <button
                              key={b.text}
                              type="button"
                              onClick={() => {
                                insertHtmlSnippet(
                                  `<span style="display: inline-flex; align-items: center; gap: 4px; background: ${b.bg}; color: ${b.color}; padding: 3px 10px; border-radius: 9999px; font-weight: 600; font-size: 11px; margin: 2px 4px 2px 0;"><span>${b.icon}</span> <span>${b.text}</span></span>`
                                );
                                setShowBadgeMenu(false);
                              }}
                              className="rounded-full px-2.5 py-1 text-[11px] font-semibold border border-black/5 hover:scale-105 transition-transform cursor-pointer"
                              style={{ backgroundColor: b.bg, color: b.color }}
                            >
                              {b.icon} {b.text}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ✨ All-Purpose Multi-Industry Templates */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowTemplateMenu(!showTemplateMenu);
                setShowBadgeMenu(false);
                setShowColorPicker(false);
                setShowHighlightPicker(false);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-linear-to-r from-primary/10 to-indigo-500/10 border border-primary/30 text-xs font-bold text-primary hover:bg-primary/20 transition-all cursor-pointer shadow-2xs"
              title="Insert Universal Multi-Industry Specification Templates"
            >
              <Sparkles className="size-3.5 text-primary animate-pulse" />
              <span>Templates ▼</span>
            </button>

            {showTemplateMenu && (
              <div className="absolute left-0 top-full mt-1.5 z-50 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-1 w-72 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto">
                <div className="text-[10px] font-bold uppercase text-slate-400 px-2.5 py-1 tracking-wider">
                  Universal Specification Blueprints
                </div>

                <button
                  type="button"
                  onClick={() => applyTemplate('general_tech')}
                  className="w-full text-left px-2.5 py-2 text-xs rounded-xl hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <FileText className="size-4 text-indigo-500 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">Technical Spec Sheet</div>
                    <div className="text-[10px] text-slate-500">General manufacturing & tolerance matrix</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyTemplate('garments')}
                  className="w-full text-left px-2.5 py-2 text-xs rounded-xl hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <Shirt className="size-4 text-purple-500 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">Garments Tech Pack</div>
                    <div className="text-[10px] text-slate-500">Fabric GSM, Size chart & Care SOP</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyTemplate('electronics')}
                  className="w-full text-left px-2.5 py-2 text-xs rounded-xl hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <Cpu className="size-4 text-sky-500 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">Electronics & Hardware</div>
                    <div className="text-[10px] text-slate-500">Voltage, power rating & compliance</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyTemplate('food_recipe')}
                  className="w-full text-left px-2.5 py-2 text-xs rounded-xl hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <Package className="size-4 text-amber-500 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">Food & Nutrition Sheet</div>
                    <div className="text-[10px] text-slate-500">Recipe SOP, nutrition facts & allergen box</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyTemplate('furniture')}
                  className="w-full text-left px-2.5 py-2 text-xs rounded-xl hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <Armchair className="size-4 text-orange-500 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">Furniture & Woodwork</div>
                    <div className="text-[10px] text-slate-500">Timber, joinery, dimensions & finish</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyTemplate('msds')}
                  className="w-full text-left px-2.5 py-2 text-xs rounded-xl hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <FlaskConical className="size-4 text-red-500 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">Chemical & Safety (MSDS)</div>
                    <div className="text-[10px] text-slate-500">Hazard classification & handling protocol</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyTemplate('warranty')}
                  className="w-full text-left px-2.5 py-2 text-xs rounded-xl hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">Warranty & SLA Policy</div>
                    <div className="text-[10px] text-slate-500">Warranty coverage terms & RMA protocol</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Mode Switchers & Fullscreen */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Editor Mode Selector */}
          <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setMode('visual')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                mode === 'visual'
                  ? 'bg-white dark:bg-slate-900 text-primary shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Eye className="size-3" />
              <span className="hidden sm:inline">Visual</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('code')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                mode === 'code'
                  ? 'bg-white dark:bg-slate-900 text-primary shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileCode className="size-3" />
              <span className="hidden sm:inline">HTML</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('split')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                mode === 'split'
                  ? 'bg-white dark:bg-slate-900 text-primary shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Columns2 className="size-3" />
              <span className="hidden md:inline">Split</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                mode === 'preview'
                  ? 'bg-white dark:bg-slate-900 text-primary shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Check className="size-3" />
              <span className="hidden sm:inline">Preview</span>
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="inline-flex items-center justify-center size-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Canvas'}
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Editor Canvas Area ────────────────────────────────────────────── */}
      <div className={`relative flex-1 ${isFullscreen ? 'h-full' : ''}`}>
        {/* Mode 1: Visual WYSIWYG Editor */}
        {mode === 'visual' && (
          <div
            ref={visualEditorRef}
            contentEditable
            role="textbox"
            tabIndex={0}
            aria-label="Product description editor"
            aria-multiline="true"
            onInput={handleVisualInput}
            onBlur={handleVisualInput}
            className="w-full min-h-40 max-h-90 overflow-y-auto p-4 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none leading-relaxed font-sans prose dark:prose-invert max-w-none"
            style={{ minHeight: `${rows * 26}px` }}
            data-placeholder={placeholder}
          />
        )}

        {/* Mode 2: HTML & CSS Code Editor */}
        {mode === 'code' && (
          <textarea
            ref={codeEditorRef}
            rows={isFullscreen ? 24 : rows + 2}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-slate-950 text-emerald-400 font-mono text-xs p-4 focus:outline-none resize-y leading-relaxed selection:bg-primary/40 border-none"
            spellCheck={false}
          />
        )}

        {/* Mode 3: Split Screen */}
        {mode === 'split' && (
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-700 min-h-55 max-h-100">
            <textarea
              rows={rows + 4}
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full bg-slate-950 text-emerald-400 font-mono text-xs p-4 focus:outline-none resize-none leading-relaxed selection:bg-primary/40"
              spellCheck={false}
            />
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 overflow-y-auto">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-wider flex items-center gap-1">
                <Eye className="size-3" /> Live Rendered Output
              </div>
              {value.trim() ? (
                <div
                  className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
                />
              ) : (
                <span className="text-slate-400 text-xs italic">Live rendered HTML preview appears here...</span>
              )}
            </div>
          </div>
        )}

        {/* Mode 4: Standalone Live Preview */}
        {mode === 'preview' && (
          <div className="p-5 bg-slate-50 dark:bg-slate-800/40 min-h-40 max-h-90 overflow-y-auto">
            {value.trim() ? (
              <div
                className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-xs gap-1.5">
                <Sparkles className="size-5 text-slate-400/60" />
                <span>No description content yet. Switch to Visual Editor or HTML mode to begin writing.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer Information Bar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[10px] text-slate-500 dark:text-slate-400 rounded-b-2xl">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3 text-primary" />
          <span>Visual WYSIWYG + HTML5/CSS3 Engine</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">Supports custom classes, tables, badges &amp; inline CSS</span>
        </div>
        <div className="font-mono">{value?.length || 0} characters</div>
      </div>
    </div>
  );
}

export function RenderHtmlContent({
  html,
  className = '',
}: {
  html: string;
  className?: string;
}) {
  const sanitize = (content: string) => {
    return DOMPurify.sanitize(content, {
      ADD_TAGS: [
        'style', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'b', 'i', 'u', 's', 'strong',
        'em', 'ul', 'ol', 'li', 'br', 'hr', 'blockquote', 'code', 'pre', 'mark'
      ],
      ADD_ATTR: [
        'style', 'class', 'id', 'target', 'border', 'cellpadding', 'cellspacing',
        'width', 'height', 'align', 'valign'
      ],
    });
  };

  if (!html || !html.trim()) {
    return null;
  }

  return (
    <div
      className={`prose dark:prose-invert max-w-none text-xs leading-relaxed font-sans ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitize(html) }}
    />
  );
}
