import crypto from "crypto";
import { queryPg } from "@/lib/db-pg";
import { hashPassword } from "@/lib/auth";

const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateTempPassword(): string {
  while (true) {
    let result = "";
    for (let i = 0; i < 10; i++) {
      const idx = crypto.randomInt(0, CHARSET.length);
      result += CHARSET[idx];
    }
    if (/[A-Z]/.test(result) && /[a-z]/.test(result) && /[0-9]/.test(result)) {
      return result;
    }
  }
}

export async function issueTempPassword(userId: string): Promise<string> {
  const temp = generateTempPassword();
  const hashed = hashPassword(temp);
  await queryPg(
    `UPDATE users
     SET password = $1,
         must_change_password = TRUE,
         reset_token = NULL,
         reset_token_expires = NULL
     WHERE id = $2`,
    [hashed, userId]
  );
  return temp;
}
