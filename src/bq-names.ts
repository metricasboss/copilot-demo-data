/** Validação dos nomes que vão para a linha de comando do `bq`. Nada passa por shell, mas validamos igual. */

const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,1023}$/;
const DESTINATION = /^[A-Za-z_][A-Za-z0-9_]{0,1023}(\$\d{8})?$/;
const PROJECT = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

export function assertProject(p: string): string {
  if (!PROJECT.test(p)) throw new Error(`Projeto GCP inválido: "${p}"`);
  return p;
}

export function assertDataset(d: string): string {
  if (!IDENT.test(d)) throw new Error(`Dataset inválido: "${d}"`);
  return d;
}

/** Aceita "tabela" ou "tabela$YYYYMMDD" (decorador de partição). */
export function assertDestination(t: string): string {
  if (!DESTINATION.test(t)) throw new Error(`Tabela de destino inválida: "${t}"`);
  return t;
}
