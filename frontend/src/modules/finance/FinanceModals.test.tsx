import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MoneyOutModal } from './modals/MoneyOutModal';
import { MoneyInModal } from './modals/MoneyInModal';
import { TransferMoneyModal } from './modals/TransferMoneyModal';
import type { ChartOfAccount, BankAccount } from '../../types/api/finance';

const mockAccounts: ChartOfAccount[] = [
  {
    id: 101,
    uuid: 'coa-101',
    account_code: '1010',
    name: 'Petty Cash',
    account_type: 'asset',
    account_subtype: 'cash',
    normal_balance: 'debit',
    is_active: true,
    current_balance: '25000.0000',
  },
  {
    id: 102,
    uuid: 'coa-102',
    account_code: '1020',
    name: 'BRAC Bank Principal',
    account_type: 'asset',
    account_subtype: 'bank',
    normal_balance: 'debit',
    is_active: true,
    current_balance: '850000.0000',
  },
  {
    id: 201,
    uuid: 'coa-201',
    account_code: '2010',
    name: 'Accounts Payable',
    account_type: 'liability',
    account_subtype: 'payable',
    normal_balance: 'credit',
    is_active: true,
    current_balance: '120000.0000',
  },
  {
    id: 501,
    uuid: 'coa-501',
    account_code: '5010',
    name: 'Operating Expense Control',
    account_type: 'expense',
    normal_balance: 'debit',
    is_active: true,
    current_balance: '45000.0000',
  },
];

const mockBankAccounts: BankAccount[] = [
  {
    id: 1,
    uuid: 'ba-01',
    company_id: 1,
    account_name: 'BRAC Bank Principal',
    account_number: '1501204892001',
    bank_name: 'BRAC Bank PLC',
    currency_code: 'BDT',
    opening_balance: '500000.0000',
    current_balance: '850000.0000',
    is_active: true,
  },
];

describe('Finance Action Modals', () => {
  describe('MoneyOutModal', () => {
    it('renders and records operational expense with balanced ledger output', async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      render(
        <MoneyOutModal
          open={true}
          onClose={onClose}
          accounts={mockAccounts}
          bankAccounts={mockBankAccounts}
          onSuccess={onSuccess}
        />
      );

      expect(screen.getByRole('heading', { name: /Money Out/i })).toBeInTheDocument();
      expect(screen.getByText('Operating Expense')).toBeInTheDocument();

      // Enter amount and payee
      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '1500' } });

      const payeeInput = screen.getByPlaceholderText('e.g. DESCO, Pathao, Landlord');
      fireEvent.change(payeeInput, { target: { value: 'DESCO Ltd' } });

      // Submit form
      const submitBtn = screen.getByRole('button', { name: /Record Money Out/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
      const payload = onSuccess.mock.calls[0]![0];
      expect(payload.expense).toBeDefined();
      expect(payload.expense.amount).toBe('1500.0000');
      expect(payload.journalEntry.total_debit).toBe('1500.0000');
      expect(payload.journalEntry.total_credit).toBe('1500.0000');
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('MoneyInModal', () => {
    it('renders customer collection prefilled and outputs balanced journal entry', () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      render(
        <MoneyInModal
          open={true}
          onClose={onClose}
          accounts={mockAccounts}
          bankAccounts={mockBankAccounts}
          initialCustomerName="Aarong Retail"
          initialDueAmount="12500"
          initialInvoiceNumber="INV-2026-009"
          onSuccess={onSuccess}
        />
      );

      expect(screen.getByRole('heading', { name: /Money In/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue('Aarong Retail')).toBeInTheDocument();
      expect(screen.getByDisplayValue('12500')).toBeInTheDocument();

      const submitBtn = screen.getByRole('button', { name: /Record Money In/i });
      fireEvent.click(submitBtn);

      expect(onSuccess).toHaveBeenCalledTimes(1);
      const payload = onSuccess.mock.calls[0]![0];
      expect(payload.collectedCustomerName).toBe('Aarong Retail');
      expect(payload.collectedAmount).toBe(12500);
      expect(payload.journalEntry.total_debit).toBe('12500.0000');
      expect(payload.journalEntry.total_credit).toBe('12500.0000');
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('TransferMoneyModal', () => {
    it('allows moving money between cash and bank accounts', () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      render(
        <TransferMoneyModal
          open={true}
          onClose={onClose}
          accounts={mockAccounts}
          bankAccounts={mockBankAccounts}
          onSuccess={onSuccess}
        />
      );

      expect(screen.getByRole('heading', { name: /Move Money/i })).toBeInTheDocument();

      // Enter transfer amount
      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '5000' } });

      const transferBtn = screen.getByRole('button', { name: /Transfer Funds/i });
      fireEvent.click(transferBtn);

      expect(onSuccess).toHaveBeenCalledTimes(1);
      const payload = onSuccess.mock.calls[0]![0];
      expect(payload.journalEntry.total_debit).toBe('5000.0000');
      expect(payload.journalEntry.total_credit).toBe('5000.0000');
      expect(onClose).toHaveBeenCalled();
    });
  });
});
