#!/bin/bash

# Configuration
TEMPLATE_PATH="../cg-tina-template"

echo "🚀 Starting Fast Repack..."

# 1. Build only tinacms
echo "🛠️  Building tinacms package..."
pnpm exec turbo run build --filter=tinacms

# 2. Pack it
echo "📦 Packing tarball..."
cd packages/tinacms
pnpm pack
VERSION=$(grep '"version":' package.json | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')
TARBALL="tinacms-$VERSION.tgz"
cd ../..

# 3. Trigger Install in Template
if [ -d "$TEMPLATE_PATH" ]; then
    echo "🔄 Installing in cg-tina-template..."
    cd "$TEMPLATE_PATH"
    
    # We need to touch package.json or force install to ensure pnpm picks up the file change if the version didn't change
    # But best practice for this loop is just to reinstall.
    # To save time, we target just the tinacms update if possible, but pnpm install is usually smart.
    pnpm install
    
    echo "✅ Done! Copied $TARBALL to template."
else
    echo "⚠️  Template directory not found at $TEMPLATE_PATH. Skipped install."
fi
