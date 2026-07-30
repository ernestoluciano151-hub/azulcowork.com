#!/usr/bin/env node
/**
 * setup-pilot-admins.js — Provisionamento de Administradores do Piloto RC-1
 *
 * Cria dois utilizadores administrativos para o início do piloto controlado:
 *   1. Ernesto Luciano   — role ADMIN (papel máximo disponível na v1.0)
 *   2. Operações Azul    — role ADMIN
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  SEGURANÇA — LER ANTES DE EXECUTAR                                      │
 * │                                                                         │
 * │  • As palavras-passe são geradas aleatoriamente com crypto.randomBytes  │
 * │  • São impressas UMA ÚNICA VEZ neste terminal                           │
 * │  • NUNCA são armazenadas em ficheiros, logs ou enviadas por chat        │
 * │  • Após anotar, feche imediatamente esta janela de terminal             │
 * │  • Transmita por canal seguro: WhatsApp, Signal ou entrega pessoal      │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * USO:
 *   DATABASE_URL="postgresql://..." node scripts/setup-pilot-admins.js
 *
 *   Ou com .env:
 *   npx dotenv -e .env -- node scripts/setup-pilot-admins.js
 *
 * IDEMPOTENTE: se o utilizador já existir, é ignorado (não duplica, não altera).
 *
 * NOTA SOBRE SUPER_ADMIN:
 *   O enum AdminRole da v1.0 não possui o papel SUPER_ADMIN.
 *   O papel máximo disponível é ADMIN, que tem acesso irrestrito a todas as
 *   funcionalidades da plataforma.
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────
// Substituir os emails antes de executar em produção.
const ADMINS = [
  {
    name: 'Ernesto Luciano',
    email: 'ernesto@azulcowork.com',       // ← SUBSTITUIR pelo email real
    role: 'ADMIN',
    label: 'Product Owner / Administrador Principal',
    note: 'Solicitado como SUPER_ADMIN → mapeado para ADMIN (papel máximo em v1.0)',
  },
  {
    name: 'Operações Azul Cowork',
    email: 'operacoes@azulcowork.com',     // ← SUBSTITUIR pelo email real
    role: 'ADMIN',
    label: 'Equipa Operacional',
    note: '',
  },
];

// ─── GERAÇÃO DE PASSWORD SEGURA ───────────────────────────────────────────────
// 20 caracteres com entropia ~120 bits.
// Charset sem caracteres ambíguos (l/1, O/0, I).
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';

function generateSecurePassword() {
  const bytes = crypto.randomBytes(20);
  return Array.from(bytes)
    .map((b) => CHARSET[b % CHARSET.length])
    .join('');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const line = '─'.repeat(68);

  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║     VD Platform — Provisionamento de Administradores             ║');
  console.log('║     Piloto Controlado RC-1 · v1.0.0-rc1 · Azul Coworking        ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('\n⚠️  ATENÇÃO: As credenciais abaixo são impressas UMA ÚNICA VEZ.');
  console.log('   Copie-as imediatamente e transmita por canal seguro.\n');
  console.log(line);

  let created = 0;
  let skipped = 0;

  for (const admin of ADMINS) {
    // Verificar se já existe — idempotência
    const existing = await prisma.adminUser.findUnique({
      where: { email: admin.email },
    });

    if (existing) {
      console.log(`\n⏭  IGNORADO  ${admin.name} <${admin.email}>`);
      console.log(`   → Utilizador já existe (role: ${existing.role}, active: ${existing.active})`);
      skipped++;
      continue;
    }

    // Gerar e hashear password
    const password = generateSecurePassword();
    const passwordHash = await bcrypt.hash(password, 12);

    // Criar utilizador
    const user = await prisma.adminUser.create({
      data: {
        name: admin.name,
        email: admin.email,
        passwordHash,
        role: admin.role,
        active: true,
        totpEnabled: false, // TOTP activado pelo próprio em /admin/settings → Segurança
      },
    });

    // Imprimir credenciais uma única vez
    console.log(`\n✅ CRIADO  ${admin.name}`);
    console.log(`   Papel:       ${admin.role}  (${admin.label})`);
    if (admin.note) {
      console.log(`   Nota:        ${admin.note}`);
    }
    console.log(`   ID:          ${user.id}`);
    console.log(`   Email:       ${admin.email}`);
    console.log(`   Password:    ${password}`);
    console.log(`   TOTP:        Não activado — activar em /admin/settings após 1.º login`);
    created++;
  }

  console.log('\n' + line);

  if (created === 0 && skipped === ADMINS.length) {
    console.log('\nℹ️  Nenhum utilizador criado — todos já existem.\n');
    await prisma.$disconnect();
    return;
  }

  console.log(`\n✅ ${created} utilizador(es) criado(s) · ${skipped} ignorado(s) (já existiam)\n`);

  console.log('📋 PASSOS OBRIGATÓRIOS APÓS A CRIAÇÃO:');
  console.log('');
  console.log('   IMEDIATO (agora, neste terminal):');
  console.log('   1. Anotar / copiar as palavras-passe acima');
  console.log('   2. Transmitir por canal seguro (WhatsApp, Signal, presencial)');
  console.log('   3. Fechar este terminal');
  console.log('');
  console.log('   NO PRIMEIRO LOGIN (cada utilizador):');
  console.log('   a. Aceder a https://<domínio>/admin/login');
  console.log('   b. Entrar com email + palavra-passe recebida');
  console.log('   c. Ir a /admin/settings → Segurança → Activar TOTP 2FA');
  console.log('      (usar Google Authenticator, Authy ou equivalente)');
  console.log('   d. Alterar palavra-passe em /admin/settings → Conta');
  console.log('');
  console.log('   VALIDAÇÃO (Product Owner):');
  console.log('   e. Confirmar login com TOTP activo em ambas as contas');
  console.log('   f. Validar permissões em /admin/auditoria (eventos de login)');
  console.log('   g. Só então iniciar onboarding das empresas piloto');
  console.log('');
  console.log('⚠️  Esta janela é a ÚNICA fonte das palavras-passe.');
  console.log('   Feche-a apenas após copiar e enviar as credenciais.\n');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('\n❌ Erro durante o provisionamento:');
  console.error(`   ${err.message}`);
  if (err.code) console.error(`   Código: ${err.code}`);
  await prisma.$disconnect();
  process.exit(1);
});
