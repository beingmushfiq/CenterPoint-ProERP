<?php

declare(strict_types=1);

namespace App\Modules\HR\Actions;

use App\Modules\HR\Models\Attendance;
use App\Modules\HR\Models\Employee;
use App\Modules\HR\Models\Shift;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class RecordAttendanceAction
{
    /**
     * @param array{
     *     employee_id: int,
     *     attendance_date: string,
     *     check_in_at?: string,
     *     check_out_at?: string,
     *     shift_id?: int,
     *     status?: string,
     *     remarks?: string,
     * } $data
     */
    public function execute(array $data, int $userId): Attendance
    {
        return DB::transaction(function () use ($data, $userId): Attendance {
            $employee = Employee::findOrFail($data['employee_id']);
            $date = $data['attendance_date'];

            $shiftId = $data['shift_id'] ?? $employee->default_shift_id;
            $shift = $shiftId ? Shift::find($shiftId) : null;

            $workedMinutes = 0;
            $lateMinutes = 0;
            $earlyLeaveMinutes = 0;
            $overtimeMinutes = 0;

            if (! empty($data['check_in_at']) && ! empty($data['check_out_at'])) {
                $checkIn = Carbon::parse($data['check_in_at']);
                $checkOut = Carbon::parse($data['check_out_at']);

                $diffSeconds = $checkOut->getTimestamp() - $checkIn->getTimestamp();
                $workedMinutes = (int) max(0, floor($diffSeconds / 60));

                if ($shift && $shift->start_time) {
                    $shiftStart = Carbon::parse($date.' '.$shift->start_time);
                    $gracePeriod = (int) ($shift->grace_in_minutes ?? 0);
                    $allowedStart = $shiftStart->copy()->addMinutes($gracePeriod);

                    if ($checkIn->getTimestamp() > $allowedStart->getTimestamp()) {
                        $lateMinutes = (int) max(0, floor(($checkIn->getTimestamp() - $shiftStart->getTimestamp()) / 60));
                    }
                }

                if ($workedMinutes > 480) { // Over 8 hours is overtime
                    $overtimeMinutes = $workedMinutes - 480;
                }
            }

            return Attendance::updateOrCreate(
                [
                    'employee_id' => $employee->id,
                    'attendance_date' => $date,
                ],
                [
                    'shift_id' => $shiftId,
                    'check_in_at' => $data['check_in_at'] ?? null,
                    'check_out_at' => $data['check_out_at'] ?? null,
                    'worked_minutes' => $workedMinutes,
                    'late_minutes' => $lateMinutes,
                    'early_leave_minutes' => $earlyLeaveMinutes,
                    'overtime_minutes' => $overtimeMinutes,
                    'status' => $data['status'] ?? ($workedMinutes > 0 ? 'present' : 'absent'),
                    'remarks' => $data['remarks'] ?? null,
                    'created_by' => $userId,
                    'updated_by' => $userId,
                ]
            );
        });
    }
}
