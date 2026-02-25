const bcrypt = require('bcrypt');

const passwords = [
    { role: 'Admin', password: 'Admin@123' },
    { role: 'Sales', password: 'Sales@123' },
    { role: 'Operations', password: 'Ops@1234' }
];

async function hashPasswords() {
    for (const p of passwords) {
        const hash = await bcrypt.hash(p.password, 10);
        console.log(`${p.role}: ${hash}`);
    }
}

hashPasswords();
