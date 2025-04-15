const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
    const users = [
        { username: 'jcheron', email: 'jcheron@student.42lehavre.fr' },
        { username: 'cpoulain', email: 'cpoulain@student.42lehavre.fr' },
        { username: 'guphilip', email: 'guphilip@student.42lehavre.fr' },
    ];

    for (const user of users) {
        try {
            await prisma.user.create({ data: user });
            console.log(`Inserted ${user.username}`);
        } catch (err) {
            if (err.code === 'P2002') {
                console.log(`Duplicate skipped: ${user.username}`);
            } else {
                console.error(`Error inserting ${user.username}:`, err);
            }
        }
    }

    console.log('Seed done');
    process.exit();
}

seed();
