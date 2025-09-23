import tailwindcss from "@tailwindcss/postcss";

const isVitest = Boolean(process.env.VITEST);

const config = {
  plugins: isVitest ? [tailwindcss()] : ["@tailwindcss/postcss"],
};

export default config;
