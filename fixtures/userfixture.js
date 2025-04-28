const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
    const users = [
        { username: 'jcheron', email: 'jcheron@student.42lehavre.fr' },
        { username: 'cpoulain', email: 'cpoulain@student.42lehavre.fr' },
        { username: 'guphilip', email: 'guphilip@student.42lehavre.fr' },
    ];

    for (const user of users) {
        let createdUser;
        try {
            createdUser = await prisma.user.create({ data: user });
            console.log(`Inserted ${user.username}`);
        } catch (err) {
            if (err.code === 'P2002') {
                createdUser = await prisma.user.findUnique({
                    where: { email: user.email },
                });
                console.log(`Duplicate skipped: ${user.username}`);
            } else {
                console.error(`Error inserting ${user.username}:`, err);
                continue;
            }
        }

        // Vérifie s’il y a déjà des stats
        const existingStat = await prisma.stat.findUnique({
            where: { userId: createdUser.id },
        });

        if (!existingStat) {
            await prisma.stat.create({
                data: {
                    userId: createdUser.id,
                    wins: Math.floor(Math.random() * 10),
                    losses: Math.floor(Math.random() * 10),
                    streak: Math.floor(Math.random() * 5),
                },
            });
            console.log(`Stats created for ${user.username}`);
        } else {
            console.log(`Stats already exist for ${user.username}`);
        }
    }

    console.log('Seed done');
    await prisma.$disconnect();
    process.exit();
}

seed();
