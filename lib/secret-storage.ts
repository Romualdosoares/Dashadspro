type RpcResult = { data: unknown; error: { message?: string } | null };
type RpcClient = {
  rpc(name: string, args: Record<string, string>): PromiseLike<RpcResult>;
};

function requireKey(key: string | undefined): string {
  if (!key?.trim()) throw new Error("Chave de criptografia nao configurada");
  return key;
}

export async function encryptSecret(
  client: RpcClient,
  plaintext: string,
  key = process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY,
): Promise<string> {
  const safeKey = requireKey(key);
  const { data, error } = await client.rpc("encrypt_token", { token: plaintext, key: safeKey });
  if (error) throw new Error(`Nao foi possivel criptografar o segredo: ${error.message ?? "erro RPC"}`);
  if (typeof data !== "string" || !data || data === plaintext) {
    throw new Error("Resultado de criptografia invalido");
  }
  return data;
}

export async function decryptSecret(
  client: RpcClient,
  ciphertext: string,
  key = process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY,
): Promise<string> {
  const safeKey = requireKey(key);
  const { data, error } = await client.rpc("decrypt_token", {
    encrypted_token: ciphertext,
    key: safeKey,
  });
  if (error || typeof data !== "string" || !data) {
    throw new Error(`Nao foi possivel descriptografar o segredo: ${error?.message ?? "resposta invalida"}`);
  }
  return data;
}
