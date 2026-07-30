/**
 * template-interpolator.ts — VOL07
 *
 * Substitui {{variavel}} pelo valor correspondente num template de texto ou HTML.
 * Funções puras, sem I/O, totalmente testáveis.
 *
 * Regras:
 *  - Delimitadores: {{ variavel }} ou {{variavel}} (espaços opcionais)
 *  - Valor ausente: substitui por string vazia (não lança erro)
 *  - Valores nulos/undefined: tratados como string vazia
 *  - Sem sanitização neste módulo — a sanitização é responsabilidade do caller
 *    para contextos HTML (usar DOMPurify ou similar no servidor)
 */

export type TemplateVars = Record<string, string | number | boolean | null | undefined>;

/**
 * Interpola variáveis num template string.
 *
 * @example
 * interpolate("Olá {{nome}}!", { nome: "Ernesto" }) // "Olá Ernesto!"
 * interpolate("Total: {{total}} Kz", { total: 5000 }) // "Total: 5000 Kz"
 * interpolate("{{ausente}} aqui", {}) // " aqui"
 */
export function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const val = vars[key];
    if (val === null || val === undefined) return "";
    return String(val);
  });
}

/**
 * Extrai a lista de variáveis presentes num template.
 *
 * @example
 * extractVariables("Olá {{nome}}, o total é {{total}}.")
 * // ["nome", "total"]
 */
export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{\s*(\w+)\s*\}\}/g) ?? [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of matches) {
    const key = m.replace(/\{\{\s*|\s*\}\}/g, "");
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

/**
 * Verifica se todas as variáveis declaradas têm valor nos vars fornecidos.
 * Retorna lista de variáveis em falta.
 *
 * @example
 * missingVariables(["nome", "total"], { nome: "Ernesto" })
 * // ["total"]
 */
export function missingVariables(
  declared: string[],
  vars: TemplateVars
): string[] {
  return declared.filter(
    (v) => vars[v] === undefined || vars[v] === null || vars[v] === ""
  );
}

/**
 * Interpola subject e htmlBody de um template de email.
 * Retorna { subject, html } prontos para envio.
 */
export function interpolateEmailTemplate(
  template: { subject: string; htmlBody: string },
  vars: TemplateVars
): { subject: string; html: string } {
  return {
    subject: interpolate(template.subject, vars),
    html:    interpolate(template.htmlBody, vars),
  };
}
