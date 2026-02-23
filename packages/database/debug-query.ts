import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function seededEmbedding(seed: string): number[] {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    const vec: number[] = [];
    for (let i = 0; i < 512; i++) {
        hash = (hash * 1103515245 + 12345) & 0x7fffffff;
        vec.push((hash / 0x7fffffff) * 2 - 1);
    }
    return vec;
}

async function main() {
    const category = 'pendant';
    const key = `demo-${category}-gold`;
    console.log(`🔑 Key: ${key}`);
    const embedding = seededEmbedding(key);
    const vectorString = `[${embedding.join(',')}]`;

    console.log('🔍 Executing query...');
    const results = await prisma.$queryRawUnsafe<any[]>(
        `
      SELECT 
        id,
        name,
        category,
        1 - (embedding <=> $1::vector) as similarity
      FROM inventory_skus
      WHERE embedding IS NOT NULL
        AND is_active = true
        AND (
          $4::text IS NULL
          OR category = $4
          OR ($4 = 'earring' AND category = 'earrings')
          OR ($4 = 'bangle' AND category = 'bangles')
        )
      ORDER BY embedding <=> $1::vector
      LIMIT 5
      `,
        vectorString, // $1
        0.3,          // $2 param in original query (similarity threshold not used in SELECT order but in WHERE)
        5,            // $3 LIMIT
        category      // $4 category
    );

    console.log(`Found ${results.length} matches.`);
    results.forEach(r => console.log(`  - ${r.name} (${r.similarity})`));
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
