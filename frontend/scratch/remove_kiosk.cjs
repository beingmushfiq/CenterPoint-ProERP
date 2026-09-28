const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../src/modules/hr/HrWorkspace.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Remove import
content = content.replace("import { BadgePunchTerminalModal } from './components/BadgePunchTerminalModal';\r\n", "");
content = content.replace("import { BadgePunchTerminalModal } from './components/BadgePunchTerminalModal';\n", "");

// 2. Remove isKioskModalOpen state
content = content.replace("  const [isKioskModalOpen, setIsKioskModalOpen] = useState(false);\r\n", "");
content = content.replace("  const [isKioskModalOpen, setIsKioskModalOpen] = useState(false);\n", "");

// 3. Remove Kiosk button
const btnRegex = /\s*<button\s+type="button"\s+onClick=\{\(\)\s*=>\s*setIsKioskModalOpen\(true\)\}[\s\S]*?<\/button>/;
content = content.replace(btnRegex, "");

// 4. Remove Modal 8
const modalRegex = /\s*\{\/\* ───+\r?\n\s*Modal 8: Biometric & NFC Kiosk Punch Terminal[\s\S]*?<BadgePunchTerminalModal[\s\S]*?\/>/;
content = content.replace(modalRegex, "");

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Kiosk successfully removed from HrWorkspace.tsx!');
