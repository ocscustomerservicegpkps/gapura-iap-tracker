import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { google } from "googleapis";

loadEnvConfig(process.cwd());

const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim();
const isPlaceholder = (value: string | undefined) =>
  !value || /^(ISI_|your_|change_me|xxx)/i.test(value);

if (isPlaceholder(clientId) || isPlaceholder(clientSecret)) {
  console.error(
    "Ganti placeholder GOOGLE_DRIVE_OAUTH_CLIENT_ID dan GOOGLE_DRIVE_OAUTH_CLIENT_SECRET di .env.local dengan kredensial OAuth Desktop app yang asli.",
  );
  process.exitCode = 1;
} else {
  const port = 53682;
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
  const oauth = new google.auth.OAuth2(clientId!, clientSecret!, redirectUri);
  const state = randomUUID();
  const url = oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive"],
    state,
  });

  const server = createServer(async (request, response) => {
    try {
      const incoming = new URL(request.url ?? "/", redirectUri);
      if (incoming.pathname !== "/oauth2callback") {
        response.writeHead(404).end("Not found");
        return;
      }
      if (incoming.searchParams.get("state") !== state) {
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        response.end(
          "Callback ini berasal dari proses otorisasi lama. Gunakan URL terbaru yang tercetak di terminal.",
        );
        return;
      }
      const code = incoming.searchParams.get("code");
      if (!code) {
        throw new Error(incoming.searchParams.get("error") ?? "Kode OAuth tidak diterima.");
      }

      const { tokens } = await oauth.getToken(code);
      if (!tokens.refresh_token) {
        throw new Error(
          "Google tidak mengembalikan refresh token. Cabut akses aplikasi lalu jalankan otorisasi lagi.",
        );
      }

      await saveRefreshToken(tokens.refresh_token);
      console.log("\nRefresh token berhasil disimpan otomatis ke .env.local.");
      console.log("Restart aplikasi agar credential baru digunakan.");
      response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Otorisasi berhasil dan refresh token sudah disimpan ke .env.local.");
      server.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Otorisasi gagal: ${message}`);
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(`Otorisasi gagal: ${message}`);
      process.exitCode = 1;
      server.close();
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log("Buka URL ini dan login sebagai pemilik folder Evidence IAP:\n");
    console.log(url);
    console.log(`\nMenunggu callback di ${redirectUri}`);
  });
}

async function saveRefreshToken(refreshToken: string): Promise<void> {
  const envPath = join(process.cwd(), ".env.local");
  const current = await readFile(envPath, "utf8").catch(() => "");
  const line = `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN=${refreshToken}`;
  const pattern = /^GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN=.*$/m;
  const next = pattern.test(current)
    ? current.replace(pattern, line)
    : `${current.trimEnd()}${current.trim() ? "\n" : ""}${line}\n`;
  await writeFile(envPath, next, "utf8");
}
