export const shouldShowUnsavedCloseConfirm = (isDirty: boolean, isLoading: boolean) =>
  isDirty && !isLoading

/**
 * react-hook-form's `valueAsNumber` turns an emptied number input into `NaN`,
 * which then fails `z.number()` instead of clearing the field. For an
 * optional count (unlike the mandatory `invitedCount`), an empty input means
 * "no number known" - route it to `null`, not `0` or `NaN`, so the field can
 * actually be cleared.
 */
export const parseOptionalCountInput = (value: string): number | null =>
  value === '' ? null : Number(value)
