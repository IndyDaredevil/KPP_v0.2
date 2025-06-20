const fs = require('fs');
const path = require('path');

/**
 * Environment setup script for frontend development
 * Ensures .env file exists by copying from .env.example if needed
 */

const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

function setupEnvironment() {
  try {
    // Check if .env already exists
    if (fs.existsSync(envPath)) {
      console.log('✅ Frontend .env file already exists');
      return;
    }

    // Check if .env.example exists
    if (!fs.existsSync(envExamplePath)) {
      console.error('❌ .env.example file not found in frontend directory');
      process.exit(1);
    }

    // Copy .env.example to .env
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Created frontend/.env from .env.example');
    console.log('💡 You can now modify frontend/.env with your local development settings');
    
  } catch (error) {
    console.error('❌ Error setting up environment:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupEnvironment();