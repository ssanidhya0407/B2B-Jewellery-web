/**
 * seed-demo.ts — Populate manufacturers, inventory_skus and manufacturer_catalog with demo data.
 *
 * Run:  npx tsx prisma/seed-demo.ts
 * (from the packages/database directory)
 *
 * Product sources:
 *   1. Inventory (InventorySku)         → Our own products
 *   2. Manufacturer (ManufacturerCatalog, source='manufacturer') → Products from manufacturer profiles
 *   3. Alibaba (ManufacturerCatalog, source='alibaba')           → Products sourced from Alibaba
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/* ───────────────────────────────────────────
 * Helper: generate a deterministic 512-dim embedding.
 * We use a simple seeded-random so that identical categories
 * cluster together, making demo similarity searches return
 * category-relevant results.
 * ─────────────────────────────────────────── */
function seededEmbedding(seed: string): number[] {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    const vec: number[] = [];
    for (let i = 0; i < 512; i++) {
        hash = (hash * 1103515245 + 12345) & 0x7fffffff;
        vec.push((hash / 0x7fffffff) * 2 - 1); // range [-1, 1]
    }
    return vec;
}

/* ─── MANUFACTURER PROFILES ─── */
const manufacturers = [
    {
        key: 'rajesh-jewels',
        companyName: 'Rajesh Jewels Pvt. Ltd.',
        contactPerson: 'Rajesh Mehta',
        email: 'rajesh@rajeshjewels.com',
        phone: '+91 98765 43210',
        address: '45/A, Zaveri Bazaar, Kalbadevi Road',
        city: 'Mumbai',
        country: 'India',
        website: 'https://rajeshjewels.com',
        description: 'Established gold and diamond jewellery manufacturer based in Mumbai with 25+ years of experience. Specializes in traditional Indian designs and bridal collections.',
        categories: ['ring', 'necklace', 'earring', 'bangle'],
        specializations: ['bridal', 'traditional', 'temple jewellery', 'kundan'],
        qualityTier: 'premium',
        minOrderValue: 5000,
        avgLeadTimeDays: 21,
        isVerified: true,
    },
    {
        key: 'golden-craft',
        companyName: 'Golden Craft International',
        contactPerson: 'Amit Sharma',
        email: 'sales@goldencraft.in',
        phone: '+91 97654 32109',
        address: '12, SEEPZ, Andheri East',
        city: 'Mumbai',
        country: 'India',
        website: 'https://goldencraft.in',
        description: 'Export-oriented jewellery manufacturer specializing in modern and contemporary designs. ISO 9001 certified with state-of-the-art CAD/CAM facility.',
        categories: ['ring', 'pendant', 'bracelet', 'earring'],
        specializations: ['modern', 'minimalist', 'CAD designs', 'custom orders'],
        qualityTier: 'premium',
        minOrderValue: 3000,
        avgLeadTimeDays: 14,
        isVerified: true,
    },
    {
        key: 'siam-gems',
        companyName: 'Siam Gems & Jewellery Co.',
        contactPerson: 'Preecha Tangkawattana',
        email: 'info@siamgems.co.th',
        phone: '+66 2 234 5678',
        address: '789 Silom Road, Bangrak',
        city: 'Bangkok',
        country: 'Thailand',
        website: 'https://siamgems.co.th',
        description: 'Thai gemstone specialist and jewellery manufacturer. Known for coloured gemstone sourcing and precision stone setting. Ruby and sapphire expertise.',
        categories: ['ring', 'necklace', 'earring', 'pendant'],
        specializations: ['gemstone sourcing', 'stone setting', 'ruby', 'sapphire', 'coloured gems'],
        qualityTier: 'luxury',
        minOrderValue: 10000,
        avgLeadTimeDays: 28,
        isVerified: true,
    },
    {
        key: 'silver-line',
        companyName: 'Silver Line Creations',
        contactPerson: 'Priya Patel',
        email: 'orders@silverlinecreations.com',
        phone: '+91 94567 89012',
        address: '23, Silver Hub, Mahidharpura',
        city: 'Surat',
        country: 'India',
        website: 'https://silverlinecreations.com',
        description: 'Budget-friendly silver jewellery manufacturer. High-volume production with quick turnaround. Ideal for everyday and fashion jewellery lines.',
        categories: ['ring', 'bracelet', 'bangle', 'earring', 'other'],
        specializations: ['silver jewellery', 'fashion jewellery', 'bulk orders', 'CZ setting'],
        qualityTier: 'standard',
        minOrderValue: 500,
        avgLeadTimeDays: 10,
        isVerified: false,
    },
];

