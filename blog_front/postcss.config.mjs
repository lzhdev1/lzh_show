// Tailwind CSS v4 PostCSS 插件（webpack 模式必需）
// 说明：dev 使用 webpack（热更新需 WATCHPACK_POLLING），Turbopack 模式下
//       Next 16 通过 @tailwindcss/turbopack 自动集成，此配置仍可共用。
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
