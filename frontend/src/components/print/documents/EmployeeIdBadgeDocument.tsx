import { useMemo } from 'react';
import type { Employee } from '../../../types/api/hr';
import { generateBarcodeSvg } from '../../../lib/barcode/engine';

export interface EmployeeIdBadgeDocumentProps {
  employee?: Employee;
  employees?: Employee[];
  companyName?: string;
  issueDate?: string;
}

function SingleEmployeeBadge({
  employee,
  companyName = 'SLICE MART FMS',
  issueDate = new Date().toISOString().slice(0, 10),
}: {
  employee: Employee;
  companyName?: string;
  issueDate?: string;
}) {
  const barcodeSvg = useMemo(() => {
    return generateBarcodeSvg({
      bcid: 'code128',
      text: employee.employee_code || 'EMP-000',
      scale: 1.15,
      height: 6,
      includeText: false,
    });
  }, [employee.employee_code]);

  const qrSvg = useMemo(() => {
    return generateBarcodeSvg({
      bcid: 'qrcode',
      text: `SEC-PASS:${employee.employee_code}|${employee.display_name}|${employee.phone || ''}`,
      scale: 1.2,
      height: 14,
      width: 14,
    });
  }, [employee.employee_code, employee.display_name, employee.phone]);

  const initials = useMemo(() => {
    const first = employee.first_name?.[0] || '';
    const last = employee.last_name?.[0] || employee.display_name?.split(' ')?.[1]?.[0] || '';
    return `${first}${last}`.toUpperCase() || 'EM';
  }, [employee.first_name, employee.last_name, employee.display_name]);

  return (
    <div className="page-break-avoid my-4">
      {/* Side-by-Side Front & Back Card Layout */}
      <div className="flex flex-wrap items-start justify-center gap-8 print:gap-6">
        {/* ───────────────────────────────────────────────────────────────────────────
            FRONT PASS
            ─────────────────────────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center">
          <div className="text-[7pt] font-bold text-slate-400 uppercase tracking-wider mb-1.5 no-print">
            Card Front (Face)
          </div>

          <div
            className="cr80-card-print relative border border-slate-800 rounded-2xl bg-white p-3 flex flex-col justify-between overflow-hidden shadow-xs"
            style={{
              width: '54mm',
              height: '85.6mm',
              boxSizing: 'border-box',
            }}
          >
            {/* Top Accent Gradient Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600" />

            {/* Top Header */}
            <div>
              {/* Lanyard Slot Cutout Guide Indicator */}
              <div className="w-8 h-1 mx-auto mb-1.5 rounded-full border border-dashed border-slate-300 bg-slate-100" />

              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <div>
                  <div className="font-black text-[8pt] tracking-tight text-slate-950 uppercase">
                    {companyName}
                  </div>
                  <div className="text-[5.5pt] font-semibold tracking-widest text-slate-500 uppercase">
                    Factory Management
                  </div>
                </div>
                <div className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[5.5pt] tracking-wider uppercase">
                  Security Pass
                </div>
              </div>
            </div>

            {/* Center Avatar & Identity */}
            <div className="flex flex-col items-center text-center my-auto py-1">
              <div className="size-14 rounded-xl border-2 border-indigo-600 bg-linear-to-br from-indigo-50 to-blue-100 flex items-center justify-center text-lg font-black text-indigo-700 shadow-inner mb-1.5">
                {initials}
              </div>

              <div className="font-black text-[9.5pt] text-slate-950 leading-tight">
                {employee.display_name}
              </div>
              <div className="text-[7.5pt] font-bold text-indigo-600 leading-tight mt-0.5">
                {employee.designation?.name || 'Staff Member'}
              </div>
              <div className="text-[6.5pt] font-medium text-slate-500 leading-tight">
                {employee.department?.name || 'Production Floor'}
              </div>
            </div>

            {/* Bottom Meta & Barcode */}
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[6.5pt]">
                <div>
                  <span className="text-[5.5pt] text-slate-500 uppercase block font-medium">ID Code</span>
                  <span className="font-mono font-bold text-slate-950">{employee.employee_code}</span>
                </div>
                <div>
                  <span className="text-[5.5pt] text-slate-500 uppercase block font-medium">Phone</span>
                  <span className="font-mono text-slate-950 truncate block">{employee.phone || 'N/A'}</span>
                </div>
              </div>

              {/* Barcode Strip */}
              <div className="bg-white border border-slate-200 rounded-md p-1 flex flex-col items-center justify-center">
                <div className="w-full flex justify-center" dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
                <div className="font-mono text-[6pt] font-bold tracking-wider text-slate-900 mt-0.5">
                  *{employee.employee_code}*
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────────────────────
            BACK PASS
            ─────────────────────────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center">
          <div className="text-[7pt] font-bold text-slate-400 uppercase tracking-wider mb-1.5 no-print">
            Card Back (Reverse)
          </div>

          <div
            className="cr80-card-print relative border border-slate-800 rounded-2xl bg-white p-3 flex flex-col justify-between overflow-hidden shadow-xs"
            style={{
              width: '54mm',
              height: '85.6mm',
              boxSizing: 'border-box',
            }}
          >
            {/* Magnetic Stripe Simulator */}
            <div className="w-full h-3 bg-slate-900 rounded-sm mb-1" />

            {/* Terms & Regulations */}
            <div className="text-[5.5pt] text-slate-600 leading-tight space-y-1 text-justify">
              <p className="font-bold text-slate-800 uppercase tracking-wide text-center">
                Conditions of Use
              </p>
              <p>
                1. This card is official company property and must be worn visibly within all factory
                premises and production facilities.
              </p>
              <p>
                2. Non-transferable. Loss of this pass must be reported to the Security Desk
                immediately.
              </p>
              <p>
                3. If found, please return to Human Resources Department or deposit in the nearest post
                facility.
              </p>
            </div>

            {/* Verification QR & Security Seal */}
            <div className="flex items-center justify-between border-y border-slate-200 py-1.5 my-1">
              <div className="space-y-0.5 text-[5.5pt]">
                <div className="text-slate-500 uppercase font-semibold">Issued Date:</div>
                <div className="font-bold text-slate-900">{issueDate}</div>
                <div className="text-slate-500 uppercase font-semibold mt-1">Status:</div>
                <div className="font-bold text-emerald-700 uppercase">ACTIVE ACCESS</div>
              </div>
              <div className="size-10 flex items-center justify-center p-0.5 bg-white border border-slate-200 rounded" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            </div>

            {/* Signature & Emergency Line */}
            <div>
              <div className="flex justify-between items-end border-b border-slate-400 pb-0.5 mb-1">
                <span className="text-[5pt] text-slate-500 uppercase">Authorized Signatory</span>
                <span className="font-serif italic text-[7pt] text-slate-800 font-bold">HR Dept.</span>
              </div>
              <div className="text-[5pt] text-center text-slate-500">
                Security Desk Hotline: +880 1700-000000 • hr@company.local
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmployeeIdBadgeDocument({
  employee,
  employees,
  companyName = 'SLICE MART FMS',
  issueDate = new Date().toISOString().slice(0, 10),
}: EmployeeIdBadgeDocumentProps) {
  const list = useMemo(() => {
    if (employees && employees.length > 0) return employees;
    if (employee) return [employee];
    return [];
  }, [employee, employees]);

  if (list.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">No employee selected for badge printing.</div>
    );
  }

  return (
    <div className="print-doc w-full text-slate-900 bg-white font-sans text-[8pt] leading-tight">
      {/* Cut / Sheet Guide Banner (Visible when printing on A4 sheet) */}
      <div className="border-b border-dashed border-slate-300 pb-2 mb-6 flex items-center justify-between text-[7pt] text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-700 uppercase tracking-wider">
            Standard CR80 Pass (54mm × 85.6mm)
          </span>
          <span>• Scale: 100% (Do not scale to fit page) • Total Passes: {list.length}</span>
        </div>
        <div>Cut along guidelines • Standard PVC / ID badge holder size</div>
      </div>

      <div className="space-y-6">
        {list.map((emp, idx) => (
          <div key={emp.id || idx} className={idx > 0 && idx % 2 === 0 ? 'page-break-before' : ''}>
            <SingleEmployeeBadge
              employee={emp}
              companyName={companyName}
              issueDate={issueDate}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
