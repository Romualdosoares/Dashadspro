import { describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret } from "../lib/secret-storage";

describe("secret storage", () => {
  it("returns encrypted data only when RPC succeeds", async () => {
    const rpc = vi.fn(async () => ({ data: "ciphertext", error: null }));
    await expect(encryptSecret({ rpc }, "plaintext", "key")).resolves.toBe("ciphertext");
  });

  it("fails closed when encryption RPC fails", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "missing function" } }));
    await expect(encryptSecret({ rpc }, "plaintext", "key")).rejects.toThrow("criptografar");
  });

  it("never accepts plaintext as an encryption result", async () => {
    const rpc = vi.fn(async () => ({ data: "plaintext", error: null }));
    await expect(encryptSecret({ rpc }, "plaintext", "key")).rejects.toThrow("invalido");
  });

  it("fails closed when decryption fails", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "wrong key" } }));
    await expect(decryptSecret({ rpc }, "ciphertext", "key")).rejects.toThrow("descriptografar");
  });

  it("requires the encryption key", async () => {
    const rpc = vi.fn();
    await expect(encryptSecret({ rpc }, "plaintext", "")).rejects.toThrow("nao configurada");
  });
});
