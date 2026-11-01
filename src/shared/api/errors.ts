import { ApiError } from "./http";

const MESSAGES: Record<string, string> = {
  invalid_credentials: "שם המשתמש או הסיסמה שגויים",
  sso_failed: "ההתחברות האוטומטית לא הצליחה. נסו שוב או התחברו עם שם משתמש וסיסמה.",
  sso_unavailable: "התחברות אוטומטית כבויה בסביבה הזו. התחברו עם שם משתמש וסיסמה.",
  invalid_range: "תאריך הסיום צריך להיות אחרי תאריך ההתחלה.",
  range_outside_data: "אין נתוני שימוש בטווח שנבחר.",
  file_too_large: "הקובץ גדול מדי.",
  visibility_text_outdated: "נוסח האישור עודכן. רעננו את הדף ואשרו שוב.",
  forbidden: "אין לכם הרשאה לפעולה הזו.",
  not_found: "לא מצאנו את מה שחיפשתם.",
};

export const GENERIC_ERROR = "משהו השתבש. נסו שוב";

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return "יותר מדי ניסיונות. נסו שוב בעוד דקה.";
    if (error.status === 413) return MESSAGES.file_too_large ?? GENERIC_ERROR; // refused by the gateway before the service sees it
    return MESSAGES[error.code] ?? GENERIC_ERROR;
  }
  return GENERIC_ERROR;
}

export const isStatus = (error: unknown, status: number): boolean => error instanceof ApiError && error.status === status;

export const messageFor = (code: string): string => MESSAGES[code] ?? GENERIC_ERROR;
