/**
 * Bootstrap — inicialização única da aplicação
 *
 * Regista todos os event handlers e serviços centrais.
 * Importar no topo de qualquer API route que emita eventos,
 * ou no instrumentation.ts do Next.js (ver abaixo).
 */

import { registerEventHandlers } from "./event-handlers";
import { registerCrmEventHandlers } from "./crm-event-handlers";

let bootstrapped = false;

export function bootstrap() {
  if (bootstrapped) return;
  bootstrapped = true;
  registerEventHandlers();
  registerCrmEventHandlers();
}

// Auto-bootstrap em desenvolvimento
if (typeof window === "undefined") {
  bootstrap();
}
