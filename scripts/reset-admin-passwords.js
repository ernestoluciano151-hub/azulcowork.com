#!/usr/bin/env node
/**
 * reset-admin-passwords.js — Reset de passwords dos administradores do piloto
 *
 * Gera novas passwords para as contas existentes sem as recriar.
 *
 * ⚠️  As passwords são impressas UMA ÚNICA VEZ no terminal.
 *     Copie imediatamente e transmita por canal seguro.
 *
 * USO:
 *   DATABASE_URL="postgresql://..." node scripts/reset-admin-passwords.js
 *   ou
 *   node --env-file=.env scripts/reset-admin-passwords.js
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

const EMAILS = [
  'ernesto@azulcowork.com',
  'operacoes@azulcowork.com',
];

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';

function generateSecurePassword() {
  const bytes = crypto.randomBytes(20);
  return Array.from(bytes).map((b) => CHARSET[b % CHARSET.length]).join('');
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║     VD Platform — Reset de Passwords de Administradores         ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('\n⚠️  As credenciais abaixo são impressas UMA ÚNICA VEZ.\n');
  console.log('─'.repeat(68));

  for (const email of EMAILS) {
    const user = await prisma.adminUser.findUnique({ where: { email } });

    if (!user) {
      console.log(`\n⚠️  NÃO ENCONTRADO: ${email}`);
      continue;
    }

    const password = generateSecurePassword();
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.adminUser.update({
      where: { email },
      data: { passwordHash },
    });

    console.log(`\n✅ RESET  ${user.name} <${email}>`);
    console.log(`   Role:      ${user.role}`);
    console.log(`   Password:  ${password}`);
    console.log(`   TOTP:      ${user.totpEnabled ? 'Activo' : 'Não activo — activar em /admin/settings'}`);
  }

  console.log('\n' + '─'.repeat(68));
  console.log('\n⚠️  Feche este terminal após copiar as credenciais.\n');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('\n❌ Erro:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});
