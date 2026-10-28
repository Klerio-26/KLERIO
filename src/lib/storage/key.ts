/** Génère une clé opaque : aucun identifiant utilisateur dans le chemin. */
export function storageKeyFor(): string {
  const now = new Date();
  return `documents/${now.getUTCFullYear()}/${crypto.randomUUID()}.bin`;
}
