#!/bin/bash

# Deploy to Vercel with AI analyzer
echo "🚀 Deploying Groq AI Chat Analyzer to Vercel..."
echo ""

# Check if GROQ_API_KEY exists in .env
if ! grep -q "GROQ_API_KEY=" .env; then
  echo "❌ Error: GROQ_API_KEY not found in .env file"
  echo "Please add: GROQ_API_KEY=<your-groq-api-key>"
  exit 1
fi

GROQ_KEY=$(grep "GROQ_API_KEY=" .env | cut -d '=' -f2)

if [ -z "$GROQ_KEY" ]; then
  echo "❌ Error: GROQ_API_KEY is empty in .env"
  exit 1
fi

echo "✅ Found GROQ_API_KEY in .env"
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
  echo "📦 Installing Vercel CLI..."
  npm install -g vercel
fi

# Set environment variable in Vercel
echo "⚙️  Setting GROQ_API_KEY in Vercel..."
vercel env add GROQ_API_KEY production << EOF
$GROQ_KEY
EOF

vercel env add GROQ_API_KEY preview << EOF
$GROQ_KEY
EOF

echo ""
echo "🚢 Deploying to production..."
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Next steps:"
echo "1. Test on Facebook Messenger: Send '@áo thun đen M'"
echo "2. Check logs: vercel logs --prod"
echo "3. Look for: [AI Parse] and [Groq Analysis] messages"
echo ""
echo "📖 Full guide: docs/GROQ_AI_DEPLOYMENT.md"
