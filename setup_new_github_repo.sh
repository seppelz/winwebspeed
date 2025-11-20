#!/bin/bash
# Script to set up WinWebSpeed as a new GitHub repository

echo "Setting up WinWebSpeed as a new GitHub repository..."
echo ""
echo "Please create the repository on GitHub first:"
echo "1. Go to https://github.com/new"
echo "2. Repository name: winwebspeed"
echo "3. Description: Ultra-lightweight native Windows network and system monitor"
echo "4. Choose Public or Private"
echo "5. DO NOT initialize with README, .gitignore, or license"
echo "6. Click 'Create repository'"
echo ""
read -p "Press Enter after you've created the repository on GitHub..."

# Update remote to new repository
echo ""
echo "Updating remote to new repository..."
git remote set-url origin https://github.com/seppelz/winwebspeed.git

# Verify remote
echo ""
echo "Current remote configuration:"
git remote -v

# Push to new repository
echo ""
echo "Pushing code to new repository..."
git push -u origin main

echo ""
echo "Done! Your WinWebSpeed project is now on GitHub at:"
echo "https://github.com/seppelz/winwebspeed"

