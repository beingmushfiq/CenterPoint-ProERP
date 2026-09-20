<?php

declare(strict_types=1);

namespace App\Modules\Finance\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Finance\Actions\CreateExpenseAction;
use App\Modules\Finance\Models\Expense;
use App\Modules\Finance\Models\ExpenseCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function __construct(
        private readonly CreateExpenseAction $createExpenseAction
    ) {}

    public function categories(Request $request): JsonResponse
    {
        $categories = ExpenseCategory::query()->with('defaultAccount')->where('is_active', true)->get();

        return response()->json([
            'data' => $categories,
        ]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_id' => 'required|integer',
            'code' => 'required|string|max:64',
            'name' => 'required|string|max:255',
            'chart_of_account_id' => 'nullable|integer',
            'description' => 'nullable|string',
        ]);

        $category = ExpenseCategory::create([
            ...$validated,
            'is_active' => true,
            'created_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json([
            'data' => $category,
        ], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $query = Expense::query()->with(['category', 'branch', 'bankAccount', 'journalEntry']);

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('category_id')) {
            $query->where('expense_category_id', $request->query('category_id'));
        }

        $expenses = $query->orderByDesc('expense_date')->orderByDesc('id')->paginate(20);

        return response()->json($expenses);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_id' => 'required|integer',
            'branch_id' => 'required|integer',
            'expense_category_id' => 'required|integer',
            'expense_date' => 'required|date',
            'payee_type' => 'required|string|in:party,employee,other',
            'payee_id' => 'nullable|integer',
            'payee_name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'amount' => 'required|numeric|min:0.01',
            'tax_amount' => 'nullable|numeric|min:0',
            'payment_method' => 'required|string|in:cash,bank,mobile_wallet,credit,cheque',
            'bank_account_id' => 'nullable|integer',
            'reference_number' => 'nullable|string|max:128',
            'cost_center_code' => 'nullable|string|max:64',
        ]);

        $userId = (int) ($request->user()?->id ?? 1);
        $expense = $this->createExpenseAction->execute($validated, $userId);

        return response()->json([
            'data' => $expense,
            'message' => 'Expense recorded and posted to general ledger.',
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $expense = Expense::with(['category', 'branch', 'bankAccount', 'journalEntry.lines.account'])->findOrFail($id);

        return response()->json([
            'data' => $expense,
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $expense = Expense::findOrFail($id);
        $expense->delete();

        return response()->json([
            'success' => true,
            'message' => 'Expense moved to Data Bin successfully',
        ]);
    }
}
