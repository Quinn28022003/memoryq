#!/bin/bash
# Quick deploy script

echo "🚀 Deploying to production..."
echo ""

# Check git status
if [[ -n $(git status -s) ]]; then
  echo "📝 Uncommitted changes found. Committing..."
  git add .
  git commit -m "fix: Improve search accuracy and webhook message format

  - Fix regex parser to capture full query text
  - Improve Groq JSON parser to extract JSON from explanatory text
  - Add admin client fallback for CLI scripts
  - Use Facebook generic template for cleaner message cards
  - Improve size filter to handle products without size data
  - Add scoring bonus for exact size/color matches
  
  Test results: All 4 test cases pass
  See docs/TEST_RESULTS.md for details
  "
fi

echo "✅ Code committed"
echo ""

# Check if GROQ_API_KEY is in Vercel
echo "⚙️  Checking GROQ_API_KEY in Vercel..."
if ! vercel env ls | grep -q "GROQ_API_KEY"; then
  echo "❌ GROQ_API_KEY not found in Vercel"
  echo ""
  echo "Please add it:"
  echo "  vercel env add GROQ_API_KEY production"
  echo "  Paste the value from your local .env when prompted."
  echo ""
  read -p "Press Enter after adding the key..."
fi

echo ""
echo "🚢 Pushing to Git..."
git push

echo ""
echo "⏳ Waiting for Vercel to deploy..."
echo "   (This will auto-deploy from Git push)"
echo ""
echo "✅ Deployment triggered!"
echo ""
echo "📊 Next steps:"
echo "  1. Check deployment status: https://vercel.com/dashboard"
echo "  2. Test on Facebook Messenger: Send '@áo khoác gió nike XL'"
echo "  3. Monitor logs: vercel logs --prod | grep 'AI Parse'"
echo ""
echo "📖 Full test results: docs/TEST_RESULTS.md"
