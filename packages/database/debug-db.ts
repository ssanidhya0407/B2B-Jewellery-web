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
    console.log('🔍 Finding latest PENDANT session...');
    const session = await prisma.$queryRaw<any[]>`
        SELECT id, selected_category, gemini_attributes, created_at 
        FROM image_sessions 
        WHERE selected_category = 'pendant'
        ORDER BY created_at DESC 
        LIMIT 1
    `;

    if (!session || session.length === 0) {
        console.error('❌ No PENDANT sessions found!');
        return;
    }

    const s = session[0];
    console.log('Session:', {
        id: s.id,
        category: s.selected_category,
        attributes: s.gemini_attributes,
        created: s.created_at
    });

    console.log('\n🔍 Checking Embedding for Session...');
    const embeddingRow = await prisma.$queryRaw<any[]>`
        SELECT embedding::text 
        FROM image_embeddings 
        WHERE image_session_id = ${s.id}::uuid
    `;

    if (!embeddingRow || embeddingRow.length === 0) {
        console.error('❌ No embedding found for this session!');
        return;
    }

    const dbVec = JSON.parse(embeddingRow[0].embedding);
    console.log(`✅ Embedding found (len: ${dbVec.length})`);

    // Verify against expected key
    const attrs = s.gemini_attributes;
    // Expected key logic from HfVisionService
    const key = `demo-${s.selected_category}-${attrs.metal_type}`;
    console.log(`🔑 Re-generating key: "${key}"`);

    const expectedVec = seededEmbedding(key);

    console.log('DB  Vec[:5]:', dbVec.slice(0, 5));
    console.log('Exp Vec[:5]:', expectedVec.slice(0, 5));

    // Check match
    const isMatch = Math.abs(dbVec[0] - expectedVec[0]) < 0.0001;
    console.log('✅ Embeddings Match:', isMatch);

    // Check internal inventory match for this key
    if (isMatch) console.log('✅ Key matches DB seed logic.');
    else console.warn('⚠️ Key MISMATCH (Runtime vs Seed logic different?)');
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