/* ─── INVENTORY SKUs (internal stock) ─── */
const inventoryItems = [
    // ═══════════════ RINGS ═══════════════
    { skuCode: 'INV-RNG-001', name: 'Classic Solitaire Diamond Ring', description: 'Timeless solitaire diamond ring in 18kt yellow gold with a brilliant-cut centre stone.', category: 'ring', primaryMetal: 'gold', stoneTypes: ['diamond'], stonePresence: 'prominent', primaryShape: 'round', style: 'modern', complexity: 'moderate', baseCost: 850, moq: 5, leadTimeDays: 7, imageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600' },
    { skuCode: 'INV-RNG-002', name: 'Vintage Rose Gold Band', description: 'Intricately engraved rose gold band with milgrain edge detailing.', category: 'ring', primaryMetal: 'rose_gold', stoneTypes: [], stonePresence: 'none', primaryShape: 'round', style: 'vintage', complexity: 'intricate', baseCost: 420, moq: 10, leadTimeDays: 5, imageUrl: 'https://images.unsplash.com/photo-1603561596112-0a132b757442?w=600' },
    { skuCode: 'INV-RNG-003', name: 'Emerald Halo Engagement Ring', description: 'Stunning emerald centre stone surrounded by a halo of micro-pavé diamonds.', category: 'ring', primaryMetal: 'gold', stoneTypes: ['emerald', 'diamond'], stonePresence: 'prominent', primaryShape: 'cushion', style: 'statement', complexity: 'intricate', baseCost: 1200, moq: 3, leadTimeDays: 10, imageUrl: 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=600' },
    { skuCode: 'INV-RNG-004', name: 'Platinum Eternity Band', description: 'Full eternity band with round brilliant diamonds channel-set in platinum.', category: 'ring', primaryMetal: 'platinum', stoneTypes: ['diamond'], stonePresence: 'prominent', primaryShape: 'round', style: 'modern', complexity: 'moderate', baseCost: 1800, moq: 3, leadTimeDays: 12, imageUrl: 'https://images.unsplash.com/photo-1589674781759-c21c37956a44?w=600' },
    { skuCode: 'INV-RNG-005', name: 'Minimalist Thin Gold Stack Ring', description: 'Ultra-thin 14kt gold stacking ring with a hammered texture.', category: 'ring', primaryMetal: 'gold', stoneTypes: [], stonePresence: 'none', primaryShape: 'round', style: 'minimalist', complexity: 'simple', baseCost: 120, moq: 20, leadTimeDays: 3, imageUrl: 'https://images.unsplash.com/photo-1543294001-f7cd5d7fb516?w=600' },
    { skuCode: 'INV-RNG-006', name: 'Sapphire Three-Stone Ring', description: 'Ceylon sapphire flanked by two trillion-cut diamonds in white gold.', category: 'ring', primaryMetal: 'gold', stoneTypes: ['sapphire', 'diamond'], stonePresence: 'prominent', primaryShape: 'oval', style: 'modern', complexity: 'intricate', baseCost: 1450, moq: 2, leadTimeDays: 14, imageUrl: 'https://images.unsplash.com/photo-1600721391689-2564bb8055de?w=600' },
    { skuCode: 'INV-RNG-007', name: 'Ruby Cluster Cocktail Ring', description: 'Bold cocktail ring with clustered rubies in a floral pattern set in 18kt gold.', category: 'ring', primaryMetal: 'gold', stoneTypes: ['ruby'], stonePresence: 'prominent', primaryShape: 'cluster', style: 'statement', complexity: 'intricate', baseCost: 980, moq: 3, leadTimeDays: 10, imageUrl: 'https://images.unsplash.com/photo-1608042314453-ae338d80c427?w=600' },
    { skuCode: 'INV-RNG-008', name: 'Silver Celtic Knot Ring', description: 'Sterling silver ring with traditional Celtic knot pattern, oxidised finish.', category: 'ring', primaryMetal: 'silver', stoneTypes: [], stonePresence: 'none', primaryShape: 'round', style: 'ethnic', complexity: 'intricate', baseCost: 85, moq: 25, leadTimeDays: 5, imageUrl: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600' },

    // ═══════════════ NECKLACES ═══════════════
    { skuCode: 'INV-NCK-001', name: 'Layered Gold Chain Necklace', description: 'Multi-layer 22kt gold chain necklace in a contemporary design.', category: 'necklace', primaryMetal: 'gold', stoneTypes: [], stonePresence: 'none', primaryShape: 'chain', style: 'modern', complexity: 'moderate', baseCost: 650, moq: 5, leadTimeDays: 7, imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600' },
    { skuCode: 'INV-NCK-002', name: 'Pearl Strand Classic Necklace', description: 'Elegant freshwater pearl strand with an 18kt gold clasp.', category: 'necklace', primaryMetal: 'gold', stoneTypes: ['pearl'], stonePresence: 'prominent', primaryShape: 'strand', style: 'vintage', complexity: 'simple', baseCost: 380, moq: 10, leadTimeDays: 5, imageUrl: 'https://images.unsplash.com/photo-1515562141589-67f0d932b7f6?w=600' },
    { skuCode: 'INV-NCK-003', name: 'Sapphire Drop Pendant Necklace', description: 'Deep blue sapphire pendant on a delicate white gold chain.', category: 'necklace', primaryMetal: 'platinum', stoneTypes: ['sapphire'], stonePresence: 'prominent', primaryShape: 'teardrop', style: 'modern', complexity: 'moderate', baseCost: 950, moq: 3, leadTimeDays: 10, imageUrl: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=600' },
    { skuCode: 'INV-NCK-004', name: 'Diamond Rivière Necklace', description: 'Graduated round-brilliant diamond necklace in 18kt white gold. Over 8ct total.', category: 'necklace', primaryMetal: 'platinum', stoneTypes: ['diamond'], stonePresence: 'prominent', primaryShape: 'graduated', style: 'statement', complexity: 'intricate', baseCost: 5200, moq: 1, leadTimeDays: 21, imageUrl: 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=600' },
    { skuCode: 'INV-NCK-005', name: 'Rose Gold Lariat Necklace', description: 'Adjustable Y-shaped lariat necklace in 14kt rose gold with a petite CZ drop.', category: 'necklace', primaryMetal: 'rose_gold', stoneTypes: ['cubic_zirconia'], stonePresence: 'subtle', primaryShape: 'lariat', style: 'minimalist', complexity: 'simple', baseCost: 220, moq: 15, leadTimeDays: 5, imageUrl: 'https://images.unsplash.com/photo-1576022162028-2be161357657?w=600' },
    { skuCode: 'INV-NCK-006', name: 'Temple Gold Choker', description: 'Traditional South Indian temple-style gold choker with deity motifs and rubies.', category: 'necklace', primaryMetal: 'gold', stoneTypes: ['ruby'], stonePresence: 'moderate', primaryShape: 'choker', style: 'ethnic', complexity: 'intricate', baseCost: 2800, moq: 2, leadTimeDays: 14, imageUrl: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=600' },
    { skuCode: 'INV-NCK-007', name: 'Emerald Tennis Necklace', description: 'Oval emeralds alternating with diamond links in 18kt yellow gold.', category: 'necklace', primaryMetal: 'gold', stoneTypes: ['emerald', 'diamond'], stonePresence: 'prominent', primaryShape: 'chain', style: 'modern', complexity: 'intricate', baseCost: 3400, moq: 1, leadTimeDays: 18, imageUrl: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=600' },

    // ═══════════════ EARRINGS ═══════════════
    { skuCode: 'INV-EAR-001', name: 'Diamond Stud Earrings', description: 'Classic round brilliant-cut diamond studs in a four-prong platinum setting.', category: 'earring', primaryMetal: 'platinum', stoneTypes: ['diamond'], stonePresence: 'prominent', primaryShape: 'round', style: 'minimalist', complexity: 'simple', baseCost: 720, moq: 5, leadTimeDays: 5, imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600' },
    { skuCode: 'INV-EAR-002', name: 'Gold Jhumka Drop Earrings', description: 'Traditional Indian jhumka earrings in 22kt gold with intricate filigree work.', category: 'earring', primaryMetal: 'gold', stoneTypes: [], stonePresence: 'none', primaryShape: 'bell', style: 'ethnic', complexity: 'intricate', baseCost: 560, moq: 10, leadTimeDays: 7, imageUrl: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?w=600' },
    { skuCode: 'INV-EAR-003', name: 'Emerald Drop Chandelier Earrings', description: 'Cascading chandelier earrings with pear-shaped emeralds and diamond accents.', category: 'earring', primaryMetal: 'gold', stoneTypes: ['emerald', 'diamond'], stonePresence: 'prominent', primaryShape: 'chandelier', style: 'statement', complexity: 'intricate', baseCost: 1650, moq: 2, leadTimeDays: 14, imageUrl: 'https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?w=600' },
    { skuCode: 'INV-EAR-004', name: 'Gold Huggie Hoop Earrings', description: 'Small 14kt gold huggie hoops with pavé-set diamonds on the front face.', category: 'earring', primaryMetal: 'gold', stoneTypes: ['diamond'], stonePresence: 'subtle', primaryShape: 'hoop', style: 'modern', complexity: 'moderate', baseCost: 380, moq: 10, leadTimeDays: 5, imageUrl: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=600' },
    { skuCode: 'INV-EAR-005', name: 'Silver Threader Earrings', description: 'Minimalist sterling silver threader earrings with a delicate bar end.', category: 'earring', primaryMetal: 'silver', stoneTypes: [], stonePresence: 'none', primaryShape: 'linear', style: 'minimalist', complexity: 'simple', baseCost: 45, moq: 30, leadTimeDays: 3, imageUrl: 'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=600' },
    { skuCode: 'INV-EAR-006', name: 'Pearl & Diamond Drop Earrings', description: 'South Sea pearl drops suspended from a diamond-set bar in 18kt white gold.', category: 'earring', primaryMetal: 'platinum', stoneTypes: ['pearl', 'diamond'], stonePresence: 'prominent', primaryShape: 'teardrop', style: 'modern', complexity: 'moderate', baseCost: 920, moq: 5, leadTimeDays: 10, imageUrl: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?w=600' },
    { skuCode: 'INV-EAR-007', name: 'Rose Gold Ear Cuffs', description: 'Non-pierced rose gold ear cuffs with a twisted rope design.', category: 'earring', primaryMetal: 'rose_gold', stoneTypes: [], stonePresence: 'none', primaryShape: 'cuff', style: 'modern', complexity: 'simple', baseCost: 150, moq: 20, leadTimeDays: 5, imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600' },

    // ═══════════════ BRACELETS ═══════════════
    { skuCode: 'INV-BRC-001', name: 'Tennis Diamond Bracelet', description: 'Stunning tennis bracelet with 3 carats of diamonds set in 18kt white gold.', category: 'bracelet', primaryMetal: 'platinum', stoneTypes: ['diamond'], stonePresence: 'prominent', primaryShape: 'chain', style: 'modern', complexity: 'intricate', baseCost: 2200, moq: 2, leadTimeDays: 14, imageUrl: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600' },
    { skuCode: 'INV-BRC-002', name: 'Gold Link Chain Bracelet', description: 'Chunky gold link bracelet in a bold contemporary design.', category: 'bracelet', primaryMetal: 'gold', stoneTypes: [], stonePresence: 'none', primaryShape: 'chain', style: 'statement', complexity: 'moderate', baseCost: 480, moq: 10, leadTimeDays: 5, imageUrl: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600' },
    { skuCode: 'INV-BRC-003', name: 'Ruby & Diamond Bangle Bracelet', description: 'Hinged bangle bracelet with alternating rubies and diamonds in 18kt gold.', category: 'bracelet', primaryMetal: 'gold', stoneTypes: ['ruby', 'diamond'], stonePresence: 'prominent', primaryShape: 'bangle', style: 'vintage', complexity: 'intricate', baseCost: 1800, moq: 2, leadTimeDays: 14, imageUrl: 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=600' },
    { skuCode: 'INV-BRC-004', name: 'Silver Charm Bracelet', description: 'Sterling silver charm bracelet with 8 assorted themed charms.', category: 'bracelet', primaryMetal: 'silver', stoneTypes: [], stonePresence: 'none', primaryShape: 'chain', style: 'modern', complexity: 'moderate', baseCost: 160, moq: 15, leadTimeDays: 5, imageUrl: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600' },
    { skuCode: 'INV-BRC-005', name: 'Rose Gold Cuff Bracelet', description: 'Wide rose gold open cuff with engraved geometric patterns.', category: 'bracelet', primaryMetal: 'rose_gold', stoneTypes: [], stonePresence: 'none', primaryShape: 'cuff', style: 'modern', complexity: 'moderate', baseCost: 350, moq: 8, leadTimeDays: 7, imageUrl: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600' },
    { skuCode: 'INV-BRC-006', name: 'Pearl Multi-Strand Bracelet', description: 'Three strands of freshwater pearls with a 14kt gold toggle clasp.', category: 'bracelet', primaryMetal: 'gold', stoneTypes: ['pearl'], stonePresence: 'prominent', primaryShape: 'strand', style: 'vintage', complexity: 'moderate', baseCost: 290, moq: 10, leadTimeDays: 7, imageUrl: 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=600' },

    // ═══════════════ PENDANTS ═══════════════
    { skuCode: 'INV-PND-001', name: 'Heart-Shaped Ruby Pendant', description: 'Romantic heart-cut ruby pendant with diamond accent halo.', category: 'pendant', primaryMetal: 'gold', stoneTypes: ['ruby', 'diamond'], stonePresence: 'prominent', primaryShape: 'heart', style: 'modern', complexity: 'moderate', baseCost: 680, moq: 5, leadTimeDays: 7, imageUrl: 'https://images.unsplash.com/photo-1600721391689-2564bb8055de?w=600' },
    { skuCode: 'INV-PND-002', name: 'Diamond Solitaire Pendant', description: 'Brilliant-cut diamond solitaire pendant in a classic four-prong platinum setting.', category: 'pendant', primaryMetal: 'platinum', stoneTypes: ['diamond'], stonePresence: 'prominent', primaryShape: 'round', style: 'minimalist', complexity: 'simple', baseCost: 920, moq: 3, leadTimeDays: 7, imageUrl: 'https://images.unsplash.com/photo-1576022162028-2be161357657?w=600' },
    { skuCode: 'INV-PND-003', name: 'Emerald Art Deco Pendant', description: 'Emerald-cut emerald in a geometric Art Deco platinum setting with diamond accents.', category: 'pendant', primaryMetal: 'platinum', stoneTypes: ['emerald', 'diamond'], stonePresence: 'prominent', primaryShape: 'geometric', style: 'vintage', complexity: 'intricate', baseCost: 1350, moq: 2, leadTimeDays: 14, imageUrl: 'https://images.unsplash.com/photo-1600721391689-2564bb8055de?w=600' },
    { skuCode: 'INV-PND-004', name: 'Gold Cross Pendant', description: 'Polished 18kt gold cross pendant with subtle beveled edges.', category: 'pendant', primaryMetal: 'gold', stoneTypes: [], stonePresence: 'none', primaryShape: 'cross', style: 'modern', complexity: 'simple', baseCost: 280, moq: 10, leadTimeDays: 5, imageUrl: 'https://images.unsplash.com/photo-1576022162028-2be161357657?w=600' },
    { skuCode: 'INV-PND-005', name: 'Tanzanite Halo Pendant', description: 'Vivid tanzanite cushion pendant surrounded by a double halo of diamonds.', category: 'pendant', primaryMetal: 'gold', stoneTypes: ['tanzanite', 'diamond'], stonePresence: 'prominent', primaryShape: 'cushion', style: 'statement', complexity: 'intricate', baseCost: 1100, moq: 3, leadTimeDays: 12, imageUrl: 'https://images.unsplash.com/photo-1600721391689-2564bb8055de?w=600' },
    { skuCode: 'INV-PND-006', name: 'Coin Gold Pendant', description: 'Ancient coin replica pendant in matte-finished 22kt gold with a twisted bail.', category: 'pendant', primaryMetal: 'gold', stoneTypes: [], stonePresence: 'none', primaryShape: 'round', style: 'ethnic', complexity: 'moderate', baseCost: 520, moq: 5, leadTimeDays: 7, imageUrl: 'https://images.unsplash.com/photo-1576022162028-2be161357657?w=600' },

    // ═══════════════ BANGLES ═══════════════
    { skuCode: 'INV-BNG-001', name: 'Traditional Gold Bangle Set', description: 'Set of 4 hand-crafted 22kt gold bangles with delicate floral motifs.', category: 'bangle', primaryMetal: 'gold', stoneTypes: [], stonePresence: 'none', primaryShape: 'round', style: 'ethnic', complexity: 'intricate', baseCost: 1400, moq: 4, leadTimeDays: 10, imageUrl: 'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=600' },
    { skuCode: 'INV-BNG-002', name: 'Minimalist Silver Cuff Bangle', description: 'Clean-lined sterling silver cuff bangle with a brushed finish.', category: 'bangle', primaryMetal: 'silver', stoneTypes: [], stonePresence: 'none', primaryShape: 'cuff', style: 'minimalist', complexity: 'simple', baseCost: 180, moq: 20, leadTimeDays: 3, imageUrl: 'https://images.unsplash.com/photo-1602524816379-6e5e73a52e63?w=600' },
    { skuCode: 'INV-BNG-003', name: 'Diamond-Studded Platinum Bangle', description: 'Sleek platinum bangle with a row of pavé-set diamonds across the top.', category: 'bangle', primaryMetal: 'platinum', stoneTypes: ['diamond'], stonePresence: 'moderate', primaryShape: 'round', style: 'modern', complexity: 'moderate', baseCost: 2400, moq: 2, leadTimeDays: 14, imageUrl: 'https://images.unsplash.com/photo-1602524816379-6e5e73a52e63?w=600' },
    { skuCode: 'INV-BNG-004', name: 'Rose Gold Twisted Bangle', description: 'Double-twisted rose gold bangle with a high-polish finish.', category: 'bangle', primaryMetal: 'rose_gold', stoneTypes: [], stonePresence: 'none', primaryShape: 'twisted', style: 'modern', complexity: 'moderate', baseCost: 380, moq: 8, leadTimeDays: 7, imageUrl: 'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=600' },
    { skuCode: 'INV-BNG-005', name: 'Kundan Meenakari Bangle Set', description: 'Set of 2 handcrafted bangles with kundan stones and meenakari enamel work.', category: 'bangle', primaryMetal: 'gold', stoneTypes: ['kundan'], stonePresence: 'prominent', primaryShape: 'round', style: 'ethnic', complexity: 'intricate', baseCost: 1800, moq: 2, leadTimeDays: 14, imageUrl: 'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=600' },
    { skuCode: 'INV-BNG-006', name: 'Sapphire Eternity Bangle', description: 'Hinged bangle with princess-cut sapphires in a full eternity setting, 18kt white gold.', category: 'bangle', primaryMetal: 'platinum', stoneTypes: ['sapphire'], stonePresence: 'prominent', primaryShape: 'round', style: 'modern', complexity: 'intricate', baseCost: 2100, moq: 2, leadTimeDays: 14, imageUrl: 'https://images.unsplash.com/photo-1602524816379-6e5e73a52e63?w=600' },

    // ═══════════════ OTHER (BROOCHES, ANKLETS, TIARAS, etc.) ═══════════════
    { skuCode: 'INV-OTH-001', name: 'Diamond Butterfly Brooch', description: 'Exquisite butterfly brooch with pavé diamonds and sapphire body in 18kt gold.', category: 'other', primaryMetal: 'gold', stoneTypes: ['diamond', 'sapphire'], stonePresence: 'prominent', primaryShape: 'butterfly', style: 'statement', complexity: 'intricate', baseCost: 1600, moq: 2, leadTimeDays: 14, imageUrl: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=600' },
    { skuCode: 'INV-OTH-002', name: 'Gold Anklet with Bells', description: 'Traditional 22kt gold anklet with tiny ghungroo bells.', category: 'other', primaryMetal: 'gold', stoneTypes: [], stonePresence: 'none', primaryShape: 'chain', style: 'ethnic', complexity: 'moderate', baseCost: 320, moq: 10, leadTimeDays: 7, imageUrl: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600' },
    { skuCode: 'INV-OTH-003', name: 'Silver Toe Ring Set', description: 'Set of 5 adjustable silver toe rings with assorted design motifs.', category: 'other', primaryMetal: 'silver', stoneTypes: [], stonePresence: 'none', primaryShape: 'round', style: 'ethnic', complexity: 'simple', baseCost: 55, moq: 50, leadTimeDays: 3, imageUrl: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600' },
    { skuCode: 'INV-OTH-004', name: 'Pearl Tiara Headpiece', description: 'Bridal tiara with freshwater pearls and CZ embellishments on a silver wire frame.', category: 'other', primaryMetal: 'silver', stoneTypes: ['pearl', 'cubic_zirconia'], stonePresence: 'prominent', primaryShape: 'tiara', style: 'vintage', complexity: 'intricate', baseCost: 450, moq: 5, leadTimeDays: 10, imageUrl: 'https://images.unsplash.com/photo-1515562141589-67f0d932b7f6?w=600' },
];

/* ─── MANUFACTURER CATALOG (products from manufacturer profiles — linked via manufacturerKey) ─── */
const manufacturerItems = [
    // ═══ Rajesh Jewels products ═══
    { manufacturerKey: 'rajesh-jewels', source: 'manufacturer', name: 'Twisted Gold Band Ring', description: 'Contemporary twisted design in polished yellow gold.', category: 'ring', primaryMetal: 'gold', stoneTypes: [], baseCostMin: 350, baseCostMax: 650, moq: 20, leadTimeDays: 21, qualityTier: 'premium', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1543294001-f7cd5d7fb516?w=600' },
    { manufacturerKey: 'rajesh-jewels', source: 'manufacturer', name: 'Temple Gold Bridal Necklace', description: 'Heavy bridal necklace in 22kt gold with traditional temple design and ruby accents.', category: 'necklace', primaryMetal: 'gold', stoneTypes: ['ruby'], baseCostMin: 2800, baseCostMax: 4500, moq: 2, leadTimeDays: 28, qualityTier: 'premium', stockStatus: 'made_to_order', imageUrl: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=600' },
    { manufacturerKey: 'rajesh-jewels', source: 'manufacturer', name: 'Kundan Meenakari Earrings', description: 'Handcrafted kundan earrings with meenakari enamel work on 22kt gold base.', category: 'earring', primaryMetal: 'gold', stoneTypes: ['kundan'], baseCostMin: 580, baseCostMax: 920, moq: 10, leadTimeDays: 21, qualityTier: 'premium', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?w=600' },
    { manufacturerKey: 'rajesh-jewels', source: 'manufacturer', name: 'Traditional Rajasthani Bangle Set', description: 'Set of 6 handcrafted gold bangles with filigree and jadau stone work.', category: 'bangle', primaryMetal: 'gold', stoneTypes: ['kundan', 'ruby'], baseCostMin: 1200, baseCostMax: 2400, moq: 4, leadTimeDays: 21, qualityTier: 'premium', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=600' },
    { manufacturerKey: 'rajesh-jewels', source: 'manufacturer', name: 'Navratna Pendant', description: 'Traditional nine-gem navratna pendant set in 22kt gold with intricate detailing.', category: 'pendant', primaryMetal: 'gold', stoneTypes: ['ruby', 'emerald', 'sapphire', 'diamond', 'pearl'], baseCostMin: 1500, baseCostMax: 2800, moq: 5, leadTimeDays: 25, qualityTier: 'premium', stockStatus: 'made_to_order', imageUrl: 'https://images.unsplash.com/photo-1600721391689-2564bb8055de?w=600' },

    // ═══ Golden Craft products ═══
    { manufacturerKey: 'golden-craft', source: 'manufacturer', name: 'Minimalist Bar Pendant', description: 'Sleek horizontal bar pendant in polished 18kt gold with custom engraving option.', category: 'pendant', primaryMetal: 'gold', stoneTypes: [], baseCostMin: 180, baseCostMax: 350, moq: 25, leadTimeDays: 14, qualityTier: 'premium', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1576022162028-2be161357657?w=600' },
    { manufacturerKey: 'golden-craft', source: 'manufacturer', name: 'Rose Gold Signet Ring', description: 'Classic signet ring in 14kt rose gold with customisable top plate.', category: 'ring', primaryMetal: 'rose_gold', stoneTypes: [], baseCostMin: 280, baseCostMax: 480, moq: 15, leadTimeDays: 14, qualityTier: 'premium', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1603561596112-0a132b757442?w=600' },
    { manufacturerKey: 'golden-craft', source: 'manufacturer', name: 'Geometric Gold Earrings', description: 'Modern geometric-shaped drop earrings in 18kt yellow gold, CAD designed.', category: 'earring', primaryMetal: 'gold', stoneTypes: [], baseCostMin: 220, baseCostMax: 380, moq: 20, leadTimeDays: 10, qualityTier: 'premium', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?w=600' },
    { manufacturerKey: 'golden-craft', source: 'manufacturer', name: 'Cuban Link Bracelet', description: 'Modern Cuban link bracelet in 18kt gold with polished finish.', category: 'bracelet', primaryMetal: 'gold', stoneTypes: [], baseCostMin: 420, baseCostMax: 780, moq: 10, leadTimeDays: 14, qualityTier: 'premium', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600' },

    // ═══ Siam Gems products ═══
    { manufacturerKey: 'siam-gems', source: 'manufacturer', name: 'Ceylon Sapphire Halo Ring', description: 'Natural Ceylon blue sapphire with diamond halo in 18kt white gold. GIA certified.', category: 'ring', primaryMetal: 'platinum', stoneTypes: ['sapphire', 'diamond'], baseCostMin: 2200, baseCostMax: 4800, moq: 3, leadTimeDays: 35, qualityTier: 'luxury', stockStatus: 'made_to_order', imageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600' },
    { manufacturerKey: 'siam-gems', source: 'manufacturer', name: 'Pigeon Blood Ruby Pendant', description: 'Rare pigeon blood ruby oval cabochon pendant with diamond bail in platinum.', category: 'pendant', primaryMetal: 'platinum', stoneTypes: ['ruby', 'diamond'], baseCostMin: 3500, baseCostMax: 7200, moq: 2, leadTimeDays: 30, qualityTier: 'luxury', stockStatus: 'made_to_order', imageUrl: 'https://images.unsplash.com/photo-1600721391689-2564bb8055de?w=600' },
    { manufacturerKey: 'siam-gems', source: 'manufacturer', name: 'Emerald Chandelier Earrings', description: 'Cascading Zambian emerald and diamond chandelier earrings in 18kt gold.', category: 'earring', primaryMetal: 'gold', stoneTypes: ['emerald', 'diamond'], baseCostMin: 2800, baseCostMax: 5500, moq: 2, leadTimeDays: 28, qualityTier: 'luxury', stockStatus: 'made_to_order', imageUrl: 'https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?w=600' },
    { manufacturerKey: 'siam-gems', source: 'manufacturer', name: 'Multi-Gem Tennis Necklace', description: 'Alternating sapphire, ruby and emerald ovals with diamond links in 18kt gold.', category: 'necklace', primaryMetal: 'gold', stoneTypes: ['sapphire', 'ruby', 'emerald', 'diamond'], baseCostMin: 8500, baseCostMax: 15000, moq: 1, leadTimeDays: 35, qualityTier: 'luxury', stockStatus: 'made_to_order', imageUrl: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=600' },

    // ═══ Silver Line products ═══
    { manufacturerKey: 'silver-line', source: 'manufacturer', name: 'CZ Eternity Band', description: 'Full eternity band with channel-set cubic zirconia stones in 925 silver.', category: 'ring', primaryMetal: 'silver', stoneTypes: ['cubic_zirconia'], baseCostMin: 12, baseCostMax: 22, moq: 100, leadTimeDays: 10, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1589674781759-c21c37956a44?w=600' },
    { manufacturerKey: 'silver-line', source: 'manufacturer', name: 'Silver Charm Bracelet', description: 'Sterling silver charm bracelet with 8 assorted themed charms.', category: 'bracelet', primaryMetal: 'silver', stoneTypes: [], baseCostMin: 15, baseCostMax: 30, moq: 50, leadTimeDays: 7, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600' },
    { manufacturerKey: 'silver-line', source: 'manufacturer', name: 'Pearl Stud Earrings', description: 'Simple freshwater pearl stud earrings with sterling silver posts.', category: 'earring', primaryMetal: 'silver', stoneTypes: ['pearl'], baseCostMin: 4, baseCostMax: 10, moq: 200, leadTimeDays: 7, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=600' },
    { manufacturerKey: 'silver-line', source: 'manufacturer', name: 'Textured Silver Kada Bangle', description: 'Heavy hand-finished silver kada bangle with antique oxidised finish.', category: 'bangle', primaryMetal: 'silver', stoneTypes: [], baseCostMin: 18, baseCostMax: 35, moq: 50, leadTimeDays: 10, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=600' },
    { manufacturerKey: 'silver-line', source: 'manufacturer', name: 'Hair Pin Pearl Set', description: 'Set of 3 hair pins with faux pearl clusters on silver wire.', category: 'other', primaryMetal: 'silver', stoneTypes: ['pearl'], baseCostMin: 4, baseCostMax: 10, moq: 200, leadTimeDays: 7, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1515562141589-67f0d932b7f6?w=600' },
    { manufacturerKey: 'silver-line', source: 'manufacturer', name: 'Resin Inlay Bangle', description: 'Artisan bangle with colourful resin inlay and silver accents.', category: 'bangle', primaryMetal: 'silver', stoneTypes: [], baseCostMin: 8, baseCostMax: 18, moq: 100, leadTimeDays: 10, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=600' },
];

/* ─── ALIBABA CATALOG (sourced from Alibaba marketplace, no manufacturer link) ─── */
const alibabaItems = [
    // ═══════════════ RINGS ═══════════════
    { source: 'alibaba', name: 'Moissanite Halo Ring', description: 'Brilliant moissanite centre with a micro-pavé halo in sterling silver.', category: 'ring', primaryMetal: 'silver', stoneTypes: ['moissanite'], baseCostMin: 25, baseCostMax: 55, moq: 50, leadTimeDays: 18, qualityTier: 'premium', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600' },
    { source: 'alibaba', name: 'Titanium Men\'s Band', description: 'Brushed titanium men\'s wedding band with a comfort-fit interior.', category: 'ring', primaryMetal: 'silver', stoneTypes: [], baseCostMin: 8, baseCostMax: 18, moq: 200, leadTimeDays: 10, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1543294001-f7cd5d7fb516?w=600' },
    { source: 'alibaba', name: 'Vintage Filigree Ring', description: 'Ornate filigree ring with oxidised silver finish and tiny garnet accent.', category: 'ring', primaryMetal: 'silver', stoneTypes: ['garnet'], baseCostMin: 10, baseCostMax: 20, moq: 100, leadTimeDays: 14, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1603561596112-0a132b757442?w=600' },

    // ═══════════════ NECKLACES ═══════════════
    { source: 'alibaba', name: 'Herringbone Chain Necklace', description: 'Flat herringbone chain in 18K gold plated stainless steel.', category: 'necklace', primaryMetal: 'gold', stoneTypes: [], baseCostMin: 12, baseCostMax: 28, moq: 100, leadTimeDays: 12, qualityTier: 'premium', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600' },
    { source: 'alibaba', name: 'Birthstone Necklace Collection', description: 'Customisable birthstone pendant on a delicate cable chain.', category: 'necklace', primaryMetal: 'gold', stoneTypes: ['cubic_zirconia'], baseCostMin: 6, baseCostMax: 14, moq: 200, leadTimeDays: 10, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1576022162028-2be161357657?w=600' },
    { source: 'alibaba', name: 'Layered Snake Chain Set', description: 'Set of 3 snake chain necklaces at different lengths.', category: 'necklace', primaryMetal: 'gold', stoneTypes: [], baseCostMin: 15, baseCostMax: 30, moq: 50, leadTimeDays: 14, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600' },

    // ═══════════════ EARRINGS ═══════════════
    { source: 'alibaba', name: 'Geometric Drop Earrings', description: 'Modern geometric-shaped drop earrings in gold plated metal.', category: 'earring', primaryMetal: 'gold', stoneTypes: [], baseCostMin: 6, baseCostMax: 14, moq: 100, leadTimeDays: 14, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?w=600' },
    { source: 'alibaba', name: 'Tassel Drop Earrings', description: 'Long chain tassel earrings in mixed metals with a bohemian vibe.', category: 'earring', primaryMetal: 'gold', stoneTypes: [], baseCostMin: 5, baseCostMax: 12, moq: 100, leadTimeDays: 12, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600' },
    { source: 'alibaba', name: 'CZ Huggie Hoops', description: 'Cubic zirconia-encrusted huggie hoop earrings in gold vermeil.', category: 'earring', primaryMetal: 'gold', stoneTypes: ['cubic_zirconia'], baseCostMin: 8, baseCostMax: 18, moq: 100, leadTimeDays: 14, qualityTier: 'premium', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=600' },
    { source: 'alibaba', name: 'Enamel Flower Studs', description: 'Hand-painted enamel flower stud earrings in assorted colours.', category: 'earring', primaryMetal: 'gold', stoneTypes: [], baseCostMin: 3, baseCostMax: 8, moq: 200, leadTimeDays: 10, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?w=600' },

    // ═══════════════ BRACELETS ═══════════════
    { source: 'alibaba', name: 'Beaded Charm Bracelet', description: 'Handmade beaded bracelet with gold-plated charms.', category: 'bracelet', primaryMetal: 'gold', stoneTypes: [], baseCostMin: 5, baseCostMax: 12, moq: 100, leadTimeDays: 14, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=600' },
    { source: 'alibaba', name: 'Evil Eye Charm Bracelet', description: 'Delicate chain bracelet with enamel evil eye charm and CZ accents.', category: 'bracelet', primaryMetal: 'gold', stoneTypes: ['cubic_zirconia'], baseCostMin: 4, baseCostMax: 10, moq: 200, leadTimeDays: 10, qualityTier: 'standard', stockStatus: 'low_stock', imageUrl: 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=600' },

    // ═══════════════ PENDANTS ═══════════════
    { source: 'alibaba', name: 'Initial Letter Pendant', description: 'Personalised initial letter pendant in 18K gold plating.', category: 'pendant', primaryMetal: 'gold', stoneTypes: [], baseCostMin: 5, baseCostMax: 12, moq: 200, leadTimeDays: 10, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1576022162028-2be161357657?w=600' },
    { source: 'alibaba', name: 'CZ Star Pendant', description: 'Star-shaped pendant encrusted with cubic zirconia on silver chain.', category: 'pendant', primaryMetal: 'silver', stoneTypes: ['cubic_zirconia'], baseCostMin: 6, baseCostMax: 14, moq: 100, leadTimeDays: 12, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1576022162028-2be161357657?w=600' },

    // ═══════════════ BANGLES ═══════════════
    { source: 'alibaba', name: 'Stacking Thin Bangle Set', description: 'Set of 6 thin stackable bangles in mixed metals.', category: 'bangle', primaryMetal: 'gold', stoneTypes: [], baseCostMin: 10, baseCostMax: 20, moq: 50, leadTimeDays: 14, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=600' },
    { source: 'alibaba', name: 'CZ Pave Bangle', description: 'Silver-tone bangle fully covered in cubic zirconia pavé setting.', category: 'bangle', primaryMetal: 'silver', stoneTypes: ['cubic_zirconia'], baseCostMin: 12, baseCostMax: 25, moq: 100, leadTimeDays: 14, qualityTier: 'premium', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1602524816379-6e5e73a52e63?w=600' },

    // ═══════════════ OTHER ═══════════════
    { source: 'alibaba', name: 'Anklet Chain with CZ', description: 'Dainty gold-plated anklet chain with cubic zirconia charms.', category: 'other', primaryMetal: 'gold', stoneTypes: ['cubic_zirconia'], baseCostMin: 4, baseCostMax: 10, moq: 200, leadTimeDays: 10, qualityTier: 'standard', stockStatus: 'in_stock', imageUrl: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600' },
];

async function main() {
    console.log('🌱 Seeding demo data ...\n');

    // Clear existing data to ensure clean state with new embeddings
    await prisma.$executeRawUnsafe('DELETE FROM quotation_items');
    await prisma.$executeRawUnsafe('DELETE FROM quotations');
    await prisma.$executeRawUnsafe('DELETE FROM cart_items');
    await prisma.$executeRawUnsafe('DELETE FROM intended_carts');
    await prisma.$executeRawUnsafe('DELETE FROM recommendation_items');
    await prisma.$executeRawUnsafe('DELETE FROM recommendation_sets');
    await prisma.$executeRawUnsafe('DELETE FROM image_embeddings');
    await prisma.$executeRawUnsafe('DELETE FROM image_sessions');
    await prisma.$executeRawUnsafe('DELETE FROM inventory_skus');
    await prisma.$executeRawUnsafe('DELETE FROM manufacturer_catalog');
    await prisma.$executeRawUnsafe('DELETE FROM manufacturers');
    console.log('🧹 Cleared existing data.\n');

    /* ── 1. MANUFACTURERS (profiles first, then their products) ── */
    console.log('📦 Creating manufacturer profiles...');
    const manufacturerIdMap: Record<string, string> = {};

    for (const mfr of manufacturers) {
        const created = await prisma.manufacturer.create({
            data: {
                companyName: mfr.companyName,
                contactPerson: mfr.contactPerson,
                email: mfr.email,
                phone: mfr.phone,
                address: mfr.address,
                city: mfr.city,
                country: mfr.country,
                website: mfr.website,
                description: mfr.description,
                categories: mfr.categories,
                specializations: mfr.specializations,
                qualityTier: mfr.qualityTier,
                minOrderValue: mfr.minOrderValue,
                avgLeadTimeDays: mfr.avgLeadTimeDays,
                isVerified: mfr.isVerified,
                isActive: true,
            },
        });
        manufacturerIdMap[mfr.key] = created.id;
        console.log(`  ✅ manufacturer: ${mfr.companyName} (${mfr.qualityTier}, ${mfr.city})`);
    }

    /* ── 2. INVENTORY SKUs (our own products) ── */
    console.log('\n📦 Creating own inventory products...');
    for (const item of inventoryItems) {
        // MUST match HfVisionService.createSeedString(): demo-category-metal
        const embeddingVec = seededEmbedding(`demo-${item.category}-${item.primaryMetal}`);
        const vecStr = `[${embeddingVec.join(',')}]`;

        await prisma.$executeRawUnsafe(
            `INSERT INTO inventory_skus
                (id, sku_code, name, description, category, primary_metal, stone_types, stone_presence, primary_shape, style, complexity, base_cost, moq, lead_time_days, available_quantity, image_url, embedding, is_active, created_at, updated_at)
             VALUES
                (gen_random_uuid(), $1, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10, $11, $12, $13, 100, $14, $15::vector, true, now(), now())`,
            item.skuCode,
            item.name,
            item.description,
            item.category,
            item.primaryMetal,
            item.stoneTypes,
            item.stonePresence,
            item.primaryShape,
            item.style,
            item.complexity,
            item.baseCost,
            item.moq,
            item.leadTimeDays,
            item.imageUrl,
            vecStr,
        );
        console.log(`  ✅ inventory: ${item.name}`);
    }

    /* ── 3. MANUFACTURER CATALOG (products linked to manufacturer profiles) ── */
    console.log('\n📦 Creating manufacturer products (linked to profiles)...');
    for (const item of manufacturerItems) {
        const manufacturerId = manufacturerIdMap[item.manufacturerKey];
        if (!manufacturerId) {
            console.error(`  ❌ Unknown manufacturer key: ${item.manufacturerKey}`);
            continue;
        }

        // Embedding key: demo-category-metal
        const embeddingVec = seededEmbedding(`demo-${item.category}-${item.primaryMetal}`);
        const vecStr = `[${embeddingVec.join(',')}]`;

        await prisma.$executeRawUnsafe(
            `INSERT INTO manufacturer_catalog
                (id, manufacturer_id, source, name, description, category, primary_metal, stone_types, base_cost_min, base_cost_max, moq, lead_time_days, image_url, quality_tier, stock_status, embedding, is_verified, created_at, updated_at)
             VALUES
                (gen_random_uuid(), $1::uuid, $2, $3, $4, $5, $6, $7::text[], $8, $9, $10, $11, $12, $13, $14, $15::vector, true, now(), now())`,
            manufacturerId,
            item.source,
            item.name,
            item.description,
            item.category,
            item.primaryMetal,
            item.stoneTypes,
            item.baseCostMin,
            item.baseCostMax,
            item.moq,
            item.leadTimeDays,
            item.imageUrl,
            item.qualityTier,
            item.stockStatus,
            vecStr,
        );
        console.log(`  ✅ manufacturer product: ${item.name} → ${item.manufacturerKey}`);
    }

    /* ── 4. ALIBABA CATALOG (no manufacturer link) ── */
    console.log('\n📦 Creating alibaba products...');
    for (const item of alibabaItems) {
        const embeddingVec = seededEmbedding(`demo-${item.category}-${item.primaryMetal}`);
        const vecStr = `[${embeddingVec.join(',')}]`;

        await prisma.$executeRawUnsafe(
            `INSERT INTO manufacturer_catalog
                (id, source, name, description, category, primary_metal, stone_types, base_cost_min, base_cost_max, moq, lead_time_days, image_url, quality_tier, stock_status, embedding, is_verified, created_at, updated_at)
             VALUES
                (gen_random_uuid(), $1, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10, $11, $12, $13, $14::vector, true, now(), now())`,
            item.source,
            item.name,
            item.description,
            item.category,
            item.primaryMetal,
            item.stoneTypes,
            item.baseCostMin,
            item.baseCostMax,
            item.moq,
            item.leadTimeDays,
            item.imageUrl,
            item.qualityTier,
            item.stockStatus,
            vecStr,
        );
        console.log(`  ✅ alibaba: ${item.name}`);
    }

    console.log(`\n✨ Done! Seeded:`);
    console.log(`   • ${manufacturers.length} manufacturer profiles`);
    console.log(`   • ${inventoryItems.length} own inventory products`);
    console.log(`   • ${manufacturerItems.length} manufacturer products (linked to profiles)`);
    console.log(`   • ${alibabaItems.length} alibaba products`);
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
