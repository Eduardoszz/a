import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Criptografia AES-256-GCM usada para chaves de API e anotações dos pacientes.
// Formato salvo no banco: "v1:<iv>:<tag>:<conteúdo>" (tudo em base64).

function key(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("ENCRYPTION_KEY não definida nas variáveis de ambiente");
  // Deriva sempre 32 bytes, qualquer que seja o tamanho do texto da chave
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(":");
}

export function decrypt(payload: string): string {
  const [version, iv, tag, data] = payload.split(":");
  if (version !== "v1") throw new Error("Formato de dado criptografado desconhecido");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
