import type { AuthUIProviderProps } from '@daveyplate/better-auth-ui'

export const authHebrewLocalization: AuthUIProviderProps['localization'] = {
  SIGN_IN: 'התחברות',
  SIGN_IN_ACTION: 'התחברות',
  SIGN_IN_DESCRIPTION: 'הזינו את הדוא"ל שלכם כדי להתחבר לחשבון',
  SIGN_IN_WITH: 'התחברות עם',
  SIGN_OUT: 'התנתקות',

  SIGN_UP: 'הרשמה',
  SIGN_UP_ACTION: 'יצירת חשבון',
  SIGN_UP_DESCRIPTION: 'הזינו את הפרטים שלכם כדי ליצור חשבון',
  SIGN_UP_EMAIL: 'בדקו את הדוא"ל שלכם לקבלת קישור האימות.',

  EMAIL: 'דוא"ל',
  EMAIL_DESCRIPTION: 'הזינו את כתובת הדוא"ל שבה תרצו להתחבר.',
  EMAIL_INSTRUCTIONS: 'הזינו כתובת דוא"ל תקינה.',
  EMAIL_REQUIRED: 'כתובת הדוא"ל נדרשת',
  EMAIL_IS_THE_SAME: 'כתובת הדוא"ל זהה לכתובת הקיימת',

  PASSWORD: 'סיסמה',
  PASSWORD_PLACEHOLDER: 'סיסמה',
  PASSWORD_REQUIRED: 'הסיסמה נדרשת',
  PASSWORDS_DO_NOT_MATCH: 'הסיסמאות אינן תואמות',

  CONFIRM_PASSWORD: 'אימות סיסמה',
  CONFIRM_PASSWORD_PLACEHOLDER: 'אימות סיסמה',
  CONFIRM_PASSWORD_REQUIRED: 'אימות הסיסמה נדרש',

  NEW_PASSWORD: 'סיסמה חדשה',
  NEW_PASSWORD_PLACEHOLDER: 'סיסמה חדשה',
  NEW_PASSWORD_REQUIRED: 'נדרשת סיסמה חדשה',

  FORGOT_PASSWORD: 'שחזור סיסמה',
  FORGOT_PASSWORD_ACTION: 'שליחת קישור לאיפוס',
  FORGOT_PASSWORD_DESCRIPTION: 'הזינו את הדוא"ל שלכם לאיפוס הסיסמה',
  FORGOT_PASSWORD_EMAIL: 'בדקו את הדוא"ל שלכם לקבלת קישור לאיפוס הסיסמה.',
  FORGOT_PASSWORD_LINK: 'שכחתם סיסמה?',

  RESET_PASSWORD: 'איפוס סיסמה',
  RESET_PASSWORD_ACTION: 'שמירת הסיסמה החדשה',
  RESET_PASSWORD_DESCRIPTION: 'הזינו את הסיסמה החדשה שלכם למטה',
  RESET_PASSWORD_SUCCESS: 'הסיסמה אופסה בהצלחה',

  EMAIL_OTP: 'קוד בדוא"ל',
  EMAIL_OTP_SEND_ACTION: 'שליחת קוד',
  EMAIL_OTP_VERIFY_ACTION: 'אימות קוד',
  EMAIL_OTP_DESCRIPTION: 'הזינו את הדוא"ל שלכם לקבלת קוד',
  EMAIL_OTP_VERIFICATION_SENT: 'בדקו את הדוא"ל שלכם לקבלת קוד האימות.',

  OR_CONTINUE_WITH: 'או המשיכו עם',

  ALREADY_HAVE_AN_ACCOUNT: 'יש לכם כבר חשבון?',
  DONT_HAVE_AN_ACCOUNT: 'אין לכם חשבון?',

  NAME: 'שם',
  NAME_PLACEHOLDER: 'שם',
  NAME_DESCRIPTION: 'הזינו את שמכם המלא, או שם תצוגה.',
  NAME_INSTRUCTIONS: 'השתמשו בעד 32 תווים.',

  REMEMBER_ME: 'זכרו אותי',
  GO_BACK: 'חזרה',

  VERIFY_YOUR_EMAIL: 'אימות הדוא"ל שלכם',
  VERIFY_YOUR_EMAIL_DESCRIPTION:
    'אנא אמתו את כתובת הדוא"ל שלכם. בדקו את תיבת הדואר הנכנס שלכם למייל האימות. אם לא קיבלתם את המייל, לחצו על הכפתור למטה לשליחה חוזרת.',
  EMAIL_VERIFICATION: 'אימות דוא"ל',
  EMAIL_VERIFICATION_DESCRIPTION: 'בדקו את הדוא"ל שלכם לקבלת קוד האימות כדי להשלים את ההרשמה.',
  EMAIL_VERIFICATION_SUCCESS: 'אימות הדוא"ל הושלם בהצלחה.',
  RESEND_VERIFICATION_EMAIL: 'שליחה חוזרת של מייל האימות',

  SESSION_NOT_FRESH: 'ההתחברות שלכם אינה עדכנית. אנא התחברו מחדש.',
  REQUEST_FAILED: 'הבקשה נכשלה',

  ACCEPT_INVITATION: 'אישור ההזמנה',
  ACCEPT_INVITATION_DESCRIPTION: 'הוזמנתם להצטרף לארגון.',
  INVITATION_ACCEPTED: 'ההזמנה אושרה בהצלחה',
  INVITATION_REJECTED: 'ההזמנה נדחתה בהצלחה',
  ACCEPT: 'אישור',
  REJECT: 'דחייה',
  INVITATION_EXPIRED: 'תוקף ההזמנה פג',
  INVITATION_NOT_FOUND: 'ההזמנה לא נמצאה',
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: 'אינכם הנמען של ההזמנה הזו',
  FAILED_TO_RETRIEVE_INVITATION: 'שגיאה באחזור ההזמנה',

  IS_REQUIRED: 'נדרש',
  IS_INVALID: 'אינו תקין',
  IS_THE_SAME: 'זהה לקודם',

  USER_NOT_FOUND: 'המשתמש לא נמצא',
  FAILED_TO_CREATE_USER: 'יצירת המשתמש נכשלה',
  FAILED_TO_CREATE_SESSION: 'יצירת ההתחברות נכשלה',
  FAILED_TO_UPDATE_USER: 'עדכון המשתמש נכשל',
  FAILED_TO_GET_SESSION: 'אחזור ההתחברות נכשל',
  INVALID_PASSWORD: 'סיסמה שגויה',
  INVALID_EMAIL: 'כתובת דוא"ל שגויה',
  INVALID_EMAIL_OR_PASSWORD: 'כתובת דוא"ל או סיסמה שגויים',
  SOCIAL_ACCOUNT_ALREADY_LINKED: 'חשבון הרשת החברתית מקושר כבר',
  PROVIDER_NOT_FOUND: 'הספק לא נמצא',
  INVALID_TOKEN: 'אסימון לא תקין',
  FAILED_TO_GET_USER_INFO: 'אחזור פרטי המשתמש נכשל',
  USER_EMAIL_NOT_FOUND: 'כתובת הדוא"ל של המשתמש לא נמצאה',
  EMAIL_NOT_VERIFIED: 'הדוא"ל לא אומת',
  PASSWORD_TOO_SHORT: 'הסיסמה קצרה מהנדרש',
  PASSWORD_TOO_LONG: 'הסיסמה ארוכה מהמותר',
  USER_ALREADY_EXISTS: 'המשתמש קיים כבר',
  EMAIL_CAN_NOT_BE_UPDATED: 'לא ניתן לעדכן את הדוא"ל',
  CREDENTIAL_ACCOUNT_NOT_FOUND: 'חשבון הכניסה לא נמצא',
  SESSION_EXPIRED: 'ההתחברות פגה. התחברו מחדש כדי לבצע פעולה זו.',
  ACCOUNT_NOT_FOUND: 'החשבון לא נמצא',

  OTP_EXPIRED: 'תוקף הקוד פג',
  INVALID_OTP: 'קוד שגוי',
  TOO_MANY_ATTEMPTS: 'יותר מדי ניסיונות',
}
