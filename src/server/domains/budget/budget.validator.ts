/**
 * Budget Domain - Validators
 *
 * Zod schemas for validating budget-related inputs.
 * These are the single source of truth for input types.
 */

import { z } from 'zod'

import { SUPPORTED_CURRENCY_CODES } from '~/lib/budget/currency'

export const MAX_BUDGET_AMOUNT = 100_000_000
export const MAX_BUDGET_DESCRIPTION_LENGTH = 200
export const MAX_BUDGET_CATEGORY_NAME_LENGTH = 100
export const MAX_BUDGET_NOTES_LENGTH = 2000

const moneySchema = z
  .number({ message: 'הסכום חייב להיות מספר' })
  .min(0, 'הסכום לא יכול להיות שלילי')
  .max(MAX_BUDGET_AMOUNT, 'הסכום גדול מדי')
  .refine((value) => Number.isFinite(value), 'הסכום חייב להיות מספר תקין')

// ─── Target budget ──────────────────────────────────────────────────────────

export const setTargetSchema = z.object({
  targetTotal: moneySchema,
})

export const currencyCodeSchema = z.enum(
  SUPPORTED_CURRENCY_CODES as [string, ...string[]],
  'מטבע לא נתמך'
)

export const setCurrencySchema = z.object({
  currency: currencyCodeSchema,
})

// ─── Categories ───────────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'שם הקטגוריה נדרש')
    .max(MAX_BUDGET_CATEGORY_NAME_LENGTH, 'השם ארוך מדי'),
  plannedAmount: moneySchema.optional(),
})

export const updateCategorySchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  name: z
    .string()
    .trim()
    .min(1, 'שם הקטגוריה נדרש')
    .max(MAX_BUDGET_CATEGORY_NAME_LENGTH, 'השם ארוך מדי')
    .optional(),
  plannedAmount: moneySchema.optional(),
})

export const deleteCategorySchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
})

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  description: z
    .string()
    .trim()
    .min(1, 'תיאור נדרש')
    .max(MAX_BUDGET_DESCRIPTION_LENGTH, 'התיאור ארוך מדי'),
  estimatedAmount: moneySchema.optional(),
  amount: moneySchema.optional(),
  isDeposit: z.boolean().optional(),
  isRefundable: z.boolean().optional(),
  refundedAt: z.coerce.date().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  paidAt: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(MAX_BUDGET_NOTES_LENGTH, 'ההערות ארוכות מדי').nullable().optional(),
})

export const updateExpenseSchema = z.object({
  expenseId: z.string().min(1, 'Expense ID is required'),
  description: z
    .string()
    .trim()
    .min(1, 'תיאור נדרש')
    .max(MAX_BUDGET_DESCRIPTION_LENGTH, 'התיאור ארוך מדי')
    .optional(),
  estimatedAmount: moneySchema.optional(),
  amount: moneySchema.optional(),
  isDeposit: z.boolean().optional(),
  isRefundable: z.boolean().optional(),
  refundedAt: z.coerce.date().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  paidAt: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(MAX_BUDGET_NOTES_LENGTH, 'ההערות ארוכות מדי').nullable().optional(),
})

export const deleteExpenseSchema = z.object({
  expenseId: z.string().min(1, 'Expense ID is required'),
})

export type SetTargetInput = z.infer<typeof setTargetSchema>
export type SetCurrencyInput = z.infer<typeof setCurrencySchema>
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
export type DeleteExpenseInput = z.infer<typeof deleteExpenseSchema>
