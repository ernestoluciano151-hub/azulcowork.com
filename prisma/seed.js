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
  } else {
    await prisma.adminUser.create({
      data: { email, passwordHash, name: "Administrador" }
    });
    console.log(`Admin criado: ${email}`);
  }

  // Seed MeetingPlans (single room with plans)
  const plans = [
    { name: "Alpha", maxPeople: 24, description: "Sala climatizada para até 24 pessoas. Inclui projetor, internet de alta velocidade, impressões limitadas e ambiente profissional.", coffeeBreakAvailable: true, customPricingAllowed: false },
    { name: "Beta", maxPeople: 15, description: "Sala climatizada para até 15 pessoas. Inclui projetor, internet de alta velocidade, impressões limitadas e ambiente profissional.", coffeeBreakAvailable: true, customPricingAllowed: false },
    { name: "Gamma", maxPeople: 8, description: "Sala climatizada para até 8 pessoas. Inclui projetor, internet de alta velocidade, impressões limitadas e ambiente profissional.", coffeeBreakAvailable: true, customPricingAllowed: false },
    { name: "Easy", maxPeople: 4, description: "Sala climatizada para até 4 pessoas. Inclui projetor, internet de alta velocidade, impressões limitadas e ambiente profissional.", coffeeBreakAvailable: true, customPricingAllowed: false },
    { name: "Personalizado", maxPeople: 24, description: "Plano especial para reuniões, formações e eventos corporativos com mais de 16 horas. Valores negociáveis.", coffeeBreakAvailable: true, customPricingAllowed: true, minHoursForCustom: 16 },
  ];

  for (const plan of plans) {
    const existing = await prisma.meetingPlan.findFirst({ where: { name: plan.name } });
    if (!existing) {
      await prisma.meetingPlan.create({ data: plan });
      console.log(`Plano criado: ${plan.name}`);
    } else {
      console.log(`Plano já existe: ${plan.name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
