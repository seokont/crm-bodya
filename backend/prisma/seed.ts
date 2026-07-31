import {
  ClientStatus,
  ClientType,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@bodya.crm').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const managerPassword = process.env.DEMO_MANAGER_PASSWORD || 'Manager123!';
  const [adminPasswordHash, managerPasswordHash] = await Promise.all([
    hash(adminPassword, 12),
    hash(managerPassword, 12),
  ]);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Адміністратор',
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
      isActive: true,
    },
    create: {
      name: 'Адміністратор',
      email: adminEmail,
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
    },
  });

  const managers = await Promise.all([
    prisma.user.upsert({
      where: { email: 'iryna@bodya.crm' },
      update: {
        name: 'Ірина Коваль',
        role: UserRole.MANAGER,
        passwordHash: managerPasswordHash,
      },
      create: {
        name: 'Ірина Коваль',
        email: 'iryna@bodya.crm',
        role: UserRole.MANAGER,
        passwordHash: managerPasswordHash,
      },
    }),
    prisma.user.upsert({
      where: { email: 'maksym@bodya.crm' },
      update: {
        name: 'Максим Бондар',
        role: UserRole.MANAGER,
        passwordHash: managerPasswordHash,
      },
      create: {
        name: 'Максим Бондар',
        email: 'maksym@bodya.crm',
        role: UserRole.MANAGER,
        passwordHash: managerPasswordHash,
      },
    }),
    prisma.user.upsert({
      where: { email: 'olena@bodya.crm' },
      update: {
        name: 'Олена Мельник',
        role: UserRole.MANAGER,
        passwordHash: managerPasswordHash,
      },
      create: {
        name: 'Олена Мельник',
        email: 'olena@bodya.crm',
        role: UserRole.MANAGER,
        passwordHash: managerPasswordHash,
      },
    }),
  ]);

  await prisma.$transaction([
    prisma.client.updateMany({
      where: { contactName: 'Александр Шевченко' },
      data: {
        contactName: 'Олександр Шевченко',
        city: 'Київ',
        address: 'вул. Велика Васильківська, 72',
        comment: 'Шукають рішення для відділу продажів із 15 осіб.',
      },
    }),
    prisma.client.updateMany({
      where: { contactName: 'Дмитрий Левченко' },
      data: {
        contactName: 'Дмитро Левченко',
        city: 'Одеса',
        source: 'Рекомендація',
      },
    }),
    prisma.client.updateMany({
      where: { contactName: 'Мария Кравченко' },
      data: { contactName: 'Марія Кравченко', city: 'Дніпро' },
    }),
    prisma.client.updateMany({
      where: { contactName: 'Виктория Гончар' },
      data: { contactName: 'Вікторія Гончар', city: 'Київ' },
    }),
    prisma.client.updateMany({
      where: { city: 'Львов' },
      data: { city: 'Львів' },
    }),
    prisma.client.updateMany({
      where: { city: 'Киев' },
      data: { city: 'Київ' },
    }),
    prisma.client.updateMany({
      where: { city: 'Одесса' },
      data: { city: 'Одеса' },
    }),
    prisma.client.updateMany({
      where: { city: 'Днепр' },
      data: { city: 'Дніпро' },
    }),
    prisma.client.updateMany({
      where: { city: 'Харьков' },
      data: { city: 'Харків' },
    }),
    prisma.client.updateMany({
      where: { source: 'Рекомендация' },
      data: { source: 'Рекомендація' },
    }),
    prisma.client.updateMany({
      where: { comment: 'Проверка PATCH' },
      data: { comment: 'Перевірка PATCH' },
    }),
  ]);

  if ((await prisma.client.count()) > 0) return;

  await prisma.client.createMany({
    data: [
      {
        type: ClientType.COMPANY,
        companyName: 'ТОВ «Nova Retail»',
        contactName: 'Олександр Шевченко',
        phone: '+380 67 482 19 24',
        email: 'hello@novaretail.ua',
        edrpou: '41234567',
        city: 'Київ',
        address: 'вул. Велика Васильківська, 72',
        status: ClientStatus.INTERESTED,
        source: 'Google',
        managerId: managers[0].id,
        creatorId: managers[0].id,
        creatorName: managers[0].name,
        comment: 'Шукають рішення для відділу продажів із 15 осіб.',
      },
      {
        type: ClientType.FOP,
        companyName: 'ФОП Дорошенко',
        contactName: 'Анна Дорошенко',
        phone: '+380 93 107 33 41',
        email: 'anna@doro.studio',
        edrpou: '3012345678',
        city: 'Львів',
        status: ClientStatus.FUTURE_PROSPECT,
        source: 'Instagram',
        managerId: managers[1].id,
        creatorId: managers[1].id,
        creatorName: managers[1].name,
      },
      {
        type: ClientType.COMPANY,
        companyName: 'Green Wave Logistics',
        contactName: 'Дмитро Левченко',
        phone: '+380 50 770 18 04',
        email: 'office@greenwave.ua',
        edrpou: '39876543',
        city: 'Одеса',
        status: ClientStatus.INTERESTED,
        source: 'Рекомендація',
        managerId: managers[0].id,
        creatorId: managers[0].id,
        creatorName: managers[0].name,
      },
      {
        type: ClientType.PERSON,
        contactName: 'Марія Кравченко',
        phone: '+380 66 321 85 72',
        email: 'maria.kravchenko@gmail.com',
        city: 'Дніпро',
        status: ClientStatus.NEW,
        source: 'Сайт',
        managerId: managers[2].id,
        creatorId: managers[2].id,
        creatorName: managers[2].name,
      },
      {
        type: ClientType.COMPANY,
        companyName: 'Bright Education',
        contactName: 'Вікторія Гончар',
        phone: '+380 98 440 06 15',
        email: 'team@bright.education',
        edrpou: '44556677',
        city: 'Київ',
        status: ClientStatus.CALL_LATER,
        source: 'LinkedIn',
        managerId: managers[2].id,
        creatorId: managers[2].id,
        creatorName: managers[2].name,
      },
      {
        type: ClientType.COMPANY,
        companyName: 'Artisan Coffee Lab',
        contactName: 'Роман Остапенко',
        phone: '+380 63 921 47 09',
        email: 'roman@artisan.coffee',
        edrpou: '43322110',
        city: 'Харків',
        status: ClientStatus.INTERESTED,
        source: 'Партнер',
        managerId: managers[1].id,
        creatorId: managers[1].id,
        creatorName: managers[1].name,
      },
    ],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
