const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
    const users = [
        { username: 'jcheron', email: 'jcheron@student.42lehavre.fr' },
        { username: 'cpoulain', email: 'cpoulain@student.42lehavre.fr' },
        { username: 'guphilip', email: 'guphilip@student.42lehavre.fr' },
    ];

    const createdUsers = [];

    for (const user of users) {
        let createdUser;
        try {
            createdUser = await prisma.user.create({
                data: {
                    ...user,
                    authMethod: 'LOCAL', // obligatoire avec ton schéma
                },
            });
            console.log(`✅ Inserted ${user.username}`);
        } catch (err) {
            if (err.code === 'P2002') {
                createdUser = await prisma.user.findUnique({
                    where: { email: user.email },
                });
                console.log(`⚠️ Duplicate skipped: ${user.username}`);
            } else {
                console.error(`❌ Error inserting ${user.username}:`, err);
                continue;
            }
        }

        createdUsers.push(createdUser);

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
            console.log(`📊 Stats created for ${user.username}`);
        } else {
            console.log(`📌 Stats already exist for ${user.username}`);
        }
    }

    // Génération de matchs aléatoires entre utilisateurs
    if (createdUsers.length >= 2) {
        for (let i = 0; i < createdUsers.length; i++) {
            for (let j = i + 1; j < createdUsers.length; j++) {
                const player1 = createdUsers[i];
                const player2 = createdUsers[j];

                await prisma.match.create({
                    data: {
                        player1Id: player1.id,
                        player2Id: player2.id,
                        player1Score: Math.floor(Math.random() * 10),
                        player2Score: Math.floor(Math.random() * 10),
                        status: 'DONE', // ou 'PENDING', 'LOSE'
                        playedAt: new Date(),
                    },
                });

                console.log(`🏓 Match created between ${player1.username} and ${player2.username}`);
            }
        }
    }

    console.log('✅ Seed completed.');
    await prisma.$disconnect();
    process.exit();
}

seed();
