// Cria o utilizador admin inicial a partir do .env (ADMIN_EMAIL / ADMIN_PASSWORD)
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@versaodigital.ao";
  const password = process.env.ADMIN_PASSWORD || "MudeEstaSenha123!";
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin já existe: ${email}`);
    return;
  }

  await prisma.adminUser.create({
    data: { email, passwordHash, name: "Administrador" }
  });
  console.log(`Admin criado: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
