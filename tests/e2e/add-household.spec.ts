import { expect, test } from '@playwright/test'

test('add household shows validation errors and then creates a valid household', async ({
  page,
}) => {
  await page.goto('/guest-list')
  await expect(page).toHaveURL('/guest-list')

  await page.getByRole('button', { name: 'הוספת אורח', exact: true }).click()
  const saveButton = page.getByRole('button', { name: 'שמירה וסגירה' })
  await saveButton.click()

  await expect(page.getByRole('alert')).toContainText('לא ניתן לשמור')
  await expect(page.getByText('שם פרטי נדרש')).toHaveCount(2)
  await expect(saveButton).toBeEnabled()

  const uniqueName = `בדיקת שמירה ${Date.now()}`
  await page.getByRole('textbox', { name: 'שם פרטי *' }).fill(uniqueName)

  const createResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/trpc/household.create') &&
      response.request().method() === 'POST'
  )
  await saveButton.click()

  expect((await createResponse).status()).toBe(200)
  await expect(page.getByText('המשפחה נוצרה בהצלחה!')).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(uniqueName) })).toBeVisible()
})
