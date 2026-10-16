<?php

declare(strict_types=1);

namespace App\Modules\HR\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\HR\Actions\RecordAttendanceAction;
use App\Modules\HR\Models\Attendance;
use App\Modules\HR\Models\Employee;
use App\Modules\HR\Models\Shift;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

class AttendanceController extends Controller
{
    public function __construct(
        private readonly RecordAttendanceAction $recordAttendanceAction
    ) {}

    public function bulkImport(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $userId = Auth::id() ? (int) Auth::id() : 1;

        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*' => ['required', 'array'],
            'mode' => ['nullable', 'string', 'in:skip,upsert'],
        ]);

        $rows = $validated['rows'];
        $mode = $validated['mode'] ?? 'skip';

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        // Preload employees by code and email for fast lookup
        $employees = Employee::query()
            ->where('tenant_id', $tenantId)
            ->get();

        $employeeMap = [];
        foreach ($employees as $emp) {
            if ($emp->employee_code) {
                $employeeMap[strtolower((string) $emp->employee_code)] = $emp;
            }
            if ($emp->email) {
                $employeeMap[strtolower((string) $emp->email)] = $emp;
            }
        }

        // Preload shifts
        $shifts = Shift::query()
            ->where('tenant_id', $tenantId)
            ->get();

        $shiftMap = [];
        foreach ($shifts as $shift) {
            if ($shift->code) {
                $shiftMap[strtolower((string) $shift->code)] = $shift;
            }
            if ($shift->name) {
                $shiftMap[strtolower((string) $shift->name)] = $shift;
            }
        }

        $chunks = array_chunk($rows, 100);

        foreach ($chunks as $chunkIndex => $chunk) {
            DB::transaction(function () use (
                $chunk,
                $chunkIndex,
                $tenantId,
                $userId,
                $mode,
                $employeeMap,
                $shiftMap,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ): void {
                foreach ($chunk as $index => $row) {
                    $rowNum = ($chunkIndex * 100) + $index + 1;
                    $empCode = trim((string) ($row['employee_code'] ?? $row['code'] ?? $row['emp_id'] ?? $row['staff_id'] ?? ''));
                    $attDate = trim((string) ($row['attendance_date'] ?? $row['date'] ?? ''));
                    $shiftCode = isset($row['shift_code']) ? trim((string) $row['shift_code']) : (isset($row['shift']) ? trim((string) $row['shift']) : null);
                    $checkInRaw = isset($row['check_in_at']) ? trim((string) $row['check_in_at']) : (isset($row['in_time']) ? trim((string) $row['in_time']) : (isset($row['clock_in']) ? trim((string) $row['clock_in']) : null));
                    $checkOutRaw = isset($row['check_out_at']) ? trim((string) $row['check_out_at']) : (isset($row['out_time']) ? trim((string) $row['out_time']) : (isset($row['clock_out']) ? trim((string) $row['clock_out']) : null));
                    $status = isset($row['status']) && in_array(strtolower(trim((string) $row['status'])), ['present', 'absent', 'late', 'half_day', 'on_leave', 'holiday', 'weekly_off'], true)
                        ? strtolower(trim((string) $row['status']))
                        : null;
                    $remarks = isset($row['remarks']) ? trim((string) $row['remarks']) : (isset($row['notes']) ? trim((string) $row['notes']) : 'Bulk imported attendance');

                    if ($empCode === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'employee_code',
                            'value' => '',
                            'message' => 'Employee code is required.',
                        ];

                        continue;
                    }

                    if ($attDate === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'attendance_date',
                            'value' => '',
                            'message' => 'Attendance date is required.',
                        ];

                        continue;
                    }

                    $employee = $employeeMap[strtolower($empCode)] ?? null;
                    if (! $employee) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'employee_code',
                            'value' => $empCode,
                            'message' => "Employee with code '{$empCode}' does not exist.",
                        ];

                        continue;
                    }

                    $shift = null;
                    if ($shiftCode && isset($shiftMap[strtolower($shiftCode)])) {
                        $shift = $shiftMap[strtolower($shiftCode)];
                    } elseif ($employee->default_shift_id) {
                        $shift = Shift::find($employee->default_shift_id);
                    }

                    // Format full datetimes
                    $checkIn = null;
                    $checkOut = null;
                    if ($checkInRaw) {
                        if (strlen($checkInRaw) <= 8 && str_contains($checkInRaw, ':')) {
                            $checkIn = Carbon::parse($attDate.' '.$checkInRaw);
                        } else {
                            $checkIn = Carbon::parse($checkInRaw);
                        }
                    }
                    if ($checkOutRaw) {
                        if (strlen($checkOutRaw) <= 8 && str_contains($checkOutRaw, ':')) {
                            $checkOut = Carbon::parse($attDate.' '.$checkOutRaw);
                        } else {
                            $checkOut = Carbon::parse($checkOutRaw);
                        }
                    }

                    // Calculate worked and late minutes
                    $workedMinutes = 0;
                    $lateMinutes = 0;
                    $overtimeMinutes = 0;

                    if ($checkIn && $checkOut) {
                        $diffSec = $checkOut->getTimestamp() - $checkIn->getTimestamp();
                        $workedMinutes = (int) max(0, floor($diffSec / 60));

                        if ($shift && $shift->start_time) {
                            $shiftStart = Carbon::parse($attDate.' '.$shift->start_time);
                            $grace = (int) ($shift->grace_in_minutes ?? 0);
                            $allowedStart = $shiftStart->copy()->addMinutes($grace);
                            if ($checkIn->getTimestamp() > $allowedStart->getTimestamp()) {
                                $lateMinutes = (int) max(0, floor(($checkIn->getTimestamp() - $shiftStart->getTimestamp()) / 60));
                            }
                        }

                        if ($workedMinutes > 480) {
                            $overtimeMinutes = $workedMinutes - 480;
                        }
                    }

                    if (! $status) {
                        if ($lateMinutes > 0) {
                            $status = 'late';
                        } elseif ($workedMinutes > 0 || $checkIn) {
                            $status = 'present';
                        } else {
                            $status = 'present';
                        }
                    }

                    // Check existing attendance record
                    $existing = Attendance::query()
                        ->where('tenant_id', $tenantId)
                        ->where('employee_id', $employee->id)
                        ->where('attendance_date', $attDate)
                        ->first();

                    if ($existing) {
                        if ($mode === 'skip') {
                            $skipped++;

                            continue;
                        }

                        // Upsert
                        try {
                            $existing->update([
                                'shift_id' => $shift?->id ?? $existing->shift_id,
                                'check_in_at' => $checkIn ?? $existing->check_in_at,
                                'check_out_at' => $checkOut ?? $existing->check_out_at,
                                'check_in_source' => 'import',
                                'check_out_source' => 'import',
                                'worked_minutes' => $workedMinutes > 0 ? $workedMinutes : $existing->worked_minutes,
                                'late_minutes' => $lateMinutes,
                                'overtime_minutes' => $overtimeMinutes,
                                'status' => $status,
                                'remarks' => $remarks,
                                'updated_by' => $userId,
                            ]);
                            $updated++;
                        } catch (Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'attendance_date',
                                'value' => $attDate,
                                'message' => 'Attendance update failed: '.$e->getMessage(),
                            ];
                        }
                    } else {
                        // Create
                        try {
                            Attendance::create([
                                'tenant_id' => $tenantId,
                                'uuid' => (string) Str::uuid(),
                                'employee_id' => $employee->id,
                                'attendance_date' => $attDate,
                                'shift_id' => $shift?->id,
                                'check_in_at' => $checkIn,
                                'check_out_at' => $checkOut,
                                'check_in_source' => 'import',
                                'check_out_source' => 'import',
                                'worked_minutes' => $workedMinutes,
                                'late_minutes' => $lateMinutes,
                                'overtime_minutes' => $overtimeMinutes,
                                'status' => $status,
                                'remarks' => $remarks,
                                'created_by' => $userId,
                                'updated_by' => $userId,
                            ]);
                            $imported++;
                        } catch (Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'attendance_date',
                                'value' => $attDate,
                                'message' => 'Attendance creation failed: '.$e->getMessage(),
                            ];
                        }
                    }
                }
            });
        }

        return response()->json([
            'success' => true,
            'data' => [
                'imported' => $imported,
                'updated' => $updated,
                'skipped' => $skipped,
                'failed' => count($errors),
                'errors' => $errors,
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = Attendance::query()->with(['employee.department', 'employee.designation', 'shift']);

        if ($request->filled('date')) {
            $query->where('attendance_date', $request->query('date'));
        }

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->query('employee_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $attendances = $query->orderByDesc('attendance_date')->paginate(50);

        return response()->json($attendances);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'employee_id' => 'required|integer',
            'attendance_date' => 'required|date',
            'check_in_at' => 'nullable|date',
            'check_out_at' => 'nullable|date',
            'shift_id' => 'nullable|integer',
            'status' => 'nullable|string|in:present,absent,late,half_day,on_leave,holiday,weekly_off',
            'remarks' => 'nullable|string',
        ]);

        $userId = (int) ($request->user()?->id ?? 1);
        $attendance = $this->recordAttendanceAction->execute($validated, $userId);

        return response()->json([
            'data' => $attendance->load(['employee.department', 'shift']),
            'message' => 'Attendance recorded successfully.',
        ], 201);
    }

    public function summary(Request $request): JsonResponse
    {
        $date = $request->query('date', date('Y-m-d'));

        $totalEmployees = Employee::where('employment_status', 'active')->count();
        $attendances = Attendance::where('attendance_date', $date)->get();

        $presentCount = $attendances->whereIn('status', ['present', 'late', 'half_day'])->count();
        $lateCount = $attendances->where('status', 'late')->count();
        $onLeaveCount = $attendances->where('status', 'on_leave')->count();
        $absentCount = max(0, $totalEmployees - $presentCount - $onLeaveCount);

        $presentRate = $totalEmployees > 0 ? round(($presentCount / $totalEmployees) * 100, 1) : 0;

        return response()->json([
            'date' => $date,
            'total_workforce' => $totalEmployees,
            'present' => $presentCount,
            'late' => $lateCount,
            'absent' => $absentCount,
            'on_leave' => $onLeaveCount,
            'present_rate_percent' => $presentRate,
        ]);
    }

    public function punchBadge(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'badge_id' => 'required|string', // Employee code or badge RFID
            'timestamp' => 'nullable|date',
        ]);

        $code = trim($validated['badge_id']);
        $employee = Employee::where('employee_code', $code)
            ->orWhere('national_id', $code)
            ->orWhere('id', is_numeric($code) ? (int) $code : 0)
            ->first();

        if (! $employee) {
            return response()->json([
                'success' => false,
                'message' => "Unrecognized badge or employee ID: {$code}",
            ], 404);
        }

        $now = $validated['timestamp'] ? Carbon::parse($validated['timestamp']) : now();
        $today = $now->toDateString();

        // Check if attendance already exists for today
        $attendance = Attendance::where('employee_id', $employee->id)
            ->where('attendance_date', $today)
            ->first();

        $shift = $employee->defaultShift ?? Shift::where('is_active', true)->first();

        if ($attendance && $attendance->check_in_at && ! $attendance->check_out_at) {
            // Clock out
            $attendance->check_out_at = $now;
            $checkIn = Carbon::parse($attendance->check_in_at);
            $workingHours = round($checkIn->diffInMinutes($now) / 60, 2);
            $attendance->working_hours = $workingHours;
            /** @var Attendance $attendance */
            $attendance->save();

            return response()->json([
                'success' => true,
                'type' => 'clock_out',
                'employee' => [
                    'id' => $employee->id,
                    'name' => $employee->display_name ?: $employee->first_name,
                    'employee_code' => $employee->employee_code,
                    'department' => $employee->department?->name,
                ],
                'attendance' => $attendance,
                'message' => "Clock-out recorded for {$employee->display_name} at {$now->format('h:i A')}. Total: {$workingHours} hrs.",
            ]);
        }

        // Clock in
        $status = 'present';
        if ($shift) {
            $shiftStart = Carbon::parse($today.' '.$shift->start_time);
            $graceEnd = $shiftStart->copy()->addMinutes($shift->grace_in_minutes ?? 15);
            if ($now->gt($graceEnd)) {
                $status = 'late';
            }
        }

        $userId = is_numeric(Auth::id()) ? (int) Auth::id() : 1;

        $attendance = Attendance::updateOrCreate(
            [
                'employee_id' => $employee->id,
                'attendance_date' => $today,
            ],
            [
                'shift_id' => $shift?->id,
                'check_in_at' => $now,
                'status' => $status,
                'created_by' => $userId,
                'updated_by' => $userId,
            ]
        );

        return response()->json([
            'success' => true,
            'type' => 'clock_in',
            'status' => $status,
            'employee' => [
                'id' => $employee->id,
                'name' => $employee->display_name ?: $employee->first_name,
                'employee_code' => $employee->employee_code,
                'department' => $employee->department?->name,
                'designation' => $employee->designation?->name,
            ],
            'attendance' => $attendance,
            'message' => "Clock-in verified: {$employee->display_name} ({$employee->employee_code}) at {$now->format('h:i A')}. Status: ".strtoupper($status),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $attendance = Attendance::findOrFail($id);
        $attendance->delete();

        return response()->json([
            'success' => true,
            'message' => 'Attendance record removed successfully.',
        ]);
    }

    public function bulkDelete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer',
        ]);

        $ids = array_map('intval', $validated['ids']);
        $count = (int) Attendance::whereIn('id', $ids)->delete();

        return response()->json([
            'success' => true,
            'message' => "Removed {$count} attendance records.",
        ]);
    }

    public function bulkStatus(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer',
            'status' => 'required|string|in:present,absent,late,half_day,on_leave,holiday,weekly_off',
        ]);

        $ids = array_map('intval', $validated['ids']);
        $status = (string) $validated['status'];
        $userId = is_numeric(Auth::id()) ? (int) Auth::id() : 1;

        $count = (int) Attendance::whereIn('id', $ids)->update([
            'status' => $status,
            'updated_by' => $userId,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Marked {$count} attendance records as {$status}.",
        ]);
    }
}
