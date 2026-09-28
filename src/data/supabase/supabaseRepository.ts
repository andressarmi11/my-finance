/**
 * Implements the same Repository interface as LocalRepository (Phase 1),
 * but against Supabase/Postgres. RLS handles per-user filtering on reads;
 * on writes, user_id has to be set explicitly.
 */
import type { Repository } from '../repository';
import { getSupabase } from './client';
import {
  budgetFromRow, budgetToRow, categoryFromRow, categoryToRow,
  paymentMethodFromRow, paymentMethodToRow, recurringRuleFromRow, recurringRuleToRow,
  reminderFromRow, reminderToRow, settingsFromRow, settingsToRow,
  transactionFromRow, transactionToRow,
  type BudgetRow, type CategoryRow, type PaymentMethodRow, type RecurringRuleRow,
  type ReminderRow, type SettingsRow, type TransactionRow,
} from './mappers';
import type { Settings } from '@/domain/types';
import { translate } from '@/i18n/language';

async function currentUserId(): Promise<string> {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error(translate('supabase.noActiveSession'));
  return session.user.id;
}

const DEFAULT_SETTINGS_BASE: Omit<Settings, 'id' | 'defaultPaymentMethodId'> = {
  displayName: '', onboardedAt: null,
  // Empty: a row that doesn't exist can't beat the local one.
  updatedAt: '',
  currency: 'COP', locale: 'es-CO', payDays: [10, 25],
  reminderDefaultDaysBefore: 1, theme: 'system',
};

export const supabaseRepository: Repository = {
  async getSettings() {
    const [supabase, userId] = await Promise.all([getSupabase(), currentUserId()]);
    const { data, error } = await supabase.from('settings').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    if (!data) return { id: 'singleton', defaultPaymentMethodId: null, ...DEFAULT_SETTINGS_BASE };
    return settingsFromRow(data as SettingsRow);
  },
  async saveSettings(settings) {
    const [supabase, userId] = await Promise.all([getSupabase(), currentUserId()]);
    const { error } = await supabase.from('settings').upsert(settingsToRow(userId, settings));
    if (error) throw error;
  },

  async listCategories() {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('categories').select('*').order('sort_order');
    if (error) throw error;
    return (data as CategoryRow[]).map(categoryFromRow);
  },
  async saveCategory(category) {
    const [supabase, userId] = await Promise.all([getSupabase(), currentUserId()]);
    const { error } = await supabase.from('categories').upsert(categoryToRow(userId, category));
    if (error) throw error;
  },
  async deleteCategory(id) {
    const supabase = await getSupabase();
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
  },

  async listPaymentMethods() {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('payment_methods').select('*');
    if (error) throw error;
    return (data as PaymentMethodRow[]).map(paymentMethodFromRow);
  },
  async savePaymentMethod(method) {
    const [supabase, userId] = await Promise.all([getSupabase(), currentUserId()]);
    const { error } = await supabase.from('payment_methods').upsert(paymentMethodToRow(userId, method));
    if (error) throw error;
  },
  async deletePaymentMethod(id) {
    const supabase = await getSupabase();
    const { error } = await supabase.from('payment_methods').delete().eq('id', id);
    if (error) throw error;
  },

  async listTransactions(range) {
    const supabase = await getSupabase();
    let query = supabase.from('transactions').select('*');
    if (range) query = query.gte('date', range.from).lte('date', range.to);
    const { data, error } = await query;
    if (error) throw error;
    return (data as TransactionRow[]).map(transactionFromRow);
  },
  async saveTransaction(tx) {
    const [supabase, userId] = await Promise.all([getSupabase(), currentUserId()]);
    const { error } = await supabase.from('transactions').upsert(transactionToRow(userId, tx));
    if (error) throw error;
  },
  async deleteTransaction(id) {
    const supabase = await getSupabase();
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
  },

  async listRecurringRules() {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('recurring_rules').select('*');
    if (error) throw error;
    return (data as RecurringRuleRow[]).map(recurringRuleFromRow);
  },
  async saveRecurringRule(rule) {
    const [supabase, userId] = await Promise.all([getSupabase(), currentUserId()]);
    const { error } = await supabase.from('recurring_rules').upsert(recurringRuleToRow(userId, rule));
    if (error) throw error;
  },
  async deleteRecurringRule(id) {
    const supabase = await getSupabase();
    const { error } = await supabase.from('recurring_rules').delete().eq('id', id);
    if (error) throw error;
  },

  async listBudgets(year, month) {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('budgets').select('*').eq('year', year).eq('month', month);
    if (error) throw error;
    return (data as BudgetRow[]).map(budgetFromRow);
  },
  async saveBudget(budget) {
    const [supabase, userId] = await Promise.all([getSupabase(), currentUserId()]);
    const { error } = await supabase.from('budgets').upsert(budgetToRow(userId, budget));
    if (error) throw error;
  },

  async listReminders() {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('reminders').select('*');
    if (error) throw error;
    return (data as ReminderRow[]).map(reminderFromRow);
  },
  async saveReminder(reminder) {
    const [supabase, userId] = await Promise.all([getSupabase(), currentUserId()]);
    const { error } = await supabase.from('reminders').upsert(reminderToRow(userId, reminder));
    if (error) throw error;
  },

  async exportAll() {
    const supabase = await getSupabase();
    const [settings, categories, paymentMethods, transactions, recurringRules, budgetsRes, reminders] = await Promise.all([
      this.getSettings(), this.listCategories(), this.listPaymentMethods(),
      this.listTransactions(), this.listRecurringRules(),
      supabase.from('budgets').select('*'), // all of them, unfiltered by year/month (unlike listBudgets)
      this.listReminders(),
    ]);
    if (budgetsRes.error) throw budgetsRes.error;
    return {
      schemaVersion: 1, exportedAt: new Date().toISOString(),
      settings: [settings], categories, paymentMethods, transactions, recurringRules,
      budgets: (budgetsRes.data as BudgetRow[]).map(budgetFromRow), reminders,
    };
  },
  async importAll() {
    throw new Error(translate('backup.importToCloudUnsupported'));
  },
};
