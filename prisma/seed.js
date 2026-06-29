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

  // Seed default meeting rooms
  const defaultRooms = [
    { name: "Sala Alpha", capacity: 8, description: "Sala de reuniões principal" },
    { name: "Sala Beta", capacity: 15, description: "Sala de conferências" },
    { name: "Sala Gamma", capacity: 4, description: "Sala de pequenas reuniões" }
  ];

  for (const room of defaultRooms) {
    const existingRoom = await prisma.meetingRoom.findFirst({ where: { name: room.name } });
    if (!existingRoom) {
      await prisma.meetingRoom.create({ data: room });
      console.log(`Sala criada: ${room.name}`);
    } else {
      console.log(`Sala já existe: ${room.name}`);
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
