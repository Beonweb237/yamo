#!/bin/bash
# Clean old dist assets and deploy fresh build
echo "=== Cleaning old assets ==="
rm -rf /home/ubuntu/miamexpress/dist/assets/*
rm -f /home/ubuntu/miamexpress/dist/index.html
echo "=== Old assets removed ==="
echo "=== Reloading nginx ==="
sudo systemctl reload nginx
echo "=== Done ==="
