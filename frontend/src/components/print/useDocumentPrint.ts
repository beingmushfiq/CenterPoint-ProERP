import { useState, useCallback } from 'react';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

let printRootElement: HTMLElement | null = null;
let printReactRoot: Root | null = null;

function getOrCreatePrintRoot(): HTMLElement {
  if (!printRootElement) {
    let el = document.getElementById('print-root');
    if (!el) {
      el = document.createElement('div');
      el.id = 'print-root';
      document.body.appendChild(el);
    }
    printRootElement = el;
  }
  return printRootElement;
}

export interface PrintOptions {
  documentTitle?: string;
  pageClass?: string;
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
}

export function useDocumentPrint() {
  const [isPrinting, setIsPrinting] = useState(false);

  const printDocument = useCallback(
    (component: React.ReactElement, options: PrintOptions = {}) => {
      setIsPrinting(true);
      const originalTitle = document.title;
      if (options.documentTitle) {
        document.title = options.documentTitle;
      }

      const container = getOrCreatePrintRoot();
      // The page class (e.g. print-page-a4, print-page-thermal-80) belongs on
      // #print-root — it is the only place. Document component roots must NOT
      // redeclare the same page class on an inner element: a descendant `page:`
      // value creates a named-page context boundary that forces a blank
      // transitional page before/after the content block in all browsers.
      container.className = `print-doc ${options.pageClass || 'print-page-a4'}`;

      if (options.onBeforePrint) {
        options.onBeforePrint();
      }

      if (!printReactRoot) {
        printReactRoot = createRoot(container);
      }

      // Render the component into the isolated print-root
      printReactRoot.render(component);

      // Give browser time to lay out CSS, fonts, and SVG barcodes.
      // 400 ms is the minimum safe value for Code128 / QR SVG generation.
      setTimeout(() => {
        document.body.classList.add('printing-active');

        const cleanup = () => {
          document.body.classList.remove('printing-active');
          document.title = originalTitle;
          setIsPrinting(false);
          if (printReactRoot) {
            printReactRoot.render(null);
          }
          if (container) {
            container.className = '';
          }
          if (options.onAfterPrint) {
            options.onAfterPrint();
          }
          window.removeEventListener('afterprint', cleanup);
        };

        window.addEventListener('afterprint', cleanup, { once: true });

        try {
          window.print();
        } catch (e) {
          console.error('Browser print execution failed:', e);
          cleanup();
        }
      }, 400);
    },
    []
  );

  return { printDocument, isPrinting };
}
