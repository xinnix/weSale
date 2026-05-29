const dotenv = require('dotenv');
const path = require('path');

// 加载根 .env，使 NEXT_PUBLIC_* 变量在构建时可用
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
