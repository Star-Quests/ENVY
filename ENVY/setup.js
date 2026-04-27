const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('\x1b[36m%s\x1b[0m', '╔════════════════════════════════════════════╗');
console.log('\x1b[36m%s\x1b[0m', '║        ENVY - Secure Setup Assistant        ║');
console.log('\x1b[36m%s\x1b[0m', '╚════════════════════════════════════════════╝\n');

console.log('\x1b[33m%s\x1b[0m', '⚠️  Your credentials will NEVER leave this computer.');
console.log('\x1b[33m%s\x1b[0m', '⚠️  They will be saved locally in .env file.\n');

const questions = [
    {
        name: 'SUPABASE_URL',
        message: 'Enter your Supabase Project URL:',
        validate: (input) => input.includes('supabase.co')
    },
    {
        name: 'SUPABASE_ANON_KEY',
        message: 'Enter your Supabase Anon Key:',
        validate: (input) => input.startsWith('eyJ')
    },
    {
        name: 'SUPABASE_SERVICE_ROLE',
        message: 'Enter your Supabase Service Role Key:',
        validate: (input) => input.startsWith('eyJ')
    },
    {
        name: 'CLOUDINARY_CLOUD_NAME',
        message: 'Enter your Cloudinary Cloud Name:'
    },
    {
        name: 'CLOUDINARY_API_KEY',
        message: 'Enter your Cloudinary API Key:'
    },
    {
        name: 'CLOUDINARY_API_SECRET',
        message: 'Enter your Cloudinary API Secret:'
    },
    {
        name: 'JWT_SECRET',
        message: 'Enter a secure JWT Secret (or press Enter to generate one):',
        default: () => require('crypto').randomBytes(32).toString('hex')
    }
];

const envContent = [];

async function askQuestions() {
    for (const q of questions) {
        const answer = await new Promise((resolve) => {
            rl.question(`\x1b[32m${q.message}\x1b[0m `, (input) => {
                if (q.validate && !q.validate(input)) {
                    console.log('\x1b[31mInvalid format. Please try again.\x1b[0m');
                    resolve(askQuestions());
                } else {
                    resolve(input || (q.default ? q.default() : ''));
                }
            });
        });
        envContent.push(`${q.name}=${answer}`);
    }
    
    envContent.push(`PORT=3000`);
    envContent.push(`NODE_ENV=development`);
    envContent.push(`BYBIT_API_URL=https://api.bybit.com`);
    envContent.push(`COINGECKO_API_URL=https://api.coingecko.com/api/v3`);
    
    fs.writeFileSync(path.join(__dirname, '.env'), envContent.join('\n'));
    
    console.log('\n\x1b[32m%s\x1b[0m', '✅ .env file created successfully!');
    console.log('\x1b[36m%s\x1b[0m', '\nNext steps:');
    console.log('1. Run: npm install');
    console.log('2. Set up Supabase database using schema.sql');
    console.log('3. Run: npm run dev');
    console.log('4. Open http://localhost:3000\n');
    
    rl.close();
}

askQuestions();