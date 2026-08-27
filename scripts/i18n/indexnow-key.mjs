/**
 * IndexNow ownership verification key for www.11tik.com.
 * Served as a root plain-text Static Asset only (no HTML/JSON wrapping).
 */
export const INDEXNOW_KEY = "r1nu3dmfdwyzm6u39zktu5gtww7zvv1z";

export const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;

/** Exact response body — key only, no trailing newline or markup. */
export function indexNowKeyBody() {
  return INDEXNOW_KEY;
}

export function indexNowKeyFilename() {
  return `${INDEXNOW_KEY}.txt`;
}
