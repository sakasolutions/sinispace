import { PrismaClient } from '@prisma/client';

// Dies stellt sicher, dass wir nicht bei jeder Code-Änderung in der Entwicklung
// eine neue Datenbankverbindung erstellen.
declare global {
  var prisma: PrismaClient | undefined;
}

// Wir erstellen den Client und übergeben die URL EXPLIZIT.
// Das entfernt jegliche Magie oder Unsicherheit.
const prisma = global.prisma || new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export { prisma };
