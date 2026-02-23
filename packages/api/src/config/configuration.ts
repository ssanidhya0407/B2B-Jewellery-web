export default () => ({
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    database: {
        url: process.env.DATABASE_URL,
    },

    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },

    hf: {
        apiToken: process.env.HF_API_TOKEN,
    },

    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    },

    s3: {
        endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
        accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
        bucketName: process.env.S3_BUCKET_NAME || 'jewellery-images',
        region: process.env.S3_REGION || 'us-east-1',
    },

    frontendUrls: {
        web: process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000',
    },
});
